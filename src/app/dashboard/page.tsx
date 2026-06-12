"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Badge, { statusToBadgeVariant } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import {
  Users, FolderOpen, Clock, CreditCard, Plus, ArrowUpRight,
  TrendingUp, CheckCircle2, AlertCircle, Zap, Calendar,
} from "lucide-react";
import type { Project, Activity, Client } from "@/types";

function StatCard({
  label, value, icon: Icon, change, color,
}: {
  label: string; value: string | number; icon: React.ElementType; change?: string; color: string;
}) {
  return (
    <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-5 hover:border-[#2a2a38] transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
        {change && (
          <span className="flex items-center gap-1 text-xs text-[#34d399] font-medium">
            <TrendingUp size={12} />
            {change}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-[#f1f1f5] mb-1">{value}</p>
      <p className="text-xs text-[#6b6b85]">{label}</p>
    </div>
  );
}

const statusOptions = [
  "Project Created", "Planning", "Designing", "Client Review",
  "Revision Requested", "Final Delivery", "Completed", "Archived",
];

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    title: "", description: "", status: "Planning", priority: "Medium",
    clientId: "", dueDate: "", tags: "",
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;

    const projectsQ = query(
      collection(db, "projects"),
      where("designerId", "==", user.uid)
    );
    const unsubProjects = onSnapshot(projectsQ, (snap) => {
      const fetchedProjects = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      const sortedProjects = fetchedProjects.sort((a, b) => {
        const aTime = (a.updatedAt as any)?.seconds || ((a.createdAt as any)?.seconds || 0);
        const bTime = (b.updatedAt as any)?.seconds || ((b.createdAt as any)?.seconds || 0);
        return bTime - aTime;
      });
      setProjects(sortedProjects.slice(0, 20));
    });

    const clientsQ = query(collection(db, "clients"), where("designerId", "==", user.uid));
    const unsubClients = onSnapshot(clientsQ, (snap) => {
      setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client)));
    });

    const activitiesQ = query(
      collection(db, "activities"),
      where("projectId", "in", ["placeholder"]),
      orderBy("timestamp", "desc"),
      limit(10)
    );
    // Activities will be fetched per-project after we have projects
    void activitiesQ;

    return () => {
      unsubProjects();
      unsubClients();
    };
  }, [user]);

  const activeProjects = projects.filter((p) =>
    !["Completed", "Archived"].includes(p.status)
  );
  const pendingReviews = projects.filter((p) => p.status === "Client Review").length;

  const handleCreateProject = async () => {
    if (!user || !newProjectForm.title || !newProjectForm.clientId) return;
    setCreating(true);
    try {
      await addDoc(collection(db, "projects"), {
        designerId: user.uid,
        clientId: newProjectForm.clientId,
        title: newProjectForm.title,
        description: newProjectForm.description,
        status: newProjectForm.status,
        priority: newProjectForm.priority,
        dueDate: newProjectForm.dueDate ? Timestamp.fromDate(new Date(newProjectForm.dueDate)) : null,
        tags: newProjectForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        milestones: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ type: "success", title: "Project created!", message: newProjectForm.title });
      setShowNewProject(false);
      setNewProjectForm({ title: "", description: "", status: "Planning", priority: "Medium", clientId: "", dueDate: "", tags: "" });
    } catch {
      toast({ type: "error", title: "Failed to create project" });
    } finally {
      setCreating(false);
    }
  };

  const activityIcons: Record<string, React.ReactNode> = {
    UPLOADED_FILE: <Zap size={14} className="text-[#7c6af7]" />,
    APPROVED_DESIGN: <CheckCircle2 size={14} className="text-[#34d399]" />,
    REQUESTED_CHANGES: <AlertCircle size={14} className="text-[#f87171]" />,
    LEFT_COMMENT: <ArrowUpRight size={14} className="text-[#60a5fa]" />,
  };

  return (
    <DashboardLayout title="Dashboard" onNewProject={() => setShowNewProject(true)}>
      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#f1f1f5]">
          Good evening, {user?.displayName?.split(" ")[0] || "Designer"} 👋
        </h2>
        <p className="text-[#6b6b85] mt-1 text-sm">Here&apos;s what&apos;s happening across your projects.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Clients"
          value={clients.length}
          icon={Users}
          color="bg-[#7c6af7]/15 text-[#7c6af7]"
          change="+2 this month"
        />
        <StatCard
          label="Active Projects"
          value={activeProjects.length}
          icon={FolderOpen}
          color="bg-[#38bdf8]/15 text-[#38bdf8]"
        />
        <StatCard
          label="Pending Reviews"
          value={pendingReviews}
          icon={Clock}
          color="bg-[#fbbf24]/15 text-[#fbbf24]"
        />
        <StatCard
          label="Revenue (Month)"
          value="₹0"
          icon={CreditCard}
          color="bg-[#34d399]/15 text-[#34d399]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2 bg-[#111118] border border-[#1e1e2a] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2a]">
            <h3 className="text-sm font-semibold text-[#f1f1f5]">Recent Projects</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/projects")}
              icon={<ArrowUpRight size={13} />}
            >
              View all
            </Button>
          </div>
          <div className="divide-y divide-[#1e1e2a]">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-[#1a1a24] border border-[#2a2a38] flex items-center justify-center mb-4">
                  <FolderOpen size={20} className="text-[#6b6b85]" />
                </div>
                <p className="text-sm font-medium text-[#a0a0b8] mb-1">No projects yet</p>
                <p className="text-xs text-[#6b6b85] mb-4">Create your first project to get started</p>
                <Button variant="primary" size="sm" onClick={() => setShowNewProject(true)} icon={<Plus size={14} />}>
                  New Project
                </Button>
              </div>
            ) : (
              projects.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#1a1a24]/50 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c6af7]/20 to-[#f472b6]/20 border border-[#2a2a38] flex items-center justify-center flex-shrink-0">
                    <FolderOpen size={14} className="text-[#7c6af7]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#f1f1f5] truncate">{project.title}</p>
                    <p className="text-xs text-[#6b6b85]">
                      {project.dueDate instanceof Timestamp
                        ? `Due ${new Date(project.dueDate.toDate()).toLocaleDateString()}`
                        : "No due date"}
                    </p>
                  </div>
                  <Badge variant={statusToBadgeVariant(project.status)} dot>
                    {project.status}
                  </Badge>
                  <ArrowUpRight size={14} className="text-[#6b6b85] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar: Clients + Activity */}
        <div className="space-y-6">
          {/* Clients */}
          <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2a]">
              <h3 className="text-sm font-semibold text-[#f1f1f5]">Clients</h3>
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/clients")} icon={<ArrowUpRight size={13} />}>
                Manage
              </Button>
            </div>
            <div className="divide-y divide-[#1e1e2a]">
              {clients.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-[#6b6b85]">No clients yet</p>
                </div>
              ) : (
                clients.slice(0, 4).map((client) => (
                  <div key={client.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#1a1a24]/50 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#38bdf8]/30 to-[#7c6af7]/30 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {client.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#f1f1f5] truncate">{client.name}</p>
                      <p className="text-[10px] text-[#6b6b85] truncate">{client.companyName || client.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[#f1f1f5] mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start"
                icon={<Plus size={14} />}
                onClick={() => setShowNewProject(true)}
                id="quick-new-project"
              >
                New Project
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start"
                icon={<Users size={14} />}
                onClick={() => router.push("/dashboard/clients")}
                id="quick-add-client"
              >
                Add Client
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start"
                icon={<Calendar size={14} />}
                onClick={() => router.push("/dashboard/payments")}
                id="quick-create-invoice"
              >
                Create Invoice
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      <Modal
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        title="Create New Project"
        size="md"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setShowNewProject(false)}>Cancel</Button>
            <Button variant="primary" size="md" loading={creating} onClick={handleCreateProject} id="create-project-confirm">
              Create Project
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Project Title"
            placeholder="e.g. Brand Identity for Acme Corp"
            value={newProjectForm.title}
            onChange={(e) => setNewProjectForm((p) => ({ ...p, title: e.target.value }))}
            id="project-title"
          />

          {/* Client selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#a0a0b8]">Client</label>
            <select
              value={newProjectForm.clientId}
              onChange={(e) => setNewProjectForm((p) => ({ ...p, clientId: e.target.value }))}
              className="w-full h-10 rounded-lg bg-[#111118] border border-[#2a2a38] text-[#f1f1f5] text-sm px-3 outline-none focus:border-[#7c6af7] transition-colors"
              id="project-client"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {clients.length === 0 && (
              <p className="text-xs text-[#fbbf24]">No clients yet. <button className="underline" onClick={() => { setShowNewProject(false); router.push("/dashboard/clients"); }}>Add a client first.</button></p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#a0a0b8]">Status</label>
              <select
                value={newProjectForm.status}
                onChange={(e) => setNewProjectForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full h-10 rounded-lg bg-[#111118] border border-[#2a2a38] text-[#f1f1f5] text-sm px-3 outline-none focus:border-[#7c6af7] transition-colors"
                id="project-status"
              >
                {statusOptions.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#a0a0b8]">Priority</label>
              <select
                value={newProjectForm.priority}
                onChange={(e) => setNewProjectForm((p) => ({ ...p, priority: e.target.value }))}
                className="w-full h-10 rounded-lg bg-[#111118] border border-[#2a2a38] text-[#f1f1f5] text-sm px-3 outline-none focus:border-[#7c6af7] transition-colors"
                id="project-priority"
              >
                {["Low", "Medium", "High", "Urgent"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <Input
            label="Due Date"
            type="date"
            value={newProjectForm.dueDate}
            onChange={(e) => setNewProjectForm((p) => ({ ...p, dueDate: e.target.value }))}
            id="project-due-date"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#a0a0b8]">Description</label>
            <textarea
              value={newProjectForm.description}
              onChange={(e) => setNewProjectForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Brief description of what this project involves..."
              rows={3}
              className="w-full rounded-lg bg-[#111118] border border-[#2a2a38] text-[#f1f1f5] placeholder-[#6b6b85] text-sm p-3 outline-none focus:border-[#7c6af7] transition-colors resize-none"
              id="project-description"
            />
          </div>

          <Input
            label="Tags (comma separated)"
            placeholder="branding, logo, social media"
            value={newProjectForm.tags}
            onChange={(e) => setNewProjectForm((p) => ({ ...p, tags: e.target.value }))}
            id="project-tags"
          />
        </div>
      </Modal>
    </DashboardLayout>
  );
}
