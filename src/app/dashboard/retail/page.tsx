'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Home, Package, ShoppingCart, ArrowDownToLine, AlertTriangle, CheckCircle2, Edit2, Save, X } from 'lucide-react';
import Link from 'next/link';

export default function RetailDashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'sale' | 'restock'>('sale');

  // Transaction Form State
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const today = new Date().toISOString().split('T')[0];

  // Editing State (For Prices & Manual Stock Corrections)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.from('retail_products').select('*').order('category').order('name');
      if (data) setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 1. Transaction Logic (Sales & Restocks) ---
  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !quantity || parseInt(quantity) <= 0) return;
    setIsSubmitting(true);

    const product = products.find(p => p.id.toString() === productId);
    if (!product) return;

    const qty = parseInt(quantity);
    const totalValue = qty * Number(product.price);
    
    const newStock = activeTab === 'sale' 
      ? Number(product.current_stock) - qty 
      : Number(product.current_stock) + qty;

    if (activeTab === 'sale' && newStock < 0) {
      alert("Error: You cannot sell more items than you have in stock!");
      setIsSubmitting(false);
      return;
    }

    try {
      await supabase.from('retail_products').update({ current_stock: newStock }).eq('id', product.id);
      await supabase.from('retail_transactions').insert({
        product_id: product.id,
        date: today,
        type: activeTab,
        quantity: qty,
        total_value: totalValue
      });

      setProductId('');
      setQuantity('');
      await fetchProducts(); 
      alert(`${activeTab === 'sale' ? 'Sale' : 'Restock'} logged successfully!`);
    } catch (error: any) {
      alert(`Error logging transaction: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 2. Edit Master Product Logic ---
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
      const { error } = await supabase
        .from('retail_products')
        .update({ 
          price: parseFloat(editPrice), 
          current_stock: parseInt(editStock) 
        })
        .eq('id', id);

      if (error) throw error;

      setEditingId(null);
      await fetchProducts();
    } catch (error: any) {
      alert(`Error updating product: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 3. Export Retail Stock Report ---
  const exportRetailReport = () => {
    const headers = ["Product Name", "Category", "Unit Price (Rs)", "Current Stock", "Status"];
    const rows = products.map(p => [
      p.name,
      p.category,
      p.price,
      p.current_stock,
      p.current_stock <= p.min_quantity ? "LOW STOCK" : "HEALTHY"
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Retail_Stock_Report_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (isLoading && products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Store Inventory...
      </div>
    );
  }

  const lowStockItems = products.filter(p => p.current_stock <= p.min_quantity);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <header className="bg-slate-900 text-white p-4 flex items-center gap-4 shadow-md">
        <Link href="/dashboard" className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-sm">
          <Home size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Retail Store & Gas</h1>
          <p className="text-sm text-slate-400">Inventory tracking & Low stock alerts</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-4 space-y-6">
        
        {/* Low Stock Alert Banner */}
        {lowStockItems.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4 shadow-sm animate-pulse">
            <div className="bg-red-100 text-red-600 p-2 rounded-lg mt-1"><AlertTriangle size={24} /></div>
            <div>
              <h3 className="text-red-800 font-bold text-lg">ACTION REQUIRED: Place Orders</h3>
              <p className="text-red-600 text-sm mt-1">The following items have dropped below your safety threshold:</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {lowStockItems.map(item => (
                  <span key={item.id} className="bg-white border border-red-200 text-red-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                    {item.name} (Only {item.current_stock} left)
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Data Entry Forms */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-200">
                <button onClick={() => setActiveTab('sale')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'sale' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                  <ShoppingCart size={16} /> Log Daily Sale
                </button>
                <button onClick={() => setActiveTab('restock')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'restock' ? 'bg-white text-emerald-600 border-b-2 border-emerald-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                  <ArrowDownToLine size={16} /> Receive Stock
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={handleTransaction} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Select Product</label>
                    <select required value={productId} onChange={e => setProductId(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500">
                      <option value="" disabled>Choose item...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} (Rs. {p.price})</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                    <input type="number" required min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-lg font-semibold outline-none focus:border-blue-500" placeholder="0" />
                  </div>

                  {productId && quantity && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-500">Total Value:</span>
                      <span className="text-lg font-bold text-slate-800">
                        Rs. {(parseInt(quantity) * products.find(p => p.id.toString() === productId)?.price).toLocaleString()}
                      </span>
                    </div>
                  )}

                  <button type="submit" disabled={isSubmitting} className={`w-full text-white font-semibold py-3 rounded-lg mt-2 flex items-center justify-center gap-2 transition-colors ${activeTab === 'sale' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : activeTab === 'sale' ? <ShoppingCart size={18} /> : <ArrowDownToLine size={18} />} 
                    {activeTab === 'sale' ? 'Record Sale' : 'Add to Inventory'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Live Inventory Table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
              
              <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 flex items-center gap-2"><Package size={18}/> Live Stock Ledger</h2>
                <button onClick={exportRetailReport} className="text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-1.5 px-3 rounded shadow-sm transition-colors flex items-center gap-2">
                  <ArrowDownToLine size={14} /> Export Excel
                </button>
              </div>
              
              <div className="overflow-auto flex-1 pb-16">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                    <tr>
                      <th className="py-3 px-4 font-semibold text-slate-600">Product Name</th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-center">Category</th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-right">Unit Price</th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-center">Live Stock</th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map(p => {
                      const isEditing = editingId === p.id;
                      const isLowStock = p.current_stock <= p.min_quantity;
                      
                      return (
                        <tr key={p.id} className={`${isEditing ? 'bg-blue-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                          <td className="py-3 px-4 font-semibold text-slate-700">{p.name}</td>
                          <td className="py-3 px-4 text-center text-slate-500">
                            <span className="bg-slate-100 px-2 py-1 rounded text-xs">{p.category}</span>
                          </td>
                          
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <input 
                                type="number" 
                                value={editPrice} 
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="w-24 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                              />
                            ) : (
                              <span className="text-slate-600">Rs. {p.price.toLocaleString()}</span>
                            )}
                          </td>
                          
                          <td className="py-3 px-4 text-center">
                            {isEditing ? (
                              <input 
                                type="number" 
                                value={editStock} 
                                onChange={(e) => setEditStock(e.target.value)}
                                className="w-20 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                              />
                            ) : (
                              <span className={`font-mono text-base font-bold ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                                {p.current_stock}
                              </span>
                            )}
                          </td>
                          
                          <td className="py-3 px-4 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => saveProductEdit(p.id)} disabled={isSubmitting} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                                  {isSubmitting ? <Loader2 size={14} className="animate-spin"/> : <Save size={14} />}
                                </button>
                                <button onClick={cancelEditing} disabled={isSubmitting} className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors">
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => startEditing(p)} className="text-slate-400 hover:text-blue-600 transition-colors p-1 flex items-center justify-center w-full gap-1 text-xs font-semibold">
                                <Edit2 size={14} /> Edit
                              </button>
                            )}
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
      </main>
    </div>
  );
}