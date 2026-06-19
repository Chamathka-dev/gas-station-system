'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Droplet, Users, FileText, BarChart3, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';

export default function MainDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  // Security check: Kick them back to login if they aren't authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
      } else {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isLoading) return null; // Prevents UI flicker while checking security

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 text-white p-6 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Farhan Station OS</h1>
            <p className="text-slate-400 text-sm mt-1">Master Control Panel</p>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors bg-slate-800 px-4 py-2 rounded-lg border border-slate-700"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      {/* The Big Buttons Grid */}
      <main className="max-w-6xl mx-auto p-6 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          
          {/* Module 1: Fuel (Links to the page we already built) */}
          <Link href="/dashboard/fuel" className="group block bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-slate-200 transition-all">
            <div className="flex items-center gap-6">
              <div className="bg-blue-100 text-blue-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
                <Droplet size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Fuel Inventory</h2>
                <p className="text-slate-500 mt-1">Daily Pump Logs, Tank Dips, & Book Stock</p>
              </div>
            </div>
          </Link>

          {/* Module 2: Creditors */}
          <Link href="/dashboard/creditors" className="group block bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-slate-200 transition-all">
            <div className="flex items-center gap-6">
              <div className="bg-emerald-100 text-emerald-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
                <Users size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Creditor Management</h2>
                <p className="text-slate-500 mt-1">Customer Tabs, Daily Deposits, & Statements</p>
              </div>
            </div>
          </Link>

          {/* Module 3: Accounts Payable */}
          <Link href="/dashboard/payables" className="group block bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-slate-200 transition-all">
            <div className="flex items-center gap-6">
              <div className="bg-orange-100 text-orange-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
                <FileText size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Accounts Payable</h2>
                <p className="text-slate-500 mt-1">Supplier Invoices, Part Payments, & Overdue Alerts</p>
              </div>
            </div>
          </Link>

          {/* Module 4: Analytics */}
          <Link href="/dashboard/analytics" className="group block bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-slate-200 transition-all">
            <div className="flex items-center gap-6">
              <div className="bg-purple-100 text-purple-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
                <BarChart3 size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Analytics & Profits</h2>
                <p className="text-slate-500 mt-1">Live Profit Charts & Monthly Overviews</p>
              </div>
            </div>
          </Link>

        </div>
      </main>
    </div>
  );
}