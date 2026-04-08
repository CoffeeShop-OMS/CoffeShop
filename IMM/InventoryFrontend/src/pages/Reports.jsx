import { useEffect, useState } from 'react';
import { 
  Download, TrendingUp, Search,
  TrendingDown, Trash2, Layers, Calendar, Filter, ArrowRight,
  ChevronDown, Coffee, Package, AlertTriangle, DollarSign
} from 'lucide-react';

import StatCards from '../components/inventory/StatCards';
import { getInventory, getInventoryLogs } from '../services/api';
import { getAuthSession } from '../utils/authStorage';
import { toast } from 'react-toastify';

export default function Reports({ setIsAuthenticated }) {
  const [stats, setStats] = useState({
    totalValue: 0,
    totalItems: 0,
    stockTurnover: 0,
    wasteRate: 0,
    healthScore: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    activeItems: 0,
  });
  const [topMoving, setTopMoving] = useState([]);
  const [slowMoving, setSlowMoving] = useState([]);
  const [reorderNeeded, setReorderNeeded] = useState([]);
  const [categoryPerformance, setCategoryPerformance] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const normalizeCategory = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/[-_\s]+/g, '');
    const map = {
      beans: 'Beans',
      milk: 'Milk',
      dairy: 'Milk',
      syrup: 'Syrup',
      syrups: 'Syrup',
      packaging: 'Cups',
      cup: 'Cups',
      cups: 'Cups',
      paper: 'Cups',
      papers: 'Cups',
      pastry: 'Pastries',
      pastries: 'Pastries',
      equipment: 'Equipment',
      addins: 'Add-ins',
      powder: 'Powder',
      other: 'Other',
    };
    return map[raw] || 'Other';
  };

  useEffect(() => {
    let mounted = true;
    const loadReports = async () => {
      setIsLoading(true);
      const session = getAuthSession();
      if (!session?.token) {
        setIsLoading(false);
        return;
      }

      try {
        const invRes = await getInventory(session.token, { limit: 200, status: 'all' });
        const logsRes = await getInventoryLogs(session.token, { days: 30, limit: 500 });

        const items = Array.isArray(invRes?.data) ? invRes.data : [];
        const logs = Array.isArray(logsRes?.data) ? logsRes.data : [];

        if (!mounted) return;

        // Calculate comprehensive stats
        let totalValue = 0;
        let activeCount = 0;
        let lowCount = 0;
        let outCount = 0;
        let wasteCount = 0;

        const categoryMap = {};
        const itemStats = [];

        items.forEach((item) => {
          const isArchived = (item.status || 'active') === 'deleted';
          if (isArchived) return;

          activeCount += 1;
          const quantity = Number(item.quantity || 0);
          const threshold = Number(item.lowStockThreshold || 0);
          const costPrice = Number(item.costPrice || 0);
          const value = quantity * costPrice;

          totalValue += value;

          if (quantity <= 0) {
            outCount += 1;
            wasteCount += 1;
          } else if (quantity <= threshold) {
            lowCount += 1;
          }

          const category = normalizeCategory(item.category);
          if (!categoryMap[category]) {
            categoryMap[category] = { count: 0, value: 0, quantity: 0 };
          }
          categoryMap[category].count += 1;
          categoryMap[category].value += value;
          categoryMap[category].quantity += quantity;

          // Stock adjustment count for turnover
          const adjustmentCount = logs.filter((log) => log.itemId === item.id && log.action === 'STOCK_ADJUST').length;

          itemStats.push({
            id: item.id,
            name: item.name,
            category,
            quantity,
            threshold,
            costPrice,
            value,
            adjustmentCount,
            isLow: quantity <= threshold,
            isOut: quantity <= 0,
          });
        });

        // Calculate metrics
        const totalActiveItems = activeCount;
        const healthScore = totalActiveItems === 0 ? 100 : Math.round(((totalActiveItems - lowCount - outCount) / totalActiveItems) * 100);
        const stockTurnover = totalActiveItems > 0 ? (logs.filter((l) => l.action === 'STOCK_ADJUST').length / totalActiveItems).toFixed(1) : 0;
        const wasteRate = totalActiveItems > 0 ? ((wasteCount / totalActiveItems) * 100).toFixed(1) : 0;

        // Top moving (highest adjustments)
        const topMovers = itemStats.sort((a, b) => b.adjustmentCount - a.adjustmentCount).slice(0, 5);

        // Slow moving (lowest adjustments but in stock)
        const slowMovers = itemStats.filter((i) => !i.isOut).sort((a, b) => a.adjustmentCount - b.adjustmentCount).slice(0, 5);

        // Reorder needed (low stock or out of stock soon)
        const reorderList = itemStats.filter((i) => i.isLow || i.isOut).sort((a, b) => a.quantity - b.quantity).slice(0, 5);

        // Category performance
        const categoryPerf = Object.entries(categoryMap)
          .map(([cat, data]) => ({
            category: cat,
            items: data.count,
            value: data.value,
            quantity: data.quantity,
          }))
          .sort((a, b) => b.value - a.value);

        if (mounted) {
          setStats({
            totalValue,
            totalItems: totalActiveItems,
            stockTurnover,
            wasteRate,
            healthScore,
            lowStockItems: lowCount,
            outOfStockItems: outCount,
            activeItems: totalActiveItems,
          });
          setTopMoving(topMovers);
          setSlowMoving(slowMovers);
          setReorderNeeded(reorderList);
          setCategoryPerformance(categoryPerf);
        }
      } catch (err) {
        console.error('Failed to load reports:', err);
        toast.error('Failed to load inventory reports');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadReports();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="w-full p-8 bg-[#F7F4F0]">
          
          {/* Page Header (styled like InventoryHeader) */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 lg:mb-8">
            <div className="flex items-center gap-3">
              <div>
                <h1
                  className="text-xl sm:text-2xl font-bold text-[#1C100A] tracking-tight"
                  style={{ fontFamily: "serif" }}
                >
                  Inventory Reports
                </h1>
                <p className="text-xs text-[#9E8A7A] mt-0.5 hidden sm:block">Deep-dive analysis of your stock performance and waste tracking.</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm">
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <button className="flex items-center gap-2 bg-[#3D261D] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2A1A14] transition-colors shadow-sm">
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>

          {/* Top Stats Cards (reused from inventory StatCards) */}
          <StatCards
            cards={[
              { icon: DollarSign, label: 'Total Inventory Value', value: `₱${Number(stats.totalValue || 0).toFixed(2)}`, sub: `${stats.totalItems} active items`, accent: '#059669', iconBg: 'bg-emerald-100', iconColor: '#059669' },
              { icon: TrendingUp, label: 'Stock Turnover', value: `${stats.stockTurnover}x`, sub: 'adjustments per item', accent: '#3D261D', iconBg: 'bg-gray-100', iconColor: '#374151' },
              { icon: AlertTriangle, label: 'Health Score', value: `${stats.healthScore}%`, sub: `${stats.lowStockItems + stats.outOfStockItems} items need attention`, accent: stats.healthScore >= 75 ? '#059669' : stats.healthScore >= 50 ? '#F59E0B' : '#DC2626', iconBg: stats.healthScore >= 75 ? 'bg-emerald-100' : stats.healthScore >= 50 ? 'bg-amber-100' : 'bg-red-100', iconColor: stats.healthScore >= 75 ? '#059669' : stats.healthScore >= 50 ? '#F59E0B' : '#DC2626' },
            ]}
          />

          {/* Middle Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* Top Moving Items */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-1">🚀 Top Moving Items</h3>
              <p className="text-xs text-gray-500 mb-4">Most frequently adjusted items</p>
              
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-center py-4"><p className="text-sm text-gray-500">Loading...</p></div>
                ) : topMoving.length === 0 ? (
                  <div className="text-center py-4"><p className="text-sm text-gray-500">No data yet</p></div>
                ) : (
                  topMoving.map((item, idx) => (
                    <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-sm text-gray-900">{idx + 1}. {item.name}</p>
                        <span className="text-xs font-bold text-emerald-600">{item.adjustmentCount} moves</span>
                      </div>
                      <p className="text-xs text-gray-500">{item.category} • Stock: {item.quantity}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Slow Moving Items */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-1">🐢 Slow Moving Items</h3>
              <p className="text-xs text-gray-500 mb-4">Least frequently adjusted items</p>
              
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-center py-4"><p className="text-sm text-gray-500">Loading...</p></div>
                ) : slowMoving.length === 0 ? (
                  <div className="text-center py-4"><p className="text-sm text-gray-500">No data yet</p></div>
                ) : (
                  slowMoving.map((item, idx) => (
                    <div key={item.id} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-sm text-gray-900">{idx + 1}. {item.name}</p>
                        <span className="text-xs font-bold text-amber-600">{item.adjustmentCount} moves</span>
                      </div>
                      <p className="text-xs text-gray-500">{item.category} • Stock: {item.quantity}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Reorder Recommendations */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-1">📦 Reorder Soon</h3>
              <p className="text-xs text-gray-500 mb-4">Items to reorder immediately</p>
              
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-center py-4"><p className="text-sm text-gray-500">Loading...</p></div>
                ) : reorderNeeded.length === 0 ? (
                  <div className="text-center py-4"><p className="text-sm text-gray-500">All items stocked!</p></div>
                ) : (
                  reorderNeeded.map((item) => (
                    <div key={item.id} className={`p-3 rounded-lg border ${item.isOut ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-sm text-gray-900">{item.name}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${item.isOut ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {item.isOut ? 'OUT' : 'LOW'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{item.quantity}/{item.threshold} {item.category}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* Category Performance */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-gray-900">Category Performance</h3>
                  <p className="text-xs text-gray-500">Value distribution and item count by category</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-800">
                      <th className="pb-3">Category</th>
                      <th className="pb-3 text-right">Items</th>
                      <th className="pb-3 text-right">Total Qty</th>
                      <th className="pb-3 text-right">Value</th>
                      <th className="pb-3 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="5" className="py-4 text-center text-gray-500">Loading...</td></tr>
                    ) : categoryPerformance.length === 0 ? (
                      <tr><td colSpan="5" className="py-4 text-center text-gray-500">No data yet</td></tr>
                    ) : (
                      categoryPerformance.map((cat) => {
                        const percent = stats.totalValue > 0 ? ((cat.value / stats.totalValue) * 100).toFixed(1) : 0;
                        return (
                          <tr key={cat.category} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="py-4 font-semibold text-gray-800">{cat.category}</td>
                            <td className="py-4 text-right text-gray-600">{cat.items}</td>
                            <td className="py-4 text-right text-gray-600">{cat.quantity.toFixed(2)}</td>
                            <td className="py-4 text-right font-bold text-gray-900">₱{cat.value.toFixed(2)}</td>
                            <td className="py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-12 bg-gray-100 rounded-full h-2">
                                  <div className="bg-[#3D261D] h-2 rounded-full" style={{ width: `${percent}%` }}></div>
                                </div>
                                <span className="text-xs font-semibold text-gray-600 w-8 text-right">{percent}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stock Health Summary */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="font-bold text-gray-900 mb-1">📊 Stock Health</h3>
              <p className="text-xs text-gray-500 mb-6">Current inventory status</p>

              <div className="flex-1 space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">Active Items</p>
                  <p className="text-3xl font-bold text-emerald-900">{stats.activeItems}</p>
                  <p className="text-xs text-emerald-700 mt-1">Healthy stock</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-yellow-700 font-bold mb-1">Low Stock</p>
                  <p className="text-3xl font-bold text-yellow-900">{stats.lowStockItems}</p>
                  <p className="text-xs text-yellow-700 mt-1">Need attention soon</p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-red-700 font-bold mb-1">Out of Stock</p>
                  <p className="text-3xl font-bold text-red-900">{stats.outOfStockItems}</p>
                  <p className="text-xs text-red-700 mt-1">Reorder immediately</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-600">
                  <span className="font-bold">Overall Health:</span> <span className={`font-bold ${stats.healthScore >= 75 ? 'text-emerald-600' : stats.healthScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{stats.healthScore}%</span>
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-2 text-center border-t border-gray-200 pt-6 pb-2">
            <p className="text-[11px] text-gray-400">
              © 2026 Coffee&Tea Inventory Systems. All rights reserved. | System Status: <span className="text-green-500 font-bold">Optimal</span>
            </p>
          </div>

    </div>
  );
}