"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { CreditCard, Plus, ArrowUpRight, DollarSign, Calendar, FileText, CheckCircle } from "lucide-react";
import type { Client } from "@/types";

interface Invoice {
  id?: string;
  clientId: string;
  clientName?: string;
  amount: number;
  currency: string;
  status: "Draft" | "Pending" | "Paid" | "Overdue";
  dueDate: any;
  createdAt: any;
  title: string;
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [updatingInvoice, setUpdatingInvoice] = useState(false);

  // Exchange rates state relative to INR (1 Unit of Foreign Currency = X INR)
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    USD: 83.5,
    GBP: 106.2,
    EUR: 90.1,
    CAD: 61.2,
    AUD: 55.4,
    INR: 1.0,
  });

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

  const getAmountInINR = (amount: number, cur: string) => {
    const rate = exchangeRates[cur] || 1.0;
    return amount * rate;
  };

  const totalRevenue = invoices
    .filter((inv) => inv.status === "Paid")
    .reduce((sum, inv) => sum + getAmountInINR(inv.amount, inv.currency), 0);

  const pendingRevenue = invoices
    .filter((inv) => inv.status === "Pending")
    .reduce((sum, inv) => sum + getAmountInINR(inv.amount, inv.currency), 0);

  // Form State
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("INR");

  const getCurrencySymbol = (cur: string) => {
    switch (cur) {
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
    if (!user) return;

    // Fetch clients
    const clientsQ = query(collection(db, "clients"), where("designerId", "==", user.uid));
    const unsubClients = onSnapshot(clientsQ, (snap) => {
      setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client)));
    });

    // Fetch invoices
    const invoicesQ = query(collection(db, "invoices"), where("designerId", "==", user.uid));
    const unsubInvoices = onSnapshot(invoicesQ, (snap) => {
      setInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice)));
    });

    return () => {
      unsubClients();
      unsubInvoices();
    };
  }, [user]);

  const handleCreateInvoice = async () => {
    if (!user || !title || !amount || !clientId || !dueDate) {
      toast({ type: "error", title: "Error", message: "Please fill out all fields" });
      return;
    }

    setCreating(true);
    try {
      const selectedClient = clients.find((c) => c.id === clientId);

      await addDoc(collection(db, "invoices"), {
        designerId: user.uid,
        clientId,
        clientName: selectedClient?.name || "Client",
        title,
        amount: parseFloat(amount),
        currency,
        status: "Pending",
        dueDate: new Date(dueDate),
        createdAt: serverTimestamp(),
      });

      toast({ type: "success", title: "Invoice Created", message: `Invoice for ${getCurrencySymbol(currency)}${amount} sent.` });
      setShowCreateInvoice(false);
      setTitle("");
      setAmount("");
      setClientId("");
      setDueDate("");
      setCurrency("INR");
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({ type: "error", title: "Error creating invoice" });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateInvoiceStatus = async (status: Invoice["status"]) => {
    if (!selectedInvoice?.id) return;
    setUpdatingInvoice(true);
    try {
      await updateDoc(doc(db, "invoices", selectedInvoice.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      setSelectedInvoice((prev) => prev ? { ...prev, status } : null);
      toast({ type: "success", title: "Invoice Updated", message: `Status changed to ${status}` });
    } catch (error) {
      console.error(error);
      toast({ type: "error", title: "Action failed" });
    } finally {
      setUpdatingInvoice(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice?.id) return;
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    setUpdatingInvoice(true);
    try {
      await deleteDoc(doc(db, "invoices", selectedInvoice.id));
      setShowInvoiceDetails(false);
      setSelectedInvoice(null);
      toast({ type: "success", title: "Invoice Deleted" });
    } catch (error) {
      console.error(error);
      toast({ type: "error", title: "Delete failed" });
    } finally {
      setUpdatingInvoice(false);
    }
  };

  const getStatusBadge = (status: Invoice["status"]) => {
    switch (status) {
      case "Paid":
        return <Badge variant="success" dot>Paid</Badge>;
      case "Pending":
        return <Badge variant="warning" dot>Pending</Badge>;
      case "Overdue":
        return <Badge variant="error" dot>Overdue</Badge>;
      default:
        return <Badge variant="default" dot>Draft</Badge>;
    }
  };

  const getGroupedRevenue = (status: Invoice["status"]) => {
    const groups: Record<string, number> = {};
    invoices
      .filter((inv) => inv.status === status)
      .forEach((inv) => {
        groups[inv.currency] = (groups[inv.currency] || 0) + inv.amount;
      });
    
    const entries = Object.entries(groups);
    if (entries.length === 0) return "0";
    return entries.map(([cur, val]) => `${getCurrencySymbol(cur)}${val.toLocaleString("en-IN")}`).join(" | ");
  };

  return (
    <DashboardLayout title="Payments">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#f1f1f5]">Invoices & Payments</h2>
          <p className="text-[#6b6b85] mt-1 text-sm">Create client invoices and track project revenue.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateInvoice(true)} icon={<Plus size={16} />}>
          New Invoice
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-5">
          <p className="text-xs font-semibold text-[#6b6b85] uppercase tracking-wider">Total Received</p>
          <p className="text-2xl font-bold text-[#f1f1f5] mt-2 truncate" title={`Unified: ₹${totalRevenue.toLocaleString("en-IN")} (~$${(totalRevenue / (exchangeRates.USD || 83.5)).toFixed(2)} USD)`}>
            ₹{totalRevenue.toLocaleString("en-IN")}
            <span className="text-sm font-medium text-[#6b6b85] ml-1.5">
              (~${(totalRevenue / (exchangeRates.USD || 83.5)).toFixed(0)})
            </span>
          </p>
          <div className="flex items-center gap-1.5 text-xs text-[#34d399] mt-2 font-medium truncate" title={getGroupedRevenue("Paid")}>
            <CheckCircle size={12} className="flex-shrink-0" />
            <span className="truncate">{getGroupedRevenue("Paid")}</span>
          </div>
        </div>

        <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-5">
          <p className="text-xs font-semibold text-[#6b6b85] uppercase tracking-wider">Pending Collection</p>
          <p className="text-2xl font-bold text-[#fbbf24] mt-2 truncate" title={`Unified: ₹${pendingRevenue.toLocaleString("en-IN")} (~$${(pendingRevenue / (exchangeRates.USD || 83.5)).toFixed(2)} USD)`}>
            ₹{pendingRevenue.toLocaleString("en-IN")}
            <span className="text-sm font-medium text-[#6b6b85] ml-1.5">
              (~${(pendingRevenue / (exchangeRates.USD || 83.5)).toFixed(0)})
            </span>
          </p>
          <div className="flex items-center gap-1.5 text-xs text-[#6b6b85] mt-2 truncate" title={getGroupedRevenue("Pending")}>
            <span className="truncate">{getGroupedRevenue("Pending")}</span>
          </div>
        </div>

        <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-5">
          <p className="text-xs font-semibold text-[#6b6b85] uppercase tracking-wider">Total Invoices</p>
          <p className="text-3xl font-bold text-[#7c6af7] mt-2">{invoices.length}</p>
          <div className="flex items-center gap-1.5 text-xs text-[#6b6b85] mt-2">
            Across all clients
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl overflow-hidden">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#1a1a24] border border-[#2a2a38] flex items-center justify-center mb-5">
              <FileText size={22} className="text-[#6b6b85]" />
            </div>
            <h3 className="text-lg font-semibold text-[#f1f1f5] mb-2">No invoices created yet</h3>
            <p className="text-sm text-[#a0a0b8] max-w-sm mb-6">
              Create professional invoices for your deliverables and get paid faster.
            </p>
            <Button variant="primary" onClick={() => setShowCreateInvoice(true)} icon={<Plus size={16} />}>
              Create First Invoice
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1e1e2a] text-xs font-semibold text-[#6b6b85] uppercase tracking-wider bg-[#0a0a0f]/50">
                  <th className="px-6 py-4">Invoice Detail</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2a]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#1a1a24]/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-[#f1f1f5]">{inv.title}</p>
                      <p className="text-[10px] text-[#6b6b85] mt-0.5">INV-{inv.id?.substring(0, 6).toUpperCase()}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#a0a0b8]">
                      {inv.clientName}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-[#f1f1f5]">
                      {getCurrencySymbol(inv.currency)}{inv.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#a0a0b8] font-mono">
                      {inv.dueDate?.toDate ? new Date(inv.dueDate.toDate()).toLocaleDateString() : new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setShowInvoiceDetails(true);
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      <Modal
        open={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
        title="Create New Invoice"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateInvoice(false)}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={handleCreateInvoice}>Create Invoice</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Invoice Item / Description"
            placeholder="e.g. Logo Design Milestone 1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#a0a0b8]">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full h-10 rounded-lg bg-[#111118] border border-[#2a2a38] text-[#f1f1f5] text-sm px-3 outline-none focus:border-[#7c6af7] transition-colors"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5 col-span-1">
              <label className="text-sm font-medium text-[#a0a0b8]">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-10 rounded-lg bg-[#111118] border border-[#2a2a38] text-[#f1f1f5] text-sm px-3 outline-none focus:border-[#7c6af7] transition-colors cursor-pointer"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="EUR">EUR (€)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="AUD">AUD (A$)</option>
              </select>
            </div>
            <div className="col-span-2">
              <Input
                label={`Amount (${currency})`}
                type="number"
                placeholder="5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>
      </Modal>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <Modal
          open={showInvoiceDetails}
          onClose={() => {
            setShowInvoiceDetails(false);
            setSelectedInvoice(null);
          }}
          title="Invoice Details"
          footer={
            <>
              <Button
                variant="ghost"
                className="text-[#f87171] hover:bg-[#f87171]/10"
                onClick={handleDeleteInvoice}
                loading={updatingInvoice}
              >
                Delete Invoice
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                onClick={() => {
                  setShowInvoiceDetails(false);
                  setSelectedInvoice(null);
                }}
              >
                Close
              </Button>
              {selectedInvoice.status !== "Paid" && (
                <Button
                  variant="primary"
                  className="!bg-[#34d399] hover:!bg-[#059669] !text-black"
                  onClick={() => handleUpdateInvoiceStatus("Paid")}
                  loading={updatingInvoice}
                >
                  Mark as Paid
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-[#6b6b85] uppercase tracking-wider font-semibold">Invoice ID</p>
                <p className="text-xs font-mono text-[#f1f1f5] mt-1">INV-{selectedInvoice.id?.substring(0, 8).toUpperCase()}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#6b6b85] uppercase tracking-wider font-semibold">Status</p>
                <div className="mt-1">{getStatusBadge(selectedInvoice.status)}</div>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-[#6b6b85] uppercase tracking-wider font-semibold">Item / Description</p>
              <p className="text-sm font-semibold text-[#f1f1f5] mt-1">{selectedInvoice.title}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-[#6b6b85] uppercase tracking-wider font-semibold">Client Name</p>
                <p className="text-sm text-[#a0a0b8] mt-1">{selectedInvoice.clientName}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#6b6b85] uppercase tracking-wider font-semibold">Amount</p>
                <p className="text-sm font-extrabold text-[#f1f1f5] mt-1">{getCurrencySymbol(selectedInvoice.currency)}{selectedInvoice.amount.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-[#6b6b85] uppercase tracking-wider font-semibold">Due Date</p>
              <p className="text-xs font-mono text-[#a0a0b8] mt-1">
                {selectedInvoice.dueDate?.toDate 
                  ? new Date(selectedInvoice.dueDate.toDate()).toLocaleDateString() 
                  : new Date(selectedInvoice.dueDate).toLocaleDateString()}
              </p>
            </div>

            {/* Sharing link */}
            {(() => {
              const matchedClient = clients.find(c => c.id === selectedInvoice.clientId);
              const portalUrl = matchedClient ? `${window.location.origin}/c/${matchedClient.slug}` : "";
              
              if (!portalUrl) return null;
              
              return (
                <div className="pt-2">
                  <p className="text-[10px] text-[#6b6b85] uppercase tracking-wider font-semibold">Client Portal URL</p>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={portalUrl}
                      className="flex-1 h-9 rounded-lg bg-[#1a1a24] border border-[#2a2a38] text-xs text-[#a0a0b8] px-3 outline-none"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(portalUrl);
                        toast({ type: "success", title: "Link copied to clipboard" });
                      }}
                    >
                      Copy Link
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
