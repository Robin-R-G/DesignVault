"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { Users, Plus, Mail, Building, MoreVertical } from "lucide-react";
import type { Client } from "@/types";

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [adding, setAdding] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "clients"), where("designerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Client)));
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddClient = async () => {
    if (!user || !name || !email) return;
    
    setAdding(true);
    try {
      // Create a slug from the company name or client name
      const baseSlug = (companyName || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
      const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

      await addDoc(collection(db, "clients"), {
        designerId: user.uid,
        name,
        email,
        companyName,
        slug,
        createdAt: serverTimestamp(),
        totalProjects: 0,
        activeProjects: 0,
      });

      toast({ type: "success", title: "Client added successfully!" });
      setShowAddClient(false);
      setName("");
      setEmail("");
      setCompanyName("");
    } catch (error) {
      console.error("Error adding client:", error);
      toast({ type: "error", title: "Failed to add client" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <DashboardLayout title="Clients">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#f1f1f5]">Clients</h2>
          <p className="text-[#6b6b85] mt-1 text-sm">Manage your clients and their portal access.</p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => setShowAddClient(true)}
          icon={<Plus size={16} />}
        >
          Add Client
        </Button>
      </div>

      <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl overflow-hidden">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="w-16 h-16 rounded-3xl bg-[#1a1a24] border border-[#2a2a38] flex items-center justify-center mb-6">
              <Users size={24} className="text-[#6b6b85]" />
            </div>
            <h3 className="text-lg font-semibold text-[#f1f1f5] mb-2">No clients yet</h3>
            <p className="text-[#a0a0b8] max-w-sm mb-6">
              Add your first client to start creating projects and collaborating.
            </p>
            <Button variant="primary" onClick={() => setShowAddClient(true)} icon={<Plus size={16} />}>
              Add Your First Client
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1e1e2a] text-xs font-semibold text-[#6b6b85] uppercase tracking-wider bg-[#0a0a0f]/50">
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Portal URL</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2a]">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-[#1a1a24]/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7c6af7]/20 to-[#f472b6]/20 border border-[#7c6af7]/30 flex items-center justify-center text-[#7c6af7] font-bold text-sm flex-shrink-0">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#f1f1f5]">{client.name}</p>
                          {client.companyName && (
                            <p className="text-xs text-[#a0a0b8] flex items-center gap-1 mt-0.5">
                              <Building size={10} />
                              {client.companyName}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-[#a0a0b8]">
                        <Mail size={14} className="text-[#6b6b85]" />
                        {client.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#1a1a24] border border-[#2a2a38] text-xs text-[#a0a0b8] font-mono">
                        designvault.app/c/{client.slug}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                        onClick={() => {
                          const portalUrl = `${window.location.origin}/c/${client.slug}`;
                          navigator.clipboard.writeText(portalUrl);
                          toast({ type: "success", title: "Portal link copied!", message: client.name });
                        }}
                      >
                        Copy Portal URL
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showAddClient}
        onClose={() => setShowAddClient(false)}
        title="Add New Client"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAddClient(false)}>Cancel</Button>
            <Button variant="primary" loading={adding} onClick={handleAddClient}>Add Client</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Client Name"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Company Name (Optional)"
            placeholder="Acme Corp"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <div className="p-4 rounded-xl bg-[#60a5fa]/10 border border-[#60a5fa]/20 mt-2">
            <h4 className="text-sm font-medium text-[#60a5fa] mb-1">What happens next?</h4>
            <p className="text-xs text-[#a0a0b8] leading-relaxed">
              Adding a client generates a secure portal link for them. They won&apos;t be notified automatically until you share the portal link or invite them to a project.
            </p>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
