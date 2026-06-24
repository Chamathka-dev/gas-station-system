'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Home, Wallet, Save, Calculator, Edit2, FileDown, Printer, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CashDashboard() {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const receiptRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [isEditingOpening, setIsEditingOpening] = useState(false); 
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
           setNotes(data[0].notes || '');
        }
      }
    } catch (error) {
      console.error("Error fetching cash logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
        date: today, opening_balance: openingBalance, cash_sales: numCashSales, credit_card_sales: Number(creditCardSales) || 0,
        expenses: numExpenses, salaries: numSalaries, bank_deposits: numBankDeposits, evening_handover: numEveningHandover,
        shortage_overage: variance, closing_balance: closingBalance, notes: notes
      }, { onConflict: 'date' });
      if (error) throw error;
      await fetchData();
      setIsEditingOpening(false); 
      alert("Shift Reconciled and Saved!");
    } catch (err: any) { alert(`Error saving shift: ${err.message}`); } finally { setIsSubmitting(false); }
  };

  const handlePrintReceipt = useReactToPrint({
    documentTitle: `Shift_Receipt_${today}`,
    contentRef: receiptRef, // Updated property for react-to-print v3
  });

  const getExportData = () => {
    const headers = ["Date", "Opening Bal", "Cash Sales", "Deductions", "Handover", "Variance", "Closing Bal"];
    const rows = ledgers.map(l => [
      l.date, l.opening_balance, l.cash_sales, (Number(l.expenses) + Number(l.salaries) + Number(l.bank_deposits)), 
      l.evening_handover, l.shortage_overage, l.closing_balance
    ]);
    return { headers, rows, filename: `Shift_Reconciliation_${today}` };
  };

  const exportCSV = () => {
    const { headers, rows, filename } = getExportData();
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = `${filename}.csv`; link.click(); setShowExportMenu(false);
  };

  const exportExcel = () => {
    const { headers, rows, filename } = getExportData();
    let table = "<table><thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>";
    rows.forEach(row => { table += "<tr>" + row.map(cell => `<td>${cell}</td>`).join("") + "</tr>"; });
    table += "</tbody></table>";
    const uri = 'data:application/vnd.ms-excel;base64,';
    const link = document.createElement("a"); link.href = uri + btoa(unescape(encodeURIComponent(table))); link.download = `${filename}.xls`; link.click(); setShowExportMenu(false);
  };

  const exportPDF = () => {
    const { headers, rows, filename } = getExportData();
    const doc = new jsPDF();
    doc.text("Shift Reconciliation History", 14, 15);
    autoTable(doc, { head: [headers], body: rows, startY: 20 });
    doc.save(`${filename}.pdf`);
    setShowExportMenu(false);
  };

  if (isLoading && ledgers.length === 0) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin mr-2" /> Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <div style={{ display: "none" }}>
        <div ref={receiptRef} className="p-6 text-black bg-white font-mono" style={{ width: '80mm' }}>
          <div className="text-center mb-4"><h1 className="font-bold text-lg">FARHAN STATION OS</h1><p className="text-xs">Daily Shift Reconciliation</p><p className="text-xs border-b border-black pb-2 mb-2">Date: {today}</p></div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>Brought Fwd:</span> <span>{openingBalance.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Cash Sales:</span> <span>+{numCashSales.toLocaleString()}</span></div>
            <div className="flex justify-between text-black"><span>Expenses:</span> <span>-{numExpenses.toLocaleString()}</span></div>
            <div className="flex justify-between text-black"><span>Salaries:</span> <span>-{numSalaries.toLocaleString()}</span></div>
            <div className="flex justify-between text-black"><span>Bank Dep:</span> <span>-{numBankDeposits.toLocaleString()}</span></div>
          </div>
          <div className="border-t border-black border-dashed my-2 pt-2 text-sm font-bold">
            <div className="flex justify-between"><span>Expected:</span> <span>{expectedCashInDrawer.toLocaleString()}</span></div>
            <div className="flex justify-between mt-1"><span>Handover:</span> <span>{numEveningHandover.toLocaleString()}</span></div>
          </div>
          <div className="text-center mt-4 p-1 border border-black font-bold text-sm">VARIANCE: {variance === 0 ? 'PERFECT' : variance.toLocaleString()}</div>
          <div className="mt-8 text-xs text-center border-t border-black pt-2">Signature: _______________</div>
        </div>
      </div>

      <header className="bg-slate-900 text-white p-4 flex items-center gap-4 shadow-md">
        <Link href="/dashboard" className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"><Home size={20} /></Link>
        <div><h1 className="text-xl font-bold">Shift Reconciliation</h1><p className="text-sm text-slate-400">Daily Cash Drawer & Expenses</p></div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 p-5 border-b border-slate-200 flex justify-between items-center"><h2 className="font-bold text-slate-800 flex items-center gap-2"><Calculator size={18}/> End of Shift Form</h2><div className="bg-white px-3 py-1 rounded text-sm font-bold border">{today}</div></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-4"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cash In</h3>
                <div>
                  <div className="flex justify-between items-center mb-1"><label className="block text-xs font-semibold text-slate-700">Opening Cash (B/FD)</label><button type="button" onClick={() => setIsEditingOpening(!isEditingOpening)} className="text-slate-400 hover:text-blue-600 text-xs flex items-center gap-1"><Edit2 size={14} /> Edit</button></div>
                  <input type="number" readOnly={!isEditingOpening} value={openingBalance} onChange={e => setOpeningBalance(Number(e.target.value))} className="w-full border rounded px-3 py-2 font-mono font-semibold outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1">Physical Cash Sales</label><input type="number" value={cashSales} onChange={e => setCashSales(e.target.value)} className="w-full border px-3 py-2" /></div>
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1">Credit Card Sales</label><input type="number" value={creditCardSales} onChange={e => setCreditCardSales(e.target.value)} className="w-full border px-3 py-2" /></div>
                </div>
              </div>
              <hr className="border-slate-100" />
              <div className="space-y-4"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cash Out (Deductions)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1">Daily Expenses</label><input type="number" value={expenses} onChange={e => setExpenses(e.target.value)} className="w-full bg-red-50 border border-red-200 px-3 py-2 text-red-700" /></div>
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1">Staff Salaries</label><input type="number" value={salaries} onChange={e => setSalaries(e.target.value)} className="w-full bg-red-50 border border-red-200 px-3 py-2 text-red-700" /></div>
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1">Bank Deposits</label><input type="number" value={bankDeposits} onChange={e => setBankDeposits(e.target.value)} className="w-full bg-red-50 border border-red-200 px-3 py-2 text-red-700" /></div>
                </div>
              </div>
              <hr className="border-slate-100" />
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shift Notes / Explanations</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Explain any shortages, or note dropped cash..." className="w-full bg-slate-50 border rounded px-3 py-2 text-sm outline-none h-20 resize-none"/>
              </div>
              <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center text-sm"><span className="font-semibold text-slate-600">Expected Cash:</span><span className="font-mono font-bold text-slate-800">Rs. {expectedCashInDrawer.toLocaleString()}</span></div>
                <div><label className="block text-xs font-bold text-slate-800 mb-1">Evening Handover</label><input type="number" value={eveningHandover} onChange={e => setEveningHandover(e.target.value)} className="w-full border-2 border-emerald-400 px-3 py-3 text-lg font-bold outline-none" /></div>
                <div className={`flex justify-between text-sm p-2 rounded ${variance === 0 ? 'bg-emerald-100' : 'bg-red-100'}`}><span className="font-bold">Variance:</span><span className="font-mono font-bold">{variance === 0 ? 'PERFECT MATCH' : `${variance > 0 ? '+' : ''} Rs. ${variance.toLocaleString()}`}</span></div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-lg mt-2 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save />} Save Shift Report</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="bg-slate-100 p-5 border-b border-slate-200 flex justify-between items-center relative">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Wallet size={18}/> Past Cash Records</h2>
              <div className="flex gap-2 relative">
                <button onClick={handlePrintReceipt} className="text-sm bg-slate-900 hover:bg-slate-800 text-white font-semibold py-1.5 px-3 rounded shadow-sm flex items-center gap-2"><Printer size={14} /> Print Receipt</button>
                <button onClick={() => setShowExportMenu(!showExportMenu)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded shadow-sm flex items-center gap-2 text-sm">
                  <FileDown size={14} /> Export <ChevronDown size={14} />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-10 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                    <button onClick={exportPDF} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as PDF</button>
                    <button onClick={exportExcel} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as Excel (.xls)</button>
                    <button onClick={exportCSV} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-semibold">Export as CSV</button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm">
                  <tr><th className="py-3 px-4 font-semibold text-slate-600">Date</th><th className="py-3 px-4 font-semibold text-slate-600 text-right">Cash In</th><th className="py-3 px-4 font-semibold text-slate-600 text-right">Cash Out</th><th className="py-3 px-4 font-semibold text-emerald-600 text-right">Handover</th><th className="py-3 px-4 font-semibold text-slate-600 text-center">Variance</th><th className="py-3 px-4 font-semibold text-blue-600 text-right">Next B/FD</th></tr>
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
                        <td className="py-3 px-4 text-center">{Number(l.shortage_overage) === 0 ? <span className="text-slate-300">-</span> : <span className={`font-bold px-2 py-1 rounded text-xs ${Number(l.shortage_overage) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{Number(l.shortage_overage).toLocaleString()}</span>}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-blue-700 bg-blue-50/30">{Number(l.closing_balance).toLocaleString()}</td>
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