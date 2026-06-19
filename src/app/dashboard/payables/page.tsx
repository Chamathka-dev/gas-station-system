'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Home, PlusCircle, CreditCard, Save, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';

export default function PayablesDashboard() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI Toggles
  const [activeTab, setActiveTab] = useState<'invoice' | 'payment'>('invoice');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invoice Form State
  const [invSupplierId, setInvSupplierId] = useState('');
  const [invNo, setInvNo] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invTerms, setInvTerms] = useState('4'); // Default 4 days

  // Payment Form State
  const [payInvoiceId, setPayInvoiceId] = useState('');
  const [payAmount, setPayAmount] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: supData } = await supabase.from('suppliers').select('*').order('name');
      if (supData) setSuppliers(supData);

      // Fetch invoices AND their related payments in one go!
      const { data: invData } = await supabase
        .from('invoices')
        .select(`
          *,
          suppliers(name),
          supplier_payments(amount_paid)
        `)
        .order('id', { ascending: false });
      
      if (invData) setInvoices(invData);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Calculate Status & Balances ---
  const today = new Date().toISOString().split('T')[0];

  const getInvoiceDetails = (inv: any) => {
    const totalPaid = inv.supplier_payments?.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0) || 0;
    const balance = Number(inv.amount) - totalPaid;
    
    let status = 'PENDING';
    if (balance <= 0) status = 'PAID';
    else if (inv.due_date < today) status = 'OVERDUE';

    return { totalPaid, balance, status };
  };

  // --- Form Handlers ---
  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Auto-calculate Due Date based on terms
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + parseInt(invTerms));
    const calculatedDueDate = dueDateObj.toISOString().split('T')[0];

    try {
      const { error } = await supabase.from('invoices').insert({
        supplier_id: parseInt(invSupplierId),
        invoice_no: invNo,
        amount: parseFloat(invAmount),
        due_date: calculatedDueDate
      });

      if (error) throw error;
      
      setInvNo(''); setInvAmount('');
      await fetchData();
      alert("Invoice added successfully!");
    } catch (err: any) {
      alert(`Failed to save invoice: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('supplier_payments').insert({
        invoice_id: parseInt(payInvoiceId),
        amount_paid: parseFloat(payAmount)
      });

      if (error) throw error;

      setPayInvoiceId(''); setPayAmount('');
      await fetchData();
      alert("Payment logged successfully!");
    } catch (err: any) {
      alert(`Failed to log payment: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && invoices.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Accounts Payable...
      </div>
    );
  }

  // Calculate Total Outstanding Debt for the Widget
  const totalDebt = invoices.reduce((sum, inv) => {
    const { balance } = getInvoiceDetails(inv);
    return sum + (balance > 0 ? balance : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <header className="bg-slate-900 text-white p-4 flex items-center gap-4 shadow-md">
        <Link href="/dashboard" className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-sm">
          <Home size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Accounts Payable</h1>
          <p className="text-sm text-slate-400">Manage Supplier Invoices & Payments</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Data Entry Forms */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Total Debt Widget */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-center shadow-sm">
            <h2 className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-2">Total Outstanding Debt</h2>
            <p className="text-3xl font-extrabold text-orange-600">Rs. {totalDebt.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200">
              <button onClick={() => setActiveTab('invoice')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'invoice' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                <PlusCircle size={16} /> Add Bill
              </button>
              <button onClick={() => setActiveTab('payment')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'payment' ? 'bg-white text-emerald-600 border-b-2 border-emerald-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                <CreditCard size={16} /> Log Payment
              </button>
            </div>

            <div className="p-6">
              {/* Add Invoice Form */}
              {activeTab === 'invoice' && (
                <form onSubmit={handleAddInvoice} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier</label>
                    <select required value={invSupplierId} onChange={e => setInvSupplierId(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500">
                      <option value="" disabled>Select Supplier...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice / Ref No.</label>
                    <input type="text" required value={invNo} onChange={e => setInvNo(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="e.g. INV-2024" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Total Bill (Rs.)</label>
                      <input type="number" required value={invAmount} onChange={e => setInvAmount(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-3 py-2 font-semibold outline-none focus:border-blue-500" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Terms</label>
                      <select value={invTerms} onChange={e => setInvTerms(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500">
                        <option value="0">Due Immediately</option>
                        <option value="3">3 Days</option>
                        <option value="4">4 Days</option>
                        <option value="7">7 Days</option>
                        <option value="14">14 Days</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg mt-2 flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Bill
                  </button>
                </form>
              )}

              {/* Add Payment Form */}
              {activeTab === 'payment' && (
                <form onSubmit={handleAddPayment} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Apply Payment To Invoice</label>
                    <select required value={payInvoiceId} onChange={e => setPayInvoiceId(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-emerald-500">
                      <option value="" disabled>Select Pending Invoice...</option>
                      {invoices.filter(i => getInvoiceDetails(i).balance > 0).map(i => (
                        <option key={i.id} value={i.id}>{i.invoice_no} ({i.suppliers?.name}) - Owes: Rs.{getInvoiceDetails(i).balance.toLocaleString()}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Paid (Rs.)</label>
                    <input type="number" required value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-3 py-2 font-semibold outline-none focus:border-emerald-500" placeholder="0.00" />
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg mt-2 flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />} Record Payment
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: The Master Ledger */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
            <div className="bg-slate-100 p-4 border-b border-slate-200">
              <h2 className="font-bold text-slate-800">Master Invoice Tracker</h2>
            </div>
            <div className="overflow-auto max-h-[700px]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-slate-600">Inv No.</th>
                    <th className="py-3 px-4 font-semibold text-slate-600">Supplier</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-right">Bill Amt</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-right">Balance</th>
                    <th className="py-3 px-4 font-semibold text-slate-600">Due Date</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-400">No invoices recorded yet.</td></tr>
                  ) : (
                    invoices.map(inv => {
                      const { balance, status } = getInvoiceDetails(inv);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-700">{inv.invoice_no}</td>
                          <td className="py-3 px-4 text-slate-600">{inv.suppliers?.name}</td>
                          <td className="py-3 px-4 text-right text-slate-500">{inv.amount.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800">{balance > 0 ? balance.toLocaleString() : '-'}</td>
                          <td className="py-3 px-4 text-slate-500">{inv.due_date}</td>
                          <td className="py-3 px-4 text-center">
                            {status === 'PAID' && <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold"><CheckCircle2 size={12}/> PAID</span>}
                            {status === 'OVERDUE' && <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold"><AlertCircle size={12}/> OVERDUE</span>}
                            {status === 'PENDING' && <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold"><Clock size={12}/> PENDING</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}