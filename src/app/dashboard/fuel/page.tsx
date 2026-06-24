'use client';

import React, { useState, useEffect } from 'react';
import { Save, LogOut, Info, Loader2, CheckCircle2, Edit2, FileDown, Home, TrendingDown, Filter, History, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import FuelReportModal from '@/components/FuelReportModal';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CashierFuelDashboard() {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [pumps, setPumps] = useState<any[]>([]);
  const [tanks, setTanks] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartFilter, setChartFilter] = useState<'7' | '30' | '90'>('7');
  
  const [savingPumps, setSavingPumps] = useState<Record<number, boolean>>({});
  const [lockedPumps, setLockedPumps] = useState<Record<number, boolean>>({});
  const [pumpTests, setPumpTests] = useState<Record<number, string>>({});
  
  const [savingTanks, setSavingTanks] = useState<Record<number, boolean>>({});
  const [lockedTanks, setLockedTanks] = useState<Record<number, boolean>>({});

  const [dipRecords, setDipRecords] = useState<any[]>([]);

  // NEW: Dropdown Menu States
  const [showDipMenu, setShowDipMenu] = useState(false);
  const [showChartMenu, setShowChartMenu] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchDipRecords = async () => {
    try {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);
      const dateString = pastDate.toISOString().split('T')[0];

      const { data } = await supabase
        .from('dip_readings')
        .select(`*, tanks(name)`)
        .gte('date', dateString)
        .order('date', { ascending: false })
        .order('id', { ascending: false });

      if (data) setDipRecords(data);
    } catch (error) {
      console.error("Error fetching dip records:", error);
    }
  };

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const { data: tanksData } = await supabase.from('tanks').select('*').order('id');
        if (tanksData) setTanks(tanksData.map(t => ({ ...t, dipReading: '', priceEdit: t.unit_price || 0 })));

        const { data: pumpsData } = await supabase.from('pumps').select('*').order('id');
        if (pumpsData) {
          const pumpsWithMeters = await Promise.all(pumpsData.map(async (pump) => {
            const { data: lastLog } = await supabase
              .from('daily_fuel_logs')
              .select('closing_meter, pump_test')
              .eq('pump_id', pump.id)
              .order('date', { ascending: false })
              .limit(1)
              .single();

            return {
              ...pump,
              openingMeter: lastLog?.closing_meter || '', 
              closingMeter: ''
            };
          }));
          setPumps(pumpsWithMeters);
        }

        if (tanksData) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const dateString = sevenDaysAgo.toISOString().split('T')[0];

          const { data: logs } = await supabase
            .from('daily_fuel_logs')
            .select(`date, liters_sold, pumps ( tanks ( fuel_type ) )`)
            .gte('date', dateString);

          if (logs) {
            let petrolSales7Days = 0;
            let dieselSales7Days = 0;

            logs.forEach((log: any) => {
              const type = log.pumps?.tanks?.fuel_type;
              if (type === 'Petrol') petrolSales7Days += Number(log.liters_sold);
              if (type === 'Diesel') dieselSales7Days += Number(log.liters_sold);
            });

            const dailyPetrolBurn = petrolSales7Days / 7 || 1; 
            const dailyDieselBurn = dieselSales7Days / 7 || 1;

            const totalPetrolStock = tanksData.filter(t => t.fuel_type === 'Petrol').reduce((sum, t) => sum + Number(t.current_stock), 0);
            const totalDieselStock = tanksData.filter(t => t.fuel_type === 'Diesel').reduce((sum, t) => sum + Number(t.current_stock), 0);

            setPredictions([
              { type: 'Petrol', daysLeft: (totalPetrolStock / dailyPetrolBurn).toFixed(1), stock: totalPetrolStock },
              { type: 'Diesel', daysLeft: (totalDieselStock / dailyDieselBurn).toFixed(1), stock: totalDieselStock }
            ]);
          }
        }

        await fetchDipRecords();

      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  useEffect(() => {
    async function fetchChartData() {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - parseInt(chartFilter));
      const dateString = pastDate.toISOString().split('T')[0];

      const { data: logs } = await supabase
        .from('daily_fuel_logs')
        .select(`date, liters_sold, pumps ( tanks ( fuel_type ) )`)
        .gte('date', dateString)
        .order('date', { ascending: true });

      if (logs) {
        const grouped: Record<string, any> = {};
        logs.forEach((log: any) => {
          const date = log.date;
          const type = log.pumps?.tanks?.fuel_type || 'Unknown';
          if (!grouped[date]) grouped[date] = { date, Petrol: 0, Diesel: 0, Kerosene: 0 };
          if (type === 'Petrol') grouped[date].Petrol += Number(log.liters_sold);
          if (type === 'Diesel') grouped[date].Diesel += Number(log.liters_sold);
          if (type === 'Kerosene') grouped[date].Kerosene += Number(log.liters_sold);
        });
        setChartData(Object.values(grouped));
      }
    }
    fetchChartData();
  }, [chartFilter]);

  // --- Export Dip Records Functions ---
  const getDipExportData = () => {
    const headers = ["Date", "Tank Name", "Calculated Stock (L)", "Physical Dip (L)", "Variance (L)", "Status"];
    const rows = dipRecords.map(d => [
      d.date, d.tanks?.name || 'Unknown', d.book_stock_at_time, d.dip_reading, d.variance, d.variance < 0 ? 'LOSS' : d.variance > 0 ? 'GAIN' : 'PERFECT'
    ]);
    return { headers, rows, filename: `Tank_Variance_Report_Last_30_Days` };
  };

  const exportDipCSV = () => {
    const { headers, rows, filename } = getDipExportData();
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = `${filename}.csv`; link.click(); setShowDipMenu(false);
  };

  const exportDipExcel = () => {
    const { headers, rows, filename } = getDipExportData();
    let table = "<table><thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>";
    rows.forEach(row => { table += "<tr>" + row.map(cell => `<td>${cell}</td>`).join("") + "</tr>"; });
    table += "</tbody></table>";
    const uri = 'data:application/vnd.ms-excel;base64,';
    const link = document.createElement("a"); link.href = uri + btoa(unescape(encodeURIComponent(table))); link.download = `${filename}.xls`; link.click(); setShowDipMenu(false);
  };

  const exportDipPDF = () => {
    const { headers, rows, filename } = getDipExportData();
    const doc = new jsPDF(); doc.text("Tank Variance Records", 14, 15); autoTable(doc, { head: [headers], body: rows, startY: 20 }); doc.save(`${filename}.pdf`); setShowDipMenu(false);
  };

  // --- Export Chart Functions ---
  const getChartExportData = () => {
    const headers = ["Date", "Petrol (L)", "Diesel (L)", "Kerosene (L)", "Total Volume (L)"];
    const rows = chartData.map(d => [d.date, d.Petrol || 0, d.Diesel || 0, d.Kerosene || 0, (d.Petrol || 0) + (d.Diesel || 0) + (d.Kerosene || 0)]);
    return { headers, rows, filename: `Fuel_Sales_Chart_Last_${chartFilter}_Days` };
  };

  const exportChartCSV = () => {
    const { headers, rows, filename } = getChartExportData();
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = `${filename}.csv`; link.click(); setShowChartMenu(false);
  };

  const exportChartExcel = () => {
    const { headers, rows, filename } = getChartExportData();
    let table = "<table><thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>";
    rows.forEach(row => { table += "<tr>" + row.map(cell => `<td>${cell}</td>`).join("") + "</tr>"; });
    table += "</tbody></table>";
    const uri = 'data:application/vnd.ms-excel;base64,';
    const link = document.createElement("a"); link.href = uri + btoa(unescape(encodeURIComponent(table))); link.download = `${filename}.xls`; link.click(); setShowChartMenu(false);
  };

  const exportChartPDF = () => {
    const { headers, rows, filename } = getChartExportData();
    const doc = new jsPDF(); doc.text("Fuel Sales Volume", 14, 15); autoTable(doc, { head: [headers], body: rows, startY: 20 }); doc.save(`${filename}.pdf`); setShowChartMenu(false);
  };

  const handleOpeningMeterChange = (id: number, value: string) => setPumps(pumps.map(p => p.id === id ? { ...p, openingMeter: value } : p));
  const handlePumpChange = (id: number, value: string) => setPumps(pumps.map(p => p.id === id ? { ...p, closingMeter: value } : p));
  const handleTankChange = (id: number, value: string) => setTanks(tanks.map(t => t.id === id ? { ...t, dipReading: value } : t));
  const handleTankPriceChange = (id: number, value: string) => setTanks(tanks.map(t => t.id === id ? { ...t, priceEdit: value } : t));
  
  const unlockPump = (id: number) => setLockedPumps(prev => ({ ...prev, [id]: false }));
  const unlockTank = (id: number) => setLockedTanks(prev => ({ ...prev, [id]: false }));

  const handleSavePump = async (pump: any) => {
    if (!pump.closingMeter || Number(pump.closingMeter) < Number(pump.openingMeter)) {
      alert("Invalid closing meter! It must be higher than the opening meter.");
      return;
    }

    setSavingPumps(prev => ({ ...prev, [pump.id]: true }));
    
    const pTest = Number(pumpTests[pump.id]) || 0;
    const litersSold = Number(pump.closingMeter) - Number(pump.openingMeter) - pTest;
    const linkedTank = tanks.find(t => t.id === pump.tank_id);
    const totalRevenue = litersSold * (Number(linkedTank?.priceEdit) || 0);

    try {
      const { data: existingLog } = await supabase.from('daily_fuel_logs').select('id, liters_sold').eq('pump_id', pump.id).eq('date', today).single();

      if (existingLog) {
        await supabase.from('daily_fuel_logs').update({
          closing_meter: Number(pump.closingMeter),
          liters_sold: litersSold,
          pump_test: pTest,
          total_revenue: totalRevenue
        }).eq('id', existingLog.id);

        if (linkedTank) {
          const correctedStock = Number(linkedTank.current_stock) + Number(existingLog.liters_sold) - litersSold;
          await supabase.from('tanks').update({ current_stock: correctedStock }).eq('id', linkedTank.id);
          setTanks(tanks.map(t => t.id === linkedTank.id ? { ...t, current_stock: correctedStock } : t));
        }
      } else {
        await supabase.from('daily_fuel_logs').insert({
          pump_id: pump.id,
          date: today,
          closing_meter: Number(pump.closingMeter),
          liters_sold: litersSold,
          pump_test: pTest,
          total_revenue: totalRevenue
        });

        if (linkedTank) {
          const newStock = Number(linkedTank.current_stock) - litersSold;
          await supabase.from('tanks').update({ current_stock: newStock }).eq('id', linkedTank.id);
          setTanks(tanks.map(t => t.id === linkedTank.id ? { ...t, current_stock: newStock } : t));
        }
      }

      setLockedPumps(prev => ({ ...prev, [pump.id]: true })); 
    } catch (error) {
      alert("Failed to save pump.");
    } finally {
      setSavingPumps(prev => ({ ...prev, [pump.id]: false }));
    }
  };

  const handleSaveTank = async (tank: any) => {
    const hasPriceChanged = Number(tank.priceEdit) !== Number(tank.unit_price);
    const hasDipReading = !!tank.dipReading;

    if (!hasPriceChanged && !hasDipReading) return;

    setSavingTanks(prev => ({ ...prev, [tank.id]: true }));
    try {
      if (hasDipReading) {
        await supabase.from('dip_readings').insert({
          tank_id: tank.id, 
          date: today, 
          book_stock_at_time: Number(tank.current_stock), 
          dip_reading: Number(tank.dipReading), 
          variance: Number(tank.dipReading) - Number(tank.current_stock)
        });
        
        await fetchDipRecords();
      }

      if (hasPriceChanged) {
        await supabase.from('tanks').update({
          unit_price: Number(tank.priceEdit)
        }).eq('id', tank.id);
        
        setTanks(prevTanks => prevTanks.map(t => t.id === tank.id ? { ...t, unit_price: Number(tank.priceEdit) } : t));
      }
      
      setLockedTanks(prev => ({ ...prev, [tank.id]: true }));
    } catch (error) {
      alert("Failed to save tank data.");
    } finally {
      setSavingTanks(prev => ({ ...prev, [tank.id]: false }));
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500"><Loader2 className="animate-spin mr-2" size={24} /> Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-sm"><Home size={20} /></Link>
          <div><h1 className="text-xl font-bold tracking-tight">Farhan Station OS</h1><p className="text-sm text-slate-400">Dashboard • Daily Fuel Log</p></div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsReportModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-sm font-semibold transition-all shadow-sm"><FileDown size={16} /> Export Reports</button>
          <div className="bg-slate-800 px-3 py-1 rounded-md text-sm border border-slate-700">{today}</div>
          <button className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm"><LogOut size={16} /> Logout</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 mt-4 space-y-8">
        
        {predictions.length > 0 && (
          <div className="bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-800 text-white flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg"><TrendingDown size={28} /></div>
              <div><h2 className="text-lg font-bold">AI Stock Prediction</h2><p className="text-slate-400 text-sm">Estimated days until tanks run dry based on 7-day average sales.</p></div>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              {predictions.map(p => (
                <div key={p.type} className={`flex-1 md:w-48 p-4 rounded-lg border ${Number(p.daysLeft) < 3 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800 border-slate-700'}`}>
                  <p className="text-sm font-semibold text-slate-400 mb-1">{p.type} Reserve</p>
                  <div className="flex items-end gap-2"><span className={`text-2xl font-bold ${Number(p.daysLeft) < 3 ? 'text-red-400' : 'text-white'}`}>{p.daysLeft}</span><span className="text-sm text-slate-500 mb-1">Days left</span></div>
                  {Number(p.daysLeft) < 3 && <p className="text-xs text-red-400 mt-2 font-bold uppercase tracking-wider animate-pulse">Order Immediately</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">1. Enter Meters & Pump Tests</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pumps.map((pump) => {
              const linkedTank = tanks.find(t => t.id === pump.tank_id);
              const testAmt = Number(pumpTests[pump.id]) || 0;
              const estLiters = Number(pump.closingMeter || 0) - Number(pump.openingMeter || 0) - testAmt;
              const estRev = estLiters > 0 ? estLiters * (Number(linkedTank?.priceEdit) || 0) : 0;

              return (
                <div key={pump.id} className={`border rounded-lg p-4 transition-colors ${lockedPumps[pump.id] ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <h3 className="font-medium text-slate-700 mb-3 flex justify-between items-center">
                    {pump.name}
                    {lockedPumps[pump.id] && <button onClick={() => unlockPump(pump.id)} className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 text-xs"><Edit2 size={14} /> Edit</button>}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Opening Meter</label>
                      <input type="number" value={pump.openingMeter} disabled={lockedPumps[pump.id]} onChange={(e) => handleOpeningMeterChange(pump.id, e.target.value)} className="w-full bg-white text-slate-900 rounded px-3 py-2 text-sm border border-slate-300 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Pump Test (Liters)</label>
                      <input type="number" value={pumpTests[pump.id] || ''} disabled={lockedPumps[pump.id]} onChange={(e) => setPumpTests({...pumpTests, [pump.id]: e.target.value})} placeholder="0" className="w-full bg-white text-slate-900 rounded px-3 py-2 text-sm border border-slate-300 focus:border-blue-500 outline-none disabled:bg-slate-100" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Today's Closing Meter</label>
                      <input type="number" value={pump.closingMeter} disabled={lockedPumps[pump.id]} onChange={(e) => handlePumpChange(pump.id, e.target.value)} placeholder="Enter Closing..." className="w-full bg-white text-slate-900 rounded px-3 py-2 text-sm border border-slate-300 focus:border-blue-500 outline-none mb-2 disabled:bg-slate-100" />
                    </div>
                    {!lockedPumps[pump.id] && estLiters > 0 && (
                      <div className="text-xs font-semibold text-slate-500 bg-slate-100 p-2 rounded text-right border border-slate-200">
                        Est Revenue: <span className="text-emerald-600 text-sm font-bold">Rs. {estRev.toLocaleString()}</span>
                      </div>
                    )}
                    <button onClick={() => handleSavePump(pump)} disabled={!pump.closingMeter || !pump.openingMeter || lockedPumps[pump.id] || savingPumps[pump.id]} className={`w-full py-2 rounded text-sm font-semibold flex items-center justify-center gap-2 transition-all ${lockedPumps[pump.id] ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed'}`}>
                      {savingPumps[pump.id] ? <Loader2 size={16} className="animate-spin" /> : lockedPumps[pump.id] ? <CheckCircle2 size={16} /> : <Save size={16} />}
                      {lockedPumps[pump.id] ? 'Saved' : 'Save Update'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">2. Review Prices & Enter Dip Readings</h2>
          </div>
          <div className="p-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-3 font-medium">Tank Name</th>
                  <th className="pb-3 font-medium text-center">Unit Price (Rs)</th>
                  <th className="pb-3 font-medium text-center">Calculated Stock (L)</th>
                  <th className="pb-3 font-medium text-right pr-4">Physical Dip (L)</th>
                  <th className="pb-3 font-medium w-32">Action</th>
                </tr>
              </thead>
              <tbody>
                {tanks.map((tank) => {
                  const hasPriceChanged = Number(tank.priceEdit) !== Number(tank.unit_price);
                  const hasDipReading = !!tank.dipReading;
                  const canSave = hasPriceChanged || hasDipReading;

                  return (
                    <tr key={tank.id} className={`border-b border-slate-100 last:border-0 ${lockedTanks[tank.id] ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}>
                      <td className="py-4 font-medium text-slate-700 flex items-center gap-2">
                        {tank.name}
                        {lockedTanks[tank.id] && <button onClick={() => unlockTank(tank.id)} className="text-slate-400 hover:text-blue-600 transition-colors ml-2"><Edit2 size={14} /></button>}
                      </td>
                      <td className="py-4 text-center">
                        <input type="number" value={tank.priceEdit} disabled={lockedTanks[tank.id]} onChange={(e) => handleTankPriceChange(tank.id, e.target.value)} className="w-24 bg-white text-slate-900 rounded px-2 py-1.5 text-sm border border-slate-300 focus:border-blue-500 outline-none text-center disabled:bg-slate-100" />
                      </td>
                      <td className="py-4 text-center">
                        <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded font-mono font-semibold border border-slate-200">
                          {tank.current_stock?.toLocaleString() || 0}
                        </span>
                      </td>
                      <td className="py-4 text-right pr-4">
                        <input type="number" value={tank.dipReading} disabled={lockedTanks[tank.id]} onChange={(e) => handleTankChange(tank.id, e.target.value)} placeholder="Dip level..." className="w-32 bg-white text-slate-900 rounded px-3 py-1.5 text-sm border border-slate-300 focus:border-blue-500 outline-none ml-auto disabled:bg-slate-100" />
                      </td>
                      <td className="py-4">
                        <button onClick={() => handleSaveTank(tank)} disabled={!canSave || lockedTanks[tank.id] || savingTanks[tank.id]} className={`px-4 py-2 rounded text-sm font-semibold flex items-center justify-center gap-2 w-full transition-all ${lockedTanks[tank.id] ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900 text-white disabled:bg-slate-300 disabled:cursor-not-allowed'}`}>
                          {savingTanks[tank.id] ? <Loader2 size={16} className="animate-spin" /> : lockedTanks[tank.id] ? <CheckCircle2 size={16} /> : <Save size={16} />}
                          {lockedTanks[tank.id] ? 'Saved' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* DIP RECORDS & VARIANCE LEDGER */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 p-5 border-b border-slate-200 flex justify-between items-center relative">
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><History size={18}/> Tank Variance Records (Last 30 Days)</h2>
            <div className="relative">
              <button onClick={() => setShowDipMenu(!showDipMenu)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded shadow-sm flex items-center gap-2 text-sm">
                <FileDown size={14} /> Export <ChevronDown size={14} />
              </button>
              {showDipMenu && (
                <div className="absolute right-0 top-10 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button onClick={exportDipPDF} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as PDF</button>
                  <button onClick={exportDipExcel} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as Excel (.xls)</button>
                  <button onClick={exportDipCSV} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-semibold">Export as CSV</button>
                </div>
              )}
            </div>
          </div>
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                <tr>
                  <th className="py-3 px-6 font-semibold text-slate-600">Date</th>
                  <th className="py-3 px-6 font-semibold text-slate-600">Tank Name</th>
                  <th className="py-3 px-6 font-semibold text-slate-600 text-center">Calculated Stock</th>
                  <th className="py-3 px-6 font-semibold text-slate-600 text-center">Physical Dip</th>
                  <th className="py-3 px-6 font-semibold text-slate-600 text-right">Variance</th>
                  <th className="py-3 px-6 font-semibold text-slate-600 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dipRecords.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">No dip records found for this period.</td></tr>
                ) : (
                  dipRecords.map(d => {
                    const v = Number(d.variance);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="py-3 px-6 text-slate-500">{d.date}</td>
                        <td className="py-3 px-6 font-semibold text-slate-700">{d.tanks?.name || 'Unknown'}</td>
                        <td className="py-3 px-6 text-center font-mono">{d.book_stock_at_time}</td>
                        <td className="py-3 px-6 text-center font-mono font-bold">{d.dip_reading}</td>
                        <td className={`py-3 px-6 text-right font-mono font-bold ${v < 0 ? 'text-red-600' : v > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {v > 0 ? '+' : ''}{v}
                        </td>
                        <td className="py-3 px-6 text-center">
                          {v < 0 ? (
                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">LOSS</span>
                          ) : v > 0 ? (
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">GAIN</span>
                          ) : (
                            <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs font-bold">PERFECT</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* FUEL SALES CHART SECTION */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 p-5 border-b border-slate-200 flex justify-between items-center relative">
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><TrendingDown size={18}/> Fuel Sales Volume</h2>
            <div className="flex gap-2 items-center relative">
              <Filter size={14} className="text-slate-500" />
              <select value={chartFilter} onChange={(e: any) => setChartFilter(e.target.value)} className="bg-white border border-slate-300 rounded px-2 py-1 text-sm outline-none">
                <option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option>
              </select>
              <button onClick={() => setShowChartMenu(!showChartMenu)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded shadow-sm flex items-center gap-2 text-sm">
                <FileDown size={14} /> Export <ChevronDown size={14} />
              </button>
              {showChartMenu && (
                <div className="absolute right-0 top-10 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button onClick={exportChartPDF} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as PDF</button>
                  <button onClick={exportChartExcel} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as Excel (.xls)</button>
                  <button onClick={exportChartCSV} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-semibold">Export as CSV</button>
                </div>
              )}
            </div>
          </div>
          <div className="p-6 h-[400px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Petrol" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} name="Petrol (Liters)" />
                  <Bar dataKey="Diesel" stackId="a" fill="#3b82f6" name="Diesel (Liters)" />
                  <Bar dataKey="Kerosene" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} name="Kerosene (Liters)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (<div className="h-full flex items-center justify-center text-slate-400">No sales data available for this period.</div>)}
          </div>
        </section>

      </main>
      <FuelReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />
    </div>
  );
}