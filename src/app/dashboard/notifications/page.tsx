"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { Bell, BellOff, Check, Heart, MessageSquare, ShieldCheck } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  description: string;
  type: "UPLOADED_FILE" | "APPROVED_DESIGN" | "REQUESTED_CHANGES" | "LEFT_COMMENT" | "SYSTEM";
  read: boolean;
  timestamp: any;
  projectId?: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Listen for real-time notifications
    const notificationsQ = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      notificationsQ,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
        // Sort in-memory to prevent composite index issues
        const sortedList = list.sort((a, b) => {
          const aTime = a.timestamp?.seconds || 0;
          const bTime = b.timestamp?.seconds || 0;
          return bTime - aTime;
        });
        setNotifications(sortedList);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching notifications:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    try {
      const promises = unread.map((n) =>
        updateDoc(doc(db, "notifications", n.id), { read: true })
      );
      await Promise.all(promises);
      toast({ type: "success", title: "All notifications marked as read." });
    } catch {
      toast({ type: "error", title: "Action failed" });
    }
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "APPROVED_DESIGN":
        return <ShieldCheck className="text-[#34d399]" size={16} />;
      case "LEFT_COMMENT":
        return <MessageSquare className="text-[#60a5fa]" size={16} />;
      case "REQUESTED_CHANGES":
        return <Bell className="text-[#f87171]" size={16} />;
      case "UPLOADED_FILE":
        return <Heart className="text-[#f472b6]" size={16} />;
      default:
        return <Bell className="text-[#a0a0b8]" size={16} />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <DashboardLayout title="Notifications">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#f1f1f5]">Notifications</h2>
          <p className="text-[#6b6b85] mt-1 text-sm">Stay up-to-date with client activity and feedback.</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={handleMarkAllRead} icon={<Check size={16} />}>
            Mark All Read
          </Button>
        )}
      </div>

      <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl overflow-hidden max-w-3xl">
        {loading ? (
          <div className="py-20 text-center text-[#6b6b85]">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#1a1a24] border border-[#2a2a38] flex items-center justify-center mb-5">
              <BellOff size={22} className="text-[#6b6b85]" />
            </div>
            <h3 className="text-lg font-semibold text-[#f1f1f5] mb-2">Clean slate!</h3>
            <p className="text-sm text-[#a0a0b8] max-w-sm">
              You are all caught up. Notifications about project views, comments, and approvals will show here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e1e2a]">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex gap-4 p-5 hover:bg-[#1a1a24]/50 transition-colors relative group ${
                  !notif.read ? "bg-[#7c6af7]/5" : ""
                }`}
              >
                {/* Read indicator */}
                {!notif.read && (
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#7c6af7]" />
                )}

                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                  !notif.read 
                    ? "bg-[#7c6af7]/15 border-[#7c6af7]/25" 
                    : "bg-[#1a1a24] border-[#2a2a38]"
                }`}>
                  {getIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <p className={`text-sm ${!notif.read ? "font-semibold text-[#f1f1f5]" : "text-[#a0a0b8]"}`}>
                      {notif.title}
                    </p>
                    <span className="text-[10px] text-[#6b6b85] whitespace-nowrap mt-0.5">
                      {notif.timestamp?.toDate ? new Date(notif.timestamp.toDate()).toLocaleDateString() : "Just now"}
                    </span>
                  </div>
                  <p className="text-xs text-[#6b6b85] mt-1 leading-relaxed">{notif.description}</p>
                </div>

                {!notif.read && (
                  <button
                    onClick={() => handleMarkAsRead(notif.id)}
                    className="text-[#6b6b85] hover:text-[#f1f1f5] p-1.5 rounded bg-[#1a1a24] border border-[#2a2a38] self-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Mark as read"
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
