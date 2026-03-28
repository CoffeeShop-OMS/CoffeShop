import { useEffect, useMemo, useState } from 'react';
import { Filter, Search, X, ChevronRight, MoreVertical, Coffee, Archive, Package, AlertTriangle, TrendingDown, RefreshCcw, PlusCircle, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { getAuthSession } from '../utils/authStorage';
import { createInventoryItem, updateInventoryItem, deleteInventoryItem, getInventory } from '../services/api';
import Dropdown from '../components/Dropdown';
import InventoryHeader from '../components/inventory/InventoryHeader';
import InventoryAlertBanner from '../components/inventory/InventoryAlertBanner';
import StatCards from '../components/inventory/StatCards';
import InventoryTable from '../components/inventory/InventoryTable';
import InventoryMobileList from '../components/inventory/InventoryMobileList';
import ItemDrawer from '../components/inventory/ItemDrawer';
import DeleteConfirmModal from '../components/inventory/DeleteConfirmModal';
import DuplicateItemModal from '../components/inventory/DuplicateItemModal';

const categoryColors = {
  Beans:     { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400',   border: 'border-amber-200' },
  Milk:      { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400',     border: 'border-sky-200' },
  Syrup:     { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-400',  border: 'border-violet-200' },
  Cups:      { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', border: 'border-emerald-200' },
  Pastries:  { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-400',    border: 'border-rose-200' },
  Equipment: { bg: 'bg-stone-50',   text: 'text-stone-600',   dot: 'bg-stone-400',   border: 'border-stone-200' },
  'Add-ins': { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-400',  border: 'border-orange-200' },
  Powder:    { bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-400',  border: 'border-yellow-200' },
  Other:     { bg: 'bg-stone-50',   text: 'text-stone-600',   dot: 'bg-stone-400',   border: 'border-stone-200' },
};

const categoryToBackend = {
  Beans: 'beans', Milk: 'milk', Syrup: 'syrup',
  Cups: 'packaging', Pastries: 'other', Equipment: 'equipment', 'Add-ins': 'add-ins', Powder: 'powder', Other: 'other',
};

const categoryFromBackend = {
  beans: 'Beans', milk: 'Milk', syrup: 'Syrup',
  packaging: 'Cups', equipment: 'Equipment', 'add-ins': 'Add-ins', powder: 'Powder', other: 'Other',
};

const formatFirestoreDate = (value) => {
  if (!value) return '-';
  try {
    if (typeof value.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
    if (typeof value === 'object' && (value._seconds || value.seconds))
      return new Date((value._seconds || value.seconds) * 1000).toISOString().slice(0, 10);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return '-';
  } catch { return '-'; }
};

const mapItemToUi = (item) => {
  const quantity  = Number(item.quantity ?? 0);
  const threshold = Number(item.lowStockThreshold ?? 0);
  const isArchived = (item.status || 'active') === 'deleted';
  const isOut     = quantity <= 0;
  const isLow     = !isArchived && !isOut && (item.isLowStock ?? quantity <= threshold);
  const costPrice = Number(item.costPrice || 0);
  const unit      = item.unit || '';
  const dateAdded = formatFirestoreDate(item.createdAt);
  const lastActivity = formatFirestoreDate(item.updatedAt || item.createdAt);
  return {
    id: item.id, name: item.name, sku: item.sku || '',
    cat: categoryFromBackend[item.category] || 'Other',
    stock: `${quantity} ${unit}`.trim(),
    status: isArchived ? 'Archived' : isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Healthy',
    reorder: `${threshold} ${unit}`.trim(),
    date: lastActivity,
    dateAdded,
    lastActivity,
    isLow, isOut, isArchived, quantity, threshold, costPrice,
    recordStatus: item.status || 'active',
    currentValue: quantity * costPrice,
    maxValue: threshold * costPrice,
  };
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

const exportToCSV = (items) => {
  if (items.length === 0) {
    toast.info('No items to export');
    return;
  }

  const headers = ['Item Name', 'SKU', 'Category', 'Stock', 'Reorder Level', 'Unit Cost', 'Current Value', 'Max Value', 'Status', 'Last Updated'];
  const rows = items.map((item) => [
    item.name,
    item.sku,
    item.cat,
    item.quantity,
    item.threshold,
    item.costPrice.toFixed(2),
    item.currentValue.toFixed(2),
    item.maxValue.toFixed(2),
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

export default function Inventory() {
  const [isDrawerOpen,    setIsDrawerOpen]    = useState(false);
  const [drawerMode,      setDrawerMode]      = useState('add'); // 'add' or 'edit'
  const [formError,       setFormError]       = useState('');
  const [pageError,       setPageError]       = useState('');
  const [isLoadingItems,  setIsLoadingItems]  = useState(true);
  const [searchTerm,      setSearchTerm]      = useState('');
  const [categoryFilter,  setCategoryFilter]  = useState('All');
  const [statusFilter,    setStatusFilter]    = useState('Active');
  const [inventoryItems,  setInventoryItems]  = useState([]);
  const [showFilters,     setShowFilters]     = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete,    setItemToDelete]    = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMatchItem, setDuplicateMatchItem] = useState(null);
  const [pendingCreateInput, setPendingCreateInput] = useState(null);
  const [currentPage,     setCurrentPage]     = useState(1);
  const [selectedItems,   setSelectedItems]   = useState(new Set());
  const [isBulkDeleting,  setIsBulkDeleting]  = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);
  const itemsPerPage = 10;
  const [newItem, setNewItem] = useState({
    itemName: '', sku: '', category: 'Beans', unit: 'pcs', costPerUnit: '', minimumStock: '', initialStock: '', expirationDate: '',
  });

  // Helper function to add activity log
  const addActivity = (type, itemName) => {
    const activity = {
      id: Math.random(),
      type, // 'created', 'updated', 'deleted'
      itemName,
      timestamp: new Date(),
    };
    setRecentActivities((prev) => [activity, ...prev].slice(0, 10)); // Keep last 10 activities
  };

  // Helper function to normalize item names for comparison
  const normalizeNameForComparison = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  };

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return inventoryItems.filter((item) => {
      const matchCat    = categoryFilter === 'All' || item.cat === categoryFilter;
      const matchSearch = !term || item.name.toLowerCase().includes(term) || item.sku.toLowerCase().includes(term);
      const matchStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && !item.isArchived) ||
        (statusFilter === 'Archived' && item.isArchived);
      return matchCat && matchSearch && matchStatus;
    });
  }, [inventoryItems, searchTerm, categoryFilter, statusFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter]);

  // Calculate paginated items
  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    return filteredItems.slice(startIdx, endIdx);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const stats = useMemo(() => {
    const activeItems = inventoryItems.filter((i) => !i.isArchived);
    const archivedItems = inventoryItems.filter((i) => i.isArchived);
    return {
      total: activeItems.length,
      lowCount: activeItems.filter((i) => i.isLow).length,
      outCount: activeItems.filter((i) => i.isOut).length,
      archivedCount: archivedItems.length,
      value: activeItems.reduce((s, i) => s + i.quantity * i.costPrice, 0),
    };
  }, [inventoryItems]);

  const selectedActiveCount = useMemo(() => {
    if (selectedItems.size === 0) return 0;
    return inventoryItems.filter((item) => selectedItems.has(item.id) && !item.isArchived).length;
  }, [selectedItems, inventoryItems]);

  const statCards = useMemo(
    () => [
      { icon: Package, label: 'Total Items', value: stats?.total?.toString() ?? '0', sub: 'Active inventory items', accent: '#3D261D', iconBg: 'bg-[#EDE4DC]', iconColor: '#3D261D' },
      { icon: AlertTriangle, label: 'Low Stock', value: stats?.lowCount?.toString() ?? '0', sub: 'Need attention', accent: '#B45309', iconBg: 'bg-amber-100', iconColor: '#B45309' },
      { icon: TrendingDown, label: 'Out of Stock', value: stats?.outCount?.toString() ?? '0', sub: 'Need replenishment', accent: '#DC2626', iconBg: 'bg-red-100', iconColor: '#DC2626' },
      { icon: Archive, label: 'Archived', value: stats?.archivedCount?.toString() ?? '0', sub: 'Hidden from active inventory', accent: '#6B7280', iconBg: 'bg-slate-100', iconColor: '#475569' },
      { icon: RefreshCcw, label: 'Inventory Value', value: stats ? `₱${Number(stats.value || 0).toFixed(2)}` : '₱0.00', sub: 'Active inventory valuation', accent: '#059669', iconBg: 'bg-emerald-100', iconColor: '#059669' },
    ],
    [stats]
  );

  useEffect(() => {
    const loadItems = async () => {
      setIsLoadingItems(true);
      const session = getAuthSession();
      if (!session?.token) { toast.error('No active session. Please login again.'); setIsLoadingItems(false); return; }
      try {
        const result = await getInventory(session.token, { limit: 100, status: 'all' });
        setInventoryItems((result.data || []).map(mapItemToUi));
      } catch (error) {
        toast.error(error?.message || 'Cannot connect to backend. Please check server connection.');
      } finally { setIsLoadingItems(false); }
    };
    loadItems();
  }, []);

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setDrawerMode('add');
    setFormError('');
    setNewItem({ itemName: '', sku: '', category: 'Beans', unit: 'pcs', costPerUnit: '', minimumStock: '', initialStock: '', expirationDate: '' });
    clearDuplicatePrompt();
  };

  const handleAddClick = () => {
    setDrawerMode('add');
    setNewItem({ itemName: '', sku: '', category: 'Beans', unit: 'pcs', costPerUnit: '', minimumStock: '', initialStock: '', expirationDate: '' });
    setFormError('');
    setIsDrawerOpen(true);
  };

  const handleUpdateClick = (item) => {
    setDrawerMode('edit');
    setNewItem({
      id: item.id,
      sku: item.sku,
      itemName: item.name,
      category: item.cat,
      unit: item.stock.split(' ')[1] || 'pcs',
      costPerUnit: item.costPrice.toString(),
      minimumStock: item.threshold.toString(),
      initialStock: item.quantity.toString(),
      expirationDate: item.expirationDate || '',
    });
    setFormError('');
    setIsDrawerOpen(true);
  };

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    const session = getAuthSession();
    if (!session?.token) { toast.error('Session expired. Please login again.'); return; }
    try {
      await deleteInventoryItem(session.token, itemToDelete.id);
      const today = new Date().toISOString().slice(0, 10);
      setInventoryItems((prev) =>
        prev.map((item) =>
          item.id === itemToDelete.id
            ? { ...item, isArchived: true, recordStatus: 'deleted', status: 'Archived', lastActivity: today, date: today }
            : item
        )
      );
      setSelectedItems((prev) => {
        const next = new Set(prev);
        next.delete(itemToDelete.id);
        return next;
      });
      setShowDeleteModal(false);
      addActivity('deleted', itemToDelete.name);
      setItemToDelete(null);
      toast.success('Item archived successfully');
    } catch (error) { toast.error(error?.message || 'Cannot connect to backend. Please check server connection.'); }
  };

  const handleBulkDelete = async () => {
    if (selectedActiveCount === 0) return;
    if (!window.confirm(`Archive ${selectedActiveCount} item(s)? These items will be hidden from inventory.`)) return;

    const session = getAuthSession();
    if (!session?.token) { toast.error('Session expired. Please login again.'); return; }
    setIsBulkDeleting(true);
    try {
      const itemIds = inventoryItems
        .filter((item) => selectedItems.has(item.id) && !item.isArchived)
        .map((item) => item.id);
      await Promise.all(itemIds.map((id) => deleteInventoryItem(session.token, id)));
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
      inventoryItems
        .filter((item) => itemIds.includes(item.id))
        .forEach((item) => addActivity('deleted', item.name));
      toast.success(`${itemIds.length} item(s) archived successfully`);
    } catch (error) { toast.error(error?.message || 'Failed to archive items'); }
    finally { setIsBulkDeleting(false); }
  };

  function clearDuplicatePrompt() {
    setShowDuplicateModal(false);
    setDuplicateMatchItem(null);
    setPendingCreateInput(null);
  }

  const submitCreateItem = async ({ token, itemName, category, unit, initialStock, minimumStock, costPerUnit, expirationDate }) => {
    const rawPrefix = (itemName.match(/[a-zA-Z]+/)?.[0] || 'Item').slice(0, 12);
    const prefix = rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1).toLowerCase();
    const number = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const sku = `${prefix}-${number}`;

    const result = await createInventoryItem(token, {
      name: itemName,
      sku,
      category: categoryToBackend[category] || 'other',
      unit,
      quantity: initialStock,
      lowStockThreshold: minimumStock,
      costPrice: costPerUnit,
      supplier: '',
      expirationDate: expirationDate || null,
    });

    if (result?.data) {
      setInventoryItems((prev) => [mapItemToUi(result.data), ...prev]);
      addActivity('created', itemName);
    }
    toast.success('Item created successfully');
    closeDrawer();
  };

  const handleDuplicateAddItem = async () => {
    if (!pendingCreateInput) return clearDuplicatePrompt();

    const session = getAuthSession();
    if (!session?.token) {
      clearDuplicatePrompt();
      toast.error('Session expired. Please login again.');
      return;
    }

    try {
      await submitCreateItem({
        token: session.token,
        ...pendingCreateInput,
      });
    } catch (error) {
      if (error?.status === 409) {
        toast.error(error?.message || 'An item with this SKU already exists.');
      } else {
        toast.error(extractApiErrorMessage(error, 'Cannot connect to backend. Please check server connection.'));
      }
    } finally {
      clearDuplicatePrompt();
    }
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
  const costPerUnit = parseFloat(newItem.costPerUnit);
  const minimumStock = parseInt(newItem.minimumStock, 10);
  const initialStock = parseInt(newItem.initialStock, 10);

  // Validation checks
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
  if (!newItem.costPerUnit || isNaN(costPerUnit)) {
    toast.error('Cost per unit is required and must be a valid number.');
    return;
  }
  if (costPerUnit < 0) {
    toast.error('Cost per unit cannot be negative.');
    return;
  }
  if (costPerUnit > 999999) {
    toast.error('Cost per unit is too high.');
    return;
  }
  if (!newItem.minimumStock || isNaN(minimumStock)) {
    toast.error('Minimum stock is required and must be a valid number.');
    return;
  }
  if (minimumStock < 0) {
    toast.error('Minimum stock cannot be negative.');
    return;
  }
  if (!newItem.category) {
    toast.error('Please select a category.');
    return;
  }
  if (!newItem.unit) {
    toast.error('Please select a unit.');
    return;
  }
  if (drawerMode === 'add') {
    if ((newItem.initialStock === '' || newItem.initialStock === undefined) || Number.isNaN(initialStock)) {
      toast.error('Stock level is required and must be a whole number.');
      return;
    }
    if (initialStock < 0) {
      toast.error('Stock level cannot be negative.');
      return;
    }
  }
  if (drawerMode === 'edit') {
    if ((newItem.initialStock === '' || newItem.initialStock === undefined) || Number.isNaN(initialStock)) {
      toast.error('Current stock is required and must be a whole number.');
      return;
    }
    if (initialStock < 0) {
      toast.error('Current stock cannot be negative.');
      return;
    }
  }

  // Check for duplicate active inventory names before creating a new item
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
        unit: newItem.unit,
        initialStock,
        minimumStock,
        costPerUnit,
        expirationDate: newItem.expirationDate,
      });
      setShowDuplicateModal(true);
      return;
    }
  }

  try {
    if (drawerMode === 'add') {
      await submitCreateItem({
        token: session.token,
        itemName,
        category: newItem.category,
        unit: newItem.unit,
        initialStock,
        minimumStock,
        costPerUnit,
        expirationDate: newItem.expirationDate,
      });
    } else {
      // Update existing item
      const result = await updateInventoryItem(session.token, newItem.id, {
        name: itemName,
        category: categoryToBackend[newItem.category] || 'other',
        quantity: initialStock,
        unit: newItem.unit,
        lowStockThreshold: minimumStock,
        costPrice: costPerUnit,
        expirationDate: newItem.expirationDate || null,
      });

      if (result?.data) {
        setInventoryItems((prev) =>
          prev.map((item) => (item.id === newItem.id ? mapItemToUi(result.data) : item))
        );
        addActivity('updated', itemName);
      }
      toast.success('Item updated successfully');
      closeDrawer();
    }
  } catch (error) {
    if (error?.status === 409) {
      toast.error(error?.message || 'An item with this SKU already exists.');
    } else {
      toast.error(extractApiErrorMessage(error, 'Cannot connect to backend. Please check server connection.'));
    }
  }
};

  return (
    <div className="min-h-screen bg-[#F7F4F0] w-full px-4 sm:px-6 lg:px-10 py-6 lg:py-9">
      <InventoryHeader onAddClick={handleAddClick} btnBrown={btnBrown} onExportCSV={() => exportToCSV(filteredItems)} />

      <StatCards stats={stats} cards={statCards} />

      <InventoryAlertBanner lowCount={stats.lowCount} outCount={stats.outCount} />

      {/* ── Main Table Card ── */}
      <div className="bg-white rounded-2xl border border-[#EAE5E0] overflow-hidden shadow-sm">

        {/* Toolbar */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#F0EDE8] bg-[#FDFCFB]">
          {/* Top row: search + buttons */}
          <div className="flex items-center gap-2 justify-between">
            <div className="relative flex-1 max-w-xs sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C4B8B0]" />
              <input
                type="text"
                placeholder="Search items…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 border border-[#E2DDD8] rounded-xl text-sm text-[#2C1810] bg-white transition focus:outline-none focus:border-[#6B3E26] focus:ring-2 focus:ring-[#6B3E26]/10 placeholder:text-[#C4B8B0]"
              />
            </div>
            <div className="flex items-center gap-2">
              {/* Bulk delete button — shows when items selected */}
              {selectedActiveCount > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-1.5 px-3 py-2 border border-amber-200 rounded-xl bg-amber-50 text-amber-600 text-sm font-medium hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <span>Archive {selectedActiveCount}</span>
                </button>
              )}
              {/* Filter toggle — shown on mobile, hidden on md+ */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 border border-[#E2DDD8] rounded-xl bg-white text-[#6B5744] text-sm font-medium hover:bg-[#FAF6F2] hover:border-[#A07850] transition-all md:hidden"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>
              {/* Category selector — always visible on md+ */}
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
                <span className="text-xs text-[#9E8A7A] font-medium whitespace-nowrap">View:</span>
                <div className="w-32">
                  <Dropdown
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={['Active', 'Archived', 'All']}
                    placeholder="Select view"
                    className="text-sm font-semibold text-[#3D261D]"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Expandable filter row — mobile only */}
          {showFilters && (
            <div className="mt-3 flex flex-col gap-2 md:hidden">
              <span className="text-xs text-[#9E8A7A] font-medium">Category:</span>
              <Dropdown
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={['All','Beans','Milk','Syrup','Cups','Pastries','Equipment','Add-ins','Powder','Other']}
                placeholder="Select category"
              />
              <span className="text-xs text-[#9E8A7A] font-medium mt-1">View:</span>
              <Dropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={['Active', 'Archived', 'All']}
                placeholder="Select view"
              />
            </div>
          )}
        </div>

        <InventoryTable
          isLoading={isLoadingItems}
          items={paginatedItems}
          onUpdate={handleUpdateClick}
          onDelete={handleDeleteClick}
          selectedItems={selectedItems}
          onSelectedChange={setSelectedItems}
        />

        {/* ── Mobile Card List (< md) ── */}
        <InventoryMobileList
          isLoading={isLoadingItems}
          items={paginatedItems}
          onUpdate={handleUpdateClick}
          onDelete={handleDeleteClick}
        />

        {/* Pagination */}
        <div className="flex justify-between items-center px-4 sm:px-5 py-3.5 border-t border-[#F0EDE8] bg-[#FDFCFB]">
          <p className="text-xs text-[#A89080]">
            Showing <strong className="text-[#3D261D]">{filteredItems.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredItems.length)}</strong> of{' '}
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

      {/* ── Recent Activity Section ── */}
      <div className="mt-6 sm:mt-8 bg-white rounded-2xl border border-[#EAE5E0] shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#F0EDE8] bg-[#FDFCFB]">
          <h3 className="text-sm font-bold text-[#1C100A]">Recent Activity</h3>
          <p className="text-xs text-[#9E8A7A] mt-1">Live inventory operations</p>
        </div>
        {recentActivities.length > 0 ? (
          <div className="divide-y divide-[#F0EDE8]">
            {recentActivities.map((activity) => {
              const getActivityIcon = () => {
                switch (activity.type) {
                  case 'created':
                    return <PlusCircle className="w-4 h-4 text-emerald-600" />;
                  case 'updated':
                    return <Edit2 className="w-4 h-4 text-blue-600" />;
                  case 'deleted':
                    return <Trash2 className="w-4 h-4 text-red-600" />;
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
                  default:
                    return 'Activity';
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
                    <p className="text-xs text-[#9E8A7A] truncate">{activity.itemName}</p>
                  </div>
                  <div className="text-xs text-[#C4B8B0] whitespace-nowrap">
                    {formatTime(activity.timestamp)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 sm:px-6 py-8 sm:py-10 text-center">
            <Coffee className="w-8 h-8 text-[#C4B8B0] mx-auto mb-3 opacity-50" />
            <p className="text-sm text-[#9E8A7A] font-medium">No activity yet</p>
            <p className="text-xs text-[#C4B8B0] mt-1">Inventory operations will appear here</p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="mt-6 sm:mt-8 pt-4 sm:pt-5 border-t border-[#E8E3DD] text-center">
        <p className="text-[11px] text-[#C4B8B0]">
          © 2026 Coffee &amp; Tea Inventory Systems · System Status:{' '}
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

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        item={itemToDelete}
        onCancel={() => { setShowDeleteModal(false); setItemToDelete(null); }}
        onConfirm={handleDeleteConfirm}
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
