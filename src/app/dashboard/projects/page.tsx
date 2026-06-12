"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, doc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Badge, { statusToBadgeVariant } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { FolderOpen, Calendar, Clock, Plus, Users, ArrowUpRight, Trash2 } from "lucide-react";
import type { Project, Client } from "@/types";

export default function ProjectsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<(Project & { clientName?: string })[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("All");
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDeleteProject = async (projectId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card redirect
    if (!confirm(`Are you sure you want to delete project "${title}"?`)) return;
    setDeleting(projectId);
    try {
      await deleteDoc(doc(db, "projects", projectId));
      toast({ type: "success", title: "Project Deleted", message: title });
    } catch (error) {
      console.error(error);
      toast({ type: "error", title: "Delete failed" });
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Fetch clients to map IDs to Names
    const clientsQ = query(collection(db, "clients"), where("designerId", "==", user.uid));
    const unsubClients = onSnapshot(clientsQ, (snap) => {
      const clientMap: Record<string, string> = {};
      snap.docs.forEach(doc => {
        clientMap[doc.id] = doc.data().name;
      });
      setClients(clientMap);
    });

    // Fetch projects
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
      setProjects(sortedProjects);
    });

    return () => {
      unsubClients();
      unsubProjects();
    };
  }, [user]);

  const filteredProjects = projects.filter(p => {
    if (filter === "All") return true;
    if (filter === "Active") return !["Completed", "Archived"].includes(p.status);
    if (filter === "Review") return p.status === "Client Review";
    if (filter === "Completed") return p.status === "Completed";
    return true;
  });

  return (
    <DashboardLayout title="Projects">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#f1f1f5]">Projects</h2>
          <p className="text-[#6b6b85] mt-1 text-sm">Manage all your client projects and deliverables.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-[#111118] border border-[#2a2a38] rounded-lg">
            {["All", "Active", "Review", "Completed"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200
                  ${filter === f 
                    ? "bg-[#2a2a38] text-[#f1f1f5] shadow-sm" 
                    : "text-[#a0a0b8] hover:text-[#f1f1f5] hover:bg-[#1a1a24]"
                  }
                `}
              >
                {f}
              </button>
            ))}
          </div>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => router.push("/dashboard")}>
            New Project
          </Button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6 bg-[#111118] border border-[#1e1e2a] rounded-2xl">
          <div className="w-16 h-16 rounded-3xl bg-[#1a1a24] border border-[#2a2a38] flex items-center justify-center mb-6">
            <FolderOpen size={24} className="text-[#6b6b85]" />
          </div>
          <h3 className="text-lg font-semibold text-[#f1f1f5] mb-2">No projects found</h3>
          <p className="text-[#a0a0b8] max-w-sm mb-6">
            {filter === "All" 
              ? "You haven't created any projects yet." 
              : `You don't have any ${filter.toLowerCase()} projects at the moment.`}
          </p>
          {filter === "All" && (
            <Button variant="primary" onClick={() => router.push("/dashboard")} icon={<Plus size={16} />}>
              Create a Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <div 
              key={project.id}
              onClick={() => router.push(`/dashboard/projects/${project.id}`)}
              className="bg-[#111118] border border-[#1e1e2a] hover:border-[#3a3a50] rounded-2xl p-5 transition-all duration-200 cursor-pointer group hover:shadow-xl hover:shadow-black/20 flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <Badge variant={statusToBadgeVariant(project.status)} dot>
                  {project.status}
                </Badge>
                <button 
                  disabled={deleting === project.id}
                  className="text-[#6b6b85] hover:text-[#f87171] transition-colors p-1 rounded-md hover:bg-[#f87171]/10 disabled:opacity-50" 
                  onClick={(e) => handleDeleteProject(project.id, project.title, e)}
                  title="Delete Project"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mb-4 flex-1">
                <h3 className="text-lg font-bold text-[#f1f1f5] mb-1 line-clamp-1 group-hover:text-[#7c6af7] transition-colors">
                  {project.title}
                </h3>
                <p className="text-sm text-[#a0a0b8] line-clamp-2 min-h-[40px]">
                  {project.description || "No description provided."}
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#1e1e2a]">
                <div className="flex items-center justify-between text-xs text-[#a0a0b8]">
                  <div className="flex items-center gap-1.5">
                    <Users size={14} className="text-[#6b6b85]" />
                    <span className="truncate max-w-[120px]">{clients[project.clientId] || "Unknown Client"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-[#6b6b85]" />
                    <span>
                      {project.dueDate instanceof Timestamp 
                        ? new Date(project.dueDate.toDate()).toLocaleDateString() 
                        : "No due date"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    {project.tags?.slice(0, 2).map(tag => (
                      <span key={tag} className="px-2 py-1 bg-[#1a1a24] text-[#a0a0b8] text-[10px] font-medium rounded-md">
                        {tag}
                      </span>
                    ))}
                    {project.tags?.length > 2 && (
                      <span className="px-2 py-1 bg-[#1a1a24] text-[#a0a0b8] text-[10px] font-medium rounded-md">
                        +{project.tags.length - 2}
                      </span>
                    )}
                  </div>
                  <div className="w-6 h-6 rounded-full bg-[#1a1a24] border border-[#2a2a38] flex items-center justify-center group-hover:bg-[#7c6af7]/20 group-hover:border-[#7c6af7]/50 group-hover:text-[#7c6af7] transition-all">
                    <ArrowUpRight size={12} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
