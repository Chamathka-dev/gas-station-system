'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Home, PlusCircle, ArrowUpRight, ArrowDownRight, Search, Filter, Save } from 'lucide-react';
import Link from 'next/link';

export default function CreditorDashboard() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState('credit');
  const [amount, setAmount] = useState('');
  const [billNo, setBillNo] = useState('');

  // Filter State (For the Daily Report / Statement feature)
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Customers
      const { data: custData } = await supabase.from('customers').select('*').order('name');
      if (custData) setCustomers(custData);

      // 2. Fetch all transactions with customer names joined
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

  // --- Calculate Live Balances ---
  const calculateBalance = (custId: number) => {
    const custTransactions = transactions.filter(t => t.customer_id === custId);
    const totalCredit = custTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + Number(t.amount), 0);
    const totalDeposit = custTransactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0);
    return totalCredit - totalDeposit;
  };

  // --- Handle Form Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !amount) return;
    setIsSubmitting(true);

    try {
      // ADDED: We now capture the 'error' variable from Supabase
      const { error } = await supabase.from('customer_transactions').insert({
        customer_id: parseInt(customerId),
        date,
        type,
        amount: parseFloat(amount),
        bill_no: billNo
      });

      // ADDED: If Supabase throws an error, we immediately stop and alert you
      if (error) throw error;

      // Reset form & refresh data instantly
      setAmount('');
      setBillNo('');
      await fetchData(); 
      alert("Transaction saved successfully!");
    } catch (error: any) {
      console.error("Error saving:", error);
      // ADDED: The alert now shows the EXACT reason it failed
      alert(`Failed to save: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Filter Logic ---
  const filteredTransactions = transactions.filter(t => {
    const matchCustomer = filterCustomer === 'all' || t.customer_id.toString() === filterCustomer;
    const matchDate = filterDate === '' || t.date === filterDate;
    return matchCustomer && matchDate;
  });

  if (isLoading && transactions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Creditors...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 flex items-center gap-4 shadow-md">
        <Link href="/dashboard" className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-sm">
          <Home size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Creditor Management</h1>
          <p className="text-sm text-slate-400">Customer Tabs, Deposits & Statements</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Data Entry Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
              <PlusCircle size={20} className="text-blue-600" /> New Transaction
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer</label>
                <select required value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
                  <option value="" disabled>Select Customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setType('credit')} className={`py-2 rounded border font-semibold text-sm flex items-center justify-center gap-1 transition-all ${type === 'credit' ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>
                  <ArrowUpRight size={16} /> Credit (Owes)
                </button>
                <button type="button" onClick={() => setType('deposit')} className={`py-2 rounded border font-semibold text-sm flex items-center justify-center gap-1 transition-all ${type === 'deposit' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>
                  <ArrowDownRight size={16} /> Deposit (Paid)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 mt-2">Amount (Rs.)</label>
                <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-lg font-semibold focus:border-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bill / Cheque No. (Optional)</label>
                <input type="text" value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="e.g. 891" className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" />
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg mt-4 transition-all flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Transaction
              </button>
            </form>
          </div>

          {/* LIVE BALANCES WIDGET */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Live Balances</h2>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {customers.map(c => {
                const bal = calculateBalance(c.id);
                if (bal === 0) return null; // Hide if balance is exactly 0
                return (
                  <div key={c.id} className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-100">
                    <span className="font-semibold text-slate-700 text-sm">{c.name}</span>
                    <span className={`font-bold ${bal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      Rs. {bal.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: The Filterable Master Ledger */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            
            {/* Filter Bar (Replaces the "Daily Filter" Excel tab) */}
            <div className="bg-slate-100 p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-600 mb-1"><Filter size={12} /> Filter by Customer</label>
                <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
                  <option value="all">All Customers</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-600 mb-1"><Search size={12} /> Filter by Date</label>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" />
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-auto flex-1 p-0">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
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
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">No transactions found.</td>
                    </tr>
                  ) : (
                    filteredTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-500">{t.date}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{t.customers?.name}</td>
                        <td className="py-3 px-4 text-slate-500">{t.bill_no || '-'}</td>
                        <td className="py-3 px-4 text-right font-medium text-red-600 bg-red-50/30">
                          {t.type === 'credit' ? t.amount.toLocaleString() : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-600 bg-emerald-50/30">
                          {t.type === 'deposit' ? t.amount.toLocaleString() : '-'}
                        </td>
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