import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Search, Coffee, Archive, Package, AlertTriangle, TrendingDown, RefreshCcw, PlusCircle, Edit2, Trash2, DollarSign, TrendingUp, ScrollText, Clock3, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthSession } from '../utils/authStorage';
import { adjustInventoryStock, createInventoryItem, updateInventoryItem, deleteInventoryItem, restoreInventoryItem, getInventory, getInventoryLogs, getNotifications } from '../services/api';
import Dropdown from '../components/Dropdown';
import InventoryHeader from '../components/inventory/InventoryHeader';
import InventoryAlertBanner from '../components/inventory/InventoryAlertBanner';
import StatCards from '../components/inventory/StatCards';
import InventoryTable from '../components/inventory/InventoryTable';
import InventoryMobileList from '../components/inventory/InventoryMobileList';
import InventoryHistoryPanel from '../components/inventory/InventoryHistoryPanel';
import ItemDrawer from '../components/inventory/ItemDrawer';
import ActionConfirmModal from '../components/inventory/ActionConfirmModal';
import StockAdjustModal from '../components/inventory/StockAdjustModal';
import DuplicateItemModal from '../components/inventory/DuplicateItemModal';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  applyRealtimeUiInventoryEvent,
  createRealtimeActivity,
  mapInventoryItemToUi as mapItemToUi,
  mergeRecentActivities,
  parseTimestamp,
} from '../utils/inventoryRealtime';
import { broadcastInventoryRefresh, subscribeToInventoryRefresh } from '../utils/inventoryEvents';

const categoryToBackend = {
  Beans: 'beans', Milk: 'milk', Syrup: 'syrup',
  Cups: 'packaging', Pastries: 'other', Equipment: 'equipment', 'Add-ins': 'add-ins', Powder: 'powder', Other: 'other',
};

const extractApiErrorMessage = (error, fallback) => {
  const validationErrors = error?.body?.errors;
  if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    const first = validationErrors[0];
    if (first?.field && first?.message) return `${first.field}: ${first.message}`;
    if (first?.message) return first.message;
  }
  return error?.message || fallback;
};

const btnBrown = 'bg-[#3D261D] hover:bg-[#2E1C15] active:scale-[0.98] text-white font-semibold transition-all duration-150';
const inputCls = 'w-full border border-[#E2DDD8] rounded-xl px-3.5 py-2.5 text-sm text-[#2C1810] bg-white transition focus:outline-none focus:border-[#6B3E26] focus:ring-2 focus:ring-[#6B3E26]/10 placeholder:text-[#C4B8B0]';
const STOCK_HISTORY_PAGE_SIZE = 40;
const STOCK_HISTORY_DEDUPE_WINDOW_MS = 5000;
const PESO_SYMBOL = '\u20B1';
const QUANTITY_PRECISION = 1000;

const normalizeInventoryQuantity = (value) => {
  const parsed = Number.parseFloat(value ?? 0);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return Math.round(parsed * QUANTITY_PRECISION) / QUANTITY_PRECISION;
};

const unitSupportsFractionalQuantity = (unit = '') =>
  String(unit).trim().toLowerCase() !== 'pcs';

const isWholeInventoryQuantity = (value) => Math.abs(value - Math.round(value)) < 0.000001;

const formatInventoryQuantity = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value ?? '');
  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(3).replace(/\.?0+$/, '');
};

const exportToCSV = (items) => {
  if (items.length === 0) {
    toast.info('No items to export');
    return;
  }

  const headers = ['Item Name', 'SKU', 'Category', 'Stock', 'Reorder Level', 'Unit Cost', 'Total Value', 'Total Batches', 'Status', 'Last Updated'];
  const rows = items.map((item) => [
    item.name,
    item.sku,
    item.cat,
    item.quantity,
    item.threshold,
    item.costPrice.toFixed(2),
    item.currentValue.toFixed(2),
    item.stockBatches?.length || 0,
    item.status,
    item.date,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const areStockHistoryEntriesEquivalent = (first, second) => {
  if (!first || !second) return false;

  if (first.id && second.id && first.id === second.id) return true;

  return (
    first.itemId === second.itemId &&
    Number(first.adjustment || 0) === Number(second.adjustment || 0) &&
    Number(first.newQuantity || 0) === Number(second.newQuantity || 0) &&
    Math.abs(parseTimestamp(first.timestamp).getTime() - parseTimestamp(second.timestamp).getTime()) <=
      STOCK_HISTORY_DEDUPE_WINDOW_MS
  );
};

const mergeStockHistoryEntries = (currentEntries = [], incomingEntries = []) => {
  const next = [...currentEntries];

  incomingEntries.forEach((incomingEntry) => {
    if (!incomingEntry) return;

    const existingIndex = next.findIndex((entry) => areStockHistoryEntriesEquivalent(entry, incomingEntry));

    if (existingIndex === -1) {
      next.push(incomingEntry);
      return;
    }

    next[existingIndex] = {
      ...next[existingIndex],
      ...incomingEntry,
    };
  });

  return next.sort((first, second) => parseTimestamp(second.timestamp) - parseTimestamp(first.timestamp));
};

const upsertInventoryUiItem = (items = [], incomingItem, { prependIfNew = false } = {}) => {
  if (!incomingItem?.id) return items;

  const existingIndex = items.findIndex((item) => item.id === incomingItem.id);
  if (existingIndex === -1) {
    return prependIfNew ? [incomingItem, ...items] : [...items, incomingItem];
  }

  const next = [...items];
  next[existingIndex] = incomingItem;
  return next;
};

const isWithinHistoryRange = (value, range) => {
  if (range === 'all') return true;

  const timestamp = parseTimestamp(value);
  if (Number.isNaN(timestamp.getTime())) return false;

  const days = Math.max(parseInt(range, 10) || 30, 1);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);

  return timestamp >= cutoff;
};

const buildStockHistoryEntry = ({
  id,
  itemId,
  itemSku = '',
  itemName,
  timestamp,
  adjustment,
  direction = null,
  newQuantity,
  previousQuantity,
  unit = '',
  reason = '',
  expirationDate = null,
  addedBatch = null,
  consumedBatches = [],
  performedBy = '',
  source = 'remote',
}) => {
  const numericAdjustment = Number(adjustment || 0);
  const numericNewQuantity = Number(newQuantity ?? 0);
  const numericPreviousQuantity =
    previousQuantity !== undefined && previousQuantity !== null
      ? Number(previousQuantity)
      : numericNewQuantity - numericAdjustment;

  return {
    id,
    itemId,
    itemSku,
    itemName: itemName || 'Unknown item',
    timestamp: parseTimestamp(timestamp),
    adjustment: numericAdjustment,
    absoluteAdjustment: Math.abs(numericAdjustment),
    direction: direction || (numericAdjustment >= 0 ? 'IN' : 'OUT'),
    previousQuantity: Number.isFinite(numericPreviousQuantity)
      ? numericPreviousQuantity
      : numericNewQuantity - numericAdjustment,
    newQuantity: numericNewQuantity,
    unit,
    reason,
    expirationDate,
    addedBatch,
    consumedBatches: Array.isArray(consumedBatches) ? consumedBatches : [],
    performedBy,
    source,
  };
};

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQueryTab = searchParams.get('tab');
  const initialQueryStatus = String(searchParams.get('status') || '').toLowerCase();
  const [isDrawerOpen,    setIsDrawerOpen]    = useState(false);
  const [drawerMode,      setDrawerMode]      = useState('add'); // 'add' or 'edit'
  const [formError,       setFormError]       = useState('');
  const [isLoadingItems,  setIsLoadingItems]  = useState(true);
  const [searchTerm,      setSearchTerm]      = useState('');
  const [categoryFilter,  setCategoryFilter]  = useState('All');
  const [statusFilter,    setStatusFilter]    = useState(initialQueryStatus === 'archived' ? 'Archived' : 'Active');
  const [sortBy,          setSortBy]          = useState('name');
  const [sortOrder,       setSortOrder]       = useState('asc');
  const [inventoryItems,  setInventoryItems]  = useState([]);
  const [showFilters,     setShowFilters]     = useState(false);
  const [confirmationAction, setConfirmationAction] = useState(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMatchItem, setDuplicateMatchItem] = useState(null);
  const [pendingCreateInput, setPendingCreateInput] = useState(null);
  const [stockAdjustDraft, setStockAdjustDraft] = useState(null);
  const [stockAdjustQuantity, setStockAdjustQuantity] = useState('1');
  const [stockAdjustExpirationDate, setStockAdjustExpirationDate] = useState('');
  const [stockAdjustBatchCost, setStockAdjustBatchCost] = useState('');
  const [stockDeductionMode, setStockDeductionMode] = useState('manual');
  const [isSubmittingStockAdjust, setIsSubmittingStockAdjust] = useState(false);
  const [currentPage,     setCurrentPage]     = useState(1);
  const [selectedItems,   setSelectedItems]   = useState(new Set());
  const [activeTab, setActiveTab] = useState(
    initialQueryTab === 'history'
      ? 'history'
      : initialQueryTab === 'archived' || initialQueryStatus === 'archived'
        ? 'archived'
        : 'inventory'
  );
  const [recentActivities, setRecentActivities] = useState([]);
  const [recentPage, setRecentPage] = useState(1);
  const [stockHistoryEntries, setStockHistoryEntries] = useState([]);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyMovementFilter, setHistoryMovementFilter] = useState('All');
  const [historyRange, setHistoryRange] = useState('30');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyCursor, setHistoryCursor] = useState(null);
  const itemsPerPage = 10;
  const recentActivitiesPerPage = 5;
  const [newItem, setNewItem] = useState({
    itemName: '', sku: '', category: 'Beans', unit: 'pcs', totalBatchCost: '', batchQuantity: '', minimumStock: '', initialStock: '', expirationDate: '',
  });

  const RECENT_ACTIVITIES_STORAGE_KEY = 'inventoryRecentActivities';

  const normalizeActivityType = (action) => {
    switch ((action || '').toString().toUpperCase()) {
      case 'CREATE': return 'created';
      case 'UPDATE': return 'updated';
      case 'DELETE': return 'deleted';
      case 'STOCK_ADJUST': return 'adjusted';
      default: return 'activity';
    }
  };

  const buildActivityDescription = (activity) => {
    if (activity.type === 'adjusted') {
      const adjustment = Number(activity.details?.adjustment || 0);
      const absAdjustment = Math.abs(adjustment);
      const direction = adjustment > 0 ? 'Restocked' : 'Consumed';
      const units = activity.details?.unit || '';
      const reason = activity.details?.reason ? ` - ${activity.details.reason}` : '';
      return `${direction} ${absAdjustment}${units} ${reason}`.trim();
    }

    if (activity.type === 'created') {
      return activity.details?.reason ? `Created - ${activity.details.reason}` : 'Created item';
    }

    if (activity.type === 'updated') {
      return activity.details?.reason ? `Updated - ${activity.details.reason}` : 'Updated item details';
    }

    if (activity.type === 'deleted') {
      return activity.details?.reason ? `Archived - ${activity.details.reason}` : 'Archived item';
    }

    return activity.details?.reason || 'Inventory activity';
  };

  const sanitizeStoredActivity = (activity) => {
    return {
      id: activity.id,
      type: activity.type,
      itemName: activity.itemName,
      timestamp: parseTimestamp(activity.timestamp).toISOString(),
      details: activity.details || {},
      source: activity.source || 'local',
    };
  };

  const saveRecentActivities = (activities) => {
    try {
      window.localStorage.setItem(RECENT_ACTIVITIES_STORAGE_KEY, JSON.stringify(activities.map(sanitizeStoredActivity)));
    } catch {
      // ignore storage failures
    }
  };

  const appendRecentActivity = (activity) => {
    if (!activity) return;

    setRecentActivities((prev) => {
      const next = mergeRecentActivities(prev, activity, 10);
      saveRecentActivities(next);
      return next;
    });
  };

  const addActivity = (type, itemName, details = {}) => {
    const activity = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      itemName,
      timestamp: new Date(),
      details,
      source: 'local',
    };
    appendRecentActivity(activity);
  };

  const loadStoredActivities = () => {
    try {
      const raw = window.localStorage.getItem(RECENT_ACTIVITIES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((activity) => ({
          ...activity,
          timestamp: parseTimestamp(activity.timestamp),
        }))
        .slice(0, 10);
    } catch {
      return [];
    }
  };

  const transformLogToActivity = (log) => {
    const type = normalizeActivityType(log.action);
    return {
      id: log.id,
      type,
      itemName: log.itemName || log.details?.itemName || 'Unknown item',
      timestamp: parseTimestamp(log.timestamp),
      details: {
        ...log.details,
        action: log.action,
      },
      source: 'remote',
    };
  };

  const inventoryItemsById = useMemo(
    () => new Map(inventoryItems.map((item) => [item.id, item])),
    [inventoryItems]
  );

  const transformLogToHistoryEntry = (log) => {
    if ((log?.action || '').toString().toUpperCase() !== 'STOCK_ADJUST') return null;

    const fallbackItem = inventoryItemsById.get(log.itemId);

    return buildStockHistoryEntry({
      id: log.id,
      itemId: log.itemId,
      itemSku: log.details?.sku || fallbackItem?.sku || '',
      itemName: log.itemName || fallbackItem?.name || 'Unknown item',
      timestamp: log.timestamp,
      adjustment: log.details?.adjustment,
      newQuantity: log.details?.newQuantity ?? fallbackItem?.quantity ?? 0,
      previousQuantity: log.details?.previousQuantity,
      unit: log.details?.unit || fallbackItem?.unit || '',
      reason: log.details?.reason || '',
      expirationDate: log.details?.expirationDate || null,
      addedBatch: log.details?.addedBatch || null,
      consumedBatches: log.details?.consumedBatches || [],
      performedBy: log.performedBy || '',
      source: 'remote',
    });
  };

  const transformExpiredNotificationToHistoryEntry = (notification) => {
    if ((notification?.type || '').toString().toLowerCase() !== 'expired') return null;

    const fallbackItem = inventoryItemsById.get(notification.itemId);
    const timestamp =
      notification.updatedAt ||
      notification.createdAt ||
      notification.timestamp ||
      notification.readAt ||
      new Date().toISOString();

    return buildStockHistoryEntry({
      id: notification.id,
      itemId: notification.itemId || fallbackItem?.id || '',
      itemSku: notification.sku || fallbackItem?.sku || '',
      itemName: notification.itemName || fallbackItem?.name || 'Unknown item',
      timestamp,
      adjustment: 0,
      direction: 'EXPIRED',
      newQuantity: notification.quantity ?? fallbackItem?.quantity ?? 0,
      previousQuantity: notification.quantity ?? fallbackItem?.quantity ?? 0,
      unit: notification.unit || fallbackItem?.unit || '',
      reason: notification.message || 'Item has expired.',
      expirationDate: notification.expirationDate || fallbackItem?.expirationDate || null,
      performedBy: '',
      source: 'notification',
    });
  };

  const createRealtimeHistoryEntry = (event) => {
    if (event?.type !== 'stock-adjusted') return null;

    const data = event?.data || {};
    const fallbackItem = inventoryItemsById.get(data.id);

    return buildStockHistoryEntry({
      id: `ws-stock-adjusted-${data.id}-${parseTimestamp(event?.timestamp || event?.receivedAt || new Date()).getTime()}`,
      itemId: data.id,
      itemSku: data.sku || fallbackItem?.sku || '',
      itemName: data.name || fallbackItem?.name || 'Unknown item',
      timestamp: event?.timestamp || event?.receivedAt || new Date(),
      adjustment: data.adjustment,
      previousQuantity: data.previousQuantity,
      newQuantity: data.quantity ?? fallbackItem?.quantity ?? 0,
      unit: data.unit || fallbackItem?.unit || '',
      reason: data.reason || '',
      expirationDate: data.expirationDate || null,
      addedBatch: data.addedBatch || null,
      consumedBatches: data.consumedBatches || [],
      performedBy: data.updatedBy || '',
      source: 'realtime',
    });
  };

  // Helper function to normalize item names for comparison
  const normalizeNameForComparison = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  };

  const selectedStockStatusFilter = useMemo(() => {
    const filter = searchParams.get('filter');

    if (filter === 'expired') return 'expired';
    if (filter === 'out-of-stock') return 'out-of-stock';
    if (filter === 'low-stock') return 'low-stock';
    return 'all';
  }, [searchParams]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let filtered = inventoryItems.filter((item) => {
      const matchCat    = categoryFilter === 'All' || item.cat === categoryFilter;
      const matchSearch = !term || item.name.toLowerCase().includes(term) || item.sku.toLowerCase().includes(term);
      const matchStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && !item.isArchived) ||
        (statusFilter === 'Archived' && item.isArchived);

      // Additional filtering for dashboard navigation
      let matchDashboardFilter = true;
      if (selectedStockStatusFilter === 'low-stock') {
        matchDashboardFilter = item.isLow && !item.isArchived;
      } else if (selectedStockStatusFilter === 'out-of-stock') {
        matchDashboardFilter = item.isOut && !item.isArchived;
      } else if (selectedStockStatusFilter === 'expired') {
        matchDashboardFilter = item.hasExpiredStock && !item.isArchived;
      }

      return matchCat && matchSearch && matchStatus && matchDashboardFilter;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'dateAdded':
          aValue = new Date(a.dateAdded);
          bValue = new Date(b.dateAdded);
          break;
        case 'category':
          aValue = a.cat.toLowerCase();
          bValue = b.cat.toLowerCase();
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'value':
          aValue = a.currentValue;
          bValue = b.currentValue;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [inventoryItems, searchTerm, categoryFilter, statusFilter, sortBy, sortOrder, selectedStockStatusFilter]);

  // Reset to page 1 when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter, sortBy, sortOrder, selectedStockStatusFilter]);

  // Calculate paginated items
  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    return filteredItems.slice(startIdx, endIdx);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  useEffect(() => {
    const safeTotalPages = totalPages || 1;
    if (currentPage > safeTotalPages) {
      setCurrentPage(safeTotalPages);
    }
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    const activeItems = inventoryItems.filter((i) => !i.isArchived);
    const archivedItems = inventoryItems.filter((i) => i.isArchived);
    return {
      total: activeItems.length,
      expiredCount: activeItems.filter((i) => i.hasExpiredStock).length,
      lowCount: activeItems.filter((i) => i.isLow).length,
      outCount: activeItems.filter((i) => i.isOut).length,
      archivedCount: archivedItems.length,
      value: activeItems.reduce((s, i) => s + Number(i.currentValue || 0), 0),
      reorderValue: activeItems.reduce((s, i) => {
        const batchCost = Number(i.totalBatchCost || 0);
        const batchQuantity = Number(i.batchQuantity || 0);
        if (Number.isFinite(batchCost) && batchQuantity > 0) {
          return s + (i.threshold / batchQuantity) * batchCost;
        }
        return s + i.threshold * i.costPrice;
      }, 0),
    };
  }, [inventoryItems]);

  const recentTotalPages = Math.ceil(recentActivities.length / recentActivitiesPerPage);

  useEffect(() => {
    if (recentPage > recentTotalPages) {
      setRecentPage(recentTotalPages || 1);
    }
  }, [recentPage, recentTotalPages]);

  const paginatedRecentActivities = useMemo(() => {
    const startIndex = (recentPage - 1) * recentActivitiesPerPage;
    return recentActivities.slice(startIndex, startIndex + recentActivitiesPerPage);
  }, [recentActivities, recentPage]);

  const selectedActiveCount = useMemo(() => {
    if (selectedItems.size === 0) return 0;
    return inventoryItems.filter((item) => selectedItems.has(item.id) && !item.isArchived).length;
  }, [selectedItems, inventoryItems]);

  const statCards = useMemo(
    () => [
      { icon: Package, label: 'Total Items', value: stats?.total?.toString() ?? '0', sub: 'Active inventory items', accent: '#3D261D', iconBg: 'bg-[#EDE4DC]', iconColor: '#3D261D' },
      { icon: Clock3, label: 'Expired Items', value: stats?.expiredCount?.toString() ?? '0', sub: 'Need disposal or deduction', accent: '#E11D48', iconBg: 'bg-rose-100', iconColor: '#E11D48' },
      { icon: AlertTriangle, label: 'Low Stock', value: stats?.lowCount?.toString() ?? '0', sub: 'Need attention', accent: '#B45309', iconBg: 'bg-amber-100', iconColor: '#B45309' },
      { icon: TrendingDown, label: 'Out of Stock', value: stats?.outCount?.toString() ?? '0', sub: 'Need replenishment', accent: '#DC2626', iconBg: 'bg-red-100', iconColor: '#DC2626' },
      { icon: Archive, label: 'Archived', value: stats?.archivedCount?.toString() ?? '0', sub: 'Hidden from active inventory', accent: '#6B7280', iconBg: 'bg-slate-100', iconColor: '#475569' },
      { icon: DollarSign, label: 'Total Value', value: stats ? `${PESO_SYMBOL}${Number(stats.value || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}` : `${PESO_SYMBOL}0.00`, sub: 'Current inventory value', accent: '#059669', iconBg: 'bg-emerald-100', iconColor: '#059669' },
    ],
    [stats]
  );

  const applyPageFilter = useCallback((nextFilter = null, nextStatus = 'Active') => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextFilter) {
      nextParams.set('filter', nextFilter);
    } else {
      nextParams.delete('filter');
    }

    if (nextStatus) {
      nextParams.set('status', nextStatus);
    } else {
      nextParams.delete('status');
    }

    setSearchParams(nextParams);
    setStatusFilter(nextStatus || 'All');
  }, [searchParams, setSearchParams]);

  const handlePrimaryTabChange = useCallback((nextTab) => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextTab === 'history') {
      nextParams.set('tab', 'history');
      nextParams.delete('status');
      nextParams.delete('filter');
    } else if (nextTab === 'archived') {
      nextParams.set('tab', 'archived');
      nextParams.set('status', 'Archived');
      nextParams.delete('filter');
    } else {
      nextParams.delete('tab');
      nextParams.set('status', 'Active');
    }

    setActiveTab(nextTab);
    setCurrentPage(1);
    setSelectedItems(new Set());
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  const handleStockStatusFilterChange = useCallback((value) => {
    const nextFilter = value === 'all' ? null : value;
    applyPageFilter(nextFilter, nextFilter ? 'Active' : statusFilter);
  }, [applyPageFilter, statusFilter]);

  const handleReviewAttention = useCallback(() => {
    if (stats.expiredCount > 0) {
      applyPageFilter('expired', 'Active');
      return;
    }

    if (stats.outCount > 0) {
      applyPageFilter('out-of-stock', 'Active');
      return;
    }

    if (stats.lowCount > 0) {
      applyPageFilter('low-stock', 'Active');
      return;
    }

    applyPageFilter(null, 'All');
  }, [applyPageFilter, stats.expiredCount, stats.lowCount, stats.outCount]);

  const loadInventoryItems = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) {
      setIsLoadingItems(true);
    }

    const session = getAuthSession();
    if (!session?.token) {
      if (showLoading) {
        toast.error('No active session. Please login again.');
        setIsLoadingItems(false);
      }
      return;
    }

    try {
      const result = await getInventory(session.token, { limit: 100, status: 'all' });
      setInventoryItems((result.data || []).map(mapItemToUi));
    } catch (error) {
      if (showLoading) {
        toast.error(error?.message || 'Cannot connect to backend. Please check server connection.');
      } else {
        console.error('Failed to refresh inventory:', error);
      }
    } finally {
      if (showLoading) {
        setIsLoadingItems(false);
      }
    }
  }, []);

  const filteredStockHistoryEntries = useMemo(() => {
    const term = historySearchTerm.trim().toLowerCase();

    return stockHistoryEntries.filter((entry) => {
      const matchesDirection =
        historyMovementFilter === 'All' || entry.direction === historyMovementFilter;

      if (!matchesDirection) return false;
      if (!term) return true;

      const searchableText = [
        entry.itemName,
        entry.itemSku,
        entry.itemId,
        entry.reason,
        entry.performedBy,
        entry.direction === 'IN'
          ? 'restock'
          : entry.direction === 'OUT'
            ? 'consumption'
            : 'expired expiration alert',
        entry.consumedBatches
          .map((batch) =>
            [
              batch.id,
              batch.expirationDate,
              batch.receivedAt,
              batch.quantity,
              batch.previousQuantity,
              batch.remainingQuantity,
            ]
              .filter(Boolean)
              .join(' ')
          )
          .join(' '),
        entry.addedBatch
          ? [entry.addedBatch.expirationDate, entry.addedBatch.receivedAt, entry.addedBatch.quantity]
              .filter(Boolean)
              .join(' ')
          : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(term);
    });
  }, [stockHistoryEntries, historySearchTerm, historyMovementFilter]);

  const loadStockHistory = async ({ cursor = null, append = false } = {}) => {
    const session = getAuthSession();
    if (!session?.token) {
      setHistoryError('Session expired. Please login again.');
      if (!append) setStockHistoryEntries([]);
      return;
    }

    if (append) {
      setIsLoadingMoreHistory(true);
    } else {
      setIsLoadingHistory(true);
      setHistoryError('');
    }

    try {
      const [logsResult, notificationsResult] = await Promise.allSettled([
        getInventoryLogs(session.token, {
          action: 'STOCK_ADJUST',
          limit: STOCK_HISTORY_PAGE_SIZE,
          days: historyRange,
          ...(cursor ? { cursor } : {}),
        }),
        append ? Promise.resolve(null) : getNotifications(session.token, { limit: 100 }),
      ]);

      const logs =
        logsResult.status === 'fulfilled' && Array.isArray(logsResult.value?.data)
          ? logsResult.value.data
          : [];
      const logEntries = logs.map(transformLogToHistoryEntry).filter(Boolean);

      const expiredEntries =
        !append &&
        notificationsResult.status === 'fulfilled' &&
        Array.isArray(notificationsResult.value?.data)
          ? notificationsResult.value.data
              .filter((notification) => (notification?.type || '').toString().toLowerCase() === 'expired')
              .filter((notification) =>
                isWithinHistoryRange(
                  notification.updatedAt ||
                    notification.createdAt ||
                    notification.timestamp ||
                    notification.readAt,
                  historyRange
                )
              )
              .map(transformExpiredNotificationToHistoryEntry)
              .filter(Boolean)
          : [];

      const nextEntries = [...logEntries, ...expiredEntries];

      setStockHistoryEntries((prev) =>
        append ? mergeStockHistoryEntries(prev, nextEntries) : mergeStockHistoryEntries([], nextEntries)
      );
      setHistoryCursor(
        logsResult.status === 'fulfilled'
          ? logsResult.value?.nextCursor || null
          : null
      );
    } catch (error) {
      setHistoryError(extractApiErrorMessage(error, 'Failed to load stock movement history.'));
      if (!append) {
        setStockHistoryEntries([]);
        setHistoryCursor(null);
      }
    } finally {
      if (append) {
        setIsLoadingMoreHistory(false);
      } else {
        setIsLoadingHistory(false);
      }
    }
  };

  useEffect(() => {
    loadInventoryItems({ showLoading: true });

    const interval = setInterval(() => {
      loadInventoryItems();
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadInventoryItems]);

  useEffect(() => {
    return subscribeToInventoryRefresh(() => {
      loadInventoryItems();
    });
  }, [loadInventoryItems]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      setStatusFilter('Active');
      return;
    }

    if (activeTab === 'archived') {
      setStatusFilter('Archived');
      setSelectedItems(new Set());
    }
  }, [activeTab]);

  // Handle URL parameters for filtering/sorting from dashboard navigation
  useEffect(() => {
    const tab = searchParams.get('tab');
    const status = searchParams.get('status');
    const filter = searchParams.get('filter');
    const sort = searchParams.get('sort');

    if (tab === 'history') {
      setActiveTab('history');
    } else if (tab === 'archived' || String(status || '').toLowerCase() === 'archived') {
      setActiveTab('archived');
    } else {
      setActiveTab('inventory');
    }

    if (filter) {
      switch (filter) {
        case 'low-stock':
        case 'out-of-stock':
        case 'expired':
          if (tab !== 'history') {
            setActiveTab('inventory');
          }
          break;
      }
    }

    if (sort) {
      switch (sort) {
        case 'value-desc':
          setSortBy('value');
          setSortOrder('desc');
          break;
        case 'name-asc':
          setSortBy('name');
          setSortOrder('asc');
          break;
        case 'name-desc':
          setSortBy('name');
          setSortOrder('desc');
          break;
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const loadRecentActivities = async () => {
      const stored = loadStoredActivities();
      if (stored.length > 0) {
        setRecentActivities(stored);
      }

      const session = getAuthSession();
      if (!session?.token) return;
      try {
        const result = await getInventoryLogs(session.token, { limit: 10, days: 30 });
        const logs = Array.isArray(result?.data) ? result.data : [];
        const activities = logs
          .map(transformLogToActivity)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10);
        if (activities.length > 0) {
          setRecentActivities(activities);
          saveRecentActivities(activities);
        }
      } catch {
        // keep local storage activity if backend load fails
      }
    };
    loadRecentActivities();
  }, []);

  useEffect(() => {
    if (searchParams.get('tab') === 'history') {
      setActiveTab('history');
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    loadStockHistory();
  }, [activeTab, historyRange]);

  useWebSocket({
    enabled: Boolean(getAuthSession()?.token),
    onInventoryEvent: (event) => {
      setInventoryItems((prev) => applyRealtimeUiInventoryEvent(prev, event));
      appendRecentActivity(createRealtimeActivity(event));

      const realtimeHistoryEntry = createRealtimeHistoryEntry(event);
      if (realtimeHistoryEntry) {
        setStockHistoryEntries((prev) => mergeStockHistoryEntries(prev, [realtimeHistoryEntry]));
      }
    },
    onNotificationEvent: (event) => {
      if (event.type === 'upsert') {
        const expiredEntry = transformExpiredNotificationToHistoryEntry(event.data);
        if (expiredEntry) {
          setStockHistoryEntries((prev) => mergeStockHistoryEntries(prev, [expiredEntry]));
        }
        return;
      }

      if (event.type === 'resolved' && event.data?.id) {
        setStockHistoryEntries((prev) => prev.filter((entry) => entry.id !== event.data.id));
      }
    },
  });

  const buildStockDetails = ({ itemName, category, unit, initialStock, minimumStock, totalBatchCost, batchQuantity, costPerUnit, expirationDate }) => {
    const displayCostPerUnit = costPerUnit ?? (batchQuantity && totalBatchCost ? Number(totalBatchCost) / Number(batchQuantity) : 0);
    const details = [
      { label: 'Item', value: itemName },
      { label: 'Category', value: category },
      { label: 'Stock', value: `${formatInventoryQuantity(initialStock)} ${unit}`.trim() },
      { label: 'Minimum', value: `${formatInventoryQuantity(minimumStock)} ${unit}`.trim() },
      { label: 'Cost', value: `PHP ${Number(displayCostPerUnit || 0).toFixed(2)} / ${unit}` },
    ];

    if (expirationDate) {
      details.push({ label: 'Expiration', value: expirationDate });
    }

    return details;
  };

  const buildAdjustedItem = (item, nextQuantity, overrides = {}) => {
    return mapItemToUi({
      id: item.id,
      name: item.name,
      sku: item.sku || '',
      category: categoryToBackend[item.cat] || 'other',
      quantity: nextQuantity,
      unit: item.unit || 'pcs',
      lowStockThreshold: item.threshold,
      costPrice: item.costPrice,
      totalBatchCost: overrides.totalBatchCost ?? item.totalBatchCost ?? 0,
      batchQuantity: item.batchQuantity ?? 0,
      status: item.recordStatus || (item.isArchived ? 'deleted' : 'active'),
      expirationDate: overrides.expirationDate ?? item.expirationDate ?? null,
      stockBatches: overrides.stockBatches ?? item.stockBatches ?? [],
      createdAt: item.dateAdded,
      updatedAt: new Date().toISOString(),
    });
  };

  const closeStockAdjustModal = () => {
    if (isSubmittingStockAdjust) return;
    setStockAdjustDraft(null);
    setStockAdjustQuantity('1');
    setStockAdjustExpirationDate('');
    setStockAdjustBatchCost('');
    setStockDeductionMode('manual');
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setDrawerMode('add');
    setFormError('');
    setConfirmationAction(null);
    setNewItem({ itemName: '', sku: '', category: 'Beans', unit: 'pcs', totalBatchCost: '', batchQuantity: '', minimumStock: '', initialStock: '', expirationDate: '' });
    clearDuplicatePrompt();
  };

  const handleAddClick = () => {
    setDrawerMode('add');
      setNewItem({ itemName: '', sku: '', category: 'Beans', unit: 'pcs', totalBatchCost: '', batchQuantity: '', minimumStock: '', initialStock: '', expirationDate: '' });
    setFormError('');
    setIsDrawerOpen(true);
  };

  const handleUpdateClick = (item) => {
    // Find the current batch cost - use the most recent batch with a cost
    let currentBatchCost = '';
    if (item.stockBatches && item.stockBatches.length > 0) {
      // Sort batches by receivedAt descending (most recent first)
      const sortedBatches = [...item.stockBatches].sort((a, b) => 
        new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0)
      );
      // Find the first batch that has a cost
      const batchWithCost = sortedBatches.find(batch => batch.cost !== undefined && batch.cost !== null);
      if (batchWithCost) {
        currentBatchCost = batchWithCost.cost.toString();
      }
    }

    setDrawerMode('edit');
    setNewItem({
      id: item.id,
      sku: item.sku,
      itemName: item.name,
      category: item.cat,
      unit: item.unit || item.stock.split(' ')[1] || 'pcs',
      totalBatchCost: currentBatchCost || (item.totalBatchCost ? item.totalBatchCost.toString() : ''),
      batchQuantity: item.batchQuantity ? item.batchQuantity.toString() : '',
      minimumStock: item.threshold.toString(),
      expirationDate: item.expirationDate || '',
    });
    setFormError('');
    setIsDrawerOpen(true);
  };

  const handleDeleteClick = (item) => {
    setConfirmationAction({
      type: 'archive-single',
      title: 'Archive Item?',
      message: `Are you sure you want to archive ${item.name}? This stock will be hidden from active inventory.`,
      confirmLabel: 'Archive Item',
      tone: 'warning',
      icon: Archive,
      details: [
        { label: 'Item', value: item.name },
        { label: 'Category', value: item.cat },
        { label: 'Current Stock', value: item.stock },
      ],
      payload: { item },
    });
  };

  const handleRestoreClick = (item) => {
    setConfirmationAction({
      type: 'restore-single',
      title: 'Restore Item?',
      message: `Restore ${item.name} to active inventory? This item will appear again in the main inventory list.`,
      confirmLabel: 'Restore Item',
      tone: 'primary',
      icon: RotateCcw,
      details: [
        { label: 'Item', value: item.name },
        { label: 'Category', value: item.cat },
        { label: 'Current Stock', value: item.stock },
      ],
      payload: { item },
    });
  };

  const archiveItem = async (token, item) => {
    await deleteInventoryItem(token, item.id);
    const today = new Date().toISOString().slice(0, 10);
    setInventoryItems((prev) =>
      prev.map((inventoryItem) =>
        inventoryItem.id === item.id
          ? { ...inventoryItem, isArchived: true, recordStatus: 'deleted', status: 'Archived', lastActivity: today, date: today }
          : inventoryItem
      )
    );
    setSelectedItems((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    addActivity('deleted', item.name);
    broadcastInventoryRefresh({ source: 'archive-item', itemId: item.id });
    toast.success('Item archived successfully');
  };

  const restoreItem = async (token, item) => {
    const result = await restoreInventoryItem(token, item.id);
    const restoredItem = result?.data ? mapItemToUi(result.data) : { ...item, isArchived: false, recordStatus: 'active', status: 'Healthy' };

    setInventoryItems((prev) =>
      prev.map((inventoryItem) => (inventoryItem.id === item.id ? restoredItem : inventoryItem))
    );
    setCurrentPage(1);
    addActivity('updated', item.name, { reason: 'Item restored from archive' });
    broadcastInventoryRefresh({ source: 'restore-item', itemId: item.id });
    toast.success('Item restored successfully');
  };

  const handleBulkDelete = () => {
    if (selectedActiveCount === 0) return;
    const itemsToArchive = inventoryItems.filter((item) => selectedItems.has(item.id) && !item.isArchived);
    if (itemsToArchive.length === 0) return;

    const previewNames = itemsToArchive.slice(0, 3).map((item) => item.name).join(', ');
    const remainingCount = itemsToArchive.length - Math.min(itemsToArchive.length, 3);

    setConfirmationAction({
      type: 'archive-bulk',
      title: `Archive ${itemsToArchive.length} Item${itemsToArchive.length > 1 ? 's' : ''}?`,
      message: `These selected stock items will be hidden from active inventory.${remainingCount > 0 ? ` ${remainingCount} more item(s) are included.` : ''}`,
      confirmLabel: itemsToArchive.length > 1 ? 'Archive Items' : 'Archive Item',
      tone: 'warning',
      icon: Archive,
      details: [
        { label: 'Selected Items', value: String(itemsToArchive.length) },
        { label: 'Preview', value: remainingCount > 0 ? `${previewNames} +${remainingCount} more` : previewNames },
      ],
      payload: { itemIds: itemsToArchive.map((item) => item.id) },
    });
  };

  const archiveItems = async (token, itemIds) => {
    const itemsToArchive = inventoryItems.filter((item) => itemIds.includes(item.id));
    await Promise.all(itemIds.map((id) => deleteInventoryItem(token, id)));
    const today = new Date().toISOString().slice(0, 10);
    setInventoryItems((prev) =>
      prev.map((item) =>
        itemIds.includes(item.id)
          ? { ...item, isArchived: true, recordStatus: 'deleted', status: 'Archived', lastActivity: today, date: today }
          : item
      )
    );
    setSelectedItems(new Set());
    setCurrentPage(1);
    itemsToArchive.forEach((item) => addActivity('deleted', item.name));
    broadcastInventoryRefresh({ source: 'archive-items', itemIds });
    toast.success(`${itemIds.length} item(s) archived successfully`);
  };

  function clearDuplicatePrompt() {
    setShowDuplicateModal(false);
    setDuplicateMatchItem(null);
    setPendingCreateInput(null);
  }

  const submitCreateItem = async ({ token, itemName, category, unit, initialStock, minimumStock, totalBatchCost, batchQuantity, expirationDate }) => {
    const result = await createInventoryItem(token, {
      name: itemName,
      category: categoryToBackend[category] || 'other',
      unit,
      quantity: initialStock,
      lowStockThreshold: minimumStock,
      totalBatchCost: totalBatchCost,
      batchQuantity: batchQuantity,
      supplier: '',
      expirationDate: expirationDate || null,
    }); 

    if (result?.data) {
      const nextItem = mapItemToUi(result.data);
      setInventoryItems((prev) => upsertInventoryUiItem(prev, nextItem, { prependIfNew: true }));
      addActivity('created', itemName);
    }
    broadcastInventoryRefresh({ source: 'create-item', itemName });
    toast.success('Item created successfully');
    closeDrawer();
  };

  const handleQuickStockAdjust = (item, direction) => {
    if (direction < 0 && item.quantity <= 0) {
      toast.error(`${item.name} is already out of stock.`);
      return;
    }

    // Find the current batch cost - use the most recent batch with a cost
    let currentBatchCost = '';
    if (item.stockBatches && item.stockBatches.length > 0) {
      // Sort batches by receivedAt descending (most recent first)
      const sortedBatches = [...item.stockBatches].sort((a, b) => 
        new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0)
      );
      // Find the first batch that has a cost
      const batchWithCost = sortedBatches.find(batch => batch.cost !== undefined && batch.cost !== null);
      if (batchWithCost) {
        currentBatchCost = batchWithCost.cost.toString();
      }
    }

    setStockAdjustDraft({
      item,
      direction,
      mode: direction > 0 ? 'increase' : 'decrease',
    });
    setStockAdjustQuantity('1');
    setStockAdjustExpirationDate('');
    setStockAdjustBatchCost(currentBatchCost);
    setStockDeductionMode('manual');
  };

  const submitQuickStockAdjust = async () => {
    if (!stockAdjustDraft?.item) return;

    const session = getAuthSession();
    if (!session?.token) {
      toast.error('Session expired. Please login again.');
      return;
    }

    const { item, direction } = stockAdjustDraft;
    const isAutoExpiredDeduct = direction < 0 && stockDeductionMode === 'expired';
    const quantitySource = isAutoExpiredDeduct ? item.expiredQuantity : stockAdjustQuantity;
    const quantity = normalizeInventoryQuantity(quantitySource);
    if (isAutoExpiredDeduct && Number(item.expiredQuantity || 0) <= 0) {
      toast.error(`No expired stock to deduct from ${item.name}.`);
      return;
    }
    if (!quantitySource || Number.isNaN(quantity)) {
      toast.error('Please enter a valid quantity.');
      return;
    }
    if (quantity <= 0) {
      toast.error('Quantity must be greater than zero.');
      return;
    }
    if (!unitSupportsFractionalQuantity(item.unit) && !isWholeInventoryQuantity(quantity)) {
      toast.error('Pieces must use whole numbers only.');
      return;
    }
    if (direction < 0 && quantity > item.quantity) {
      toast.error(`You can only remove up to ${formatInventoryQuantity(item.quantity)} ${item.unit || 'unit'} from ${item.name}.`);
      return;
    }

    const signedAdjustment = direction * quantity;

    const reason =
      signedAdjustment > 0
        ? `Quick stock increase from inventory list (${formatInventoryQuantity(quantity)} ${item.unit || 'unit'})`
        : isAutoExpiredDeduct
          ? `Auto deducted expired stock from inventory list (${formatInventoryQuantity(quantity)} ${item.unit || 'unit'})`
        : `Quick stock decrease from inventory list (${formatInventoryQuantity(quantity)} ${item.unit || 'unit'})`;

    try {
      setIsSubmittingStockAdjust(true);

      const result = await adjustInventoryStock(session.token, item.id, {
        adjustment: signedAdjustment,
        reason,
        ...(signedAdjustment > 0 ? {
          expirationDate: stockAdjustExpirationDate || null,
          batchCost: stockAdjustBatchCost ? parseFloat(stockAdjustBatchCost) : null
        } : {}),
      });
      const nextQuantity = Number(result?.data?.newQuantity ?? item.quantity + signedAdjustment);

      setInventoryItems((prev) =>
        prev.map((currentItem) =>
          currentItem.id === item.id
            ? buildAdjustedItem(currentItem, nextQuantity, {
                expirationDate: result?.data?.expirationDate ?? currentItem.expirationDate ?? null,
                stockBatches: result?.data?.stockBatches ?? currentItem.stockBatches ?? [],
                totalBatchCost: result?.data?.totalBatchCost ?? currentItem.totalBatchCost ?? 0,
              })
            : currentItem
        )
      );

      addActivity('adjusted', item.name, {
        adjustment: signedAdjustment,
        reason,
        unit: item.unit || '',
        quantity: nextQuantity,
        threshold: item.threshold,
        expirationDate: (result?.data?.expirationDate ?? stockAdjustExpirationDate) || null,
      });

      setStockHistoryEntries((prev) =>
        mergeStockHistoryEntries(prev, [
          buildStockHistoryEntry({
            id: `local-stock-adjust-${item.id}-${Date.now()}`,
            itemId: item.id,
            itemSku: item.sku || '',
            itemName: item.name,
            timestamp: new Date(),
            adjustment: signedAdjustment,
            newQuantity: nextQuantity,
            unit: item.unit || '',
            reason,
            expirationDate: (result?.data?.expirationDate ?? stockAdjustExpirationDate) || null,
            addedBatch:
              signedAdjustment > 0
                ? result?.data?.addedBatch || {
                    quantity,
                    expirationDate: stockAdjustExpirationDate || null,
                    receivedAt: new Date().toISOString(),
                  }
                : null,
            consumedBatches: result?.data?.consumedBatches || [],
            performedBy: session.email || '',
            source: 'local',
          }),
        ])
      );

      broadcastInventoryRefresh({
        source: 'quick-adjust',
        itemId: item.id,
        adjustment: signedAdjustment,
      });

      toast.success(
        signedAdjustment > 0
          ? `Added ${formatInventoryQuantity(quantity)} ${item.unit || 'unit'} to ${item.name}`
          : `Removed ${formatInventoryQuantity(quantity)} ${item.unit || 'unit'} from ${item.name}`
      );
      setStockAdjustDraft(null);
      setStockAdjustQuantity('1');
      setStockAdjustExpirationDate('');
      setStockAdjustBatchCost('');
      setStockDeductionMode('manual');
    } catch (error) {
      toast.error(extractApiErrorMessage(error, 'Failed to adjust stock.'));
    } finally {
      setIsSubmittingStockAdjust(false);
    }
  };

  const handleDuplicateAddItem = () => {
    if (!pendingCreateInput) return clearDuplicatePrompt();

    const createInput = pendingCreateInput;
    clearDuplicatePrompt();
    setConfirmationAction({
      type: 'create',
      title: 'Add this stock item?',
      message: `A similar active item already exists, but you can still add ${createInput.itemName} as a separate stock item if that is intentional.`,
      confirmLabel: 'Add Item',
      tone: 'primary',
      icon: PlusCircle,
      details: buildStockDetails(createInput),
      payload: createInput,
    });
  };

  const handleDuplicateUseExisting = () => {
    const existing = duplicateMatchItem;
    clearDuplicatePrompt();
    if (!existing) return;
    handleUpdateClick(existing);
    toast.info(`Loaded existing item "${existing.name}" for update.`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const session = getAuthSession();
    if (!session?.token) {
      setFormError('Session expired. Please login again.');
      return;
    }

    const itemName = newItem.itemName.trim();
    const unit = newItem.unit;
    const totalBatchCost = parseFloat(newItem.totalBatchCost);
    const rawBatchQuantity = parseFloat(newItem.batchQuantity);
    const minimumStock = normalizeInventoryQuantity(newItem.minimumStock);
    const initialStock = normalizeInventoryQuantity(newItem.initialStock);
    const batchQuantity = drawerMode === 'add'
      ? initialStock
      : Number.isFinite(rawBatchQuantity) && rawBatchQuantity > 0
        ? rawBatchQuantity
        : undefined;
    const costPerUnit = (totalBatchCost && batchQuantity) ? totalBatchCost / batchQuantity : 0;

    console.log('[DEBUG] Form Submission - itemName:', { raw: newItem.itemName, trimmed: itemName, newItem });

    if (!itemName) {
      toast.error('Item name is required.');
      return;
    }
    if (itemName.length < 2) {
      toast.error('Item name must be at least 2 characters.');
      return;
    }
    if (itemName.length > 100) {
      toast.error('Item name cannot exceed 100 characters.');
      return;
    }
    if (!newItem.totalBatchCost || isNaN(totalBatchCost)) {
      toast.error('Current batch cost is required and must be a valid number.');
      return;
    }
    if (totalBatchCost < 0) {
      toast.error('Current batch cost cannot be negative.');
      return;
    }
    if (totalBatchCost > 9999999) {
      toast.error('Current batch cost is too high.');
      return;
    }
    if (!newItem.minimumStock || Number.isNaN(minimumStock)) {
      toast.error('Minimum stock is required and must be a valid number.');
      return;
    }
    if (minimumStock < 0) {
      toast.error('Minimum stock cannot be negative.');
      return;
    }
    if (!unitSupportsFractionalQuantity(unit) && !isWholeInventoryQuantity(minimumStock)) {
      toast.error('Minimum stock must be a whole number when unit is pcs.');
      return;
    }
    if (!newItem.category) {
      toast.error('Please select a category.');
      return;
    }
    if (!unit) {
      toast.error('Please select a unit.');
      return;
    }
    if (drawerMode === 'add') {
      if ((newItem.initialStock === '' || newItem.initialStock === undefined) || Number.isNaN(initialStock)) {
        toast.error('Stock level is required and must be a valid number.');
        return;
      }
      if (initialStock < 0) {
        toast.error('Stock level cannot be negative.');
        return;
      }
      if (!unitSupportsFractionalQuantity(unit) && !isWholeInventoryQuantity(initialStock)) {
        toast.error('Stock level must be a whole number when unit is pcs.');
        return;
      }
    }
    // Removed current stock validation for edit mode

    if (drawerMode === 'add') {
      const normalizedNewName = normalizeNameForComparison(itemName);
      const duplicateItem = inventoryItems.find(
        (item) => !item.isArchived && normalizeNameForComparison(item.name) === normalizedNewName
      );

      if (duplicateItem) {
        setDuplicateMatchItem(duplicateItem);
        setPendingCreateInput({
          itemName,
          category: newItem.category,
          unit,
          initialStock,
          minimumStock,
          totalBatchCost,
          batchQuantity,
          costPerUnit,
          expirationDate: newItem.expirationDate,
        });
        setShowDuplicateModal(true);
        return;
      }

      setConfirmationAction({
        type: 'create',
        title: 'Add this stock item?',
        message: `Are you sure you want to add ${itemName} to inventory?`,
        confirmLabel: 'Add Item',
        tone: 'primary',
        icon: PlusCircle,
        details: buildStockDetails({
          itemName,
          category: newItem.category,
          unit,
          initialStock,
          minimumStock,
          costPerUnit,
          expirationDate: newItem.expirationDate,
        }),
        payload: {
          itemName,
          category: newItem.category,
          unit,
          initialStock,
          minimumStock,
          totalBatchCost,
          batchQuantity,
          expirationDate: newItem.expirationDate,
        },
      });
      return;
    }

    setConfirmationAction({
      type: 'update',
      title: 'Save stock changes?',
      message: `Apply these updates to ${itemName}? The current stock details will be replaced with the values below.`,
      confirmLabel: 'Save Changes',
      tone: 'primary',
      icon: Edit2,
      details: buildStockDetails({
        itemName,
        category: newItem.category,
        unit,
        initialStock,
        minimumStock,
        costPerUnit,
      }),
      payload: {
        id: newItem.id,
        name: itemName,
        category: newItem.category,
        unit,
        lowStockThreshold: minimumStock,
        totalBatchCost,
        batchQuantity,
      },
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmationAction) return;

    const action = confirmationAction;
    const session = getAuthSession();
    if (!session?.token) {
      toast.error('Session expired. Please login again.');
      return;
    }

    setIsConfirmingAction(true);
    try {
      if (action.type === 'create') {
        await submitCreateItem({
          token: session.token,
          ...action.payload,
        });
        setConfirmationAction(null);
        return;
      }

      if (action.type === 'update') {
        const result = await updateInventoryItem(session.token, action.payload.id, {
          name: action.payload.itemName,
          category: categoryToBackend[action.payload.category] || 'other',
          unit: action.payload.unit,
          lowStockThreshold: action.payload.minimumStock,
          totalBatchCost: action.payload.totalBatchCost,
          batchQuantity: action.payload.batchQuantity,
          costPrice: action.payload.costPerUnit,
        });

        if (result?.data) {
          setInventoryItems((prev) =>
            prev.map((item) => (item.id === action.payload.id ? mapItemToUi(result.data) : item))
          );
          addActivity('updated', action.payload.itemName);
        }
        broadcastInventoryRefresh({
          source: 'update-item',
          itemId: action.payload.id,
        });
        toast.success('Item updated successfully');
        setConfirmationAction(null);
        closeDrawer();
        return;
      }

      if (action.type === 'archive-single') {
        await archiveItem(session.token, action.payload.item);
        setConfirmationAction(null);
        return;
      }

      if (action.type === 'restore-single') {
        await restoreItem(session.token, action.payload.item);
        setConfirmationAction(null);
        return;
      }

      if (action.type === 'archive-bulk') {
        await archiveItems(session.token, action.payload.itemIds);
        setConfirmationAction(null);
      }
    } catch (error) {
      if (error?.status === 409) {
        toast.error(error?.message || 'An item with this SKU already exists.');
      } else {
        toast.error(extractApiErrorMessage(error, 'Cannot connect to backend. Please check server connection.'));
      }
    } finally {
      setIsConfirmingAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4F0] w-full px-4 sm:px-6 lg:px-10 py-6 lg:py-9">
      <InventoryHeader onAddClick={handleAddClick} btnBrown={btnBrown} onExportCSV={() => exportToCSV(filteredItems)} />

      <div className="mb-5 sm:mb-6 border-b border-[#E8E1D9]">
        <div className="flex items-end gap-5 sm:gap-6">
          {[
            {
              id: 'inventory',
              label: 'Inventory',
              icon: Package,
            },
            {
              id: 'archived',
              label: 'Archived',
              icon: Archive,
            },
            {
              id: 'history',
              label: 'History',
              icon: ScrollText,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handlePrimaryTabChange(tab.id)}
                className={`relative inline-flex items-center gap-1.5 pb-2 text-[11px] sm:text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'text-[#3D261D]'
                    : 'text-[#A89080] hover:text-[#6B5744]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                <span
                  className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-opacity ${
                    isActive ? 'bg-[#3D261D] opacity-100' : 'bg-transparent opacity-0'
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>

      {activeTab !== 'history' ? (
        <>
      {activeTab === 'inventory' && (
        <>
          <StatCards stats={stats} cards={statCards} />

          <InventoryAlertBanner
            lowCount={stats.lowCount}
            outCount={stats.outCount}
            expiredCount={stats.expiredCount}
            onReview={handleReviewAttention}
          />
        </>
      )}

      {/* Main table card */}
      <div className="bg-white rounded-2xl border border-[#EAE5E0] overflow-hidden shadow-sm">

        {/* Toolbar */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#F0EDE8] bg-[#FDFCFB]">
          {/* Top row: search + buttons */}
          <div className="flex items-center gap-2 justify-between">
            <div className="relative flex-1 max-w-xs sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C4B8B0]" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 border border-[#E2DDD8] rounded-xl text-sm text-[#2C1810] bg-white transition focus:outline-none focus:border-[#6B3E26] focus:ring-2 focus:ring-[#6B3E26]/10 placeholder:text-[#C4B8B0]"
              />
            </div>
            <div className="flex items-center gap-2">
              {/* Bulk delete button shown when items are selected */}
              {activeTab === 'inventory' && selectedActiveCount > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-2 border border-amber-200 rounded-xl bg-amber-50 text-amber-600 text-sm font-medium hover:bg-amber-100 transition-all"
                >
                  <span>Archive {selectedActiveCount}</span>
                </button>
              )}
              {/* Filter toggle shown on mobile, hidden on md+ */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 border border-[#E2DDD8] rounded-xl bg-white text-[#6B5744] text-sm font-medium hover:bg-[#FAF6F2] hover:border-[#A07850] transition-all md:hidden"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>
              {/* Category selector always visible on md+ */}
              <div className="hidden md:flex items-center gap-3">
                <span className="text-xs text-[#9E8A7A] font-medium whitespace-nowrap">Category:</span>
                <div className="w-40">
                  <Dropdown
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={['All','Beans','Milk','Syrup','Cups','Pastries','Equipment','Add-ins','Powder','Other']}
                    placeholder="Select category"
                    className="text-sm font-semibold text-[#3D261D]"
                  />
                </div>
                <span className="text-xs text-[#9E8A7A] font-medium whitespace-nowrap">Sort by:</span>
                <div className="w-44">
                  <Dropdown
                    value={sortBy}
                    onChange={setSortBy}
                    options={[
                      { value: 'name', label: 'Name A-Z' },
                      { value: 'dateAdded', label: 'Date Added' },
                      { value: 'category', label: 'Category' },
                      { value: 'quantity', label: 'Quantity' },
                      { value: 'value', label: 'Value' }
                    ]}
                    placeholder="Sort by"
                    className="text-sm font-semibold text-[#3D261D]"
                  />
                </div>
                {activeTab === 'inventory' && (
                  <>
                    <span className="text-xs text-[#9E8A7A] font-medium whitespace-nowrap">Stock status:</span>
                    <div className="w-44">
                      <Dropdown
                        value={selectedStockStatusFilter}
                        onChange={handleStockStatusFilterChange}
                        options={[
                          { value: 'all', label: 'All statuses' },
                          { value: 'expired', label: 'Expired batch items' },
                          { value: 'out-of-stock', label: 'Out of stock' },
                          { value: 'low-stock', label: 'Low stock' }
                        ]}
                        placeholder="Stock status"
                        className="text-sm font-semibold text-[#3D261D]"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Expandable filter row for mobile only */}
          {showFilters && (
            <div className="mt-3 flex flex-col gap-2 md:hidden">
              <span className="text-xs text-[#9E8A7A] font-medium">Category:</span>
              <Dropdown
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={['All','Beans','Milk','Syrup','Cups','Pastries','Equipment','Add-ins','Powder','Other']}
                placeholder="Select category"
              />
              <span className="text-xs text-[#9E8A7A] font-medium mt-1">Sort by:</span>
              <Dropdown
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: 'name', label: 'Name A-Z' },
                  { value: 'dateAdded', label: 'Date Added' },
                  { value: 'category', label: 'Category' },
                  { value: 'quantity', label: 'Quantity' },
                  { value: 'value', label: 'Value' }
                ]}
                placeholder="Sort by"
              />
              {activeTab === 'inventory' && (
                <>
                  <span className="text-xs text-[#9E8A7A] font-medium mt-1">Stock status:</span>
                  <Dropdown
                    value={selectedStockStatusFilter}
                    onChange={handleStockStatusFilterChange}
                    options={[
                      { value: 'all', label: 'All statuses' },
                      { value: 'expired', label: 'Expired batch items' },
                      { value: 'out-of-stock', label: 'Out of stock' },
                      { value: 'low-stock', label: 'Low stock' }
                    ]}
                    placeholder="Stock status"
                  />
                </>
              )}
            </div>
          )}
        </div>

        <InventoryTable
          isLoading={isLoadingItems}
          items={paginatedItems}
          onUpdate={handleUpdateClick}
          onDelete={handleDeleteClick}
          onRestore={handleRestoreClick}
          onQuickAdjust={activeTab === 'inventory' ? handleQuickStockAdjust : undefined}
          selectedItems={selectedItems}
          onSelectedChange={setSelectedItems}
        />

        {/* Mobile card list (< md) */}
        <InventoryMobileList
          isLoading={isLoadingItems}
          items={paginatedItems}
          onUpdate={handleUpdateClick}
          onDelete={handleDeleteClick}
          onRestore={handleRestoreClick}
          onQuickAdjust={activeTab === 'inventory' ? handleQuickStockAdjust : undefined}
        />

        {/* Pagination */}
        <div className="flex justify-between items-center px-4 sm:px-5 py-3.5 border-t border-[#F0EDE8] bg-[#FDFCFB]">
          <p className="text-xs text-[#A89080]">
            Showing <strong className="text-[#3D261D]">{filteredItems.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)}</strong> of{' '}
            <strong className="text-[#3D261D]">{filteredItems.length}</strong> items
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-[#E2DDD8] rounded-lg text-sm text-[#6B5744] font-medium hover:bg-[#FAF6F2] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <span className="text-xs text-[#9E8A7A] font-medium">
              {filteredItems.length === 0 ? 0 : currentPage}/{totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-[#E2DDD8] rounded-lg text-sm text-[#6B5744] font-medium hover:bg-[#FAF6F2] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Recent activity section */}
      <div className="mt-6 sm:mt-8 bg-white rounded-2xl border border-[#EAE5E0] shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#F0EDE8] bg-[#FDFCFB]">
          <h3 className="text-sm font-bold text-[#1C100A]">Recent Activity</h3>
          <p className="text-xs text-[#9E8A7A] mt-1">Live inventory operations</p>
        </div>
        {recentActivities.length > 0 ? (
          <>
            <div className="divide-y divide-[#F0EDE8]">
              {paginatedRecentActivities.map((activity) => {
              const getActivityIcon = () => {
                switch (activity.type) {
                  case 'created':
                    return <PlusCircle className="w-4 h-4 text-emerald-600" />;
                  case 'updated':
                    return <Edit2 className="w-4 h-4 text-blue-600" />;
                  case 'deleted':
                    return <Trash2 className="w-4 h-4 text-red-600" />;
                  case 'adjusted':
                    return <RefreshCcw className="w-4 h-4 text-amber-600" />;
                  default:
                    return null;
                }
              };

              const getActivityBg = () => {
                switch (activity.type) {
                  case 'created':
                    return 'bg-emerald-50';
                  case 'updated':
                    return 'bg-blue-50';
                  case 'deleted':
                    return 'bg-red-50';
                  case 'adjusted':
                    return 'bg-amber-50';
                  default:
                    return 'bg-gray-50';
                }
              };

              const getActivityLabel = () => {
                switch (activity.type) {
                  case 'created':
                    return 'Item Created';
                  case 'updated':
                    return 'Item Updated';
                  case 'deleted':
                    return 'Item Archived';
                  case 'adjusted':
                    return 'Stock Adjusted';
                  default:
                    return 'Inventory Activity';
                }
              };

              const formatTime = (timestamp) => {
                return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              };

              return (
                <div key={activity.id} className="px-4 sm:px-6 py-3 sm:py-4 flex items-start gap-3 hover:bg-[#FDFCFB] transition">
                  <div className={`${getActivityBg()} p-2 rounded-lg`}>
                    {getActivityIcon()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1C100A]">{getActivityLabel()}</p>
                    <p className="text-xs text-[#9E8A7A] truncate font-medium">{activity.itemName}</p>
                    <p className="text-xs text-[#6B5744] mt-1 truncate">{buildActivityDescription(activity)}</p>
                  </div>
                  <div className="text-xs text-[#C4B8B0] whitespace-nowrap">
                    {formatTime(activity.timestamp)}
                  </div>
                </div>
              );
            })}
          </div>
          {recentTotalPages > 1 && (
            <div className="px-4 sm:px-6 py-3 flex items-center justify-between border-t border-[#F0EDE8] bg-[#FBFAF8]">
              <div className="text-xs text-[#9E8A7A]">Page {recentPage} of {recentTotalPages}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRecentPage((page) => Math.max(1, page - 1))}
                  disabled={recentPage === 1}
                  className="px-3 py-1.5 border border-[#E2DDD8] rounded-lg text-sm text-[#6B5744] font-medium hover:bg-[#FAF6F2] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setRecentPage((page) => Math.min(recentTotalPages, page + 1))}
                  disabled={recentPage === recentTotalPages}
                  className="px-3 py-1.5 border border-[#E2DDD8] rounded-lg text-sm text-[#6B5744] font-medium hover:bg-[#FAF6F2] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
        ) : (
          <div className="px-4 sm:px-6 py-8 sm:py-10 text-center">
            <Coffee className="w-8 h-8 text-[#C4B8B0] mx-auto mb-3 opacity-50" />
            <p className="text-sm text-[#9E8A7A] font-medium">No activity yet</p>
            <p className="text-xs text-[#C4B8B0] mt-1">Inventory operations will appear here</p>
          </div>
        )}
      </div>

      {/* Footer */}
        </>
      ) : (
        <InventoryHistoryPanel
          entries={filteredStockHistoryEntries}
          loadedCount={stockHistoryEntries.length}
          isLoading={isLoadingHistory}
          isLoadingMore={isLoadingMoreHistory}
          error={historyError}
          searchTerm={historySearchTerm}
          onSearchTermChange={setHistorySearchTerm}
          movementFilter={historyMovementFilter}
          onMovementFilterChange={setHistoryMovementFilter}
          rangeFilter={historyRange}
          onRangeFilterChange={setHistoryRange}
          onRefresh={() => loadStockHistory()}
          onLoadMore={() => loadStockHistory({ cursor: historyCursor, append: true })}
          hasMore={Boolean(historyCursor)}
        />
      )}

      <div className="mt-6 sm:mt-8 pt-4 sm:pt-5 border-t border-[#E8E3DD] text-center">
        <p className="text-[11px] text-[#C4B8B0]">
          (C) 2026 Coffee &amp; Tea Inventory Systems - System Status:{' '}
          <span className="text-emerald-600 font-semibold">Optimal</span>
        </p>
      </div>

      <ItemDrawer
        isOpen={isDrawerOpen}
        isEditMode={drawerMode === 'edit'}
        item={newItem}
        setItem={setNewItem}
        formError={formError}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        inputCls={inputCls}
        btnBrown={btnBrown}
      />

      <ActionConfirmModal
        isOpen={Boolean(confirmationAction)}
        title={confirmationAction?.title}
        message={confirmationAction?.message}
        details={confirmationAction?.details}
        confirmLabel={confirmationAction?.confirmLabel}
        tone={confirmationAction?.tone}
        icon={confirmationAction?.icon}
        isBusy={isConfirmingAction}
        onCancel={() => {
          if (!isConfirmingAction) setConfirmationAction(null);
        }}
        onConfirm={handleConfirmAction}
      />

      <StockAdjustModal
        isOpen={Boolean(stockAdjustDraft)}
        item={stockAdjustDraft?.item || null}
        mode={stockAdjustDraft?.mode || 'increase'}
        quantity={stockAdjustQuantity}
        expirationDate={stockAdjustExpirationDate}
        batchCost={stockAdjustBatchCost}
        deductionMode={stockDeductionMode}
        isBusy={isSubmittingStockAdjust}
        onQuantityChange={setStockAdjustQuantity}
        onExpirationDateChange={setStockAdjustExpirationDate}
        onBatchCostChange={setStockAdjustBatchCost}
        onDeductionModeChange={setStockDeductionMode}
        onCancel={closeStockAdjustModal}
        onConfirm={submitQuickStockAdjust}
      />

      <DuplicateItemModal
        isOpen={showDuplicateModal}
        item={duplicateMatchItem}
        onAddItem={handleDuplicateAddItem}
        onUseExisting={handleDuplicateUseExisting}
        onCancel={clearDuplicatePrompt}
      />
    </div>
  );
}


