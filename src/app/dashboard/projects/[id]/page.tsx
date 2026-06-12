"use client";

export const runtime = 'edge';

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Badge, { statusToBadgeVariant } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import {
  FolderOpen, Calendar, Clock, Plus, ArrowLeft, Upload, FileText,
  CheckCircle, AlertCircle, MessageSquare, Trash2, ExternalLink, Download,
  Mic, Play, Pause, Volume2, Paperclip, Square, Trash, Lock, Unlock, Check
} from "lucide-react";
import type { Project, Client } from "@/types";

interface FileMetadata {
  id?: string;
  name: string;
  url: string;
  size: string;
  uploadedAt: any;
  approved: boolean;
  driveFileId: string;
  locked?: boolean;
  designerId?: string;
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

const STATUS_STEPS = [
  { key: "Project Created", label: "Project Created", desc: "Project initial setup", icon: FolderOpen },
  { key: "Planning", label: "Planning", desc: "Roadmap & scope outline", icon: Calendar },
  { key: "Designing", label: "Designing", desc: "Active design development", icon: FileText },
  { key: "Client Review", label: "Client Review", desc: "Awaiting feedback", icon: Clock },
  { key: "Revision Requested", label: "Revision Requested", desc: "Revisions based on input", icon: AlertCircle },
  { key: "Final Delivery", label: "Final Delivery", desc: "Delivering high-res work", icon: Upload },
  { key: "Completed", label: "Completed", desc: "Project signed off & closed", icon: CheckCircle },
  { key: "Archived", label: "Archived", desc: "Stored in archives", icon: Lock },
] as const;

const STATUS_ORDER = [
  "Project Created",
  "Planning",
  "Designing",
  "Client Review",
  "Revision Requested",
  "Final Delivery",
  "Completed",
  "Archived"
] as const;

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals & Forms
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lockFile, setLockFile] = useState(false);
  
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // Preview modal state
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // Close preview on window blur (anti-screenshot)
  useEffect(() => {
    const handleBlur = () => { setIsWindowBlurred(true); };
    const handleFocus = () => { setIsWindowBlurred(false); };
    const blockKeys = (e: KeyboardEvent) => {
      if (!showPreview) return;
      if (
        e.key === 'PrintScreen' ||
        (e.ctrlKey && ['s', 'p', 'c'].includes(e.key.toLowerCase())) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        toast({ type: 'error', title: 'Disabled', message: 'Saving or capturing is disabled for protected previews.' });
      }
    };
    const blockContext = (e: MouseEvent) => { if (showPreview) e.preventDefault(); };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keydown', blockKeys);
    window.addEventListener('contextmenu', blockContext);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', blockKeys);
      window.removeEventListener('contextmenu', blockContext);
    };
  }, [showPreview]);

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
          await addDoc(collection(db, "projects", id as string, "comments"), {
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

        await addDoc(collection(db, "projects", id as string, "comments"), {
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
        await addDoc(collection(db, "projects", id as string, "comments"), {
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

  useEffect(() => {
    if (!id || !user) return;

    // Fetch Project
    const projectRef = doc(db, "projects", id as string);
    const unsubProject = onSnapshot(projectRef, async (docSnap) => {
      if (docSnap.exists()) {
        const projData = { id: docSnap.id, ...docSnap.data() } as Project;
        setProject(projData);

        // Fetch Client
        const clientRef = doc(db, "clients", projData.clientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
          setClient({ id: clientSnap.id, ...clientSnap.data() } as Client);
        }
      } else {
        toast({ type: "error", title: "Project not found" });
        router.push("/dashboard/projects");
      }
      setLoading(false);
    });

    // Fetch Files
    const filesQ = query(
      collection(db, "projects", id as string, "files"),
      where("designerId", "==", user?.uid)
    );
    const unsubFiles = onSnapshot(filesQ, (snap) => {
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as FileMetadata)));
    });

    // Fetch Comments
    const commentsQ = query(collection(db, "projects", id as string, "comments"));
    const unsubComments = onSnapshot(commentsQ, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
      setComments(list.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)));
    });

    return () => {
      unsubProject();
      unsubFiles();
      unsubComments();
    };
  }, [id, user, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name.replace(/\.[^/.]+$/, "")); // Auto fill name without extension
    }
  };

  const handleUploadFile = async () => {
    if (uploadMode === "link") {
      if (!fileName || !fileUrl) {
        toast({ type: "error", title: "Missing fields", message: "Please fill in file name and URL." });
        return;
      }
      setUploading(true);
      try {
        const driveFileId = "gdrive-" + Math.random().toString(36).substring(2, 12);
        await addDoc(collection(db, "projects", id as string, "files"), {
          name: fileName,
          url: fileUrl,
          size: "2.4 MB",
          uploadedAt: serverTimestamp(),
          approved: false,
          driveFileId,
          locked: lockFile,
          designerId: user?.uid,
        });

        await addDoc(collection(db, "activities"), {
          designerId: user!.uid,
          projectId: id,
          projectTitle: project?.title,
          type: "UPLOADED_FILE",
          description: `Uploaded file "${fileName}"`,
          timestamp: serverTimestamp(),
        });

        toast({ type: "success", title: "Asset link added!" });
        setShowUploadModal(false);
        setFileName("");
        setFileUrl("");
        setLockFile(false);
      } catch {
        toast({ type: "error", title: "Action failed" });
      } finally {
        setUploading(false);
      }
    } else {
      if (!selectedFile) {
        toast({ type: "error", title: "No file selected", message: "Please choose a file from your device." });
        return;
      }

      setUploading(true);
      setUploadProgress(15);
      
      // Simulate Google Drive API upload streaming
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          return prev + 20;
        });
      }, 150);

      try {
        const driveFileId = "gdrive-" + Math.random().toString(36).substring(2, 12);
        const sizeStr = selectedFile.size > 1024 * 1024 
          ? (selectedFile.size / (1024 * 1024)).toFixed(1) + " MB"
          : (selectedFile.size / 1024).toFixed(0) + " KB";
        const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf("."));
        const fullLabel = fileName ? `${fileName}${ext}` : selectedFile.name;

        const isImg = selectedFile.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)/i.test(selectedFile.name);

        const uploadFileRecord = async (finalUrl: string) => {
          clearInterval(interval);
          setUploadProgress(100);

          await addDoc(collection(db, "projects", id as string, "files"), {
            name: fullLabel,
            url: finalUrl,
            size: sizeStr,
            uploadedAt: serverTimestamp(),
            approved: false,
            driveFileId,
            locked: lockFile,
            designerId: user?.uid,
          });

          await addDoc(collection(db, "activities"), {
            designerId: user!.uid,
            projectId: id,
            projectTitle: project?.title,
            type: "UPLOADED_FILE",
            description: `Uploaded file "${fullLabel}"`,
            timestamp: serverTimestamp(),
          });

          toast({ type: "success", title: "File uploaded successfully!", message: fullLabel });
          setShowUploadModal(false);
          setSelectedFile(null);
          setFileName("");
          setUploadProgress(0);
          setLockFile(false);
          setUploading(false);
        };

        if (isImg) {
          const reader = new FileReader();
          reader.readAsDataURL(selectedFile);
          reader.onloadend = async () => {
            const rawBase64 = reader.result as string;
            // Compress the image before uploading to keep it under 1MB Firestore limit
            const compressedBase64 = await compressImage(rawBase64);
            if (compressedBase64.length > 1000000) {
              clearInterval(interval);
              toast({ 
                type: "error", 
                title: "Image too large", 
                message: "This image is too large. Please select a smaller design file." 
              });
              setUploading(false);
              return;
            }
            await uploadFileRecord(compressedBase64);
          };
        } else {
          // For non-images, if under 1MB, read as base64 data URL so they are downloadable
          if (selectedFile.size < 1000000) {
            const reader = new FileReader();
            reader.readAsDataURL(selectedFile);
            reader.onloadend = async () => {
              const base64Data = reader.result as string;
              await uploadFileRecord(base64Data);
            };
          } else {
            // fallback to mock URL for very large document files
            await uploadFileRecord(`https://drive.google.com/file/d/mock-${driveFileId}/view`);
          }
        }
      } catch (error) {
        clearInterval(interval);
        console.error(error);
        toast({ type: "error", title: "Upload failed" });
        setUploading(false);
      }
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setSendingComment(true);

    try {
      await addDoc(collection(db, "projects", id as string, "comments"), {
        author: user?.displayName || "Designer",
        content: commentText,
        role: "designer",
        timestamp: serverTimestamp(),
      });

      setCommentText("");
    } catch {
      toast({ type: "error", title: "Comment failed to post" });
    } finally {
      setSendingComment(false);
    }
  };

  const handleUpdateStatus = async (newStatus: Project["status"]) => {
    try {
      await updateDoc(doc(db, "projects", id as string), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      
      // Auto-post a system message comment in the chat
      await addDoc(collection(db, "projects", id as string, "comments"), {
        author: "System Notification",
        content: `Project status updated to: ${newStatus}`,
        role: "designer",
        timestamp: serverTimestamp(),
      });

      toast({ type: "success", title: "Project status updated", message: newStatus });
    } catch {
      toast({ type: "error", title: "Failed to update status" });
    }
  };

  const handleToggleFileLock = async (fileId: string, currentLockStatus: boolean) => {
    try {
      await updateDoc(doc(db, "projects", id as string, "files", fileId), {
        locked: !currentLockStatus,
      });
      toast({ 
        type: "success", 
        title: !currentLockStatus ? "File Locked" : "File Unlocked", 
        message: !currentLockStatus ? "Paywall activated. Client must pay invoices." : "Client can download this file now." 
      });
    } catch {
      toast({ type: "error", title: "Action failed" });
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Loading Project...">
        <div className="py-20 text-center text-[#6b6b85]">Loading workspace...</div>
      </DashboardLayout>
    );
  }


  if (!project) return null;

  return (
    <DashboardLayout title={project.title}>
      {/* Header Back Button */}
      <button 
        onClick={() => router.push("/dashboard/projects")}
        className="flex items-center gap-2 text-xs font-semibold text-[#6b6b85] hover:text-[#f1f1f5] transition-colors mb-6"
      >
        <ArrowLeft size={14} />
        Back to Projects
      </button>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Project Details */}
          <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-[#f1f1f5]">{project.title}</h2>
                <p className="text-xs text-[#6b6b85] mt-1">
                  Client: <span className="text-[#a0a0b8] font-medium">{client?.name || "Loading..."}</span>
                </p>
              </div>
              <Badge variant={statusToBadgeVariant(project.status)} dot>
                {project.status}
              </Badge>
            </div>

            <p className="text-sm text-[#a0a0b8] leading-relaxed mb-6">
              {project.description || "No description provided."}
            </p>

            {/* Meta Items */}
            <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-[#1e1e2a] text-xs text-[#a0a0b8]">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[#6b6b85]" />
                <span>Due Date: {(project.dueDate as any)?.toDate ? new Date((project.dueDate as any).toDate()).toLocaleDateString() : (project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "No date")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[#6b6b85]" />
                <span>Priority: <span className="font-semibold text-[#f1f1f5]">{project.priority}</span></span>
              </div>
            </div>
          </div>

          {/* Files / Deliverables Section */}
          <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-[#f1f1f5]">Deliverables & Reviews</h3>
              <Button variant="primary" size="sm" icon={<Upload size={14} />} onClick={() => setShowUploadModal(true)}>
                Upload File
              </Button>
            </div>

            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-[#2a2a38] rounded-xl">
                <FileText size={20} className="text-[#6b6b85] mb-2" />
                <p className="text-xs text-[#a0a0b8]">No deliverables uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-4 bg-[#1a1a24]/50 border border-[#2a2a38]/60 rounded-xl group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#7c6af7]/10 border border-[#7c6af7]/20 flex items-center justify-center text-[#7c6af7]">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#f1f1f5]">{file.name}</p>
                        <p className="text-[10px] text-[#6b6b85] mt-0.5">{file.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleFileLock(file.id!, !!file.locked)}
                        className={`p-1.5 rounded border flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                          file.locked
                            ? "bg-[#f87171]/10 border-[#f87171]/20 text-[#f87171] hover:bg-[#f87171]/20"
                            : "bg-[#34d399]/10 border-[#34d399]/20 text-[#34d399] hover:bg-[#34d399]/20"
                        }`}
                        title={file.locked ? "Click to unlock download for client" : "Click to lock download (Paywall)"}
                      >
                        {file.locked ? (
                          <>
                            <Lock size={12} />
                            Locked
                          </>
                        ) : (
                          <>
                            <Unlock size={12} />
                            Unlocked
                          </>
                        )}
                      </button>
                      {file.approved ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#34d399]/10 text-[#34d399] rounded">
                          Approved
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#fbbf24]/10 text-[#fbbf24] rounded">
                          Review Pending
                        </span>
                      )}
                      {/* Preview Button */}
                      <button
                        onClick={() => { setPreviewFile(file); setShowPreview(true); }}
                        className="p-1.5 rounded bg-[#111118] border border-[#2a2a38] text-[#a0a0b8] hover:text-[#f1f1f5] transition-colors"
                        title="Preview"
                      >
                        <ExternalLink size={12} />
                      </button>
                      {/* Download link – only enabled if unlocked */}
                      {!file.locked && (
                        <a 
                          href={file.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-1.5 rounded bg-[#111118] border border-[#2a2a38] text-[#a0a0b8] hover:text-[#f1f1f5] transition-colors"
                        >
                          <Download size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Status Update & Feedback comments */}
        <div className="space-y-6">
          
          {/* Quick Actions / Status Pipeline */}
          <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-[#6b6b85] uppercase tracking-wider mb-4">Project Status Pipeline</h3>
            <div className="space-y-1">
              {STATUS_STEPS.map((step, idx) => {
                const stepIndex = STATUS_ORDER.indexOf(step.key);
                const currentIndex = STATUS_ORDER.indexOf(project.status as any);
                const isCompleted = stepIndex < currentIndex;
                const isActive = stepIndex === currentIndex;
                const isPending = stepIndex > currentIndex;
                const StepIcon = step.icon;

                return (
                  <div key={step.key} className="flex gap-3 relative group">
                    {/* Left side: Node and line */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => handleUpdateStatus(step.key)}
                        title={`Set status to ${step.label}`}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 z-10 ${
                          isCompleted
                            ? "bg-[#7c6af7] text-white shadow-[0_0_8px_rgba(124,106,247,0.4)] hover:bg-[#8d7df8]"
                            : isActive
                            ? "bg-[#1a1a24] border-2 border-[#f472b6] text-[#f472b6] shadow-[0_0_12px_rgba(244,114,182,0.5)] animate-pulse cursor-default"
                            : "bg-[#161622] border border-[#2a2a38] text-[#5e5e78] hover:border-[#7c6af7] hover:text-[#7c6af7]"
                        }`}
                      >
                        {isCompleted ? (
                          <Check size={10} className="stroke-[3]" />
                        ) : (
                          <StepIcon size={10} className={isActive ? "stroke-[2.5]" : "stroke-[1.5]"} />
                        )}
                      </button>

                      {idx < STATUS_STEPS.length - 1 && (
                        <div
                          className={`w-[1.5px] flex-1 my-1 transition-colors duration-300 ${
                            stepIndex < currentIndex ? "bg-[#7c6af7]" : "bg-[#1e1e2a]"
                          }`}
                          style={{ minHeight: "16px" }}
                        />
                      )}
                    </div>

                    {/* Right side: Labels and descriptions */}
                    <button
                      onClick={() => handleUpdateStatus(step.key)}
                      className="flex-1 text-left pb-3 select-none hover:translate-x-0.5 transition-transform duration-200"
                    >
                      <span
                        className={`text-xs font-semibold block transition-colors duration-200 ${
                          isActive
                            ? "text-[#f472b6]"
                            : isCompleted
                            ? "text-[#e9edef] group-hover:text-[#7c6af7]"
                            : "text-[#5e5e78] group-hover:text-[#a0a0b8]"
                        }`}
                      >
                        {step.label}
                      </span>
                      <span
                        className={`text-[9px] block mt-0.5 leading-tight transition-colors duration-200 ${
                          isActive
                            ? "text-[#a0a0b8]"
                            : "text-[#4e4e65] group-hover:text-[#6b6b85]"
                        }`}
                      >
                        {step.desc}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-[#1e1e2a] text-center">
              <span className="text-[10px] text-[#6b6b85]">Portal URL for Client:</span>
              <div className="mt-1.5 px-2.5 py-1 rounded bg-[#1a1a24] border border-[#2a2a38] font-mono text-[10px] text-[#7c6af7] truncate select-all">
                designvault.app/c/{client?.slug}
              </div>
            </div>
          </div>

          {/* Comment Stream */}
          <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-5 flex flex-col h-[500px]">
            <h3 className="text-xs font-semibold text-[#6b6b85] uppercase tracking-wider mb-4 flex items-center gap-2">
              <MessageSquare size={14} className="text-[#7c6af7]" />
              Activity & Feedback
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
                    id="chat-file-attach-designer" 
                  />
                  <label 
                    htmlFor="chat-file-attach-designer"
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
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Deliverable"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowUploadModal(false)}>Cancel</Button>
            <Button variant="primary" loading={uploading} onClick={handleUploadFile}>Upload File</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Upload Mode Toggle */}
          <div className="flex p-1 bg-[#1a1a24] border border-[#2a2a38] rounded-lg mb-2">
            <button
              type="button"
              onClick={() => setUploadMode("file")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                uploadMode === "file" ? "bg-[#2a2a38] text-[#f1f1f5]" : "text-[#a0a0b8] hover:text-[#f1f1f5]"
              }`}
            >
              Upload Local File
            </button>
            <button
              type="button"
              onClick={() => setUploadMode("link")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                uploadMode === "link" ? "bg-[#2a2a38] text-[#f1f1f5]" : "text-[#a0a0b8] hover:text-[#f1f1f5]"
              }`}
            >
              Link Google Drive Asset
            </button>
          </div>

          {uploadMode === "file" ? (
            <div className="space-y-4">
              {/* File Select */}
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#2a2a38] rounded-xl bg-[#111118] hover:border-[#7c6af7]/50 transition-colors relative group">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="local-file-picker"
                />
                <Upload size={24} className="text-[#6b6b85] mb-2 group-hover:text-[#7c6af7] transition-colors" />
                <p className="text-xs text-[#a0a0b8] text-center font-medium">
                  {selectedFile ? selectedFile.name : "Click to browse files, albums, or gallery"}
                </p>
                {selectedFile && (
                  <p className="text-[10px] text-[#6b6b85] mt-1">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
              </div>

              <Input 
                label="Label / File Name (Optional)"
                placeholder="e.g. Logo V1"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                hint="Custom label for the file, defaults to selected file name."
                onKeyDown={(e) => e.key === "Enter" && handleUploadFile()}
              />

              {uploading && uploadProgress > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[10px] text-[#a0a0b8] font-mono">
                    <span>Streaming to Google Drive...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-[#1a1a24] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#7c6af7] h-full transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Input 
                label="File Name"
                placeholder="e.g. Logo Design V1 (High-Res)"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                required
                onKeyDown={(e) => e.key === "Enter" && handleUploadFile()}
              />
              <Input 
                label="File URL / Asset Link (Direct Google Drive Link)"
                placeholder="https://drive.google.com/..."
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                required
                hint="Provide a link to your asset. In a live system, this link is synced via the Drive Sync API automatically."
                onKeyDown={(e) => e.key === "Enter" && handleUploadFile()}
              />
            </div>
          )}

          {/* Lock Checkbox */}
          <div className="flex items-center gap-2 pt-2.5 border-t border-[#2a2a38]">
            <input
              type="checkbox"
              id="lock-file-checkbox"
              checked={lockFile}
              onChange={(e) => setLockFile(e.target.checked)}
              className="w-4 h-4 rounded border-[#2a2a38] bg-[#111118] text-[#7c6af7] focus:ring-[#7c6af7] cursor-pointer"
            />
            <label htmlFor="lock-file-checkbox" className="text-xs text-[#a0a0b8] font-medium cursor-pointer select-none">
              Lock download until invoice paid (Protective Paywall)
            </label>
          </div>
        </div>
      </Modal>
      {/* Preview Modal */}
      {showPreview && previewFile && (
        <Modal
          open={showPreview}
          onClose={() => { setShowPreview(false); setIsWindowBlurred(false); }}
          title={previewFile.name || 'File Preview'}
          footer={
            <div className="flex justify-between items-center w-full">
              <span className="text-xs text-[#6b6b85] font-mono">{previewFile.size}</span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowPreview(false)}>Close</Button>
                {!previewFile.locked && (
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#34d399] hover:bg-[#059669] text-sm font-bold text-black transition-colors"
                  >
                    <Download size={14} />
                    Download
                  </a>
                )}
              </div>
            </div>
          }
        >
          <div className="flex flex-col items-center justify-center bg-[#0b0b10] border border-[#1e1e2a] rounded-xl p-4 min-h-[300px] relative overflow-hidden select-none">
            {isWindowBlurred && previewFile.locked ? (
              <div className="w-full h-[300px] flex flex-col items-center justify-center p-6 text-center select-none">
                <Lock size={32} className="text-[#f87171] mb-3" />
                <p className="text-sm font-semibold text-[#f1f1f5]">Preview Hidden</p>
                <p className="text-xs text-[#6b6b85] mt-1.5 leading-relaxed">
                  Previews are hidden when the window loses focus to prevent screenshots.
                </p>
              </div>
            ) : (() => {
              const isImage = previewFile.url.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp)/i.test(previewFile.name);
              if (isImage) {
                return (
                  <div className="relative max-w-full overflow-hidden rounded-lg">
                    <img
                      src={getImageUrl(previewFile.url)}
                      alt={previewFile.name}
                      className="max-w-full max-h-[450px] object-contain select-none pointer-events-none"
                      draggable={false}
                      onContextMenu={(e) => { if (previewFile.locked) e.preventDefault(); }}
                    />
                    {previewFile.locked && (
                      <>
                        <div
                          className="absolute inset-0 pointer-events-none select-none"
                          style={{
                            backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.4), rgba(0,0,0,0.4) 15px, rgba(255,255,255,0.04) 15px, rgba(255,255,255,0.04) 30px),
                              url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><text x='90' y='90' fill='rgba(255,255,255,0.07)' font-size='12' font-family='sans-serif' font-weight='bold' text-anchor='middle' transform='rotate(-30 90 90)'>PROPRIETARY PREVIEW ONLY</text></svg>")`,
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="text-[13px] font-extrabold text-white/20 uppercase tracking-widest -rotate-12 border border-white/10 px-4 py-2 rounded-lg bg-black/40 backdrop-blur-sm">
                            LOCKED — PREVIEW ONLY
                          </div>
                        </div>
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded bg-black/85 border border-[#f87171]/40 text-[10px] text-[#f87171] font-bold tracking-wider uppercase flex items-center gap-1">
                          <Lock size={10} />
                          Locked
                        </div>
                      </>
                    )}
                  </div>
                );
              }
              return (
                <div className="flex flex-col items-center py-12 text-center text-[#a0a0b8]">
                  <FileText size={48} className="text-[#6b6b85] mb-3" />
                  <p className="text-sm font-semibold text-[#f1f1f5]">{previewFile.name}</p>
                  <p className="text-xs text-[#6b6b85] mt-1">{previewFile.size}</p>
                  {previewFile.locked && (
                    <div className="mt-4 px-3 py-1.5 rounded bg-[#f87171]/10 border border-[#f87171]/20 text-xs text-[#f87171] font-semibold flex items-center gap-1.5">
                      <Lock size={12} />
                      Locked — Preview Only
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
