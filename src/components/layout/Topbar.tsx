"use client";

import { useState } from "react";
import { Search, Bell, Plus, Command } from "lucide-react";
import { useAuth } from "@/lib/firebase/auth";
import Button from "@/components/ui/Button";

interface TopbarProps {
  title?: string;
  onNewProject?: () => void;
}

export default function Topbar({ title = "Dashboard", onNewProject }: TopbarProps) {
  const { user } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="fixed top-0 right-0 left-[260px] h-14 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-[#1e1e2a] flex items-center px-6 gap-4 z-30">
      {/* Page title */}
      <h1 className="text-sm font-semibold text-[#f1f1f5] flex-shrink-0 mr-4">{title}</h1>

      {/* Search bar */}
      <div
        className={`
          flex-1 max-w-md flex items-center gap-2 h-8 px-3 rounded-lg
          bg-[#111118] border transition-all duration-200
          ${searchFocused ? "border-[#7c6af7]/60 ring-1 ring-[#7c6af7]/20" : "border-[#2a2a38]"}
        `}
      >
        <Search size={14} className="text-[#6b6b85] flex-shrink-0" />
        <input
          type="text"
          placeholder="Search projects, files, clients..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="flex-1 bg-transparent text-sm text-[#f1f1f5] placeholder-[#6b6b85] outline-none"
          id="global-search"
        />
        <div className="flex items-center gap-1 text-[10px] text-[#6b6b85] flex-shrink-0">
          <Command size={10} />
          <span>K</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <button
          className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-[#2a2a38] bg-[#111118] text-[#a0a0b8] hover:text-[#f1f1f5] hover:border-[#3a3a50] transition-all"
          id="notifications-btn"
        >
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#f472b6] rounded-full" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#f472b6] flex items-center justify-center text-white text-xs font-bold cursor-pointer">
          {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || "D"}
        </div>

        {/* New Project CTA */}
        {onNewProject && (
          <Button variant="primary" size="sm" onClick={onNewProject} icon={<Plus size={14} />} id="new-project-btn">
            New Project
          </Button>
        )}
      </div>
    </header>
  );
}
