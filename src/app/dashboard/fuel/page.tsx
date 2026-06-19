'use client';

import React, { useState, useEffect } from 'react';
import { Save, LogOut, Info, Loader2, CheckCircle2, Edit2, FileDown, Home } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import FuelReportModal from '@/components/FuelReportModal';
import Link from 'next/link';

export default function CashierFuelDashboard() {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false); // Add this line
  const [pumps, setPumps] = useState<any[]>([]);
  const [tanks, setTanks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [savingPumps, setSavingPumps] = useState<Record<number, boolean>>({});
  const [lockedPumps, setLockedPumps] = useState<Record<number, boolean>>({}); // Changed to 'locked' to handle edits
  const [savingTanks, setSavingTanks] = useState<Record<number, boolean>>({});
  const [lockedTanks, setLockedTanks] = useState<Record<number, boolean>>({});

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const { data: tanksData } = await supabase.from('tanks').select('*').order('id');
        if (tanksData) setTanks(tanksData.map(t => ({ ...t, dipReading: '' })));

        const { data: pumpsData } = await supabase.from('pumps').select('*').order('id');
        if (pumpsData) {
          const pumpsWithMeters = await Promise.all(pumpsData.map(async (pump) => {
            const { data: lastLog } = await supabase
              .from('daily_fuel_logs')
              .select('closing_meter')
              .eq('pump_id', pump.id)
              .order('date', { ascending: false })
              .limit(1)
              .single();

            return {
              ...pump,
              openingMeter: lastLog?.closing_meter || '', // Empty string instead of 0 for easier typing on Day 1
              closingMeter: ''
            };
          }));
          setPumps(pumpsWithMeters);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // --- NEW: Handle Opening Meter Changes (For Day 1 Manual Entry) ---
  const handleOpeningMeterChange = (id: number, value: string) => {
    setPumps(pumps.map(p => p.id === id ? { ...p, openingMeter: value } : p));
  };

  const handlePumpChange = (id: number, value: string) => {
    setPumps(pumps.map(p => p.id === id ? { ...p, closingMeter: value } : p));
  };

  const handleTankChange = (id: number, value: string) => {
    setTanks(tanks.map(t => t.id === id ? { ...t, dipReading: value } : t));
  };

  // --- NEW: Unlock Handlers for Editing Mistakes ---
  const unlockPump = (id: number) => {
    setLockedPumps(prev => ({ ...prev, [id]: false }));
  };

  const unlockTank = (id: number) => {
    setLockedTanks(prev => ({ ...prev, [id]: false }));
  };

  const handleSavePump = async (pump: any) => {
    if (!pump.closingMeter || Number(pump.closingMeter) < Number(pump.openingMeter)) {
      alert("Invalid closing meter! It must be higher than the opening meter.");
      return;
    }

    setSavingPumps(prev => ({ ...prev, [pump.id]: true }));
    const litersSold = Number(pump.closingMeter) - Number(pump.openingMeter);

    try {
      // Upsert logic: if they are editing a mistake, update today's record instead of making a new one
      const { data: existingLog } = await supabase
        .from('daily_fuel_logs')
        .select('id, liters_sold')
        .eq('pump_id', pump.id)
        .eq('date', today)
        .single();

      if (existingLog) {
        // Update existing mistake
        await supabase.from('daily_fuel_logs').update({
          closing_meter: Number(pump.closingMeter),
          liters_sold: litersSold
        }).eq('id', existingLog.id);

        // Fix the tank math (add back the old mistake, subtract the new correct amount)
        const linkedTank = tanks.find(t => t.id === pump.tank_id);
        if (linkedTank) {
          const correctedStock = Number(linkedTank.current_stock) + Number(existingLog.liters_sold) - litersSold;
          await supabase.from('tanks').update({ current_stock: correctedStock }).eq('id', linkedTank.id);
          setTanks(tanks.map(t => t.id === linkedTank.id ? { ...t, current_stock: correctedStock } : t));
        }
      } else {
        // Insert brand new log
        await supabase.from('daily_fuel_logs').insert({
          pump_id: pump.id,
          date: today,
          closing_meter: Number(pump.closingMeter),
          liters_sold: litersSold
        });

        // Deduct from tank
        const linkedTank = tanks.find(t => t.id === pump.tank_id);
        if (linkedTank) {
          const newStock = Number(linkedTank.current_stock) - litersSold;
          await supabase.from('tanks').update({ current_stock: newStock }).eq('id', linkedTank.id);
          setTanks(tanks.map(t => t.id === linkedTank.id ? { ...t, current_stock: newStock } : t));
        }
      }

      setLockedPumps(prev => ({ ...prev, [pump.id]: true })); // Lock it after saving
    } catch (error) {
      console.error("Error saving pump:", error);
      alert("Failed to save pump.");
    } finally {
      setSavingPumps(prev => ({ ...prev, [pump.id]: false }));
    }
  };

  const handleSaveTank = async (tank: any) => {
    if (!tank.dipReading) return;

    setSavingTanks(prev => ({ ...prev, [tank.id]: true }));
    const variance = Number(tank.dipReading) - Number(tank.current_stock);

    try {
      await supabase.from('dip_readings').insert({
        tank_id: tank.id,
        date: today,
        book_stock_at_time: Number(tank.current_stock),
        dip_reading: Number(tank.dipReading),
        variance: variance
      });

      setLockedTanks(prev => ({ ...prev, [tank.id]: true }));
    } catch (error) {
      console.error("Error saving tank dip:", error);
      alert("Failed to save dip reading.");
    } finally {
      setSavingTanks(prev => ({ ...prev, [tank.id]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Farhan Station OS...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        
        {/* NEW: Left side with Home Button and Title */}
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard"
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-sm"
            title="Return to Dashboard"
          >
            <Home size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Farhan Station OS</h1>
            <p className="text-sm text-slate-400">Dashboard • Daily Fuel Log</p>
          </div>
        </div>

        {/* Right side (Export, Date, Logout) stays exactly the same */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-sm font-semibold transition-all shadow-sm"
          >
            <FileDown size={16} /> Export Reports
          </button>
          
          <div className="bg-slate-800 px-3 py-1 rounded-md text-sm border border-slate-700">
            {today}
          </div>
          <button className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 mt-4 space-y-8">
        
        {/* PUMPS SECTION */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">1. Enter Meters</h2>
            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
              <Info size={12} /> Opening meters are editable for Day 1
            </span>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pumps.map((pump) => (
              <div key={pump.id} className={`border rounded-lg p-4 transition-colors ${lockedPumps[pump.id] ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className="font-medium text-slate-700 mb-3 flex justify-between items-center">
                  {pump.name}
                  {lockedPumps[pump.id] && (
                    <button onClick={() => unlockPump(pump.id)} className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 text-xs">
                      <Edit2 size={14} /> Edit
                    </button>
                  )}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Opening Meter</label>
                    <input 
                      type="number" 
                      value={pump.openingMeter} 
                      disabled={lockedPumps[pump.id]}
                      onChange={(e) => handleOpeningMeterChange(pump.id, e.target.value)}
                      placeholder="Enter Opening..."
                      className="w-full bg-white text-slate-900 rounded px-3 py-2 text-sm border border-slate-300 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Today's Closing Meter</label>
                    <input 
                      type="number" 
                      value={pump.closingMeter}
                      disabled={lockedPumps[pump.id]}
                      onChange={(e) => handlePumpChange(pump.id, e.target.value)}
                      placeholder="Enter Closing..."
                      className="w-full bg-white text-slate-900 rounded px-3 py-2 text-sm border border-slate-300 focus:border-blue-500 outline-none mb-2 disabled:bg-slate-100"
                    />
                    <button 
                      onClick={() => handleSavePump(pump)}
                      disabled={!pump.closingMeter || !pump.openingMeter || lockedPumps[pump.id] || savingPumps[pump.id]}
                      className={`w-full py-2 rounded text-sm font-semibold flex items-center justify-center gap-2 transition-all 
                        ${lockedPumps[pump.id] ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed' : 
                          'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed'}`}
                    >
                      {savingPumps[pump.id] ? <Loader2 size={16} className="animate-spin" /> : 
                       lockedPumps[pump.id] ? <CheckCircle2 size={16} /> : <Save size={16} />}
                      {lockedPumps[pump.id] ? 'Saved' : 'Save Update'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TANKS SECTION */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">2. Enter Dip Readings (Stick Measurement)</h2>
          </div>
          
          <div className="p-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-3 font-medium">Tank Name</th>
                  <th className="pb-3 font-medium text-center">Calculated Book Stock (L)</th>
                  <th className="pb-3 font-medium text-right pr-4">Physical Dip Reading (L)</th>
                  <th className="pb-3 font-medium w-32">Action</th>
                </tr>
              </thead>
              <tbody>
                {tanks.map((tank) => (
                  <tr key={tank.id} className={`border-b border-slate-100 last:border-0 ${lockedTanks[tank.id] ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}>
                    <td className="py-4 font-medium text-slate-700 flex items-center gap-2">
                      {tank.name}
                      {lockedTanks[tank.id] && (
                        <button onClick={() => unlockTank(tank.id)} className="text-slate-400 hover:text-blue-600 transition-colors ml-2">
                          <Edit2 size={14} />
                        </button>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded font-mono font-semibold border border-slate-200 transition-all duration-500">
                        {tank.current_stock?.toLocaleString() || 0}
                      </span>
                    </td>
                    <td className="py-4 text-right pr-4">
                      <input 
                        type="number" 
                        value={tank.dipReading}
                        disabled={lockedTanks[tank.id]}
                        onChange={(e) => handleTankChange(tank.id, e.target.value)}
                        placeholder="Enter Dip level..."
                        className="w-40 bg-white text-slate-900 rounded px-3 py-2 text-sm border border-slate-300 focus:border-blue-500 outline-none ml-auto disabled:bg-slate-100"
                      />
                    </td>
                    <td className="py-4">
                      <button 
                        onClick={() => handleSaveTank(tank)}
                        disabled={!tank.dipReading || lockedTanks[tank.id] || savingTanks[tank.id]}
                        className={`px-4 py-2 rounded text-sm font-semibold flex items-center justify-center gap-2 w-full transition-all
                          ${lockedTanks[tank.id] ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed' : 
                            'bg-slate-800 hover:bg-slate-900 text-white disabled:bg-slate-300 disabled:cursor-not-allowed'}`}
                      >
                        {savingTanks[tank.id] ? <Loader2 size={16} className="animate-spin" /> : 
                         lockedTanks[tank.id] ? <CheckCircle2 size={16} /> : <Save size={16} />}
                        {lockedTanks[tank.id] ? 'Saved' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </main>
  {/* Render the modal */}
      <FuelReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
      />

    </div>
  );
}