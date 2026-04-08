import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coffee, Package, Calendar, Plus,
  DollarSign, AlertTriangle, TrendingUp, TrendingDown,
  PlusCircle, Trash2, ShoppingCart, RefreshCw, ArrowUpRight, X, Archive
} from 'lucide-react';

import StatCards from '../components/inventory/StatCards';
import DailyUsageGraph from '../components/dashboard/DailyUsageGraph';
import { getInventory, getInventoryLogs } from '../services/api';
import { getAuthSession } from '../utils/authStorage';
import { toast } from 'react-toastify';

const dashboardCache = {
  stats: null,
  inventoryItems: null,
  categoryDistribution: null,
  allAlerts: null,
  alertItems: null,
  lastSync: null,
  logs: null,
  statsTs: 0,
  logsTs: 0,
};

const DASHBOARD_CACHE_TTL = 15 * 1000; // 15 seconds

export default function Dashboard({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, lowCount: 0, outCount: 0, archivedCount: 0, value: 0 });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [categoryDistribution, setCategoryDistribution] = useState([]);
  const [alertItems, setAlertItems] = useState([]);
  const [allAlerts, setAllAlerts] = useState([]);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

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

  const buildCategoryDistribution = (items) => {
    const totals = items.reduce((acc, item) => {
      const category = normalizeCategory(item.category);
      const qty = Number(item.quantity || 0);
      acc[category] = (acc[category] || 0) + qty;
      return acc;
    }, {});

    const grandTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);
    if (!grandTotal) return [];

    return Object.entries(totals)
      .map(([category, qty]) => {
        const rawPercent = (qty / grandTotal) * 100;
        return {
          category,
          qty,
          percent: Number(rawPercent.toFixed(1)),
          displayPercent: rawPercent > 0 && rawPercent < 0.5 ? 0.5 : Number(rawPercent.toFixed(1)),
        };
      })
      .sort((a, b) => b.qty - a.qty);
  };

  const formatLogTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    }
    if (typeof timestamp === 'object' && (timestamp._seconds || timestamp.seconds)) {
      return new Date((timestamp._seconds || timestamp.seconds) * 1000).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    }
    return new Date(timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
  };

  const handleCardClick = (action) => {
    switch (action) {
      case 'all':
        navigate('/inventory');
        break;
      case 'low-stock':
        navigate('/inventory?status=Active&filter=low-stock');
        break;
      case 'out-of-stock':
        navigate('/inventory?status=Active&filter=out-of-stock');
        break;
      case 'value':
        navigate('/inventory?sort=value-desc');
        break;
      case 'archived':
        navigate('/inventory?status=Archived');
        break;
      default:
        navigate('/inventory');
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadStats = async () => {
      const session = getAuthSession();
      if (!session?.token) return;
      try {
        const res = await getInventory(session.token, { limit: 100, status: 'all' });
        const items = Array.isArray(res?.data) ? res.data : [];

        let total = items.length;
        let lowCount = 0;
        let outCount = 0;
        let archivedCount = 0;
        let value = 0;
        const alerts = [];

        items.forEach((item) => {
          const quantity = Number(item.quantity || 0);
          const threshold = Number(item.lowStockThreshold || 0);
          const costPrice = Number(item.costPrice || 0);
          const isArchived = (item.status || 'active') === 'deleted';

          if (isArchived) {
            archivedCount += 1;
          } else {
            if (quantity <= 0) {
              outCount += 1;
              alerts.push({ ...item, severity: 'critical' });
            } else if (quantity <= threshold) {
              lowCount += 1;
              alerts.push({ ...item, severity: 'warning' });
            }

            value += quantity * costPrice;
          }
        });

        if (mounted) {
          // Sort by severity (critical first), then by how low they are
          const sortedAlerts = alerts.sort((a, b) => {
            if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
            return Number(a.quantity || 0) - Number(b.quantity || 0);
          });

          const nextStats = { total: total - archivedCount, lowCount, outCount, archivedCount, value };
          const nextCategoryDistribution = buildCategoryDistribution(items);
          const nextAlertItems = sortedAlerts.slice(0, 4);
          const nextLastSync = new Date();

          setStats(nextStats);
          setInventoryItems(items);
          setCategoryDistribution(nextCategoryDistribution);
          setAllAlerts(sortedAlerts); // Store all alerts
          setAlertItems(nextAlertItems); // Display only top 4
          setLastSync(nextLastSync);

          dashboardCache.stats = nextStats;
          dashboardCache.inventoryItems = items;
          dashboardCache.categoryDistribution = nextCategoryDistribution;
          dashboardCache.allAlerts = sortedAlerts;
          dashboardCache.alertItems = nextAlertItems;
          dashboardCache.lastSync = nextLastSync;
          dashboardCache.statsTs = Date.now();
        }
      } catch (err) {
        toast.error(err?.message || 'Failed to load inventory stats');
      }
    };

    const now = Date.now();
    if (dashboardCache.stats && now - dashboardCache.statsTs < DASHBOARD_CACHE_TTL) {
      setStats(dashboardCache.stats);
      setInventoryItems(dashboardCache.inventoryItems || []);
      setCategoryDistribution(dashboardCache.categoryDistribution || []);
      setAllAlerts(dashboardCache.allAlerts || []);
      setAlertItems(dashboardCache.alertItems || []);
      setLastSync(dashboardCache.lastSync || new Date());
    } else {
      loadStats();
    }

    const interval = setInterval(loadStats, 60 * 1000); // refresh every minute
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadLogs = async () => {
      setIsLoadingLogs(true);
      const now = Date.now();
      if (dashboardCache.logs && now - dashboardCache.logsTs < DASHBOARD_CACHE_TTL) {
        if (mounted) {
          setLogs(dashboardCache.logs || []);
          setIsLoadingLogs(false);
        }
        return;
      }

      const session = getAuthSession();
      if (!session?.token) {
        setIsLoadingLogs(false);
        return;
      }
      try {
        const res = await getInventoryLogs(session.token, { days: 7, limit: 500 });
        if (mounted) {
          const newLogs = Array.isArray(res?.data) ? res.data : [];
          setLogs(newLogs);
          dashboardCache.logs = newLogs;
          dashboardCache.logsTs = Date.now();
        }
      } catch (err) {
        console.error('Failed to load usage logs:', err);
        // Silently fail for logs - don't show toast
      } finally {
        if (mounted) setIsLoadingLogs(false);
      }
    };

    loadLogs();
    const interval = setInterval(loadLogs, 60 * 1000); // refresh every minute
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const formattedDate = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const inventoryHealth = stats.total === 0
    ? 100
    : Math.max(0, Math.round(((stats.total - stats.lowCount - stats.outCount) / stats.total) * 100));

  const alertCount = stats.lowCount + stats.outCount;

  const getHealthColor = () => {
    if (inventoryHealth === 0) return 'text-red-600';
    if (inventoryHealth <= 50) return 'text-yellow-600';
    if (inventoryHealth <= 75) return 'text-amber-600';
    return 'text-emerald-600';
  };

  const getAlertColor = () => {
    if (alertCount === 0) return 'text-gray-700';
    if (alertCount > 5) return 'text-red-600';
    return 'text-amber-600';
  };

  const recentLogs = logs.slice(0, 4);
  const positiveAdjustments = logs.filter((log) => Number(log.details?.adjustment || 0) > 0).length;
  const negativeAdjustments = logs.filter((log) => Number(log.details?.adjustment || 0) < 0).length;
  const netAdjustment = logs.reduce((sum, log) => sum + Number(log.details?.adjustment || 0), 0);

  return (
    <div className="w-full p-8 bg-[#F7F4F0]">
      {/* All Alerts Modal */}
      {showAllAlerts && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-gray-500" /> All Priority Alerts
                </h2>
                <p className="text-sm text-gray-500 mt-1">{allAlerts.length} item{allAlerts.length === 1 ? '' : 's'} need attention</p>
              </div>
              <button
                onClick={() => setShowAllAlerts(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {allAlerts.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-lg text-gray-600 font-medium">✓ All inventory levels healthy</p>
                  <p className="text-sm text-gray-400 mt-1">No items below threshold</p>
                </div>
              ) : (
                allAlerts.map((item) => (
                  <div key={item.id} className="p-4 border border-gray-100 rounded-xl flex justify-between items-center hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="font-bold text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Current: {item.quantity}{item.unit} / Reorder: {item.lowStockThreshold}{item.unit}
                      </p>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap ml-4 ${
                      item.severity === 'critical'
                        ? 'bg-red-500 text-white'
                        : 'border border-gray-300 text-gray-600'
                    }`}>
                      {item.severity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

          {/* Welcome Section (styled like InventoryHeader) */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 lg:mb-8">
            <div className="flex items-center gap-3">
              <div>
                <h1
                  className="text-xl sm:text-2xl font-bold text-[#1C100A] tracking-tight"
                  style={{ fontFamily: "serif" }}
                >
                  {getTimeBasedGreeting()}, Manager
                </h1>
                <p className="text-xs text-[#9E8A7A] mt-0.5 hidden sm:block">
                  Your inventory health is <span className={`font-semibold ${getHealthColor()}`}>{inventoryHealth}%</span>.
                  {alertCount > 0 && (
                    <span className={getAlertColor()}>
                      {` ${alertCount} item${alertCount === 1 ? '' : 's'} need your attention.`}
                    </span>
                  )}
                  {alertCount === 0 && ' All inventory levels are currently healthy.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <Calendar className="w-4 h-4" />
                {formattedDate}
              </button>
            </div>
          </div>

          {/* Top Stats Cards (live data) */}
          <StatCards
            cards={[
              { icon: Package, label: 'Total Items', value: String(stats.total), sub: 'Across all categories', accent: '#3D261D', iconBg: 'bg-[#EDE4DC]', iconColor: '#3D261D', action: 'all' },
              { icon: TrendingDown, label: 'Out of Stock', value: String(stats.outCount), sub: 'Need replenishment', accent: '#DC2626', iconBg: 'bg-red-100', iconColor: '#DC2626', action: 'out-of-stock' },
              { icon: DollarSign, label: 'Inventory Value', value: `₱${Number(stats.value || 0).toFixed(2)}`, sub: 'Current valuation', accent: '#059669', iconBg: 'bg-emerald-100', iconColor: '#059669', action: 'value' },
              { icon: AlertTriangle, label: 'Low Items', value: String(stats.lowCount), sub: 'Need attention', accent: '#F59E0B', iconBg: 'bg-amber-100', iconColor: '#B45309', action: 'low-stock' },
              { icon: Archive, label: 'Archived', value: String(stats.archivedCount), sub: 'Hidden from active inventory', accent: '#6B7280', iconBg: 'bg-slate-100', iconColor: '#475569', action: 'archived' },
              { icon: RefreshCw, label: 'Last Sync', value: lastSync ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—', sub: lastSync ? new Date(lastSync).toLocaleDateString() : '', accent: '#6B7280', iconBg: 'bg-gray-100', iconColor: '#374151' },
            ]}
            onCardClick={handleCardClick}
          />

          {/* Middle Section - Graphs & Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

            {/* Big Graph - Daily Ingredient Usage */}
            <DailyUsageGraph logs={logs} isLoading={isLoadingLogs} />

            {/* Priority Alerts */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-gray-500" /> Priority Alerts
                  </h3>
                  <p className="text-xs text-gray-500">Items below threshold as of today</p>
                </div>
                <button
                  onClick={() => setShowAllAlerts(true)}
                  className="text-xs text-gray-600 hover:text-gray-900"
                >
                  View All
                </button>
              </div>
              
              <div className="flex-1 space-y-3">
                {alertItems.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-gray-600 font-medium">✓ All inventory levels healthy</p>
                    <p className="text-[10px] text-gray-400">No items below threshold</p>
                  </div>
                ) : (
                  alertItems.map((item) => (
                    <div key={item.id} className="p-3 border border-gray-100 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm text-gray-900">{item.name}</p>
                        <p className="text-[10px] text-gray-500">
                          Current: {item.quantity}{item.unit} / Reorder: {item.lowStockThreshold}{item.unit}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.severity === 'critical'
                          ? 'bg-red-500 text-white'
                          : 'border border-gray-300 text-gray-600'
                      }`}>
                        {item.severity}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-[10px] text-gray-400">
                  {allAlerts.length === 0
                    ? 'All items in stock'
                    : `${allAlerts.length} item${allAlerts.length === 1 ? '' : 's'} need attention`}
                </span>
                <ArrowUpRight className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Bottom Section - 3 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            {/* Stock Distribution */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-1">Stock Distribution</h3>
              <p className="text-xs text-gray-500 mb-6">Actual inventory volume by category</p>

              <div className="space-y-4 mb-6">
                {categoryDistribution.length > 0 ? (
                  categoryDistribution.map((category) => (
                    <div key={category.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{category.category}</span>
                        <span className="text-gray-500">{category.percent}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3.5">
                        <div className="bg-[#4A332A] h-3.5 rounded-full" style={{ width: `${category.displayPercent}%`, minWidth: category.displayPercent > 0 && category.displayPercent < 0.5 ? '0.5%' : undefined }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-2xl bg-[#FAF8F5] text-sm text-gray-500">
                    No category distribution available yet.
                  </div>
                )}
              </div>

              {categoryDistribution.length > 0 && (
                <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                  {categoryDistribution.slice(0, 3).map((category) => (
                    <div key={category.category} className="text-center">
                      <p className="text-[10px] text-gray-400">{category.category}</p>
                      <p className="font-bold text-gray-900">{category.percent}%</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stock Movement */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-1">Stock Movement</h3>
              <p className="text-xs text-gray-500 mb-6">Last 7 days of stock adjustments</p>

              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-2xl bg-[#F9FAF7] p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Total Adjustments</p>
                  <p className="text-3xl font-bold text-gray-900">{logs.length}</p>
                </div>
                <div className="rounded-2xl bg-[#F7F4F0] p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Consumed</p>
                  <p className="text-3xl font-bold text-red-600">{negativeAdjustments}</p>
                </div>
                <div className="rounded-2xl bg-[#ECFDF5] p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Restocked</p>
                  <p className="text-3xl font-bold text-emerald-600">{positiveAdjustments}</p>
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                Net adjustment over the last 7 days: <span className="font-semibold text-gray-900">{netAdjustment >= 0 ? '+' : ''}{netAdjustment} units</span>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="font-bold text-gray-900 mb-1">Recent Activity</h3>
              <p className="text-xs text-gray-500 mb-6">Recent inventory activity</p>

              <div className="flex-1 relative">
                <div className="absolute left-2.75 top-2 bottom-2 w-0.5 bg-gray-100"></div>

                <div className="space-y-5 relative z-10">
                  {recentLogs.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#FAF8F5] text-sm text-gray-500 text-center">
                      No recent activity recorded.
                    </div>
                  ) : (
                    recentLogs.map((log) => {
                      const getActivityInfo = (log) => {
                        switch (log.action) {
                          case 'CREATE':
                            return {
                              icon: PlusCircle,
                              iconColor: 'text-emerald-600',
                              bgColor: 'bg-emerald-50 border-emerald-100',
                              actionText: 'Added',
                              description: `New item created with ${log.details?.quantity || 0} units`
                            };
                          case 'UPDATE':
                            return {
                              icon: RefreshCw,
                              iconColor: 'text-blue-600',
                              bgColor: 'bg-blue-50 border-blue-100',
                              actionText: 'Updated',
                              description: 'Item details modified'
                            };
                          case 'DELETE':
                            return {
                              icon: Trash2,
                              iconColor: 'text-red-600',
                              bgColor: 'bg-red-50 border-red-100',
                              actionText: 'Deleted',
                              description: 'Item archived'
                            };
                          case 'STOCK_ADJUST':
                            const adjustment = Number(log.details?.adjustment || 0);
                            const isRestock = adjustment > 0;
                            return {
                              icon: isRestock ? PlusCircle : Trash2,
                              iconColor: isRestock ? 'text-emerald-600' : 'text-red-500',
                              bgColor: isRestock ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100',
                              actionText: isRestock ? 'Restocked' : 'Consumed',
                              description: log.details?.reason || `${Math.abs(adjustment)} units ${isRestock ? 'added' : 'removed'}`
                            };
                          default:
                            return {
                              icon: RefreshCw,
                              iconColor: 'text-gray-600',
                              bgColor: 'bg-gray-50 border-gray-100',
                              actionText: 'Activity',
                              description: 'Inventory activity'
                            };
                        }
                      };

                      const activityInfo = getActivityInfo(log);
                      const Icon = activityInfo.icon;

                      return (
                        <div key={log.id} className="flex gap-4">
                          <div className={`w-6 h-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center ${activityInfo.bgColor}`}>
                            <Icon className={`w-3 h-3 ${activityInfo.iconColor}`} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">
                              {activityInfo.actionText} <span className="font-normal text-[10px] text-gray-400 ml-1">{formatLogTimestamp(log.timestamp)}</span>
                            </p>
                            <p className="text-xs text-gray-600">{log.itemName || 'Unknown item'}</p>
                            <p className="text-[10px] text-gray-400 italic">{activityInfo.description}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Restock Banner */}
          <div className="bg-[#FAF6F4] rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between border border-[#F0EBE6]">
            <div className="flex items-center gap-4 mb-4 md:mb-0">
              <div className="bg-[#3D261D] p-3 rounded-xl">
                <Coffee className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg font-serif">Need a restock fast?</h3>
                <p className="text-sm text-gray-600">Quick-order from your top 3 suppliers in one click.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="bg-white border border-gray-200 text-gray-800 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">Supplier Portal</button>
              <button className="bg-[#3D261D] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#2A1A14] transition-colors">Create Bulk PO</button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center border-t border-gray-200 pt-6 pb-2">
            <p className="text-[11px] text-gray-400">
              © 2026 Coffee&Tea Inventory Systems. All rights reserved. | System Status: <span className="text-green-500 font-bold">Optimal</span>
            </p>
          </div>

    </div>
  );
}