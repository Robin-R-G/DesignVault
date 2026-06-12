"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Vault } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type AuthMode = "login" | "register" | "reset";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"designer" | "client">("designer");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user profile exists
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // New Google user — check if their email already exists in the clients collection
        const q = query(collection(db, "clients"), where("email", "==", user.email));
        const clientSnap = await getDocs(q);
        const isClient = !clientSnap.empty;

        await setDoc(userRef, {
          id: user.uid,
          email: user.email,
          name: user.displayName,
          role: isClient ? "client" : "designer",
          avatar: user.photoURL,
          createdAt: serverTimestamp(),
          googleDriveConnected: false,
        });

        if (isClient) {
          const clientData = clientSnap.docs[0].data();
          router.push(`/c/${clientData.slug}`);
        } else {
          router.push("/dashboard");
        }
      } else {
        const userData = userSnap.data();
        if (userData.role === "client") {
          const q = query(collection(db, "clients"), where("email", "==", user.email));
          const clientSnap = await getDocs(q);
          if (!clientSnap.empty) {
            const clientData = clientSnap.docs[0].data();
            router.push(`/c/${clientData.slug}`);
          } else {
            router.push("/client/pending");
          }
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err: unknown) {
      setError("Google sign-in failed. Please try again.");
      console.error(err);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "register") {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", result.user.uid), {
          id: result.user.uid,
          email,
          name,
          role,
          createdAt: serverTimestamp(),
          googleDriveConnected: false,
        });
        
        if (role === "client") {
          const q = query(collection(db, "clients"), where("email", "==", email));
          const clientSnap = await getDocs(q);
          if (!clientSnap.empty) {
            const clientData = clientSnap.docs[0].data();
            router.push(`/c/${clientData.slug}`);
          } else {
            router.push("/client/pending");
          }
        } else {
          router.push("/dashboard");
        }
      } else if (mode === "login") {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userSnap = await getDoc(doc(db, "users", result.user.uid));
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.role === "client") {
            const q = query(collection(db, "clients"), where("email", "==", email));
            const clientSnap = await getDocs(q);
            if (!clientSnap.empty) {
              const clientData = clientSnap.docs[0].data();
              router.push(`/c/${clientData.slug}`);
            } else {
              router.push("/client/pending");
            }
          } else {
            router.push("/dashboard");
          }
        } else {
          router.push("/dashboard");
        }
      } else if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setSuccessMessage("Password reset email sent! Check your inbox.");
      }
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || "An error occurred";
      if (message.includes("user-not-found") || message.includes("wrong-password") || message.includes("invalid-credential")) {
        setError("Invalid email or password.");
      } else if (message.includes("email-already-in-use")) {
        setError("An account with this email already exists.");
      } else if (message.includes("weak-password")) {
        setError("Password should be at least 6 characters.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Left: Branding Panel */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#7c6af7]/20 via-[#0a0a0f] to-[#f472b6]/10" />
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-[#7c6af7]/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-[#f472b6]/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between h-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7c6af7] to-[#f472b6] flex items-center justify-center">
              <Vault size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-[#f1f1f5]">DesignVault</span>
          </div>

          {/* Hero content */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-[#f1f1f5] leading-tight mb-6">
              The collaboration platform{" "}
              <span className="bg-gradient-to-r from-[#7c6af7] to-[#f472b6] bg-clip-text text-transparent">
                creative pros
              </span>{" "}
              love.
            </h1>
            <p className="text-[#a0a0b8] text-lg leading-relaxed">
              Stop juggling WhatsApp, email, and scattered Drive links. DesignVault gives every client a private portal, real-time updates, and one-click approvals.
            </p>

            {/* Feature pills */}
            <div className="mt-8 flex flex-wrap gap-3">
              {["Google Drive integrated", "Real-time collaboration", "Client approvals", "Version control"].map((feat) => (
                <span
                  key={feat}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#1a1a24] border border-[#2a2a38] text-[#a0a0b8]"
                >
                  ✦ {feat}
                </span>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="bg-[#1a1a24]/80 backdrop-blur-sm border border-[#2a2a38] rounded-2xl p-6 max-w-md">
            <p className="text-[#f1f1f5] text-sm leading-relaxed">
              &ldquo;DesignVault completely transformed how I deliver work to clients. No more chasing approvals on WhatsApp!&rdquo;
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#f472b6] flex items-center justify-center text-white text-xs font-bold">
                R
              </div>
              <div>
                <p className="text-sm font-medium text-[#f1f1f5]">Robin Thomas</p>
                <p className="text-xs text-[#6b6b85]">Graphic Designer & Branding Expert</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Auth Form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:max-w-md">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7c6af7] to-[#f472b6] flex items-center justify-center">
              <Vault size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-[#f1f1f5]">DesignVault</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#f1f1f5]">
              {mode === "login" ? "Welcome back" : mode === "register" ? "Create account" : "Reset password"}
            </h2>
            <p className="text-[#a0a0b8] mt-1 text-sm">
              {mode === "login"
                ? "Sign in to your DesignVault workspace"
                : mode === "register"
                ? "Join DesignVault and start collaborating"
                : "We'll send you a link to reset your password"}
            </p>
          </div>

          {/* Success message */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-[#34d399]/10 border border-[#34d399]/30 text-[#34d399] text-sm">
              {successMessage}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#f87171]/10 border border-[#f87171]/30 text-[#f87171] text-sm">
              {error}
            </div>
          )}

          {/* Google Sign In */}
          {mode !== "reset" && (
            <>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                loading={googleLoading}
                onClick={handleGoogleLogin}
                id="google-signin-btn"
                icon={
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                }
              >
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#1e1e2a]" />
                <span className="text-xs text-[#6b6b85]">or continue with email</span>
                <div className="flex-1 h-px bg-[#1e1e2a]" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
            {mode === "register" && (
              <Input
                label="Full Name"
                type="text"
                placeholder="Robin Thomas"
                value={name}
                onChange={(e) => setName(e.target.value)}
                leftIcon={<User size={16} />}
                required
                id="register-name"
              />
            )}

            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={16} />}
              required
              id="auth-email"
            />

            {mode !== "reset" && (
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "register" ? "Min. 6 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock size={16} />}
                rightIcon={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="cursor-pointer">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                required
                id="auth-password"
              />
            )}

            {/* Role selector for register */}
            {mode === "register" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[#a0a0b8]">I am a</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["designer", "client"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`
                        py-2.5 px-4 rounded-lg border text-sm font-medium capitalize transition-all duration-200
                        ${role === r
                          ? "bg-[#7c6af7]/15 border-[#7c6af7]/50 text-[#7c6af7]"
                          : "bg-[#111118] border-[#2a2a38] text-[#a0a0b8] hover:border-[#3a3a50]"
                        }
                      `}
                    >
                      {r === "designer" ? "🎨 Designer" : "🏢 Client"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "login" && (
              <button
                type="button"
                onClick={() => { setMode("reset"); setError(""); }}
                className="text-xs text-[#7c6af7] hover:text-[#6b59e8] transition-colors text-left"
              >
                Forgot password?
              </button>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              loading={loading}
              id="auth-submit-btn"
              icon={<ArrowRight size={16} />}
            >
              {mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Send Reset Link"}
            </Button>
          </form>

          {/* Switch mode */}
          <p className="text-center text-sm text-[#6b6b85] mt-6">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => { setMode("register"); setError(""); }}
                  className="text-[#7c6af7] hover:text-[#6b59e8] font-medium transition-colors"
                >
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setMode("login"); setError(""); }}
                  className="text-[#7c6af7] hover:text-[#6b59e8] font-medium transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
