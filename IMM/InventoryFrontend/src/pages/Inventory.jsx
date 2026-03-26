import { useEffect, useMemo, useState } from 'react';
import { Filter,  Search, X, ChevronRight, MoreVertical, Coffee} from 'lucide-react';
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
  const isOut     = quantity <= 0;
  const isLow     = !isOut && (item.isLowStock ?? quantity <= threshold);
  const costPrice = Number(item.costPrice || 0);
  const unit      = item.unit || '';
  return {
    id: item.id, name: item.name, sku: item.sku || '',
    cat: categoryFromBackend[item.category] || 'Other',
    stock: quantity > 0 ? `${quantity} ${unit}`.trim() : '0',
    status: isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Healthy',
    reorder: `${threshold} ${unit}`.trim(),
    date: formatFirestoreDate(item.updatedAt || item.createdAt),
    isLow, isOut, quantity, threshold, costPrice,
    currentValue: quantity * costPrice,
    maxValue: threshold * costPrice,
  };
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
  const [inventoryItems,  setInventoryItems]  = useState([]);
  const [showFilters,     setShowFilters]     = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete,    setItemToDelete]    = useState(null);
  const [currentPage,     setCurrentPage]     = useState(1);
  const [selectedItems,   setSelectedItems]   = useState(new Set());
  const [isBulkDeleting,  setIsBulkDeleting]  = useState(false);
  const itemsPerPage = 10;
  const [newItem, setNewItem] = useState({
    itemName: '', sku: '', category: 'Beans', unit: 'pcs', costPerUnit: '', minimumStock: '', initialStock: '',
  });

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
      return matchCat && matchSearch;
    });
  }, [inventoryItems, searchTerm, categoryFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

  // Calculate paginated items
  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    return filteredItems.slice(startIdx, endIdx);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const stats = useMemo(() => ({
    total:    inventoryItems.length,
    lowCount: inventoryItems.filter((i) => i.isLow).length,
    outCount: inventoryItems.filter((i) => i.isOut).length,
    value:    inventoryItems.reduce((s, i) => s + i.quantity * i.costPrice, 0),
  }), [inventoryItems]);

  useEffect(() => {
    const loadItems = async () => {
      setIsLoadingItems(true);
      const session = getAuthSession();
      if (!session?.token) { toast.error('No active session. Please login again.'); setIsLoadingItems(false); return; }
      try {
        const result = await getInventory(session.token, { limit: 100 });
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
    setNewItem({ itemName: '', sku: '', category: 'Beans', unit: 'pcs', costPerUnit: '', minimumStock: '', initialStock: '' });
  };

  const handleAddClick = () => {
    setDrawerMode('add');
    setNewItem({ itemName: '', sku: '', category: 'Beans', unit: 'pcs', costPerUnit: '', minimumStock: '', initialStock: '' });
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
      setInventoryItems((prev) => prev.filter((item) => item.id !== itemToDelete.id));
      setShowDeleteModal(false);
      setItemToDelete(null);
      toast.success('Item archived successfully');
    } catch (error) { toast.error(error?.message || 'Cannot connect to backend. Please check server connection.'); }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!window.confirm(`Archive ${selectedItems.size} item(s)? These items will be hidden from inventory.`)) return;

    const session = getAuthSession();
    if (!session?.token) { toast.error('Session expired. Please login again.'); return; }
    setIsBulkDeleting(true);
    try {
      const itemIds = Array.from(selectedItems);
      await Promise.all(itemIds.map((id) => deleteInventoryItem(session.token, id)));
      setInventoryItems((prev) => prev.filter((item) => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
      setCurrentPage(1);
      toast.success(`${itemIds.length} item(s) archived successfully`);
    } catch (error) { toast.error(error?.message || 'Failed to archive items'); }
    finally { setIsBulkDeleting(false); }
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

  // Check for duplicate item names (case-insensitive) when adding new items
  if (drawerMode === 'add') {
    const normalizedNewName = normalizeNameForComparison(itemName);
    const duplicateItem = inventoryItems.find(
      (item) => normalizeNameForComparison(item.name) === normalizedNewName
    );

    if (duplicateItem) {
      toast.error(`Item '${duplicateItem.name}' already exists with SKU '${duplicateItem.sku}'. Please update it instead or use a different name.`);
      return;
    }
  }

  try {
    if (drawerMode === 'add') {
      // Generate SKU for new items - 3 letter prefix from name + hyphen + 3 random digits
      const prefix = itemName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
      const number = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const sku = `${prefix}-${number}`;

      const result = await createInventoryItem(session.token, {
  name: itemName,
  sku,
  category: categoryToBackend[newItem.category] || 'other',
  unit: newItem.unit,
  quantity: 0,                // Start at 0 since no initial stock input
  lowStockThreshold: minimumStock,
  costPrice: costPerUnit,
  supplier: '',               // or null if you prefer
});

      if (result?.data) setInventoryItems((prev) => [mapItemToUi(result.data), ...prev]);
      toast.success('Item created successfully');
    } else {
      // Update existing item
      const result = await updateInventoryItem(session.token, newItem.id, {
        name: itemName,
        category: categoryToBackend[newItem.category] || 'other',
        unit: newItem.unit,
        lowStockThreshold: minimumStock,
        costPrice: costPerUnit,
      });

      if (result?.data) {
        setInventoryItems((prev) =>
          prev.map((item) => (item.id === newItem.id ? mapItemToUi(result.data) : item))
        );
      }
      toast.success('Item updated successfully');
    }

    closeDrawer();
  } catch (error) {
    if (error?.response?.status === 409) {
      toast.error(`Item with SKU '${error?.response?.data?.message?.match(/SKU '([^']+)'/)?.[1] || 'unknown'}' already exists`);
    } else {
      toast.error(error?.message || 'Cannot connect to backend. Please check server connection.');
    }
  }
};

  return (
    <div className="min-h-screen bg-[#F7F4F0] w-full px-4 sm:px-6 lg:px-10 py-6 lg:py-9">
      <InventoryHeader onAddClick={handleAddClick} btnBrown={btnBrown} onExportCSV={() => exportToCSV(filteredItems)} />

      <StatCards stats={stats} />

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
              {selectedItems.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-1.5 px-3 py-2 border border-amber-200 rounded-xl bg-amber-50 text-amber-600 text-sm font-medium hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <span>Archive {selectedItems.size}</span>
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
              <div className="hidden md:flex items-center gap-2">
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
    </div>
  );
}