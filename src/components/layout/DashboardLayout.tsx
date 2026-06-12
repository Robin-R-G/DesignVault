"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import ToastProvider from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { Lock } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  onNewProject?: () => void;
}

export default function DashboardLayout({ children, title, onNewProject }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profileLoading, setProfileLoading] = useState(true);
  const [paymentConfigured, setPaymentConfigured] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    if (user && user.role === "designer") {
      const checkProfile = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const hasUPI = !!data.upiId;
            const hasBank = !!data.bankDetails;
            const hasStripe = !!data.stripeLink;
            setPaymentConfigured(hasUPI || hasBank || hasStripe);
          } else {
            setPaymentConfigured(false);
          }
        } catch (err) {
          console.error("Error loading payment config:", err);
          setPaymentConfigured(false);
        } finally {
          setProfileLoading(false);
        }
      };
      checkProfile();
    } else {
      setProfileLoading(false);
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c6af7] to-[#f472b6] flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-sm">DV</span>
          </div>
          <div className="w-5 h-5 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const showPaymentLock = !profileLoading && !paymentConfigured && pathname !== "/dashboard/settings";

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <Topbar title={title} onNewProject={onNewProject} />
      <main className="ml-[260px] pt-14 min-h-screen">
        <div className="p-6 animate-fade-in">
          {showPaymentLock ? (
            <div className="flex items-center justify-center py-20 min-h-[70vh]">
              <div className="max-w-md w-full bg-[#111118] border border-[#f87171]/20 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-[#f87171]/50" />
                <div className="w-14 h-14 rounded-2xl bg-[#f87171]/10 border border-[#f87171]/20 flex items-center justify-center mx-auto mb-6 text-[#f87171]">
                  <Lock size={24} className="animate-pulse" />
                </div>
                <h2 className="text-xl font-bold text-[#f1f1f5] mb-2">Payment Setup Required</h2>
                <p className="text-xs text-[#a0a0b8] leading-relaxed mb-8">
                  To comply with standard agency onboarding and enable private client portals, dynamic UPI QR codes, bank transfers, and file locking/unlocking, you must configure at least one active payment gateway or bank account.
                </p>
                <div className="space-y-3">
                  <Button 
                    variant="primary" 
                    onClick={() => router.push("/dashboard/settings")} 
                    className="w-full justify-center !bg-[#7c6af7] hover:!bg-[#6b59e8]"
                  >
                    Go to Payment Settings
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
      <ToastProvider />
    </div>
  );
}
