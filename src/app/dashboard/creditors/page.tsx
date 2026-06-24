'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Home, PlusCircle, ArrowUpRight, ArrowDownRight, Search, Filter, Save, UserPlus, FileDown, X, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CreditorDashboard() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState('credit');
  const [amount, setAmount] = useState('');
  const [billNo, setBillNo] = useState('');

  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: custData } = await supabase.from('customers').select('*').order('name');
      if (custData) setCustomers(custData);

      const { data: transData } = await supabase
        .from('customer_transactions')
        .select('*, customers(name)')
        .order('date', { ascending: false })
        .order('id', { ascending: false });
      
      if (transData) setTransactions(transData);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateBalance = (custId: number) => {
    const custTransactions = transactions.filter(t => t.customer_id === custId);
    const totalCredit = custTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + Number(t.amount), 0);
    const totalDeposit = custTransactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0);
    return totalCredit - totalDeposit;
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('customers').insert({ name: newCustomerName.toUpperCase() });
      if (error) throw error;
      setNewCustomerName('');
      setShowAddCustomer(false);
      await fetchData();
    } catch (error: any) {
      alert(`Failed to add customer: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !amount) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('customer_transactions').insert({
        customer_id: parseInt(customerId),
        date,
        type,
        amount: parseFloat(amount),
        bill_no: billNo
      });

      if (error) throw error;

      setAmount('');
      setBillNo('');
      await fetchData(); 
      alert("Transaction saved successfully!");
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchCustomer = filterCustomer === 'all' || t.customer_id.toString() === filterCustomer;
    const matchDate = filterDate === '' || t.date === filterDate;
    return matchCustomer && matchDate;
  });

  // --- Export Functions ---
  const getExportData = () => {
    const headers = ["Date", "Ref / Bill No.", "Type", "Credit Given (Owes)", "Deposit Rcvd (Paid)"];
    const rows = filteredTransactions.map(t => [
      t.date, t.bill_no || '-', t.type.toUpperCase(), t.type === 'credit' ? t.amount : 0, t.type === 'deposit' ? t.amount : 0
    ]);
    const customer = customers.find(c => c.id.toString() === filterCustomer);
    const filename = `${customer ? customer.name.replace(/\s+/g, '_') : 'All_Customers'}_Statement`;
    return { headers, rows, filename, title: customer ? `Statement for ${customer.name}` : "All Creditor Transactions" };
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
    const { headers, rows, filename, title } = getExportData();
    const doc = new jsPDF();
    doc.text(title, 14, 15);
    autoTable(doc, { head: [headers], body: rows, startY: 20 });
    doc.save(`${filename}.pdf`);
    setShowExportMenu(false);
  };

  if (isLoading && transactions.length === 0) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin mr-2" /> Loading Creditors...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <header className="bg-slate-900 text-white p-4 flex items-center gap-4 shadow-md">
        <Link href="/dashboard" className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-sm"><Home size={20} /></Link>
        <div><h1 className="text-xl font-bold tracking-tight">Creditor Management</h1><p className="text-sm text-slate-400">Customer Tabs, Deposits & Statements</p></div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Data Entry Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><PlusCircle size={20} className="text-blue-600" /> New Transaction</h2>
            </div>

            {showAddCustomer ? (
              <form onSubmit={handleAddCustomer} className="flex gap-2 mb-6 bg-slate-50 p-3 rounded-lg border border-blue-200">
                <input required type="text" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Customer Name..." className="flex-1 border border-slate-300 px-3 py-1.5 text-sm rounded outline-none focus:border-blue-500" />
                <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-3 rounded flex items-center justify-center">{isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}</button>
                <button type="button" onClick={() => setShowAddCustomer(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 rounded flex items-center justify-center"><X size={16}/></button>
              </form>
            ) : (
              <button onClick={() => setShowAddCustomer(true)} className="w-full mb-6 py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-600 font-semibold flex items-center justify-center gap-2">
                <UserPlus size={16}/> Add New Customer
              </button>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Date</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" /></div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer</label>
                <select required value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
                  <option value="" disabled>Select Customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setType('credit')} className={`py-2 rounded border font-semibold text-sm flex items-center justify-center gap-1 ${type === 'credit' ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}><ArrowUpRight size={16} /> Credit (Owes)</button>
                <button type="button" onClick={() => setType('deposit')} className={`py-2 rounded border font-semibold text-sm flex items-center justify-center gap-1 ${type === 'deposit' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}><ArrowDownRight size={16} /> Deposit (Paid)</button>
              </div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1 mt-2">Amount (Rs.)</label><input type="number" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-lg font-semibold focus:border-blue-500 outline-none" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Bill / Cheque No. (Optional)</label><input type="text" value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="e.g. 891" className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" /></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg mt-4 flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Transaction
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Live Balances</h2>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {customers.map(c => {
                const bal = calculateBalance(c.id);
                if (bal === 0) return null;
                return (
                  <div key={c.id} className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-100">
                    <span className="font-semibold text-slate-700 text-sm">{c.name}</span>
                    <span className={`font-bold ${bal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Rs. {bal.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Ledger & Export Menu */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            
            <div className="bg-slate-100 p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-end relative">
              <div className="md:col-span-5">
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-600 mb-1"><Filter size={12} /> Filter by Customer</label>
                <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
                  <option value="all">All Customers</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-600 mb-1"><Search size={12} /> Filter by Date</label>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" />
              </div>
              <div className="md:col-span-3 relative">
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded shadow-sm flex items-center justify-center gap-2 text-sm h-[38px]"
                >
                  <FileDown size={16} /> Export <ChevronDown size={14} />
                </button>
                
                {/* Export Dropdown */}
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                    <button onClick={exportPDF} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 font-semibold">Export as PDF</button>
                    <button onClick={exportExcel} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 font-semibold">Export as Excel (.xls)</button>
                    <button onClick={exportCSV} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-semibold">Export as CSV</button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-auto flex-1 p-0">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-slate-600">Date</th>
                    <th className="py-3 px-4 font-semibold text-slate-600">Customer</th>
                    <th className="py-3 px-4 font-semibold text-slate-600">Ref / Bill</th>
                    <th className="py-3 px-4 font-semibold text-red-600 text-right">Credit Given</th>
                    <th className="py-3 px-4 font-semibold text-emerald-600 text-right">Deposit Rcvd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400">No transactions found.</td></tr>
                  ) : (
                    filteredTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-500">{t.date}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{t.customers?.name}</td>
                        <td className="py-3 px-4 text-slate-500">{t.bill_no || '-'}</td>
                        <td className="py-3 px-4 text-right font-medium text-red-600 bg-red-50/30">{t.type === 'credit' ? t.amount.toLocaleString() : '-'}</td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-600 bg-emerald-50/30">{t.type === 'deposit' ? t.amount.toLocaleString() : '-'}</td>
                      </tr>
                    ))
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