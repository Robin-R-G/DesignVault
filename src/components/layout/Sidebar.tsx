"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/auth";
import {
  LayoutDashboard, FolderOpen, Users, Bell, Settings,
  LogOut, Vault, ChevronRight, CreditCard, Zap, HardDrive,
  MessageSquare
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/projects", icon: FolderOpen, label: "Projects" },
  { href: "/dashboard/chat", icon: MessageSquare, label: "Chat" },
  { href: "/dashboard/clients", icon: Users, label: "Clients" },
  { href: "/dashboard/drive", icon: HardDrive, label: "Drive Sync" },
  { href: "/dashboard/payments", icon: CreditCard, label: "Payments" },
  { href: "/dashboard/notifications", icon: Bell, label: "Notifications" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] bg-[#0d0d15] border-r border-[#1e1e2a] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#1e1e2a]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c6af7] to-[#f472b6] flex items-center justify-center flex-shrink-0">
          <Vault size={16} className="text-white" />
        </div>
        <div>
          <span className="text-sm font-bold text-[#f1f1f5]">DesignVault</span>
          <p className="text-[10px] text-[#6b6b85]">Designer Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                  transition-all duration-150 group relative
                  ${isActive
                    ? "bg-[#7c6af7]/15 text-[#7c6af7] border border-[#7c6af7]/20"
                    : "text-[#a0a0b8] hover:bg-[#1a1a24] hover:text-[#f1f1f5] border border-transparent"
                  }
                `}
              >
                <Icon size={16} className="flex-shrink-0" />
                {label}
                {isActive && <ChevronRight size={12} className="ml-auto opacity-60" />}
              </Link>
            );
          })}
        </div>

        {/* Upgrade banner */}
        <div className="mt-6 p-3 rounded-xl bg-gradient-to-br from-[#7c6af7]/10 to-[#f472b6]/10 border border-[#7c6af7]/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-[#7c6af7]" />
            <span className="text-xs font-semibold text-[#f1f1f5]">Free Plan</span>
          </div>
          <p className="text-[10px] text-[#a0a0b8] leading-relaxed">Unlimited projects on free tier with Google Drive storage.</p>
        </div>
      </nav>

      {/* Bottom: User + Settings */}
      <div className="border-t border-[#1e1e2a] p-3 space-y-1">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#a0a0b8] hover:bg-[#1a1a24] hover:text-[#f1f1f5] transition-all border border-transparent"
        >
          <Settings size={16} />
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#a0a0b8] hover:bg-[#f87171]/10 hover:text-[#f87171] transition-all border border-transparent cursor-pointer"
        >
          <LogOut size={16} />
          Sign Out
        </button>
        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2 mt-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#f472b6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || "D"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#f1f1f5] truncate">{user?.displayName || "Designer"}</p>
            <p className="text-[10px] text-[#6b6b85] truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
