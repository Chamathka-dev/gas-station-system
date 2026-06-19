'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, FileText, FileSpreadsheet, FileBox, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FuelReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FuelReportModal({ isOpen, onClose }: FuelReportModalProps) {
  const [period, setPeriod] = useState('7');
  const [format, setFormat] = useState('pdf');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  // Calculate the start date based on the selected period
  const getStartDate = (daysAgo: string) => {
    if (daysAgo === 'all') return '2000-01-01'; // Fetch everything
    const date = new Date();
    date.setDate(date.getDate() - parseInt(daysAgo));
    return date.toISOString().split('T')[0];
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    const startDate = getStartDate(period);
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. Fetch data from Supabase
      const { data: logs, error } = await supabase
        .from('daily_fuel_logs')
        .select(`
          date,
          closing_meter,
          liters_sold,
          pumps ( name, tanks ( name ) )
        `)
        .gte('date', startDate)
        .lte('date', today)
        .order('date', { ascending: true });

      if (error) throw error;
      if (!logs || logs.length === 0) {
        alert("No data found for this time period.");
        setIsGenerating(false);
        return;
      }

      // 2. Format the data for our reports
      const reportData = logs.map(log => ({
        Date: log.date,
        'Tank': (log.pumps as any)?.tanks?.name || 'Unknown Tank',
        'Pump': (log.pumps as any)?.name || 'Unknown Pump',
        'Closing Meter': log.closing_meter,
        'Liters Sold': log.liters_sold
      }));

      // 3. Generate the requested file type
      if (format === 'csv') generateCSV(reportData);
      if (format === 'excel') generateExcel(reportData);
      if (format === 'pdf') generatePDF(reportData);

      onClose(); // Close modal on success
    } catch (err) {
      console.error("Export Error:", err);
      alert("Failed to generate report.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- EXPORT FUNCTIONS ---

  const generateCSV = (data: any[]) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Fuel_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const generateExcel = (data: any[]) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fuel Logs");
    XLSX.writeFile(wb, `Fuel_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const generatePDF = (data: any[]) => {
    const doc = new jsPDF();
    doc.text(`Farhan Station OS - Fuel Report`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    const tableColumn = ["Date", "Tank", "Pump", "Closing Meter", "Liters Sold"];
    const tableRows = data.map(row => [row.Date, row.Tank, row.Pump, row['Closing Meter'], row['Liters Sold']]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [44, 62, 80] } // Slate-900 color to match the UI
    });

    doc.save(`Fuel_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-slate-100 px-6 py-4 flex justify-between items-center border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Download size={20} className="text-blue-600" /> Export Fuel Report
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Time Period Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Select Time Period</label>
            <select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none"
            >
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 1 Month</option>
              <option value="90">Last 3 Months</option>
              <option value="180">Last 6 Months</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Format Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Export Format</label>
            <div className="grid grid-cols-3 gap-3">
              
              <button 
                onClick={() => setFormat('pdf')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${format === 'pdf' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                <FileText size={24} className="mb-1" />
                <span className="text-xs font-semibold">PDF</span>
              </button>

              <button 
                onClick={() => setFormat('excel')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${format === 'excel' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                <FileSpreadsheet size={24} className="mb-1" />
                <span className="text-xs font-semibold">Excel</span>
              </button>

              <button 
                onClick={() => setFormat('csv')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${format === 'csv' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                <FileBox size={24} className="mb-1" />
                <span className="text-xs font-semibold">CSV</span>
              </button>

            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:bg-blue-400"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {isGenerating ? 'Generating...' : 'Download Report'}
          </button>
        </div>

      </div>
    </div>
  );
}