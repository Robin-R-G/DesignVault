"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import {
  MessageSquare, FileText, ExternalLink, Mic, Play, Pause, 
  Volume2, Paperclip, Square, Trash, Search, ArrowLeft, Send
} from "lucide-react";
import type { Project, Client } from "@/types";

interface Comment {
  id?: string;
  author: string;
  content: string;
  timestamp: any;
  role: "designer" | "client";
  type?: "text" | "file" | "audio";
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  audioDuration?: string;
}

interface ChatConversation {
  projectId: string;
  projectTitle: string;
  clientName: string;
  clientCompany: string;
  clientSlug: string;
  latestMessage: string;
  latestTimestamp: any;
  latestRole: string;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

function AudioPlayerBubble({ src, duration }: { src: string; duration?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
      const m = Math.floor(audio.currentTime / 60);
      const s = Math.floor(audio.currentTime % 60);
      setCurrentTime(`${m}:${s < 10 ? "0" : ""}${s}`);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime("0:00");
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error(e));
      setIsPlaying(true);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const newTime = (parseFloat(e.target.value) / 100) * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
    setProgress(parseFloat(e.target.value));
  };

  return (
    <div className="flex items-center gap-3 py-1 px-1 min-w-[200px] sm:min-w-[240px] select-none text-[#e9edef]">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button 
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-[#f1f1f5]/10 hover:bg-[#f1f1f5]/20 flex items-center justify-center text-[#f1f1f5] transition-all cursor-pointer flex-shrink-0 animate-fade-in"
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} className="ml-0.5" fill="currentColor" />}
      </button>
      <div className="flex-1 space-y-1">
        <input 
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={handleSliderChange}
          className="w-full h-1 bg-[#2a2a38] rounded-lg appearance-none cursor-pointer accent-[#53bdeb] outline-none"
        />
        <div className="flex justify-between text-[8px] text-[#8696a0] font-mono">
          <span>{currentTime}</span>
          <span>{duration || "0:00"}</span>
        </div>
      </div>
      <div className="w-7 h-7 rounded-full bg-[#3b4a54] flex items-center justify-center text-[#53bdeb] flex-shrink-0">
        <Volume2 size={13} />
      </div>
    </div>
  );
}

function FileBubbleCard({ name, size, url }: { name: string; size: string; url: string }) {
  const isImage = url.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)/i.test(name);

  if (isImage) {
    return (
      <div className="space-y-1.5 max-w-[280px] text-[#e9edef] animate-fade-in">
        <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-[#2a2a38] hover:opacity-90 transition-opacity">
          <img src={url} alt={name} className="max-h-[180px] w-full object-cover" />
        </a>
        <div className="flex items-center justify-between text-[9px] text-[#8696a0] px-0.5">
          <span className="truncate max-w-[180px] font-medium">{name}</span>
          <span>{size}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-[#1a1a24]/80 border border-[#2a2a38] rounded-xl min-w-[200px] max-w-[260px] text-[#e9edef] animate-fade-in">
      <div className="w-9 h-9 rounded-lg bg-[#7c6af7]/10 border border-[#7c6af7]/20 flex items-center justify-center text-[#7c6af7] flex-shrink-0">
        <FileText size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#f1f1f5] truncate">{name}</p>
        <p className="text-[10px] text-[#6b6b85]">{size}</p>
      </div>
      <a 
        href={url} 
        target="_blank" 
        rel="noreferrer"
        className="p-1.5 rounded bg-[#111118] border border-[#2a2a38] text-[#a0a0b8] hover:text-[#f1f1f5] transition-colors flex-shrink-0"
      >
        <ExternalLink size={12} />
      </a>
    </div>
  );
}

export default function ChatHubPage() {
  const { user } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Voice recording & file attachments in chat state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom of active conversation
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments, selectedProjectId]);

  // Load chat listing and latest messages real-time
  useEffect(() => {
    if (!user) return;

    // Fetch Clients
    const clientsQ = query(collection(db, "clients"), where("designerId", "==", user.uid));
    const unsubClients = onSnapshot(clientsQ, (clientsSnap) => {
      const clientMap: Record<string, Client> = {};
      clientsSnap.docs.forEach((doc) => {
        clientMap[doc.id] = { id: doc.id, ...doc.data() } as Client;
      });

      // Fetch Projects
      const projectsQ = query(collection(db, "projects"), where("designerId", "==", user.uid));
      const unsubProjects = onSnapshot(projectsQ, (projectsSnap) => {
        const projs = projectsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
        
        const latestMsgs: Record<string, { content: string; timestamp: any; role: string }> = {};
        const activeListeners: (() => void)[] = [];

        if (projs.length === 0) {
          setLoading(false);
        }

        projs.forEach((p, idx) => {
          const commentsQ = query(collection(db, "projects", p.id, "comments"));
          const unsubComments = onSnapshot(commentsQ, (commentsSnap) => {
            if (!commentsSnap.empty) {
              const list = commentsSnap.docs.map(d => d.data());
              const sorted = list.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
              const latest = sorted[0];
              latestMsgs[p.id] = {
                content: latest.type === "audio" ? "🎵 Voice Message" : latest.type === "file" ? "📁 Attachment" : latest.content,
                timestamp: latest.timestamp,
                role: latest.role,
              };
            } else {
              latestMsgs[p.id] = {
                content: "No messages yet",
                timestamp: p.createdAt,
                role: "system",
              };
            }

            // Consolidate rooms list
            const listData = projs.map((project) => {
              const clientObj = clientMap[project.clientId];
              const latestInfo = latestMsgs[project.id] || {
                content: "No messages yet",
                timestamp: project.createdAt,
                role: "system",
              };

              return {
                projectId: project.id,
                projectTitle: project.title,
                clientName: clientObj?.name || "Loading Client...",
                clientCompany: clientObj?.companyName || "",
                clientSlug: clientObj?.slug || "",
                latestMessage: latestInfo.content,
                latestTimestamp: latestInfo.timestamp,
                latestRole: latestInfo.role,
              };
            });

            // Sort rooms latest timestamp descending
            const sortedConversations = listData.sort((a, b) => {
              const aTime = a.latestTimestamp?.seconds || 0;
              const bTime = b.latestTimestamp?.seconds || 0;
              return bTime - aTime;
            });

            setConversations(sortedConversations);
            setLoading(false);
          });
          activeListeners.push(unsubComments);
        });

        setProjects(projs);
        setClients(Object.values(clientMap));

        return () => {
          activeListeners.forEach(unsub => unsub());
        };
      });

      return () => {
        unsubProjects();
      };
    });

    return () => {
      unsubClients();
    };
  }, [user]);

  // Load comments of active conversation
  useEffect(() => {
    if (!selectedProjectId) {
      setComments([]);
      return;
    }

    const commentsQ = query(collection(db, "projects", selectedProjectId, "comments"));
    const unsubComments = onSnapshot(commentsQ, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
      setComments(list.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)));
    });

    return () => unsubComments();
  }, [selectedProjectId]);

  const activeConversation = conversations.find(c => c.projectId === selectedProjectId);

  // Form actions
  const handlePostComment = async () => {
    if (!commentText.trim() || !selectedProjectId) return;
    setSendingComment(true);

    try {
      await addDoc(collection(db, "projects", selectedProjectId, "comments"), {
        author: user?.displayName || "Designer",
        content: commentText,
        role: "designer",
        timestamp: serverTimestamp(),
      });

      setCommentText("");
    } catch {
      toast({ type: "error", title: "Message failed to send" });
    } finally {
      setSendingComment(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (!selectedProjectId) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
        const durationStr = formatDuration(durationSeconds);

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (base64Audio.length > 1000000) {
            toast({ 
              type: "error", 
              title: "Voice note too long", 
              message: "Please keep your voice message shorter to stay within direct message limits." 
            });
            return;
          }
          await addDoc(collection(db, "projects", selectedProjectId, "comments"), {
            author: user?.displayName || "Designer",
            content: "Voice Message",
            role: "designer",
            timestamp: serverTimestamp(),
            type: "audio",
            fileUrl: base64Audio,
            audioDuration: durationStr,
          });
        };

        stream.getTracks().forEach(track => track.stop());
      };

      setIsRecording(true);
      setRecordingDuration(0);
      startTimeRef.current = Date.now();
      mediaRecorder.start();

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access failed:", err);
      toast({ type: "error", title: "Microphone error", message: "Failed to access microphone. Please check permissions." });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProjectId) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeStr = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + " MB"
      : (file.size / 1024).toFixed(0) + " KB";
    
    toast({ type: "info", title: "Sending attachment...", message: file.name });

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        
        // Compress the image before uploading to keep it under 1MB Firestore limit
        const compressedBase64 = await compressImage(rawBase64);
        
        if (compressedBase64.length > 1000000) {
          toast({ 
            type: "error", 
            title: "Image too large", 
            message: "This image is too large to share in chat. Please link it as a project deliverable instead." 
          });
          return;
        }

        await addDoc(collection(db, "projects", selectedProjectId, "comments"), {
          author: user?.displayName || "Designer",
          content: `Shared image: ${file.name}`,
          role: "designer",
          timestamp: serverTimestamp(),
          type: "file",
          fileUrl: compressedBase64,
          fileName: file.name,
          fileSize: sizeStr,
        });
        toast({ type: "success", title: "Image sent!" });
      };
    } else {
      setTimeout(async () => {
        const fileId = Math.random().toString(36).substring(2, 12);
        await addDoc(collection(db, "projects", selectedProjectId, "comments"), {
          author: user?.displayName || "Designer",
          content: `Shared file: ${file.name}`,
          role: "designer",
          timestamp: serverTimestamp(),
          type: "file",
          fileUrl: `https://drive.google.com/file/d/mock-attach-${fileId}/view`,
          fileName: file.name,
          fileSize: sizeStr,
        });
        toast({ type: "success", title: "Attachment sent!" });
      }, 600);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(c => 
    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.projectTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout title="Chat Hub">
      <div className="flex bg-[#111118] border border-[#1e1e2a] rounded-2xl h-[calc(100vh-140px)] overflow-hidden">
        
        {/* Left Side: Conversations list */}
        <div className="w-[320px] md:w-[360px] border-r border-[#1e1e2a] flex flex-col flex-shrink-0 bg-[#0d0d15]/60">
          <div className="p-4 border-b border-[#1e1e2a]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b85]" size={15} />
              <input 
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-[#1a1a24] border border-[#2a2a38] text-xs text-[#f1f1f5] outline-none focus:border-[#7c6af7] transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#1e1e2a]/40">
            {loading ? (
              <p className="text-xs text-[#6b6b85] text-center py-8">Loading conversations...</p>
            ) : filteredConversations.length === 0 ? (
              <p className="text-xs text-[#6b6b85] text-center py-8">No chats found.</p>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c.projectId === selectedProjectId;
                const initials = c.clientName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
                const latestTime = c.latestTimestamp?.toDate 
                  ? new Date(c.latestTimestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                  : "";

                return (
                  <button
                    key={c.projectId}
                    onClick={() => setSelectedProjectId(c.projectId)}
                    className={`w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-[#1a1a24]/50 ${
                      isActive ? "bg-[#7c6af7]/10" : ""
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#f472b6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-1">
                        <h4 className="text-xs font-bold text-[#f1f1f5] truncate">{c.clientName}</h4>
                        <span className="text-[9px] text-[#6b6b85] font-mono">{latestTime}</span>
                      </div>
                      <p className="text-[10px] text-[#7c6af7] font-medium truncate mt-0.5">{c.projectTitle}</p>
                      <p className="text-[11px] text-[#8696a0] truncate mt-1">
                        {c.latestRole === "designer" ? <span className="text-[#34b7f1] mr-1">You:</span> : ""}
                        {c.latestMessage}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Conversation Thread */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0f]">
          {activeConversation ? (
            <>
              {/* Header */}
              <div className="h-16 border-b border-[#1e1e2a] px-6 flex items-center justify-between bg-[#111118]/80 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#f472b6] flex items-center justify-center text-white text-xs font-bold">
                    {activeConversation.clientName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-[#f1f1f5] truncate">{activeConversation.clientName}</h3>
                    <p className="text-[10px] text-[#6b6b85] truncate mt-0.5">Project: <span className="text-[#a78bfa]">{activeConversation.projectTitle}</span></p>
                  </div>
                </div>

                <a 
                  href={`/c/${activeConversation.clientSlug}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a24] border border-[#2a2a38] text-[10px] font-bold text-[#a0a0b8] hover:text-[#f1f1f5] transition-colors"
                >
                  <ExternalLink size={12} />
                  Client Portal
                </a>
              </div>

              {/* Chat messages stream */}
              <div className="flex-1 overflow-y-auto space-y-3 p-6 bg-[#0b141a]">
                {comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <MessageSquare size={24} className="text-[#3b4a54] mb-2" />
                    <p className="text-xs text-[#8696a0]">No messages yet. Send a message to start chatting!</p>
                  </div>
                ) : (
                  comments.map((comment) => {
                    const isSystem = comment.author === "System Notification";
                    const isSent = comment.role === "designer";
                    const timeString = comment.timestamp?.toDate 
                      ? new Date(comment.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    if (isSystem) {
                      return (
                        <div key={comment.id} className="flex justify-center my-2">
                          <div className="px-3 py-1.5 rounded-lg bg-[#182229]/90 border border-[#ffe285]/20 text-[10px] text-[#ffd279] max-w-[85%] text-center leading-relaxed font-medium shadow-sm">
                            {comment.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={comment.id} className={`flex ${isSent ? "justify-end" : "justify-start"} my-1`}>
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs text-[#e9edef] shadow-md relative ${
                          isSent 
                            ? "bg-[#005c4b] border border-[#005c4b]/30 rounded-tr-none" 
                            : "bg-[#202c33] border border-[#202c33]/30 rounded-tl-none"
                        }`}>
                          {!isSent && (
                            <p className="text-[10px] font-bold text-[#34b7f1] mb-0.5 select-none">
                              {comment.author}
                            </p>
                          )}
                          {comment.type === "audio" ? (
                            <AudioPlayerBubble src={comment.fileUrl || ""} duration={comment.audioDuration} />
                          ) : comment.type === "file" ? (
                            <FileBubbleCard name={comment.fileName || "attachment"} size={comment.fileSize || ""} url={comment.fileUrl || ""} />
                          ) : (
                            <p className="leading-relaxed break-words whitespace-pre-wrap">{comment.content}</p>
                          )}
                          <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-[#8696a0] select-none">
                            <span className={`${isSent ? "text-[#a0c5bd]" : "text-[#8696a0]"}`}>{timeString}</span>
                            {isSent && <span className="text-[#53bdeb] font-semibold text-[10px]">✓✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-[#1e1e2a] bg-[#111118]/80 flex-shrink-0">
                <div className="flex gap-2">
                  {isRecording ? (
                    <div className="flex-1 flex items-center justify-between bg-[#1f2c34] border border-[#2a3942] rounded-lg h-10 px-4 animate-fade-in text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        <span className="text-[#e9edef] font-medium font-mono">{formatDuration(recordingDuration)}</span>
                        <span className="text-[#8696a0] ml-2 select-none">Recording voice note...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={cancelRecording}
                          className="p-1.5 hover:bg-white/10 rounded-full text-red-400 transition-colors cursor-pointer"
                          title="Cancel Recording"
                        >
                          <Trash size={14} />
                        </button>
                        <button 
                          onClick={stopRecording}
                          className="p-1.5 hover:bg-white/10 rounded-full text-green-400 transition-colors cursor-pointer"
                          title="Send Voice Note"
                        >
                          <Square size={14} fill="currentColor" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex gap-2 items-center">
                      <input 
                        type="file" 
                        onChange={handleAttachFile} 
                        className="hidden" 
                        id="chat-file-attach-hub" 
                      />
                      <label 
                        htmlFor="chat-file-attach-hub"
                        className="w-10 h-10 rounded-full bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a38] flex items-center justify-center text-[#a0a0b8] hover:text-[#f1f1f5] transition-all cursor-pointer flex-shrink-0"
                        title="Attach File"
                      >
                        <Paperclip size={16} />
                      </label>

                      <input 
                        type="text"
                        placeholder="Type a message..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                        className="flex-1 h-10 rounded-lg bg-[#1a1a24] border border-[#2a2a38] text-xs text-[#f1f1f5] px-4 outline-none focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7] transition-all"
                      />

                      <button 
                        onClick={startRecording}
                        className="w-10 h-10 rounded-full bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a38] flex items-center justify-center text-[#a0a0b8] hover:text-[#53bdeb] hover:border-[#53bdeb]/40 transition-all cursor-pointer flex-shrink-0"
                        title="Record Voice Note"
                      >
                        <Mic size={16} />
                      </button>

                      <Button variant="primary" size="sm" loading={sendingComment} onClick={handlePostComment} className="h-10 px-4 flex-shrink-0">
                        Send
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-[#6b6b85]">
              <div className="w-16 h-16 rounded-2xl bg-[#111118] border border-[#1e1e2a] flex items-center justify-center mb-4 text-[#7c6af7]">
                <MessageSquare size={28} />
              </div>
              <h3 className="text-base font-bold text-[#f1f1f5]">DesignVault Chat Hub</h3>
              <p className="text-xs text-[#6b6b85] max-w-xs leading-relaxed mt-2">
                Select a client conversation from the sidebar list to review feedback comments, send attachments, or record voice messages.
              </p>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
