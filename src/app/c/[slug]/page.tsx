"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { collection, query, where, onSnapshot, getDocs, getDoc, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import Badge, { statusToBadgeVariant } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import {
  Vault, FileText, CheckCircle, AlertCircle, MessageSquare, 
  Download, ArrowUpRight, Lock, ExternalLink, CreditCard, QrCode,
  Mic, Play, Pause, Volume2, Paperclip, Square, Trash, Building,
  FolderOpen, Calendar, Clock, Plus, Upload, Check
} from "lucide-react";
import type { Client, Project } from "@/types";

interface FileMetadata {
  id: string;
  name: string;
  url: string;
  size: string;
  uploadedAt: any;
  approved: boolean;
  driveFileId: string;
  locked?: boolean;
}

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


const getImageUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("data:image/")) return url;
  
  // Extract Google Drive ID if it is a Drive link
  const driveIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) {
    const fileId = driveIdMatch[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  return url;
};

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
  const imageUrl = getImageUrl(url);

  if (isImage) {
    return (
      <div className="space-y-1.5 max-w-[280px] text-[#e9edef] animate-fade-in">
        <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-[#2a2a38] hover:opacity-90 transition-opacity">
          <img src={imageUrl} alt={name} className="max-h-[180px] w-full object-cover" />
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

const CLIENT_STEPS = [
  { key: "Project Created", label: "Kickoff", desc: "Briefing", icon: FolderOpen },
  { key: "Planning", label: "Planning", desc: "Roadmap", icon: Calendar },
  { key: "Designing", label: "Design", desc: "Active design", icon: FileText },
  { key: "Client Review", label: "Review", desc: "Feedback", icon: Clock },
  { key: "Revision Requested", label: "Revisions", desc: "Refinement", icon: AlertCircle },
  { key: "Final Delivery", label: "Delivery", desc: "Assets upload", icon: Upload },
  { key: "Completed", label: "Signed Off", desc: "Approved", icon: CheckCircle },
] as const;

const STATUS_ORDER_CLIENT = [
  "Project Created",
  "Planning",
  "Designing",
  "Client Review",
  "Revision Requested",
  "Final Delivery",
  "Completed",
  "Archived"
] as const;

export default function ClientPortalPage() {
  const { slug } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState<string | null>(null);
  const [activePreviewFile, setActivePreviewFile] = useState<FileMetadata | null>(null);
  const [savingToDrive, setSavingToDrive] = useState<string | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareLeftFileId, setCompareLeftFileId] = useState("");
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [compareRightFileId, setCompareRightFileId] = useState("");
  const [compareSliderValue, setCompareSliderValue] = useState(50);

  const handleSaveToGoogleDrive = async (file: FileMetadata) => {
    setSavingToDrive(file.id);
    toast({
      type: "info",
      title: "Google Drive Export",
      message: `Connecting to Google Drive for ${client?.email || "your account"}...`
    });

    // Simulate oauth checking and file streaming to Google Drive folder
    setTimeout(() => {
      toast({
        type: "info",
        title: "Exporting File",
        message: `Uploading "${file.name}" to your Drive...`
      });
      
      setTimeout(() => {
        setSavingToDrive(null);
        toast({
          type: "success",
          title: "Saved to Google Drive!",
          message: `"${file.name}" was successfully saved to the 'DesignVault' folder in ${client?.email}.`
        });
      }, 1500);
    }, 1200);
  };

  const handleOpenCompareModal = () => {
    const imageFiles = files.filter(f => f.url.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)/i.test(f.name));
    if (imageFiles.length >= 2) {
      setCompareLeftFileId(imageFiles[0].id);
      setCompareRightFileId(imageFiles[1].id);
    } else if (imageFiles.length === 1) {
      setCompareLeftFileId(imageFiles[0].id);
      setCompareRightFileId(imageFiles[0].id);
    }
    setCompareSliderValue(50);
    setShowCompareModal(true);
  };

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // Voice recording & file attachments in chat state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

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
        if (!selectedProject) return;
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
          await addDoc(collection(db, "projects", selectedProject.id, "comments"), {
            author: client?.name || "Client",
            content: "Voice Message",
            role: "client",
            timestamp: serverTimestamp(),
            type: "audio",
            fileUrl: base64Audio,
            audioDuration: durationStr,
          });

          // Notify Designer
          await addDoc(collection(db, "notifications"), {
            userId: selectedProject.designerId,
            title: "New Client Voice Note",
            description: `${client?.name} sent a voice message on "${selectedProject.title}"`,
            type: "LEFT_COMMENT",
            read: false,
            timestamp: serverTimestamp(),
            projectId: selectedProject.id,
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
    if (!selectedProject) return;
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

        await addDoc(collection(db, "projects", selectedProject.id, "comments"), {
          author: client?.name || "Client",
          content: `Shared image: ${file.name}`,
          role: "client",
          timestamp: serverTimestamp(),
          type: "file",
          fileUrl: compressedBase64,
          fileName: file.name,
          fileSize: sizeStr,
        });

        // Notify Designer
        await addDoc(collection(db, "notifications"), {
          userId: selectedProject.designerId,
          title: "New Client Attachment",
          description: `${client?.name} shared an image on "${selectedProject.title}"`,
          type: "LEFT_COMMENT",
          read: false,
          timestamp: serverTimestamp(),
          projectId: selectedProject.id,
        });

        toast({ type: "success", title: "Image sent!" });
      };
    } else {
      setTimeout(async () => {
        const fileId = Math.random().toString(36).substring(2, 12);
        await addDoc(collection(db, "projects", selectedProject.id, "comments"), {
          author: client?.name || "Client",
          content: `Shared file: ${file.name}`,
          role: "client",
          timestamp: serverTimestamp(),
          type: "file",
          fileUrl: `https://drive.google.com/file/d/mock-attach-${fileId}/view`,
          fileName: file.name,
          fileSize: sizeStr,
        });

        // Notify Designer
        await addDoc(collection(db, "notifications"), {
          userId: selectedProject.designerId,
          title: "New Client Attachment",
          description: `${client?.name} shared a file on "${selectedProject.title}"`,
          type: "LEFT_COMMENT",
          read: false,
          timestamp: serverTimestamp(),
          projectId: selectedProject.id,
        });

        toast({ type: "success", title: "Attachment sent!" });
      }, 600);
    }
  };

  // Payments / Invoices State
  const [designer, setDesigner] = useState<{ name: string; upiId?: string; bankDetails?: string; stripeLink?: string } | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [activePaymentTab, setActivePaymentTab] = useState<"upi" | "card" | "bank">("upi");

  // Exchange rates state relative to INR (1 Unit of Foreign Currency = X INR)
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    USD: 83.5,
    GBP: 106.2,
    EUR: 90.1,
    CAD: 61.2,
    AUD: 55.4,
    INR: 1.0,
  });

  const getCurrencySymbol = (cur: string) => {
    switch (cur || "INR") {
      case "USD": return "$";
      case "GBP": return "£";
      case "EUR": return "€";
      case "CAD": return "C$";
      case "AUD": return "A$";
      case "INR":
      default: return "₹";
    }
  };

  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/INR")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.rates) {
          const newRates: Record<string, number> = { INR: 1.0 };
          const currencies = ["USD", "GBP", "EUR", "CAD", "AUD"];
          currencies.forEach((cur) => {
            if (data.rates[cur]) {
              newRates[cur] = 1 / data.rates[cur];
            } else {
              newRates[cur] = cur === "USD" ? 83.5 : cur === "GBP" ? 106.2 : cur === "EUR" ? 90.1 : cur === "CAD" ? 61.2 : 55.4;
            }
          });
          setExchangeRates(newRates);
        }
      })
      .catch((err) => console.error("Error fetching exchange rates:", err));
  }, []);

  useEffect(() => {
    if (showPayModal && designer) {
      if (designer.upiId) {
        setActivePaymentTab("upi");
      } else if (designer.stripeLink) {
        setActivePaymentTab("card");
      } else if (designer.bankDetails) {
        setActivePaymentTab("bank");
      }
    }
  }, [showPayModal, designer]);

  // Authenticate by client slug
  useEffect(() => {
    if (!slug) return;

    const fetchPortalData = async () => {
      try {
        // Find client by slug
        const clientQ = query(collection(db, "clients"), where("slug", "==", slug));
        const clientSnap = await getDocs(clientQ);
        
        if (clientSnap.empty) {
          setLoading(false);
          return;
        }

        const clientData = { id: clientSnap.docs[0].id, ...clientSnap.docs[0].data() } as Client;
        setClient(clientData);

        // Fetch Designer Details for UPI / Brand config
        const designerSnap = await getDoc(doc(db, "users", clientData.designerId));
        if (designerSnap.exists()) {
          const dData = designerSnap.data();
          setDesigner({
            name: dData.displayName || dData.name || "Designer",
            upiId: dData.upiId,
            bankDetails: dData.bankDetails || "",
            stripeLink: dData.stripeLink || "",
          });
        }

        // Fetch Invoices
        const invoicesQ = query(collection(db, "invoices"), where("clientId", "==", clientData.id));
        const unsubInvoices = onSnapshot(invoicesQ, (snap) => {
          setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Fetch projects for this client
        const projectsQ = query(collection(db, "projects"), where("clientId", "==", clientData.id));
        const unsubProjects = onSnapshot(projectsQ, (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
          setProjects(list);
          
          // Set initial project selection if not set
          if (list.length > 0 && !selectedProject) {
            setSelectedProject(list[0]);
          }
        });

        setLoading(false);
        return () => {
          unsubInvoices();
          unsubProjects();
        };
      } catch (error) {
        console.error("Portal error:", error);
        setLoading(false);
      }
    };

    fetchPortalData();
  }, [slug]);

  // Fetch files and comments for selected project
  useEffect(() => {
    if (!selectedProject?.id) return;

    const filesQ = query(collection(db, "projects", selectedProject.id, "files"));
    const unsubFiles = onSnapshot(filesQ, (snap) => {
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as FileMetadata)));
    });

    const commentsQ = query(collection(db, "projects", selectedProject.id, "comments"));
    const unsubComments = onSnapshot(commentsQ, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
      setComments(list.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)));
    });

    return () => {
      unsubFiles();
      unsubComments();
    };
  }, [selectedProject]);

  // Anti-Screenshot & Copy Protection for locked previews
  useEffect(() => {
    if (!activePreviewFile) {
      setIsWindowBlurred(false);
      return;
    }

    const isCompletedLock = selectedProject?.status === "Completed" && invoices.some((inv) => inv.status === "Pending");
    const isPreviewLocked = !!activePreviewFile.locked || isCompletedLock;

    if (!isPreviewLocked) {
      setIsWindowBlurred(false);
      return;
    }

    const handleBlur = () => {
      setIsWindowBlurred(true);
    };

    const handleFocus = () => {
      setIsWindowBlurred(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+S, Ctrl+P, Ctrl+C (copy), PrintScreen, F12 / Inspect
      if (
        (e.ctrlKey && (e.key === "s" || e.key === "S")) ||
        (e.ctrlKey && (e.key === "p" || e.key === "P")) ||
        (e.ctrlKey && (e.key === "c" || e.key === "C")) ||
        e.key === "PrintScreen" ||
        e.keyCode === 44 ||
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "C" || e.key === "c" || e.key === "J" || e.key === "j"))
      ) {
        e.preventDefault();
        toast({
          type: "error",
          title: "Screenshot / Save Disabled",
          message: "Saving, printing, or capturing screenshots is disabled for locked deliverables."
        });
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [activePreviewFile, selectedProject, invoices]);

  const handleApproveFile = async (fileId: string, fileName: string) => {
    if (!selectedProject) return;
    setSubmittingDecision(fileId);

    try {
      // Mark file as approved
      await updateDoc(doc(db, "projects", selectedProject.id, "files", fileId), {
        approved: true,
      });

      // Post system comment
      await addDoc(collection(db, "projects", selectedProject.id, "comments"), {
        author: "System Notification",
        content: `Client approved deliverable "${fileName}"`,
        role: "client",
        timestamp: serverTimestamp(),
      });

      // Notify Designer (Create Notification document)
      await addDoc(collection(db, "notifications"), {
        userId: selectedProject.designerId,
        title: "Deliverable Approved!",
        description: `${client?.name} approved "${fileName}" for project "${selectedProject.title}"`,
        type: "APPROVED_DESIGN",
        read: false,
        timestamp: serverTimestamp(),
        projectId: selectedProject.id,
      });

      toast({ type: "success", title: "Deliverable Approved!", message: "Designer has been notified." });
    } catch {
      toast({ type: "error", title: "Action failed" });
    } finally {
      setSubmittingDecision(null);
    }
  };

  const handleRequestRevision = async (fileId: string, fileName: string) => {
    if (!selectedProject) return;
    
    const feedback = prompt("Please describe what revisions are needed:");
    if (!feedback) return;

    setSubmittingDecision(fileId);
    try {
      // Update Project Status
      await updateDoc(doc(db, "projects", selectedProject.id), {
        status: "Revision Requested",
      });

      // Post revision request comment
      await addDoc(collection(db, "projects", selectedProject.id, "comments"), {
        author: client?.name || "Client",
        content: `REVISION REQUESTED for "${fileName}": ${feedback}`,
        role: "client",
        timestamp: serverTimestamp(),
      });

      // Notify Designer
      await addDoc(collection(db, "notifications"), {
        userId: selectedProject.designerId,
        title: "Revision Requested",
        description: `${client?.name} requested changes on "${fileName}"`,
        type: "REQUESTED_CHANGES",
        read: false,
        timestamp: serverTimestamp(),
        projectId: selectedProject.id,
      });

      toast({ type: "success", title: "Revision Requested", message: "Designer has been notified." });
    } catch {
      toast({ type: "error", title: "Action failed" });
    } finally {
      setSubmittingDecision(null);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !selectedProject) return;
    setSendingComment(true);

    try {
      await addDoc(collection(db, "projects", selectedProject.id, "comments"), {
        author: client?.name || "Client",
        content: commentText,
        role: "client",
        timestamp: serverTimestamp(),
      });

      // Notify Designer
      await addDoc(collection(db, "notifications"), {
        userId: selectedProject.designerId,
        title: "New Client Comment",
        description: `${client?.name} commented on "${selectedProject.title}"`,
        type: "LEFT_COMMENT",
        read: false,
        timestamp: serverTimestamp(),
        projectId: selectedProject.id,
      });

      setCommentText("");
    } catch (error) {
      console.error(error);
      toast({ type: "error", title: "Failed to post comment" });
    } finally {
      setSendingComment(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedInvoice || !selectedProject) return;
    setMarkingPaid(true);

    try {
      await updateDoc(doc(db, "invoices", selectedInvoice.id), {
        status: "Paid",
      });

      const rate = exchangeRates[selectedInvoice.currency] || 1.0;
      const convertedVal = selectedInvoice.currency !== "INR" ? ` (₹${(selectedInvoice.amount * rate).toFixed(2)} INR)` : "";
      const methodLabel = activePaymentTab === "upi" ? "UPI QR Code" : activePaymentTab === "card" ? "Credit/Debit Card" : "SWIFT/Bank Transfer";

      await addDoc(collection(db, "projects", selectedProject.id, "comments"), {
        author: "System Notification",
        content: `PAYMENT CONFIRMED: Client paid ${getCurrencySymbol(selectedInvoice.currency)}${selectedInvoice.amount} ${selectedInvoice.currency}${convertedVal} for invoice "${selectedInvoice.title}" via ${methodLabel}.`,
        role: "client",
        timestamp: serverTimestamp(),
      });

      await addDoc(collection(db, "notifications"), {
        userId: selectedProject.designerId,
        title: `Invoice Paid via ${methodLabel}!`,
        description: `${client?.name} marked invoice "${selectedInvoice.title}" for ${getCurrencySymbol(selectedInvoice.currency)}${selectedInvoice.amount} as Paid`,
        type: "APPROVED_DESIGN",
        read: false,
        timestamp: serverTimestamp(),
        projectId: selectedProject.id,
      });

      toast({ type: "success", title: "Payment Recorded!", message: "Invoice marked as paid. Designer has been notified." });
      setShowPayModal(false);
      setSelectedInvoice(null);
    } catch (error) {
      console.error("Payment record failed:", error);
      toast({ type: "error", title: "Action failed" });
    } finally {
      setMarkingPaid(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-[#6b6b85] text-sm">
        Opening client portal...
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#111118] border border-[#1e1e2a] flex items-center justify-center mb-6 text-[#f87171]">
          <Lock size={22} />
        </div>
        <h2 className="text-xl font-bold text-[#f1f1f5] mb-2">Access Restricted</h2>
        <p className="text-sm text-[#a0a0b8] max-w-sm leading-relaxed">
          This client collaboration portal is secure. The requested link is invalid or expired.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f1f1f5] flex flex-col">
      {/* Portal Top Bar */}
      <header className="sticky top-0 bg-[#0d0d15] border-b border-[#1e1e2a] px-6 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c6af7] to-[#f472b6] flex items-center justify-center">
            <Vault size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#f1f1f5]">DesignVault Workspace</h1>
            <p className="text-[10px] text-[#6b6b85]">Review Portal: {client.companyName || client.name}</p>
          </div>
        </div>

        {/* Project Selector dropdown */}
        {projects.length > 1 && (
          <select
            value={selectedProject?.id || ""}
            onChange={(e) => setSelectedProject(projects.find(p => p.id === e.target.value) || null)}
            className="rounded-lg bg-[#111118] border border-[#2a2a38] text-xs text-[#f1f1f5] px-3 py-1.5 outline-none focus:border-[#7c6af7] transition-colors"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        )}
      </header>

      {/* Portal Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Deliverables Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {selectedProject ? (
            <>
              {/* Project Card */}
              <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <h2 className="text-lg font-bold text-[#f1f1f5]">{selectedProject.title}</h2>
                  <Badge variant={statusToBadgeVariant(selectedProject.status)} dot>
                    {selectedProject.status}
                  </Badge>
                </div>
                <p className="text-sm text-[#a0a0b8] leading-relaxed mb-6">
                  {selectedProject.description || "Review and download your deliverables below. Leave comments if revisions are required."}
                </p>
                          {/* Project Progress Steps */}
                <div className="pt-4 border-t border-[#1e1e2a]/60 space-y-4">
                  <div className="flex justify-between items-center text-[10px] text-[#6b6b85] font-semibold uppercase tracking-wider">
                    <span>Progress Pipeline</span>
                    <span className="text-[#7c6af7]">
                      {selectedProject.status === "Project Created" && "Phase 1: Project Kickoff"}
                      {selectedProject.status === "Planning" && "Phase 1: Planning & Setup"}
                      {selectedProject.status === "Designing" && "Phase 2: Active Designing"}
                      {selectedProject.status === "Client Review" && "Phase 3: Client Feedback"}
                      {selectedProject.status === "Revision Requested" && "Phase 3: Rework & Revisions"}
                      {selectedProject.status === "Final Delivery" && "Phase 4: Deliverables Ready"}
                      {selectedProject.status === "Completed" && "Completed & Signed Off 🎉"}
                      {selectedProject.status === "Archived" && "Archived & Completed"}
                    </span>
                  </div>

                  {/* Scrollable Container for Stepper (on mobile) */}
                  <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-[#2a2a38] scrollbar-track-transparent">
                    <div className="min-w-[600px] md:min-w-0 md:w-full relative flex items-center justify-between py-2">
                      
                      {/* Horizontal Connector Line Background */}
                      <div className="absolute left-0 right-0 h-[2px] bg-[#1e1e2a] top-[16px] z-0" />
                      
                      {/* Active Progress Connector Line (Colored) */}
                      <div 
                        className="absolute left-0 h-[2px] bg-gradient-to-r from-[#7c6af7] to-[#f472b6] top-[16px] z-0 transition-all duration-500"
                        style={{
                          width: (() => {
                            const currentIdx = STATUS_ORDER_CLIENT.indexOf(selectedProject.status as any);
                            const maxSteps = CLIENT_STEPS.length - 1;
                            const completedSteps = currentIdx === 7 ? maxSteps : Math.min(currentIdx, maxSteps);
                            return `${(completedSteps / maxSteps) * 100}%`;
                          })()
                        }}
                      />

                      {/* Stepper Nodes */}
                      {CLIENT_STEPS.map((step, idx) => {
                        const stepIndex = STATUS_ORDER_CLIENT.indexOf(step.key);
                        let currentIdx = STATUS_ORDER_CLIENT.indexOf(selectedProject.status as any);
                        if (currentIdx === 7) {
                          currentIdx = 6; // Treat Archived as Completed
                        }
                        const isCompleted = stepIndex < currentIdx;
                        const isActive = stepIndex === currentIdx;
                        const isPending = stepIndex > currentIdx;
                        const StepIcon = step.icon;

                        return (
                          <div key={step.key} className="flex flex-col items-center z-10 relative flex-1 text-center">
                            {/* Node Circle */}
                            <div 
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                                isCompleted 
                                  ? "bg-[#7c6af7] text-white shadow-[0_0_10px_rgba(124,106,247,0.3)]" 
                                  : isActive 
                                  ? "bg-[#1a1a24] border-2 border-[#f472b6] text-[#f472b6] shadow-[0_0_12px_rgba(244,114,182,0.4)] animate-pulse" 
                                  : "bg-[#161622] border border-[#2a2a38] text-[#5e5e78]"
                              }`}
                            >
                              {isCompleted ? (
                                <Check size={12} className="stroke-[3]" />
                              ) : (
                                <StepIcon size={12} className={isActive ? "stroke-[2.5]" : "stroke-[1.5]"} />
                              )}
                            </div>
                            
                            {/* Labels */}
                            <div className="mt-2 space-y-0.5">
                              <span 
                                className={`text-[10px] font-semibold block leading-none transition-colors duration-200 ${
                                  isActive 
                                    ? "text-[#f472b6]" 
                                    : isCompleted 
                                    ? "text-[#e9edef]" 
                                    : "text-[#5e5e78]"
                                }`}
                              >
                                {step.label}
                              </span>
                              <span className={`text-[8px] block leading-none ${isActive ? "text-[#a0a0b8]" : "text-[#4e4e65]"}`}>
                                {step.desc}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoices & Payments */}
              {invoices.length > 0 && (
                <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-[#f1f1f5] mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-[#7c6af7]" />
                    Invoices & Payments
                  </h3>
                  <div className="space-y-3">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="p-4 bg-[#1a1a24]/50 border border-[#2a2a38]/60 rounded-xl flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold text-[#f1f1f5]">{inv.title}</p>
                          <p className="text-[10px] text-[#6b6b85] mt-0.5">{getCurrencySymbol(inv.currency)}{inv.amount.toLocaleString("en-IN")}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {inv.status === "Paid" ? (
                            <span className="px-2.5 py-1 text-[10px] font-bold bg-[#34d399]/15 text-[#34d399] rounded-lg flex items-center gap-1">
                              <CheckCircle size={10} />
                              Paid
                            </span>
                          ) : (
                            <>
                              <span className="px-2.5 py-1 text-[10px] font-bold bg-[#fbbf24]/15 text-[#fbbf24] rounded-lg">
                                Pending
                              </span>
                              <Button
                                variant="primary"
                                size="sm"
                                className="!bg-[#7c6af7] hover:!bg-[#6b59e8]"
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setShowPayModal(true);
                                }}
                              >
                                Pay Invoice
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files list */}
              <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-[#f1f1f5]">Available Deliverables</h3>
                  {files.filter(f => f.url.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)/i.test(f.name)).length >= 2 && (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={handleOpenCompareModal}
                      className="text-xs border-[#2a2a38] text-[#a0a0b8] hover:text-[#7c6af7] hover:border-[#7c6af7]/30 transition-all flex items-center gap-1.5"
                    >
                      <ArrowUpRight size={13} />
                      Compare Versions
                    </Button>
                  )}
                </div>
                
                {files.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[#6b6b85]">
                    No deliverables uploaded by designer yet. Check back soon!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {files.map((file) => {
                      const isImage = file.url.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)/i.test(file.name);
                      const isCompletedLock = selectedProject?.status === "Completed" && invoices.some((inv) => inv.status === "Pending");
                      const isLocked = !!file.locked || isCompletedLock;
                      const lockLabel = isCompletedLock ? "Payment Required" : "Locked by Admin";
                      const lockTitle = isCompletedLock ? "Complete pending invoice to unlock download" : "Unlock requested by Admin to download";
                      
                      return (
                        <div key={file.id} className="p-5 bg-[#1a1a24]/50 border border-[#2a2a38]/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            {isImage ? (
                              <div 
                                className="w-16 h-16 rounded-xl overflow-hidden border border-[#2a2a38] flex-shrink-0 relative group/preview cursor-pointer"
                                onClick={() => setActivePreviewFile(file)}
                                title="Click to view preview"
                              >
                                <img 
                                  src={getImageUrl(file.url)} 
                                  alt={file.name} 
                                  className={`w-full h-full object-cover transition-all duration-300 ${
                                    isLocked 
                                      ? "brightness-75 select-none" 
                                      : "group-hover/preview:scale-105"
                                  }`}
                                  draggable={!isLocked}
                                  onContextMenu={(e) => {
                                    if (isLocked) e.preventDefault();
                                  }}
                                />
                                {isLocked && (
                                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-0.5 text-[#f87171] px-1 text-center">
                                    <Lock size={12} />
                                    <span className="text-[7px] font-bold tracking-wider uppercase leading-tight">{lockLabel}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                className="w-16 h-16 rounded-xl bg-[#7c6af7]/10 border border-[#7c6af7]/20 flex items-center justify-center text-[#7c6af7] flex-shrink-0 cursor-pointer hover:bg-[#7c6af7]/20 transition-colors"
                                onClick={() => setActivePreviewFile(file)}
                                title="Click to preview"
                              >
                                <FileText size={22} />
                              </div>
                            )}
                            <div>
                              <p 
                                className="text-sm font-semibold text-[#f1f1f5] hover:text-[#7c6af7] transition-colors cursor-pointer"
                                onClick={() => setActivePreviewFile(file)}
                                title="Click to view preview"
                              >
                                {file.name}
                              </p>
                              <p className="text-[10px] text-[#6b6b85] mt-0.5">{file.size}</p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2.5 self-end sm:self-center">
                            {isLocked ? (
                              <span 
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f87171]/10 border border-[#f87171]/20 text-xs font-semibold text-[#f87171] select-none cursor-not-allowed" 
                                title={lockTitle}
                              >
                                <Lock size={12} />
                                {lockLabel}
                              </span>
                            ) : (
                              <div className="flex gap-2">
                                <a 
                                  href={file.url}
                                  download={file.name}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111118] border border-[#2a2a38] text-xs font-semibold text-[#a0a0b8] hover:text-[#f1f1f5] transition-colors"
                                  title={isImage ? "Save directly to your phone gallery" : "Download to your device"}
                                >
                                  <Download size={13} />
                                  {isImage ? "Save Image" : "Download"}
                                </a>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  loading={savingToDrive === file.id}
                                  onClick={() => handleSaveToGoogleDrive(file)}
                                  className="flex items-center gap-1.5 text-xs border-[#2a2a38] text-[#a0a0b8] hover:text-[#53bdeb] hover:border-[#53bdeb]/30"
                                  title={`Save directly to Google Drive of ${client?.email}`}
                                >
                                  <ArrowUpRight size={13} />
                                  Save to Drive
                                </Button>
                              </div>
                            )}

                            {file.approved ? (
                              <span className="px-3 py-1.5 text-xs font-bold bg-[#34d399]/15 text-[#34d399] rounded-lg flex items-center gap-1">
                                <CheckCircle size={12} />
                                Approved
                              </span>
                            ) : (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="!text-[#f87171] hover:!bg-[#f87171]/10"
                                  onClick={() => handleRequestRevision(file.id, file.name)}
                                  loading={submittingDecision === file.id}
                                >
                                  Revise
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="!bg-[#34d399] hover:!bg-[#059669] !text-black"
                                  onClick={() => handleApproveFile(file.id, file.name)}
                                  loading={submittingDecision === file.id}
                                >
                                  Approve
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20 bg-[#111118] border border-[#1e1e2a] rounded-2xl text-[#6b6b85] text-sm">
              No active projects found.
            </div>
          )}

        </div>

        {/* Portal Feedback Column */}
        <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-6 flex flex-col h-[550px]">
          <h3 className="text-sm font-semibold text-[#f1f1f5] mb-4 flex items-center gap-2">
            <MessageSquare size={16} className="text-[#7c6af7]" />
            Feedback & Chat
          </h3>

          {/* WhatsApp Background Chat Pane */}
          <div className="flex-1 overflow-y-auto space-y-3 p-4 mb-4 rounded-xl bg-[#0b141a] border border-[#1f2c34]">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <MessageSquare size={24} className="text-[#3b4a54] mb-2" />
                <p className="text-xs text-[#8696a0]">No messages yet. Send a message to start chatting!</p>
              </div>
            ) : (
              comments.map((comment) => {
                const isSystem = comment.author === "System Notification";
                const isSent = comment.role === "client";
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
                        <p className="text-[10px] font-bold text-[#a78bfa] mb-0.5 select-none">
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
                  disabled={!selectedProject}
                  id="chat-file-attach-client" 
                />
                <label 
                  htmlFor="chat-file-attach-client"
                  className={`w-10 h-10 rounded-full bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a38] flex items-center justify-center text-[#a0a0b8] hover:text-[#f1f1f5] transition-all cursor-pointer flex-shrink-0 ${
                    !selectedProject ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  title="Attach File"
                >
                  <Paperclip size={16} />
                </label>

                <input 
                  type="text"
                  placeholder="Type a message..."
                  value={commentText}
                  disabled={!selectedProject}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                  className="flex-1 h-10 rounded-lg bg-[#1a1a24] border border-[#2a2a38] text-xs text-[#f1f1f5] px-4 outline-none focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7] transition-all"
                />

                <button 
                  onClick={startRecording}
                  disabled={!selectedProject}
                  className={`w-10 h-10 rounded-full bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a38] flex items-center justify-center text-[#a0a0b8] hover:text-[#53bdeb] hover:border-[#53bdeb]/40 transition-all cursor-pointer flex-shrink-0 ${
                    !selectedProject ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  title="Record Voice Note"
                >
                  <Mic size={16} />
                </button>

                <Button 
                  variant="primary" 
                  size="sm" 
                  loading={sendingComment} 
                  disabled={!selectedProject} 
                  onClick={handlePostComment}
                  className="h-10 px-4 flex-shrink-0"
                >
                  Send
                </Button>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Pay Invoice Modal */}
      {selectedInvoice && (
        <Modal
          open={showPayModal}
          onClose={() => {
            setShowPayModal(false);
            setSelectedInvoice(null);
          }}
          title="Secure Invoice Payout"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowPayModal(false);
                  setSelectedInvoice(null);
                }}
              >
                Cancel
              </Button>
              {(designer?.upiId || designer?.stripeLink || designer?.bankDetails) && (
                <Button
                  variant="primary"
                  loading={markingPaid}
                  onClick={handleMarkPaid}
                  className="!bg-[#34d399] hover:!bg-[#059669] !text-black"
                >
                  I Have Paid
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-5 py-2">
            <div className="text-center">
              <p className="text-xs text-[#a0a0b8] uppercase tracking-wider">Amount to Pay</p>
              <p className="text-3xl font-extrabold text-[#f1f1f5] mt-1">{getCurrencySymbol(selectedInvoice.currency)}{selectedInvoice.amount.toLocaleString("en-IN")}</p>
              <p className="text-xs text-[#6b6b85] mt-1">{selectedInvoice.title}</p>
            </div>

            {!designer?.upiId && !designer?.stripeLink && !designer?.bankDetails ? (
              <div className="p-5 rounded-xl bg-[#f87171]/10 border border-[#f87171]/20 max-w-sm mx-auto text-center">
                <AlertCircle size={24} className="text-[#f87171] mx-auto mb-2.5" />
                <h4 className="text-sm font-semibold text-[#f1f1f5] mb-1">No Payment Methods Configured</h4>
                <p className="text-xs text-[#a0a0b8] leading-relaxed">
                  Your designer has not configured their payout details yet. Please contact them to complete setting up their payment gateways.
                </p>
              </div>
            ) : (
              <>
                {/* Tabs Selector */}
                <div className="flex p-1 bg-[#1a1a24] border border-[#2a2a38] rounded-xl">
                  {designer.upiId && (
                    <button
                      onClick={() => setActivePaymentTab("upi")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        activePaymentTab === "upi" ? "bg-[#2a2a38] text-[#f1f1f5]" : "text-[#a0a0b8] hover:text-[#f1f1f5]"
                      }`}
                    >
                      UPI (India)
                    </button>
                  )}
                  {designer.stripeLink && (
                    <button
                      onClick={() => setActivePaymentTab("card")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        activePaymentTab === "card" ? "bg-[#2a2a38] text-[#f1f1f5]" : "text-[#a0a0b8] hover:text-[#f1f1f5]"
                      }`}
                    >
                      Debit / Credit Card
                    </button>
                  )}
                  {designer.bankDetails && (
                    <button
                      onClick={() => setActivePaymentTab("bank")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        activePaymentTab === "bank" ? "bg-[#2a2a38] text-[#f1f1f5]" : "text-[#a0a0b8] hover:text-[#f1f1f5]"
                      }`}
                    >
                      SWIFT / Wire Transfer
                    </button>
                  )}
                </div>

                {/* Tab Contents */}
                {activePaymentTab === "upi" && designer.upiId && (
                  <div className="space-y-4 text-center">
                    {/* UPI QR Code Generation */}
                    {(() => {
                      const isForeign = selectedInvoice.currency !== "INR";
                      const rate = exchangeRates[selectedInvoice.currency] || 1.0;
                      const convertedAmount = isForeign ? Number((selectedInvoice.amount * rate).toFixed(2)) : selectedInvoice.amount;
                      
                      const upiUrl = `upi://pay?pa=${designer.upiId}&pn=${encodeURIComponent(designer.name)}&am=${convertedAmount}&cu=INR&tn=${encodeURIComponent(selectedInvoice.title)}`;
                      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&bgcolor=ffffff&color=111118&data=${encodeURIComponent(upiUrl)}`;
                      
                      return (
                        <div className="space-y-4 max-w-xs mx-auto">
                          {isForeign && (
                            <div className="p-3 bg-[#ffe285]/10 border border-[#ffe285]/20 rounded-xl text-left text-xs space-y-1">
                              <p className="font-semibold text-[#ffd279] flex items-center gap-1.5">
                                <AlertCircle size={13} />
                                International UPI Conversion
                              </p>
                              <p className="text-[#a0a0b8] text-[10px] leading-relaxed">
                                UPI operates only in INR. The invoice has been converted to Indian Rupees at the current market rate:
                              </p>
                              <p className="text-white text-[11px] font-mono font-bold mt-1">
                                {getCurrencySymbol(selectedInvoice.currency)}{selectedInvoice.amount} {selectedInvoice.currency} = ₹{convertedAmount.toLocaleString("en-IN")} INR
                              </p>
                              <p className="text-[#6b6b85] text-[9px] font-mono">
                                Rate: 1 {selectedInvoice.currency} = {rate.toFixed(4)} INR
                              </p>
                            </div>
                          )}

                          <div className="p-3 bg-white rounded-2xl inline-block shadow-lg border border-[#e2e8f0]">
                            <img 
                              src={qrUrl} 
                              alt="UPI QR Code" 
                              className="w-[180px] h-[180px] mx-auto"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <p className="text-xs text-[#a0a0b8] leading-relaxed">
                              Scan this QR code using any UPI app (GPay, PhonePe, Paytm, BHIM) to pay directly to <span className="font-semibold text-[#f1f1f5]">{designer.name}</span>.
                            </p>
                            <p className="text-[11px] text-[#6b6b85] font-mono select-all">
                              UPI ID: {designer.upiId}
                            </p>
                            {isForeign && (
                              <p className="text-[10px] text-[#fbbf24] font-medium">
                                Converted Amount: ₹{convertedAmount.toLocaleString("en-IN")} INR
                              </p>
                            )}
                          </div>

                          {/* Click to pay deep link for mobile devices */}
                          <a
                            href={upiUrl}
                            className="inline-flex w-full items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a38] text-xs font-semibold text-[#f1f1f5] transition-colors mt-2"
                          >
                            <ExternalLink size={12} />
                            Pay directly from mobile
                          </a>
                        </div>
                      );
                    })()}

                    <div className="p-4 rounded-xl bg-[#34d399]/5 border border-[#34d399]/15 text-left max-w-sm mx-auto">
                      <h4 className="text-xs font-semibold text-[#34d399] mb-1">How UPI payments work:</h4>
                      <ol className="list-decimal pl-4 text-[10px] text-[#a0a0b8] space-y-1">
                        <li>Scan the QR code and authorize payment in your UPI app.</li>
                        <li>Once payment is successful, click **I Have Paid** below.</li>
                        <li>The designer will instantly be notified to verify and approve.</li>
                      </ol>
                    </div>
                  </div>
                )}

                {activePaymentTab === "card" && designer.stripeLink && (
                  <div className="space-y-4 max-w-xs mx-auto text-center">
                    <div className="p-4 rounded-xl bg-[#7c6af7]/5 border border-[#7c6af7]/15">
                      <CreditCard size={32} className="text-[#7c6af7] mx-auto mb-3" />
                      <h4 className="text-xs font-semibold text-[#f1f1f5] mb-1">Pay via Credit / Debit Card</h4>
                      <p className="text-[10px] text-[#a0a0b8] leading-relaxed">
                        International card transactions (Visa, Mastercard, Amex, Apple Pay) are supported securely.
                      </p>
                    </div>
                    <a
                      href={designer.stripeLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#7c6af7] hover:bg-[#6b59e8] text-sm font-bold text-white transition-all cursor-pointer shadow-lg shadow-[#7c6af7]/20"
                    >
                      <ExternalLink size={14} />
                      Pay with Stripe / Card
                    </a>
                    <div className="p-4 rounded-xl bg-[#34d399]/5 border border-[#34d399]/15 text-left max-w-sm mx-auto">
                      <h4 className="text-xs font-semibold text-[#34d399] mb-1">Next steps:</h4>
                      <ol className="list-decimal pl-4 text-[10px] text-[#a0a0b8] space-y-1">
                        <li>Click the checkout button above to pay via the secure gateway.</li>
                        <li>After checkout completes, return here and click **I Have Paid** below.</li>
                      </ol>
                    </div>
                  </div>
                )}

                {activePaymentTab === "bank" && designer.bankDetails && (
                  <div className="space-y-4 max-w-sm mx-auto">
                    <div className="p-4 rounded-xl bg-[#a0a0b8]/5 border border-[#2a2a38] space-y-3">
                      <div className="flex items-center gap-2 border-b border-[#2a2a38] pb-2 text-[#7c6af7]">
                        <Building size={16} />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Wire Transfer Credentials</h4>
                      </div>
                      <pre className="text-xs font-mono text-[#f1f1f5] whitespace-pre-wrap leading-relaxed">
                        {designer.bankDetails}
                      </pre>
                    </div>
                    <div className="p-4 rounded-xl bg-[#34d399]/5 border border-[#34d399]/15 text-left max-w-sm mx-auto space-y-1">
                      <h4 className="text-xs font-semibold text-[#34d399] mb-1">Direct SWIFT Transfers:</h4>
                      <ol className="list-decimal pl-4 text-[10px] text-[#a0a0b8] space-y-1">
                        <li>Initiate a wire transfer from your bank app using the SWIFT/IBAN details above.</li>
                        <li>Include the reference **"{selectedInvoice.title}"** in the transfer memo.</li>
                        <li>Click **I Have Paid** below to notify your agency/designer.</li>
                      </ol>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Lightbox / Deliverable Preview Modal */}
      {activePreviewFile && (
        <Modal
          open={!!activePreviewFile}
          onClose={() => setActivePreviewFile(null)}
          title={activePreviewFile.name || "Deliverable Preview"}
          footer={
            (() => {
              const isCompletedLock = selectedProject?.status === "Completed" && invoices.some((inv) => inv.status === "Pending");
              const isPreviewLocked = !!activePreviewFile.locked || isCompletedLock;
              const lockLabel = isCompletedLock ? "Payment Required" : "Locked by Admin";
              const lockTitle = isCompletedLock ? "Complete pending invoice to unlock download" : "Unlock required by Admin to download";
              
              return (
                <div className="flex justify-between items-center w-full">
                  <span className="text-xs text-[#6b6b85] font-mono">{activePreviewFile.size}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setActivePreviewFile(null)}>Close</Button>
                    {!isPreviewLocked ? (
                      <div className="flex gap-2">
                        <a
                          href={activePreviewFile.url}
                          download={activePreviewFile.name}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#34d399] hover:bg-[#059669] text-sm font-bold text-black transition-colors"
                          title={activePreviewFile.url.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)/i.test(activePreviewFile.name) ? "Save directly to your phone gallery" : "Download to your device"}
                        >
                          <Download size={14} />
                          {activePreviewFile.url.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)/i.test(activePreviewFile.name) ? "Save Image" : "Download File"}
                        </a>
                        <Button
                          variant="secondary"
                          loading={savingToDrive === activePreviewFile.id}
                          onClick={() => handleSaveToGoogleDrive(activePreviewFile)}
                          className="flex items-center gap-1.5 text-sm border-[#2a2a38] text-[#a0a0b8] hover:text-[#53bdeb] hover:border-[#53bdeb]/30"
                          title={`Save directly to Google Drive of ${client?.email}`}
                        >
                          <ArrowUpRight size={14} />
                          Save to Drive
                        </Button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f87171]/15 border border-[#f87171]/35 text-xs font-semibold text-[#f87171] select-none cursor-not-allowed" title={lockTitle}>
                        <Lock size={12} />
                        {lockLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()
          }
        >
          <div className="flex flex-col items-center justify-center bg-[#0b0b10] border border-[#1e1e2a] rounded-xl p-4 min-h-[300px] relative overflow-hidden select-none">
            {(() => {
              const isCompletedLock = selectedProject?.status === "Completed" && invoices.some((inv) => inv.status === "Pending");
              const isPreviewLocked = !!activePreviewFile.locked || isCompletedLock;
              const lockLabel = isCompletedLock ? "Payment Required" : "Locked by Admin";

              if (isPreviewLocked && isWindowBlurred) {
                return (
                  <div className="w-[450px] h-[300px] max-w-full rounded-lg bg-[#111118] border border-[#f87171]/20 flex flex-col items-center justify-center p-6 text-center select-none animate-pulse">
                    <Lock size={32} className="text-[#f87171] mb-3" />
                    <p className="text-sm font-semibold text-[#f1f1f5]">Secure Preview Hidden</p>
                    <p className="text-xs text-[#6b6b85] mt-1.5 leading-relaxed">
                      To prevent unauthorized screenshotting, previews are hidden when window focus is lost. Focus the window to resume viewing.
                    </p>
                  </div>
                );
              }
              
              if (activePreviewFile.url.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)/i.test(activePreviewFile.name)) {
                return (
                  <div className="relative max-w-full max-h-[450px] overflow-hidden rounded-lg">
                    <img
                      src={getImageUrl(activePreviewFile.url)}
                      alt={activePreviewFile.name}
                      className="max-w-full max-h-[450px] object-contain select-none pointer-events-none"
                      draggable={false}
                      onContextMenu={(e) => {
                        if (isPreviewLocked) e.preventDefault();
                      }}
                    />
                    {isPreviewLocked && (
                      <>
                        {/* Protective Watermark Grid Overlay to prevent screenshotting */}
                        <div 
                          className="absolute inset-0 pointer-events-none select-none flex flex-col items-center justify-center"
                          style={{
                            background: "repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45) 15px, rgba(255, 255, 255, 0.05) 15px, rgba(255, 255, 255, 0.05) 30px)",
                            backgroundImage: `
                              repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45) 15px, rgba(255, 255, 255, 0.05) 15px, rgba(255, 255, 255, 0.05) 30px),
                              url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'><text x='90' y='90' fill='rgba(255,255,255,0.06)' font-size='12' font-family='sans-serif' font-weight='bold' text-anchor='middle' transform='rotate(-30 90 90)'>PROPRIETARY</text><text x='90' y='108' fill='rgba(255,255,255,0.06)' font-size='9' font-family='sans-serif' font-weight='bold' text-anchor='middle' transform='rotate(-30 90 90)'>PREVIEW ONLY</text></svg>")
                            `
                          }}
                        >
                          <div className="text-[10px] sm:text-[14px] font-extrabold text-white/25 uppercase tracking-widest text-center select-none -rotate-12 border border-white/10 px-4 py-2 rounded-lg bg-black/40 backdrop-blur-[0.5px] max-w-[80%]">
                            PROPRIETARY PREVIEW - {lockLabel.toUpperCase()}
                          </div>
                        </div>
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded bg-black/85 border border-[#f87171]/40 text-[10px] text-[#f87171] font-bold tracking-wider uppercase flex items-center gap-1 z-10">
                          <Lock size={10} />
                          {lockLabel} (Preview Only)
                        </div>
                      </>
                    )}
                  </div>
                );
              }
              
              return (
                <div className="flex flex-col items-center py-12 text-center text-[#a0a0b8]">
                  <FileText size={48} className="text-[#6b6b85] mb-3" />
                  <p className="text-sm font-semibold text-[#f1f1f5]">{activePreviewFile.name}</p>
                  <p className="text-xs text-[#6b6b85] mt-1">{activePreviewFile.size}</p>
                  {isPreviewLocked && (
                    <div className="mt-4 px-3 py-1.5 rounded bg-[#f87171]/10 border border-[#f87171]/20 text-xs text-[#f87171] font-semibold flex items-center gap-1.5 justify-center">
                      <Lock size={12} />
                      {lockLabel} (Preview Only)
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Before/After Version Comparison Modal */}
      {showCompareModal && (
        <Modal
          open={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          title="Compare Deliverables (Before / After)"
          footer={
            <div className="flex justify-end w-full">
              <Button variant="primary" onClick={() => setShowCompareModal(false)}>Close Comparison</Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Image Selectors */}
            {(() => {
              const imageFiles = files.filter(f => f.url.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)/i.test(f.name));
              const leftFile = imageFiles.find(f => f.id === compareLeftFileId);
              const rightFile = imageFiles.find(f => f.id === compareRightFileId);
              
              return (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#6b6b85] font-bold uppercase tracking-wider">Before (Left Side)</label>
                      <select
                        value={compareLeftFileId}
                        onChange={(e) => setCompareLeftFileId(e.target.value)}
                        className="w-full h-10 rounded-lg bg-[#1a1a24] border border-[#2a2a38] text-xs text-[#f1f1f5] px-3 outline-none focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7] transition-all cursor-pointer"
                      >
                        {imageFiles.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#6b6b85] font-bold uppercase tracking-wider">After (Right Side)</label>
                      <select
                        value={compareRightFileId}
                        onChange={(e) => setCompareRightFileId(e.target.value)}
                        className="w-full h-10 rounded-lg bg-[#1a1a24] border border-[#2a2a38] text-xs text-[#f1f1f5] px-3 outline-none focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7] transition-all cursor-pointer"
                      >
                        {imageFiles.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {leftFile && rightFile ? (
                    <div className="relative w-full h-[360px] sm:h-[420px] bg-[#0b0b10] border border-[#1e1e2a] rounded-xl overflow-hidden select-none mt-2">
                      {/* Right Image (After) in Background */}
                      <img
                        src={rightFile.url}
                        alt={rightFile.name}
                        className="w-full h-full object-contain absolute inset-0 select-none pointer-events-none"
                      />
                      
                      {/* Left Image (Before) clipped */}
                      <div 
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ clipPath: `inset(0 ${100 - compareSliderValue}% 0 0)` }}
                      >
                        <img
                          src={leftFile.url}
                          alt={leftFile.name}
                          className="w-full h-full object-contain absolute inset-0 select-none pointer-events-none"
                        />
                      </div>

                      {/* Vertical Separator Line */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-[#7c6af7] pointer-events-none z-10"
                        style={{ left: `${compareSliderValue}%` }}
                      >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#7c6af7] border border-[#f1f1f5] shadow-lg flex items-center justify-center text-[#f1f1f5] pointer-events-none">
                          <span className="text-xs font-bold leading-none">↔</span>
                        </div>
                      </div>

                      {/* Corner Labels */}
                      <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/70 border border-[#2a2a38]/60 text-[9px] font-bold text-[#a0a0b8] rounded uppercase tracking-wider pointer-events-none z-10">
                        Before
                      </div>
                      <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 border border-[#2a2a38]/60 text-[9px] font-bold text-[#34d399] rounded uppercase tracking-wider pointer-events-none z-10">
                        After
                      </div>

                      {/* Range Input Drag Control Overlay */}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={compareSliderValue}
                        onChange={(e) => setCompareSliderValue(Number(e.target.value))}
                        className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-20 accent-transparent"
                      />
                    </div>
                  ) : (
                    <div className="py-20 text-center text-xs text-[#6b6b85] border border-dashed border-[#2a2a38] rounded-xl">
                      Select two image deliverables from the dropdowns above to compare.
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </Modal>
      )}
    </div>
  );
}
