'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Home, PlusCircle, CreditCard, Save, AlertCircle, CheckCircle2, Clock, UserPlus, X, FileDown, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function PayablesDashboard() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'invoice' | 'payment'>('invoice');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  const [invSupplierId, setInvSupplierId] = useState('');
  const [invNo, setInvNo] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invTerms, setInvTerms] = useState('4');

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

      const { data: invData } = await supabase
        .from('invoices')
        .select(`*, suppliers(name), supplier_payments(amount_paid)`)
        .order('id', { ascending: false });
      
      if (invData) setInvoices(invData);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const getInvoiceDetails = (inv: any) => {
    const totalPaid = inv.supplier_payments?.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0) || 0;
    const balance = Number(inv.amount) - totalPaid;
    let status = 'PENDING';
    if (balance <= 0) status = 'PAID';
    else if (inv.due_date < today) status = 'OVERDUE';
    return { totalPaid, balance, status };
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('suppliers').insert({ name: newSupplierName.toUpperCase(), default_credit_days: 7 });
      if (error) throw error;
      setNewSupplierName('');
      setShowAddSupplier(false);
      await fetchData();
    } catch (error: any) { alert(`Failed to add supplier: ${error.message}`); } 
    finally { setIsSubmitting(false); }
  };

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + parseInt(invTerms));
    const calculatedDueDate = dueDateObj.toISOString().split('T')[0];

    try {
      const { error } = await supabase.from('invoices').insert({ supplier_id: parseInt(invSupplierId), invoice_no: invNo, amount: parseFloat(invAmount), due_date: calculatedDueDate });
      if (error) throw error;
      setInvNo(''); setInvAmount(''); await fetchData(); alert("Invoice added successfully!");
    } catch (err: any) { alert(`Failed to save invoice: ${err.message}`); } 
    finally { setIsSubmitting(false); }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('supplier_payments').insert({ invoice_id: parseInt(payInvoiceId), amount_paid: parseFloat(payAmount) });
      if (error) throw error;
      setPayInvoiceId(''); setPayAmount(''); await fetchData(); alert("Payment logged successfully!");
    } catch (err: any) { alert(`Failed to log payment: ${err.message}`); } 
    finally { setIsSubmitting(false); }
  };

  // --- Export Functions ---
  const getExportData = () => {
    const headers = ["Inv No.", "Supplier", "Bill Amt (Rs)", "Balance (Rs)", "Due Date", "Status"];
    const rows = invoices.map(inv => {
      const { balance, status } = getInvoiceDetails(inv);
      return [inv.invoice_no, inv.suppliers?.name, inv.amount, balance, inv.due_date, status];
    });
    return { headers, rows, filename: `Accounts_Payable_${today}` };
  };

  const exportCSV = () => {
    const { headers, rows, filename } = getExportData();
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `${filename}.csv`;
    link.click();
    setShowExportMenu(false);
  };

  const exportExcel = () => {
    const { headers, rows, filename } = getExportData();
    let table = "<table><thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>";
    rows.forEach(row => { table += "<tr>" + row.map(cell => `<td>${cell}</td>`).join("") + "</tr>"; });
    table += "</tbody></table>";
    const uri = 'data:application/vnd.ms-excel;base64,';
    const base64 = btoa(unescape(encodeURIComponent(table)));
    const link = document.createElement("a");
    link.href = uri + base64;
    link.download = `${filename}.xls`;
    link.click();
    setShowExportMenu(false);
  };

  const exportPDF = () => {
    const { headers, rows, filename } = getExportData();
    const doc = new jsPDF();
    doc.text("Accounts Payable Ledger", 14, 15);
    autoTable(doc, { head: [headers], body: rows, startY: 20 });
    doc.save(`${filename}.pdf`);
    setShowExportMenu(false);
  };

  if (isLoading && invoices.length === 0) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin mr-2" /> Loading...</div>;

  const totalDebt = invoices.reduce((sum, inv) => { const { balance } = getInvoiceDetails(inv); return sum + (balance > 0 ? balance : 0); }, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <header className="bg-slate-900 text-white p-4 flex items-center gap-4 shadow-md">
        <Link href="/dashboard" className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"><Home size={20} /></Link>
        <div><h1 className="text-xl font-bold tracking-tight">Accounts Payable</h1><p className="text-sm text-slate-400">Manage Supplier Invoices & Payments</p></div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-center shadow-sm">
            <h2 className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-2">Total Outstanding Debt</h2>
            <p className="text-3xl font-extrabold text-orange-600">Rs. {totalDebt.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            {showAddSupplier ? (
              <form onSubmit={handleAddSupplier} className="flex gap-2 bg-slate-50 p-2 rounded-lg border border-blue-200">
                <input required type="text" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="Supplier Name..." className="flex-1 border border-slate-300 px-3 py-1.5 text-sm rounded outline-none" />
                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-3 rounded flex items-center">{isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}</button>
                <button type="button" onClick={() => setShowAddSupplier(false)} className="bg-slate-200 text-slate-600 px-3 rounded flex items-center"><X size={16}/></button>
              </form>
            ) : (
              <button onClick={() => setShowAddSupplier(true)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-slate-50 font-semibold flex items-center justify-center gap-2"><UserPlus size={16}/> Add New Supplier</button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200">
              <button onClick={() => setActiveTab('invoice')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'invoice' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}><PlusCircle size={16} /> Add Bill</button>
              <button onClick={() => setActiveTab('payment')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'payment' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500'}`}><CreditCard size={16} /> Log Payment</button>
            </div>

            <div className="p-6">
              {activeTab === 'invoice' && (
                <form onSubmit={handleAddInvoice} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier</label>
                    <select required value={invSupplierId} onChange={e => setInvSupplierId(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm outline-none"><option value="" disabled>Select Supplier...</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  </div>
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1">Invoice / Ref No.</label><input type="text" required value={invNo} onChange={e => setInvNo(e.target.value)} className="w-full bg-slate-50 border rounded px-3 py-2 text-sm outline-none" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Total Bill (Rs.)</label><input type="number" required value={invAmount} onChange={e => setInvAmount(e.target.value)} className="w-full bg-white border rounded px-3 py-2 font-semibold outline-none" /></div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Terms</label>
                      <select value={invTerms} onChange={e => setInvTerms(e.target.value)} className="w-full bg-slate-50 border rounded px-3 py-2 text-sm outline-none"><option value="0">Due Immediately</option><option value="3">3 Days</option><option value="4">4 Days</option><option value="7">7 Days</option><option value="14">14 Days</option></select>
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white font-semibold py-3 rounded-lg mt-2 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Bill</button>
                </form>
              )}

              {activeTab === 'payment' && (
                <form onSubmit={handleAddPayment} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Apply Payment To Invoice</label>
                    <select required value={payInvoiceId} onChange={e => setPayInvoiceId(e.target.value)} className="w-full bg-slate-50 border rounded px-3 py-2 text-sm outline-none">
                      <option value="" disabled>Select Pending Invoice...</option>
                      {invoices.filter(i => getInvoiceDetails(i).balance > 0).map(i => (<option key={i.id} value={i.id}>{i.invoice_no} ({i.suppliers?.name}) - Owes: Rs.{getInvoiceDetails(i).balance.toLocaleString()}</option>))}
                    </select>
                  </div>
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1">Amount Paid (Rs.)</label><input type="number" required value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full bg-white border rounded px-3 py-2 font-semibold outline-none" /></div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg mt-2 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />} Record Payment</button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full relative">
            <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-800">Master Invoice Tracker</h2>
              <div className="relative">
                <button onClick={() => setShowExportMenu(!showExportMenu)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded shadow-sm flex items-center gap-2 text-sm">
                  <FileDown size={14} /> Export <ChevronDown size={14} />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                    <button onClick={exportPDF} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as PDF</button>
                    <button onClick={exportExcel} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as Excel (.xls)</button>
                    <button onClick={exportCSV} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-semibold">Export as CSV</button>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-auto max-h-[700px]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm">
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