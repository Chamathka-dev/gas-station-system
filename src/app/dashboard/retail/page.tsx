'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Home, Package, ShoppingCart, AlertTriangle, Edit2, Save, X, History, Search, FileDown, ChevronDown, ArrowDownToLine, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function RetailDashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'sale' | 'restock'>('sale');

  // Transaction Form State
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  
  // NEW: Batch Pricing State for Restocks
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');

  const [searchQuery, setSearchQuery] = useState(''); 
  const [txFilter, setTxFilter] = useState<'7' | '30' | '90'>('30');
  
  const [showStockMenu, setShowStockMenu] = useState(false);
  const [showTxMenu, setShowTxMenu] = useState(false);

  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => { fetchTransactions(); }, [txFilter]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.from('retail_products').select('*').order('category').order('name');
      if (data) setProducts(data);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const fetchTransactions = async () => {
    try {
      const pastDate = new Date(); pastDate.setDate(pastDate.getDate() - parseInt(txFilter));
      const { data } = await supabase.from('retail_transactions').select(`*, retail_products ( name, category )`).gte('date', pastDate.toISOString().split('T')[0]).order('id', { ascending: false });
      if (data) setTransactions(data);
    } catch (error) { console.error(error); }
  };

  // --- FIFO TRANSACTION ENGINE ---
  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !quantity || parseInt(quantity) <= 0) return;
    setIsSubmitting(true);
    const product = products.find(p => p.id.toString() === productId);
    if (!product) return;
    
    const qty = parseInt(quantity);
    const newStock = activeTab === 'sale' ? Number(product.current_stock) - qty : Number(product.current_stock) + qty;
    
    if (activeTab === 'sale' && newStock < 0) { 
      alert("Error: You cannot sell more items than you have in stock!"); 
      setIsSubmitting(false); 
      return; 
    }

    try {
      if (activeTab === 'restock') {
        if (!costPrice || !sellingPrice) { alert("Please enter cost and selling prices."); setIsSubmitting(false); return; }
        
        await supabase.from('retail_batches').insert({
          product_id: product.id, date_received: today, cost_price: parseFloat(costPrice), selling_price: parseFloat(sellingPrice), initial_qty: qty, current_qty: qty
        });

        await supabase.from('retail_products').update({ current_stock: newStock, price: parseFloat(sellingPrice) }).eq('id', product.id);
        
        await supabase.from('retail_transactions').insert({ product_id: product.id, date: today, type: 'restock', quantity: qty, total_value: qty * parseFloat(costPrice) });
        
        setCostPrice(''); setSellingPrice('');

      } else if (activeTab === 'sale') {
        const { data: batches } = await supabase.from('retail_batches').select('*').eq('product_id', product.id).gt('current_qty', 0).order('id', { ascending: true });
        
        let remainingQty = qty;
        let totalCost = 0;
        let totalRevenue = 0;

        if (batches) {
          for (const batch of batches) {
            if (remainingQty <= 0) break;
            const qtyToTake = Math.min(batch.current_qty, remainingQty);
            totalCost += qtyToTake * Number(batch.cost_price);
            totalRevenue += qtyToTake * Number(batch.selling_price);
            await supabase.from('retail_batches').update({ current_qty: batch.current_qty - qtyToTake }).eq('id', batch.id);
            remainingQty -= qtyToTake;
          }
        }

        if (remainingQty > 0) {
          totalCost += remainingQty * (Number(product.price) * 0.8);
          totalRevenue += remainingQty * Number(product.price);
        }

        const profit = totalRevenue - totalCost;
        await supabase.from('retail_products').update({ current_stock: newStock }).eq('id', product.id);
        await supabase.from('retail_transactions').insert({ 
          product_id: product.id, date: today, type: 'sale', quantity: qty, total_value: totalRevenue, total_cost: totalCost, profit: profit 
        });
      }

      setProductId(''); setQuantity(''); await fetchProducts(); await fetchTransactions();
      alert(`${activeTab === 'sale' ? 'Sale' : 'Restock'} logged successfully!`);
    } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
  };

  // --- EDIT & CANCEL LOGIC ---
  const startEditing = (product: any) => {
    setEditingId(product.id);
    setEditPrice(product.price);
    setEditStock(product.current_stock);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditPrice('');
    setEditStock('');
  };

  const saveProductEdit = async (id: number) => {
    setIsSubmitting(true);
    try {
      await supabase.from('retail_products').update({ price: parseFloat(editPrice), current_stock: parseInt(editStock) }).eq('id', id);
      setEditingId(null); await fetchProducts();
    } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
  };

  // --- Export Functions ---
  const getStockExportData = () => {
    const headers = ["Product Name", "Category", "Active Sell Price (Rs)", "Total Stock", "Status"];
    const rows = filteredProducts.map(p => [p.name, p.category, p.price, p.current_stock, p.current_stock <= p.min_quantity ? "LOW STOCK" : "HEALTHY"]);
    return { headers, rows, filename: `Retail_Stock_Report_${today}` };
  };

  const exportStockCSV = () => {
    const { headers, rows, filename } = getStockExportData();
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = `${filename}.csv`; link.click(); setShowStockMenu(false);
  };

  const exportStockExcel = () => {
    const { headers, rows, filename } = getStockExportData();
    let table = "<table><thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>";
    rows.forEach(row => { table += "<tr>" + row.map(cell => `<td>${cell}</td>`).join("") + "</tr>"; });
    table += "</tbody></table>";
    const uri = 'data:application/vnd.ms-excel;base64,';
    const link = document.createElement("a"); link.href = uri + btoa(unescape(encodeURIComponent(table))); link.download = `${filename}.xls`; link.click(); setShowStockMenu(false);
  };

  const exportStockPDF = () => {
    const { headers, rows, filename } = getStockExportData();
    const doc = new jsPDF(); doc.text("Live Retail Stock", 14, 15); autoTable(doc, { head: [headers], body: rows, startY: 20 }); doc.save(`${filename}.pdf`); setShowStockMenu(false);
  };

  const getTxExportData = () => {
    const headers = ["Date", "Product", "Type", "Quantity", "Total Value (Rs)", "Profit (Rs)"];
    const rows = transactions.map(t => [t.date, t.retail_products?.name || "Unknown", t.type.toUpperCase(), t.quantity, t.total_value, t.type === 'sale' ? t.profit : '-']);
    return { headers, rows, filename: `Retail_Tx_${txFilter}_Days` };
  };

  const exportTxCSV = () => {
    const { headers, rows, filename } = getTxExportData();
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = `${filename}.csv`; link.click(); setShowTxMenu(false);
  };

  const exportTxExcel = () => {
    const { headers, rows, filename } = getTxExportData();
    let table = "<table><thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>";
    rows.forEach(row => { table += "<tr>" + row.map(cell => `<td>${cell}</td>`).join("") + "</tr>"; });
    table += "</tbody></table>";
    const uri = 'data:application/vnd.ms-excel;base64,';
    const link = document.createElement("a"); link.href = uri + btoa(unescape(encodeURIComponent(table))); link.download = `${filename}.xls`; link.click(); setShowTxMenu(false);
  };

  const exportTxPDF = () => {
    const { headers, rows, filename } = getTxExportData();
    const doc = new jsPDF(); doc.text("Retail Sales & Profit Ledger", 14, 15); autoTable(doc, { head: [headers], body: rows, startY: 20 }); doc.save(`${filename}.pdf`); setShowTxMenu(false);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading && products.length === 0) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin mr-2" /> Loading Store...</div>;

  const lowStockItems = products.filter(p => p.current_stock <= p.min_quantity);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <header className="bg-slate-900 text-white p-4 flex items-center gap-4 shadow-md">
        <Link href="/dashboard" className="p-2.5 bg-slate-800 rounded-lg"><Home size={20} /></Link>
        <div><h1 className="text-xl font-bold">Retail Store & Gas</h1><p className="text-sm text-slate-400">FIFO Inventory & Profit Tracking</p></div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-4 space-y-6">
        {lowStockItems.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4 shadow-sm animate-pulse">
            <div className="bg-red-100 text-red-600 p-2 rounded-lg mt-1"><AlertTriangle size={24} /></div>
            <div>
              <h3 className="text-red-800 font-bold text-lg">ACTION REQUIRED: Place Orders</h3>
              <div className="flex flex-wrap gap-2 mt-3">{lowStockItems.map(item => <span key={item.id} className="bg-white border text-red-700 text-xs font-bold px-3 py-1 rounded-full">{item.name} ({item.current_stock} left)</span>)}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-200">
                <button onClick={() => setActiveTab('sale')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'sale' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}><ShoppingCart size={16} /> Log Daily Sale</button>
                <button onClick={() => setActiveTab('restock')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'restock' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500'}`}><FileDown size={16} /> Receive Stock</button>
              </div>
              <div className="p-6">
                <form onSubmit={handleTransaction} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Select Product</label>
                    <select required value={productId} onChange={e => setProductId(e.target.value)} className="w-full bg-slate-50 border rounded px-3 py-2 text-sm outline-none">
                      <option value="" disabled>Choose item...</option>
                      {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name} (Active: Rs. {p.price})</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label><input type="number" required min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full bg-white border rounded px-3 py-2 text-lg font-semibold outline-none" /></div>
                  {activeTab === 'restock' && (
                    <div className="grid grid-cols-2 gap-4 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                      <div><label className="block text-xs font-semibold text-emerald-800 mb-1">Cost Price (Per Unit)</label><input type="number" required value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="Cost..." className="w-full border rounded px-2 py-1 text-sm outline-none focus:border-emerald-500" /></div>
                      <div><label className="block text-xs font-semibold text-emerald-800 mb-1">Selling Price</label><input type="number" required value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="Sell For..." className="w-full border rounded px-2 py-1 text-sm outline-none focus:border-emerald-500" /></div>
                    </div>
                  )}
                  <button type="submit" disabled={isSubmitting} className={`w-full text-white font-semibold py-3 rounded-lg mt-2 flex items-center justify-center gap-2 ${activeTab === 'sale' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : activeTab === 'sale' ? <ShoppingCart size={18} /> : <FileDown size={18} />} 
                    {activeTab === 'sale' ? 'Record Sale (FIFO)' : 'Add Batch to Inventory'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col max-h-[500px]">
              <div className="bg-slate-100 p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-3 relative">
                <h2 className="font-bold text-slate-800 flex items-center gap-2"><Package size={18}/> Live Master Stock</h2>
                <div className="flex gap-3 w-full md:w-auto relative">
                  <div className="relative flex items-center flex-1 md:flex-none">
                    <Search size={14} className="absolute left-3 text-slate-400" />
                    <input type="text" placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded outline-none w-full md:w-48" />
                  </div>
                  <button onClick={() => setShowStockMenu(!showStockMenu)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded shadow-sm flex items-center gap-2 text-sm">
                    <FileDown size={14} /> Export <ChevronDown size={14} />
                  </button>
                  {showStockMenu && (
                    <div className="absolute right-0 top-10 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                      <button onClick={exportStockPDF} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as PDF</button>
                      <button onClick={exportStockExcel} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as Excel (.xls)</button>
                      <button onClick={exportStockCSV} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-semibold">Export as CSV</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="overflow-auto flex-1 pb-16">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                    <tr><th className="py-3 px-4 text-slate-600">Product Name</th><th className="py-3 px-4 text-center text-slate-600">Category</th><th className="py-3 px-4 text-right text-slate-600">Active Sell Price</th><th className="py-3 px-4 text-center text-slate-600">Total Stock</th><th className="py-3 px-4 text-center text-slate-600">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map(p => {
                      const isEditing = editingId === p.id;
                      return (
                        <tr key={p.id} className={`${isEditing ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                          <td className="py-3 px-4 font-semibold text-slate-700">{p.name}</td>
                          <td className="py-3 px-4 text-center"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{p.category}</span></td>
                          <td className="py-3 px-4 text-right">{isEditing ? <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-24 px-2 py-1 text-sm border rounded text-right" /> : <span className="text-slate-600">Rs. {p.price.toLocaleString()}</span>}</td>
                          <td className="py-3 px-4 text-center">{isEditing ? <input type="number" value={editStock} onChange={(e) => setEditStock(e.target.value)} className="w-20 px-2 py-1 text-sm border rounded text-center" /> : <span className={`font-mono font-bold ${p.current_stock <= p.min_quantity ? 'text-red-600' : 'text-slate-800'}`}>{p.current_stock}</span>}</td>
                          <td className="py-3 px-4 text-center">
                            {isEditing ? (
                              <div className="flex justify-center gap-2"><button onClick={() => saveProductEdit(p.id)} disabled={isSubmitting} className="p-1.5 bg-blue-600 text-white rounded"><Save size={14} /></button><button onClick={cancelEditing} className="p-1.5 bg-slate-200 rounded"><X size={14} /></button></div>
                            ) : (<button onClick={() => startEditing(p)} className="text-slate-400 hover:text-blue-600 flex justify-center w-full"><Edit2 size={14} /> Edit</button>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center relative">
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={18}/> Sales & Profit Ledger</h2>
            <div className="flex items-center gap-4 relative">
              <select value={txFilter} onChange={(e: any) => setTxFilter(e.target.value)} className="border rounded px-3 py-1.5 text-sm outline-none"><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option></select>
              <button onClick={() => setShowTxMenu(!showTxMenu)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded shadow-sm flex items-center gap-2 text-sm">
                <FileDown size={14} /> Export <ChevronDown size={14} />
              </button>
              {showTxMenu && (
                <div className="absolute right-0 top-10 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button onClick={exportTxPDF} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as PDF</button>
                  <button onClick={exportTxExcel} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b font-semibold">Export as Excel (.xls)</button>
                  <button onClick={exportTxCSV} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-semibold">Export as CSV</button>
                </div>
              )}
            </div>
          </div>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                <tr><th className="py-3 px-6 text-slate-600">Date</th><th className="py-3 px-6 text-slate-600">Product Name</th><th className="py-3 px-6 text-center text-slate-600">Type</th><th className="py-3 px-6 text-center text-slate-600">Qty</th><th className="py-3 px-6 text-right text-slate-600">Total Value</th><th className="py-3 px-6 text-right text-emerald-600 font-bold">Profit Margin</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-3 px-6 text-slate-500">{t.date}</td>
                    <td className="py-3 px-6 font-semibold text-slate-700">{t.retail_products?.name || "Unknown"}</td>
                    <td className="py-3 px-6 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'sale' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{t.type.toUpperCase()}</span></td>
                    <td className="py-3 px-6 text-center font-mono font-bold">{t.quantity}</td>
                    <td className={`py-3 px-6 text-right font-semibold ${t.type === 'sale' ? 'text-blue-600' : 'text-slate-500'}`}>{t.type === 'sale' ? '+' : '-'}{t.total_value.toLocaleString()}</td>
                    <td className="py-3 px-6 text-right font-bold text-emerald-600">{t.type === 'sale' ? `Rs. ${t.profit?.toLocaleString() || 0}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}