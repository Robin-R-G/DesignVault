"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { Settings, User, Building, Palette, Save } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [brandColor, setBrandColor] = useState("#7c6af7");
  const [website, setWebsite] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [stripeLink, setStripeLink] = useState("");

  useEffect(() => {
    if (!user) return;

    const fetchUserProfile = async () => {
      try {
        setDisplayName(user.displayName || "");
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setCompanyName(data.companyName || "");
          setBrandColor(data.brandColor || "#7c6af7");
          setWebsite(data.website || "");
          setUpiId(data.upiId || "");
          setBankDetails(data.bankDetails || "");
          setStripeLink(data.stripeLink || "");
        }
      } catch (error) {
        console.error("Error loading profile settings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Update Firebase Auth Profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName,
        });
      }

      // Update Firestore User Profile
      await updateDoc(doc(db, "users", user.uid), {
        displayName,
        companyName,
        brandColor,
        website,
        upiId,
        bankDetails,
        stripeLink,
        updatedAt: new Date(),
      });

      toast({
        type: "success",
        title: "Settings Saved",
        message: "Your profile and workspace configuration have been updated.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        type: "error",
        title: "Save Failed",
        message: "Unable to update profile settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Settings">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#f1f1f5]">Workspace Settings</h2>
        <p className="text-[#6b6b85] mt-1 text-sm">Configure your personal profile and workspace brand styles.</p>
      </div>

      <div className="max-w-3xl space-y-6">
        {loading ? (
          <div className="py-12 text-center text-[#6b6b85]">Loading profile settings...</div>
        ) : (
          <>
            {/* Profile Section */}
            <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6 border-b border-[#1e1e2a] pb-4">
                <User size={18} className="text-[#7c6af7]" />
                <h3 className="text-sm font-semibold text-[#f1f1f5]">Personal Profile</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Display Name"
                  placeholder="e.g. John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  hint="Your primary email for logging in."
                />
              </div>
            </div>

            {/* Brand Workspace */}
            <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6 border-b border-[#1e1e2a] pb-4">
                <Building size={18} className="text-[#7c6af7]" />
                <h3 className="text-sm font-semibold text-[#f1f1f5]">Workspace & Brand</h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Agency / Company Name"
                    placeholder="e.g. Pixel Perfect Designs"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                  <Input
                    label="Website URL"
                    placeholder="e.g. https://agency.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                {/* Theme brand customization */}
                <div className="flex flex-col gap-2 pt-2">
                  <label className="text-sm font-medium text-[#a0a0b8] flex items-center gap-1.5">
                    <Palette size={14} />
                    Primary Client Portal Brand Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="w-12 h-10 rounded border border-[#2a2a38] bg-transparent cursor-pointer"
                    />
                    <Input
                      placeholder="#7c6af7"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="max-w-[150px]"
                    />
                    <p className="text-xs text-[#6b6b85] max-w-md">
                      This color is used to theme your private client portals so they feel custom-tailored to your studio brand.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment & Payout Configuration */}
            <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6 border-b border-[#1e1e2a] pb-4">
                <Save size={18} className="text-[#7c6af7]" />
                <h3 className="text-sm font-semibold text-[#f1f1f5]">Payment Gateway & Payout Settings</h3>
              </div>
              <div className="space-y-6">
                {/* UPI ID */}
                <Input
                  label="UPI ID (India Direct Transfers)"
                  placeholder="e.g. yourname@okaxis or designer@ybl"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  hint="Enables instant zero-fee payments and QR codes in client portals (India only)."
                />

                {/* Stripe / PayPal Link */}
                <Input
                  label="Stripe / PayPal Payment Link (Debit/Credit Card)"
                  placeholder="https://buy.stripe.com/... or https://paypal.me/..."
                  value={stripeLink}
                  onChange={(e) => setStripeLink(e.target.value)}
                  hint="A direct checkout URL where foreign/international clients can pay using Credit Cards, Debit Cards, Apple Pay, etc."
                />

                {/* Wire / Swift bank details */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#a0a0b8]">
                    International Bank Account Details (SWIFT / Wire Transfer)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="e.g.&#10;Bank Name: JPMorgan Chase&#10;Account Name: Pixel Perfect LLC&#10;IBAN / Account Number: US123456...&#10;SWIFT / BIC Code: CHASUS33"
                    value={bankDetails}
                    onChange={(e) => setBankDetails(e.target.value)}
                    className="w-full rounded-lg bg-[#1a1a24] border border-[#2a2a38] text-xs text-[#f1f1f5] p-3 outline-none focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7] transition-all resize-none"
                  />
                  <p className="text-[10px] text-[#6b6b85]">
                    Provide bank routing and account details. These will be visible to your foreign clients in their portal to initiate bank-to-bank wire transfers.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20 mt-2">
                  <h4 className="text-xs font-semibold text-[#fbbf24] mb-1">Onboarding Setup Requirement</h4>
                  <p className="text-[11px] text-[#a0a0b8] leading-relaxed">
                    You must specify **at least one** payout method above. Configuring your payment details unlocks your dashboard, enables client portals, and activates paywall locks for deliverable files.
                  </p>
                </div>
              </div>
            </div>

            {/* Save bar */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1e1e2a]">
              <Button
                variant="primary"
                loading={saving}
                onClick={handleSaveSettings}
                icon={<Save size={16} />}
              >
                Save All Settings
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
