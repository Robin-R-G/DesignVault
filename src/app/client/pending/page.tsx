"use client";

import { useAuth } from "@/lib/firebase/auth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import Button from "@/components/ui/Button";
import { Lock, LogOut } from "lucide-react";

export default function ClientPendingPage() {
  const { user } = useAuth();

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f1f1f5] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-[#111118] border border-[#1e1e2a] flex items-center justify-center mb-6 text-[#fbbf24] shadow-lg shadow-black/25">
        <Lock size={24} />
      </div>
      
      <h1 className="text-2xl font-bold mb-2">Workspace Pending</h1>
      <p className="text-[#a0a0b8] max-w-sm mb-8 text-sm leading-relaxed">
        Your email (<span className="text-[#7c6af7]">{user?.email}</span>) is registered as a client, but your designer hasn&apos;t invited you to a project portal yet.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="secondary" onClick={handleLogout} icon={<LogOut size={16} />}>
          Sign Out / Switch Account
        </Button>
      </div>
      
      <p className="text-xs text-[#6b6b85] mt-12 max-w-xs leading-normal">
        Once your designer adds your email to a project, refresh this page to access your portal.
      </p>
    </div>
  );
}
