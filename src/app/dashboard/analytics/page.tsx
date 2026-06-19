'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Home, TrendingUp, TrendingDown, DollarSign, Droplets } from 'lucide-react';
import Link from 'next/link';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export default function AnalyticsDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  
  // KPI State
  const [totalReceivables, setTotalReceivables] = useState(0); // Money Customers Owe Him
  const [totalPayables, setTotalPayables] = useState(0); // Money He Owes Suppliers
  const [fuelSold30Days, setFuelSold30Days] = useState(0);
  
  // Chart State
  const [fuelTrendData, setFuelTrendData] = useState<any[]>([]);
  const [debtPieData, setDebtPieData] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // 1. Calculate Total Receivables (Customers)
      const { data: customerTx } = await supabase.from('customer_transactions').select('type, amount');
      let receivables = 0;
      if (customerTx) {
        const totalCredit = customerTx.filter(t => t.type === 'credit').reduce((sum, t) => sum + Number(t.amount), 0);
        const totalDeposit = customerTx.filter(t => t.type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0);
        receivables = totalCredit - totalDeposit;
        setTotalReceivables(receivables > 0 ? receivables : 0);
      }

      // 2. Calculate Total Payables (Suppliers)
      const { data: invoices } = await supabase.from('invoices').select('amount');
      const { data: payments } = await supabase.from('supplier_payments').select('amount_paid');
      let payables = 0;
      if (invoices && payments) {
        const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
        const totalPaid = payments.reduce((sum, pay) => sum + Number(pay.amount_paid), 0);
        payables = totalBilled - totalPaid;
        setTotalPayables(payables > 0 ? payables : 0);
      }

      // Set Pie Chart Data
      setDebtPieData([
        { name: 'Owed TO You (Customers)', value: receivables > 0 ? receivables : 0, color: '#10b981' }, // Emerald
        { name: 'You Owe (Suppliers)', value: payables > 0 ? payables : 0, color: '#f97316' } // Orange
      ]);

      // 3. Fetch Fuel Data for the last 30 Days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateString = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: logs } = await supabase
        .from('daily_fuel_logs')
        .select(`
          date,
          liters_sold,
          pumps ( tanks ( fuel_type ) )
        `)
        .gte('date', dateString)
        .order('date', { ascending: true });

      if (logs) {
        let totalFuel = 0;
        const groupedByDate: Record<string, any> = {};

        logs.forEach(log => {
          totalFuel += Number(log.liters_sold);
          const date = log.date;
          // @ts-ignore - Safely digging into the joined tables
          const type = log.pumps?.tanks?.fuel_type || 'Unknown';

          if (!groupedByDate[date]) {
            groupedByDate[date] = { date, Petrol: 0, Diesel: 0 };
          }
          if (type === 'Petrol') groupedByDate[date].Petrol += Number(log.liters_sold);
          if (type === 'Diesel') groupedByDate[date].Diesel += Number(log.liters_sold);
        });

        setFuelSold30Days(totalFuel);
        setFuelTrendData(Object.values(groupedByDate));
      }

    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={24} /> Compiling Analytics...
      </div>
    );
  }

  const netPosition = totalReceivables - totalPayables;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 flex items-center gap-4 shadow-md">
        <Link href="/dashboard" className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-sm">
          <Home size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Business Analytics</h1>
          <p className="text-sm text-slate-400">Live 30-Day Performance & Debt Tracker</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-4 space-y-6">
        
        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Net Position Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm font-semibold text-slate-500">Net Financial Position</p>
                <h3 className={`text-2xl font-bold mt-1 ${netPosition >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {netPosition >= 0 ? '+' : '-'} Rs. {Math.abs(netPosition).toLocaleString()}
                </h3>
              </div>
              <div className={`p-3 rounded-lg ${netPosition >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                <DollarSign size={24} />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">Receivables minus Payables</p>
          </div>

          {/* Customers Owe Us */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm font-semibold text-slate-500">Total Receivables</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">
                  Rs. {totalReceivables.toLocaleString()}
                </h3>
              </div>
              <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                <TrendingUp size={24} />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">Money customers owe you</p>
          </div>

          {/* We Owe Suppliers */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm font-semibold text-slate-500">Total Payables</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">
                  Rs. {totalPayables.toLocaleString()}
                </h3>
              </div>
              <div className="p-3 rounded-lg bg-orange-100 text-orange-600">
                <TrendingDown size={24} />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">Money you owe suppliers</p>
          </div>

          {/* Fuel Volume */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm font-semibold text-slate-500">Fuel Sold (30 Days)</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">
                  {fuelSold30Days.toLocaleString()} L
                </h3>
              </div>
              <div className="p-3 rounded-lg bg-indigo-100 text-indigo-600">
                <Droplets size={24} />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">Total volume pumped</p>
          </div>

        </div>

        {/* CHARTS ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Chart: Fuel Trends */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-800 mb-6">30-Day Fuel Sales Trend (Liters)</h2>
            <div className="h-80 w-full">
              {fuelTrendData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400">Not enough data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fuelTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="Petrol" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="Diesel" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Right Chart: Debt Distribution */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Market Debt Distribution</h2>
            <div className="h-64 w-full relative">
              {(totalReceivables === 0 && totalPayables === 0) ? (
                <div className="h-full flex items-center justify-center text-slate-400">All debts are cleared!</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={debtPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {debtPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `Rs. ${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {/* Center Text in Donut */}
              {(totalReceivables > 0 || totalPayables > 0) && (
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none mt-[-10px]">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-widest">Total</span>
                  <span className="text-lg font-bold text-slate-800">
                    Rs. {((totalReceivables) + (totalPayables)).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Custom Legend for Pie Chart */}
            <div className="mt-6 space-y-3">
              {debtPieData.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-slate-600 font-medium">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-800">Rs. {item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}