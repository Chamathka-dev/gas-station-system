'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Home, Wallet, ArrowRight, Save, DollarSign, Calculator, AlertCircle, Edit2 } from 'lucide-react';
import Link from 'next/link';

export default function CashDashboard() {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Today's Form State
  const today = new Date().toISOString().split('T')[0];
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [isEditingOpening, setIsEditingOpening] = useState(false); // NEW STATE FOR DAY 1
  const [cashSales, setCashSales] = useState<string>('');
  const [creditCardSales, setCreditCardSales] = useState<string>('');
  const [expenses, setExpenses] = useState<string>('');
  const [salaries, setSalaries] = useState<string>('');
  const [bankDeposits, setBankDeposits] = useState<string>('');
  const [eveningHandover, setEveningHandover] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.from('daily_cash_drawers').select('*').order('date', { ascending: false });
      if (data && data.length > 0) {
        setLedgers(data);
        if (data[0].date !== today) {
          setOpeningBalance(Number(data[0].closing_balance));
        } else {
           setOpeningBalance(data.length > 1 ? Number(data[1].closing_balance) : 0);
        }
      }
    } catch (error) {
      console.error("Error fetching cash logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Live Math Calculations ---
  const numCashSales = Number(cashSales) || 0;
  const numExpenses = Number(expenses) || 0;
  const numSalaries = Number(salaries) || 0;
  const numBankDeposits = Number(bankDeposits) || 0;
  const numEveningHandover = Number(eveningHandover) || 0;

  const expectedCashInDrawer = openingBalance + numCashSales - (numExpenses + numSalaries + numBankDeposits);
  const variance = numEveningHandover - expectedCashInDrawer;
  const closingBalance = expectedCashInDrawer - numEveningHandover;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('daily_cash_drawers').upsert({
        date: today,
        opening_balance: openingBalance,
        cash_sales: numCashSales,
        credit_card_sales: Number(creditCardSales) || 0,
        expenses: numExpenses,
        salaries: numSalaries,
        bank_deposits: numBankDeposits,
        evening_handover: numEveningHandover,
        shortage_overage: variance,
        closing_balance: closingBalance,
        notes: notes
      }, { onConflict: 'date' });

      if (error) throw error;
      
      await fetchData();
      setIsEditingOpening(false); // Lock it back up after saving
      alert("Shift Reconciled and Saved!");
    } catch (err: any) {
      alert(`Error saving shift: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && ledgers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Cash Drawer...
      </div>
    );
  }

  const isTodayLogged = ledgers.some(l => l.date === today);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <header className="bg-slate-900 text-white p-4 flex items-center gap-4 shadow-md">
        <Link href="/dashboard" className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-sm">
          <Home size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Shift Reconciliation</h1>
          <p className="text-sm text-slate-400">Daily Cash Drawer & Expenses</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: The Daily Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
            
            <div className="bg-slate-100 p-5 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Calculator size={18}/> End of Shift Form</h2>
              <div className="bg-white px-3 py-1 rounded text-sm font-bold text-slate-600 border border-slate-200">{today}</div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              {/* SECTION: Cash In */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cash In</h3>
                
                {/* UPGRADED OPENING BALANCE FIELD */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Opening Cash (Brought Forward)</label>
                    <button 
                      type="button" 
                      onClick={() => setIsEditingOpening(!isEditingOpening)} 
                      className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 text-xs"
                    >
                      <Edit2 size={14} /> Edit for Day 1
                    </button>
                  </div>
                  <input 
                    type="number" 
                    readOnly={!isEditingOpening} 
                    value={openingBalance} 
                    onChange={e => setOpeningBalance(Number(e.target.value))}
                    className={`w-full border rounded px-3 py-2 font-mono font-semibold outline-none transition-colors ${
                      isEditingOpening 
                        ? 'bg-white border-blue-400 text-slate-900 focus:ring-1 focus:ring-blue-400' 
                        : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                    }`} 
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isEditingOpening ? 'Manually overriding initial balance.' : "Auto-pulled from yesterday's closing balance."}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Physical Cash Sales</label>
                    <input type="number" value={cashSales} onChange={e => setCashSales(e.target.value)} className="w-full bg-white border border-blue-300 rounded px-3 py-2 font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Card Sales</label>
                    <input type="number" value={creditCardSales} onChange={e => setCreditCardSales(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-3 py-2 font-semibold outline-none focus:border-blue-500" placeholder="0" />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* SECTION: Cash Out */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cash Out (Deductions)</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Daily Expenses</label>
                    <input type="number" value={expenses} onChange={e => setExpenses(e.target.value)} className="w-full bg-red-50 border border-red-200 rounded px-3 py-2 text-red-700 font-semibold outline-none focus:border-red-400" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Salaries</label>
                    <input type="number" value={salaries} onChange={e => setSalaries(e.target.value)} className="w-full bg-red-50 border border-red-200 rounded px-3 py-2 text-red-700 font-semibold outline-none focus:border-red-400" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Deposits</label>
                    <input type="number" value={bankDeposits} onChange={e => setBankDeposits(e.target.value)} className="w-full bg-red-50 border border-red-200 rounded px-3 py-2 text-red-700 font-semibold outline-none focus:border-red-400" placeholder="0" />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* SECTION: Handover & Math */}
              <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-600">Expected Cash in Drawer:</span>
                  <span className="font-mono font-bold text-slate-800">Rs. {expectedCashInDrawer.toLocaleString()}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Evening Handover (Actual Cash Received)</label>
                  <input type="number" value={eveningHandover} onChange={e => setEveningHandover(e.target.value)} className="w-full bg-white border-2 border-emerald-400 rounded px-3 py-3 text-lg font-bold outline-none focus:border-emerald-600 shadow-sm" placeholder="Amount given to Farhan..." />
                </div>

                <div className={`flex justify-between items-center text-sm p-2 rounded ${variance === 0 ? 'bg-emerald-100 text-emerald-800' : variance > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                  <span className="font-bold">Variance (Shortage/Overage):</span>
                  <span className="font-mono font-bold">
                    {variance === 0 ? 'PERFECT MATCH' : `${variance > 0 ? '+' : ''} Rs. ${variance.toLocaleString()}`}
                  </span>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-lg mt-2 flex items-center justify-center gap-2 transition-all">
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} 
                {isTodayLogged ? 'Update Today\'s Shift' : 'Save Shift Report'}
              </button>

            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: The Historical Ledger */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="bg-slate-100 p-5 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Wallet size={18}/> Past Cash Records</h2>
            </div>
            
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-slate-600">Date</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-right">Cash In</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-right">Cash Out</th>
                    <th className="py-3 px-4 font-semibold text-emerald-600 text-right">Handover</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-center">Variance</th>
                    <th className="py-3 px-4 font-semibold text-blue-600 text-right">Next B/FD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgers.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-400">No shifts recorded yet.</td></tr>
                  ) : (
                    ledgers.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-700">{l.date}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{(Number(l.opening_balance) + Number(l.cash_sales)).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-red-500">{(Number(l.expenses) + Number(l.salaries) + Number(l.bank_deposits)).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600">{Number(l.evening_handover).toLocaleString()}</td>
                        <td className="py-3 px-4 text-center">
                          {Number(l.shortage_overage) === 0 ? (
                            <span className="text-slate-300">-</span>
                          ) : (
                            <span className={`font-bold px-2 py-1 rounded text-xs ${Number(l.shortage_overage) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                              {Number(l.shortage_overage).toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                          {Number(l.closing_balance).toLocaleString()}
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