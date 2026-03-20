import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Download, Package,
  AlertTriangle, TrendingDown, RefreshCcw, Filter,
  Search, X, ChevronRight
} from 'lucide-react';
import { getAuthSession } from '../utils/authStorage';
import { createInventoryItem, getInventory } from '../services/api';

const categoryColors = {
  Beans: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400', border: 'border-amber-200' },
  Milk: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-400', border: 'border-sky-200' },
  Syrup: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-400', border: 'border-violet-200' },
  Cups: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', border: 'border-emerald-200' },
  Pastries: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-400', border: 'border-rose-200' },
  Equipment: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400', border: 'border-gray-200' },
  Other: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400', border: 'border-gray-200' },
};

const categoryToBackend = {
  Beans: 'beans',
  Milk: 'milk',
  Syrup: 'syrup',
  Cups: 'packaging',
  Pastries: 'other',
  Equipment: 'equipment',
  Other: 'other',
};

const categoryFromBackend = {
  beans: 'Beans',
  milk: 'Milk',
  syrup: 'Syrup',
  packaging: 'Cups',
  equipment: 'Equipment',
  other: 'Other',
};

const formatFirestoreDate = (value) => {
  if (!value) return '-';

  try {
    if (typeof value.toDate === 'function') {
      return value.toDate().toISOString().slice(0, 10);
    }

    if (typeof value === 'object' && (value._seconds || value.seconds)) {
      const seconds = value._seconds || value.seconds;
      return new Date(seconds * 1000).toISOString().slice(0, 10);
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

    return '-';
  } catch {
    return '-';
  }
};

const mapItemToUi = (item) => {
  const quantity = Number(item.quantity ?? 0);
  const threshold = Number(item.lowStockThreshold ?? 0);
  const isOut = quantity <= 0;
  const isLow = !isOut && (item.isLowStock ?? quantity <= threshold);
  const uiCategory = categoryFromBackend[item.category] || 'Other';

  return {
    id: item.id,
    name: item.name,
    cat: uiCategory,
    stock: `${quantity} ${item.unit || ''}`.trim(),
    status: isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Healthy',
    reorder: `${threshold} ${item.unit || ''}`.trim(),
    date: formatFirestoreDate(item.updatedAt || item.createdAt),
    isLow,
    isOut,
    quantity,
    costPrice: Number(item.costPrice || 0),
  };
};

export default function Inventory() {
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [newItem, setNewItem] = useState({
    itemName: '', category: 'Beans', unit: 'pcs', costPerUnit: '', minimumStock: '',
  });
  const [inventoryItems, setInventoryItems] = useState([]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return inventoryItems.filter((item) => {
      const matchCategory = categoryFilter === 'All' ? true : item.cat === categoryFilter;
      const matchSearch = !term
        ? true
        : item.name.toLowerCase().includes(term) || item.id.toLowerCase().includes(term);
      return matchCategory && matchSearch;
    });
  }, [inventoryItems, searchTerm, categoryFilter]);

  const stats = useMemo(() => {
    const total = inventoryItems.length;
    const outCount = inventoryItems.filter((item) => item.isOut).length;
    const lowCount = inventoryItems.filter((item) => item.isLow).length;
    const value = inventoryItems.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);

    return { total, lowCount, outCount, value };
  }, [inventoryItems]);

  useEffect(() => {
    const loadItems = async () => {
      setIsLoadingItems(true);
      setPageError('');

      const session = getAuthSession();
      if (!session?.token) {
        setPageError('No active session. Please login again.');
        setIsLoadingItems(false);
        return;
      }

      try {
        const result = await getInventory(session.token, { limit: 100 });
        setInventoryItems((result.data || []).map(mapItemToUi));
      } catch (error) {
        setPageError(error?.message || 'Cannot connect to backend. Please check server connection.');
      } finally {
        setIsLoadingItems(false);
      }
    };

    loadItems();
  }, []);

  const closeDrawer = () => { setIsAddDrawerOpen(false); setFormError(''); };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const session = getAuthSession();
    if (!session?.token) {
      setFormError('Session expired. Please login again.');
      return;
    }

    const itemName = newItem.itemName.trim();
    const costPerUnit = Number(newItem.costPerUnit);
    const minimumStock = Number(newItem.minimumStock);

    if (!itemName || Number.isNaN(costPerUnit) || Number.isNaN(minimumStock)) {
      setFormError('Please complete all fields with valid values.');
      return;
    }
    if (costPerUnit < 0 || minimumStock < 0) {
      setFormError('Cost per unit and minimum stock must be 0 or higher.');
      return;
    }

    const normalizedName = itemName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'ITEM';
    const sku = `${normalizedName}${Date.now().toString().slice(-6)}`;

    const payload = {
      name: itemName,
      sku,
      category: categoryToBackend[newItem.category] || 'other',
      quantity: 0,
      unit: newItem.unit,
      lowStockThreshold: Math.floor(minimumStock),
      costPrice: costPerUnit,
      supplier: '',
    };

    try {
      const result = await createInventoryItem(session.token, payload);
      if (result?.data) {
        setInventoryItems((prev) => [mapItemToUi(result.data), ...prev]);
      }

      setNewItem({ itemName: '', category: 'Beans', unit: 'pcs', costPerUnit: '', minimumStock: '' });
      closeDrawer();
    } catch (error) {
      setFormError(error?.message || 'Cannot connect to backend. Please check server connection.');
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

        .inv-root { font-family: 'DM Sans', sans-serif; background: #FAF8F5; min-height: 100vh; }
        .inv-heading { font-family: 'Playfair Display', serif; }

        .stat-card {
          background: #fff;
          border-radius: 20px;
          padding: 24px;
          border: 1px solid #EEEBE6;
          transition: box-shadow 0.2s, transform 0.2s;
          position: relative;
          overflow: hidden;
        }
        .stat-card:hover { box-shadow: 0 8px 32px rgba(61,38,29,0.08); transform: translateY(-2px); }
        .stat-card-accent { position: absolute; bottom: 0; right: 0; width: 80px; height: 80px; border-radius: 50% 0 0 0; opacity: 0.06; }

        .main-table-wrap {
          background: #fff;
          border-radius: 20px;
          border: 1px solid #EEEBE6;
          overflow: hidden;
          box-shadow: 0 2px 16px rgba(61,38,29,0.05);
        }

        .table-toolbar {
          padding: 18px 24px;
          border-bottom: 1px solid #F0EDE8;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          background: #FDFCFB;
        }

        .search-input-wrap { position: relative; }
        .search-input-wrap input {
          padding: 9px 14px 9px 38px;
          border: 1.5px solid #E8E2DA;
          border-radius: 12px;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          background: #fff;
          width: 280px;
          transition: border-color 0.2s, box-shadow 0.2s;
          color: #3D261D;
        }
        .search-input-wrap input:focus { outline: none; border-color: #8B5E3C; box-shadow: 0 0 0 3px rgba(139,94,60,0.1); }
        .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #B5A99A; }

        .filter-btn {
          padding: 9px 14px;
          border: 1.5px solid #E8E2DA;
          border-radius: 12px;
          background: #fff;
          color: #6B5744;
          cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 500;
          transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
        }
        .filter-btn:hover { background: #FAF5F0; border-color: #8B5E3C; }

        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #FDFCFB; border-bottom: 1.5px solid #F0EDE8; }
        thead th { padding: 12px 20px; font-size: 11px; font-weight: 600; color: #9E8A7A; text-transform: uppercase; letter-spacing: 0.06em; }
        tbody tr { border-bottom: 1px solid #F7F4F1; transition: background 0.15s; }
        tbody tr:last-child { border-bottom: none; }
        tbody tr:hover { background: #FBF9F7; }
        tbody tr.out-row { background: #FFF5F5; }
        tbody tr.out-row:hover { background: #FFF0F0; }
        td { padding: 14px 20px; }

        .cat-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 600; border: 1px solid transparent;
        }
        .cat-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

        .status-pill {
          display: inline-block; padding: 3px 10px; border-radius: 20px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.03em;
        }
        .status-healthy { background: #ECFDF5; color: #059669; }
        .status-low { background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; }
        .status-out { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }

        .view-link { font-size: 12px; font-weight: 600; color: #8B5E3C; text-decoration: none; display: flex; align-items: center; gap: 2px; transition: color 0.15s; }
        .view-link:hover { color: #3D261D; }

        .pagination { padding: 16px 24px; border-top: 1px solid #F0EDE8; display: flex; justify-content: space-between; align-items: center; background: #FDFCFB; }

        .drawer-overlay { position: fixed; inset: 0; background: rgba(61,38,29,0.08); backdrop-filter: blur(4px); z-index: 40; }
        .drawer {
          position: fixed; top: 0; right: 0; height: 100vh;
          width: 100%; max-width: 420px;
          background: #fff; z-index: 50;
          border-left: 1px solid #EEEBE6;
          box-shadow: -8px 0 40px rgba(61,38,29,0.12);
          display: flex; flex-direction: column;
        }
        .drawer-header { padding: 28px 28px 20px; border-bottom: 1px solid #F0EDE8; }
        .drawer-body { flex: 1; overflow-y: auto; padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; }
        .drawer-footer { padding: 20px 28px; border-top: 1px solid #F0EDE8; display: flex; gap: 12px; }

        .form-label { display: block; font-size: 12px; font-weight: 600; color: #6B5744; margin-bottom: 7px; text-transform: uppercase; letter-spacing: 0.05em; }
        .form-input, .form-select {
          width: 100%; border: 1.5px solid #E8E2DA; border-radius: 12px;
          padding: 10px 14px; font-size: 13px; font-family: 'DM Sans', sans-serif;
          color: #3D261D; background: #fff; transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .form-input:focus, .form-select:focus { outline: none; border-color: #8B5E3C; box-shadow: 0 0 0 3px rgba(139,94,60,0.1); }
        .form-error { font-size: 12px; color: #DC2626; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 10px 14px; }

        .btn-primary {
          flex: 1; padding: 11px 20px; border-radius: 12px;
          background: #3D261D; color: #fff; font-weight: 600; font-size: 14px;
          border: none; cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-primary:hover { background: #2A1A14; }
        .btn-primary:active { transform: scale(0.98); }
        .btn-ghost {
          flex: 1; padding: 11px 20px; border-radius: 12px;
          background: #fff; color: #6B5744; font-weight: 600; font-size: 14px;
          border: 1.5px solid #E8E2DA; cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: background 0.15s;
        }
        .btn-ghost:hover { background: #FAF5F0; }

        .add-btn {
          display: flex; align-items: center; gap: 7px;
          background: #3D261D; color: #fff; padding: 10px 18px;
          border-radius: 12px; font-size: 13px; font-weight: 600;
          border: none; cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: background 0.15s, box-shadow 0.15s;
          box-shadow: 0 2px 8px rgba(61,38,29,0.18);
        }
        .add-btn:hover { background: #2A1A14; box-shadow: 0 4px 16px rgba(61,38,29,0.22); }

        .export-btn {
          display: flex; align-items: center; gap: 7px;
          background: #fff; color: #3D261D; padding: 10px 18px;
          border-radius: 12px; font-size: 13px; font-weight: 600;
          border: 1.5px solid #E8E2DA; cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }
        .export-btn:hover { background: #FAF5F0; border-color: #C4A882; }

        .alert-banner {
          background: linear-gradient(135deg, #FFF7ED 0%, #FFF3E6 100%);
          border: 1px solid #FDE68A;
          border-radius: 14px;
          padding: 14px 18px;
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 28px;
        }

        .item-name { font-weight: 600; font-size: 14px; color: #1C120D; }
        .item-id { font-size: 11px; color: #B5A99A; font-weight: 500; margin-top: 1px; }
        .stock-val { font-weight: 700; font-size: 14px; }
        .stock-val.warn { color: #D97706; }
        .stock-val.danger { color: #DC2626; }
        .stock-val.ok { color: #1C120D; }
      `}</style>

      <div className="inv-root" style={{ width: '100%', padding: '36px 40px', boxSizing: 'border-box' }}>
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-serif mb-1">Inventory Management</h1>
            <p className="text-gray-500 text-sm">Monitor and manage your coffee shop supplies and ingredients.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="export-btn"><Download style={{ width: 15, height: 15 }} /> Export CSV</button>
            <button className="add-btn" onClick={() => setIsAddDrawerOpen(true)}><Plus style={{ width: 15, height: 15 }} /> Add New Item</button>
          </div>
        </div>

        <div className="alert-banner">
          <AlertTriangle style={{ width: 18, height: 18, color: '#D97706', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>Attention needed - </span>
            <span style={{ fontSize: 13, color: '#92400E' }}>{stats.lowCount} items are running low and {stats.outCount} items are out of stock.</span>
          </div>
          <button style={{ fontSize: 12, fontWeight: 600, color: '#8B5E3C', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            Review <ChevronRight style={{ width: 13, height: 13 }} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 28 }}>
          {[
            { icon: Package, label: 'Total Items', value: stats.total.toString(), sub: 'Across categories', accent: '#3D261D', iconBg: '#F5F0EB' },
            { icon: AlertTriangle, label: 'Low Stock Alerts', value: stats.lowCount.toString(), sub: 'Action required', accent: '#D97706', iconBg: '#FFF8ED' },
            { icon: TrendingDown, label: 'Out of Stock', value: stats.outCount.toString(), sub: 'Need replenishment', accent: '#DC2626', iconBg: '#FFF0F0' },
            { icon: RefreshCcw, label: 'Inventory Value', value: `$${stats.value.toFixed(2)}`, sub: 'Current valuation', accent: '#059669', iconBg: '#ECFDF5' },
          ].map(({ icon: Icon, label, value, sub, accent, iconBg }) => (
            <div className="stat-card" key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ background: iconBg, borderRadius: 12, padding: 10, display: 'flex' }}>
                  <Icon style={{ width: 18, height: 18, color: accent }} />
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9E8A7A', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div className="inv-heading" style={{ fontSize: 26, fontWeight: 700, color: '#1C120D', marginBottom: 3 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#B5A99A' }}>{sub}</div>
              <div className="stat-card-accent" style={{ background: accent }} />
            </div>
          ))}
        </div>

        <div className="main-table-wrap">
          {pageError && (
            <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">{pageError}</div>
          )}

          <div className="table-toolbar">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="search-input-wrap">
                <Search className="search-icon" style={{ width: 15, height: 15 }} />
                <input
                  type="text"
                  placeholder="Search items or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="filter-btn"><Filter style={{ width: 13, height: 13 }} /> Filter</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#9E8A7A', fontWeight: 500 }}>Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: '#3D261D', outline: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                {['All', 'Beans', 'Milk', 'Syrup', 'Cups', 'Pastries', 'Equipment', 'Other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: 48, textAlign: 'center' }}><input type="checkbox" style={{ accentColor: '#3D261D' }} /></th>
                <th style={{ textAlign: 'left' }}>Item Details</th>
                <th style={{ textAlign: 'left' }}>Category</th>
                <th style={{ textAlign: 'left' }}>Stock</th>
                <th style={{ textAlign: 'left' }}>Reorder Level</th>
                <th style={{ textAlign: 'left' }}>Last Order</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingItems ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9E8A7A', padding: '20px' }}>Loading inventory...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9E8A7A', padding: '20px' }}>No items found.</td></tr>
              ) : (
                filteredItems.map((item) => {
                  const cc = categoryColors[item.cat] || categoryColors.Other;
                  return (
                    <tr key={item.id} className={item.isOut ? 'out-row' : ''}>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" style={{ accentColor: '#3D261D' }} /></td>
                      <td>
                        <div className="item-name">{item.name}</div>
                        <div className="item-id">{item.id}</div>
                      </td>
                      <td>
                        <span className={`cat-badge ${cc.bg} ${cc.text} ${cc.border}`}>
                          <span className={`cat-dot ${cc.dot}`} />
                          {item.cat}
                        </span>
                      </td>
                      <td>
                        <span className={`stock-val ${item.isOut ? 'danger' : item.isLow ? 'warn' : 'ok'}`}>{item.stock}</span>
                      </td>
                      <td style={{ fontSize: 13, color: '#6B5744', fontWeight: 500 }}>{item.reorder}</td>
                      <td style={{ fontSize: 12, color: '#9E8A7A' }}>{item.date}</td>
                      <td>
                        <span className={`status-pill ${item.isOut ? 'status-out' : item.isLow ? 'status-low' : 'status-healthy'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="view-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          View <ChevronRight style={{ width: 12, height: 12 }} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="pagination">
            <p style={{ fontSize: 12, color: '#9E8A7A' }}>
              Showing <strong style={{ color: '#3D261D' }}>1-{filteredItems.length}</strong> of <strong style={{ color: '#3D261D' }}>{filteredItems.length}</strong> items
            </p>
          </div>
        </div>

        <div style={{ marginTop: 32, textAlign: 'center', borderTop: '1px solid #EEEBE6', paddingTop: 20 }}>
          <p style={{ fontSize: 11, color: '#C4B9AD' }}>
            (c) 2026 Coffee & Tea Inventory Systems. All rights reserved. | System Status: <span style={{ color: '#059669', fontWeight: 700 }}>Optimal</span>
          </p>
        </div>

        {isAddDrawerOpen && (
          <>
            <button aria-label="Close" onClick={closeDrawer} className="drawer-overlay" style={{ border: 'none', padding: 0 }} />
            <aside className="drawer">
              <form onSubmit={handleAddSubmit} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="drawer-header">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h2 className="inv-heading" style={{ fontSize: 22, fontWeight: 700, color: '#1C120D', margin: 0 }}>Add New Item</h2>
                      <p style={{ fontSize: 13, color: '#9E8A7A', marginTop: 4 }}>Fill in the details for the new inventory item.</p>
                    </div>
                    <button type="button" onClick={closeDrawer} style={{ background: '#F5F0EB', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', color: '#6B5744' }}>
                      <X style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                </div>

                <div className="drawer-body">
                  {[
                    { label: 'Item Name', field: 'itemName', type: 'text', placeholder: 'e.g. Arabica Beans' },
                    { label: 'Cost per Unit', field: 'costPerUnit', type: 'number', placeholder: 'e.g. 12.50' },
                    { label: 'Minimum Stock', field: 'minimumStock', type: 'number', placeholder: 'e.g. 50' },
                  ].map(({ label, field, type, placeholder }) => (
                    <div key={field}>
                      <label className="form-label">{label}</label>
                      <input
                        type={type}
                        min={type === 'number' ? 0 : undefined}
                        step={field === 'costPerUnit' ? '0.01' : field === 'minimumStock' ? '1' : undefined}
                        value={newItem[field]}
                        onChange={(e) => setNewItem((p) => ({ ...p, [field]: e.target.value }))}
                        className="form-input"
                        placeholder={placeholder}
                        required
                      />
                    </div>
                  ))}

                  <div>
                    <label className="form-label">Category</label>
                    <select value={newItem.category} onChange={(e) => setNewItem((p) => ({ ...p, category: e.target.value }))} className="form-select" required>
                      {['Beans', 'Milk', 'Syrup', 'Cups', 'Pastries'].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Unit</label>
                    <select value={newItem.unit} onChange={(e) => setNewItem((p) => ({ ...p, unit: e.target.value }))} className="form-select" required>
                      {['pcs', 'ml', 'grams', 'liters'].map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>

                  {formError && <div className="form-error">{formError}</div>}
                </div>

                <div className="drawer-footer">
                  <button type="button" onClick={closeDrawer} className="btn-ghost">Cancel</button>
                  <button type="submit" className="btn-primary">Save Item</button>
                </div>
              </form>
            </aside>
          </>
        )}
      </div>
    </>
  );
}
