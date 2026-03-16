import { Link, useNavigate } from 'react-router-dom';
import { 
  Coffee, LayoutDashboard, Package, Truck, BarChart2, 
  Settings, LogOut, Search, Bell, Plus, Download,
  AlertTriangle, TrendingDown, RefreshCcw, Filter, 
  List, LayoutGrid, MoreHorizontal, Droplet, CupSoda, Cookie, Beaker
} from 'lucide-react';

export default function Inventory({ setIsAuthenticated }) {
  const navigate = useNavigate();

  const handleLogout = (e) => {
    e.preventDefault();
    setIsAuthenticated(false);
    navigate('/login');
  };

  const inventoryItems = [
    { id: 'INV-001', name: 'Ethiopian Yirgacheffe', img: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=50&h=50&fit=crop', cat: 'Beans', catIcon: Coffee, stock: '12 kg', status: 'Low Stock', reorder: '15 kg', supplier: 'Altitude Roasters', date: '2023-10-24', isLow: true, isOut: false },
    { id: 'INV-002', name: 'Organic Whole Milk', img: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=50&h=50&fit=crop', cat: 'Milk', catIcon: Droplet, stock: '48 L', status: 'Healthy', reorder: '20 L', supplier: 'Green Valley Dairy', date: '2023-10-26', isLow: false, isOut: false },
    { id: 'INV-003', name: 'Vanilla Bean Syrup', img: 'https://images.unsplash.com/photo-1525598912003-663126343e1f?w=50&h=50&fit=crop', cat: 'Syrup', catIcon: Beaker, stock: '5 Bottle', status: 'Low Stock', reorder: '8 Bottle', supplier: 'Monin Gourmet', date: '2023-10-15', isLow: true, isOut: false },
    { id: 'INV-004', name: '12oz Compostable Cups', img: 'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?w=50&h=50&fit=crop', cat: 'Cups', catIcon: CupSoda, stock: '1200 pcs', status: 'Healthy', reorder: '500 pcs', supplier: 'EcoPack Solutions', date: '2023-10-20', isLow: false, isOut: false },
    { id: 'INV-005', name: 'Almond Croissant', img: 'https://images.unsplash.com/photo-1549903072-7e6e0bedb7fb?w=50&h=50&fit=crop', cat: 'Pastries', catIcon: Cookie, stock: '8 pcs', status: 'Low Stock', reorder: '10 pcs', supplier: 'Artisan Bakeshop', date: '2023-10-27', isLow: true, isOut: false },
    { id: 'INV-006', name: 'Oat Milk Barista Ed.', img: 'https://images.unsplash.com/photo-1600718374662-0483d2b9da44?w=50&h=50&fit=crop', cat: 'Milk', catIcon: Droplet, stock: '24 L', status: 'Healthy', reorder: '12 L', supplier: 'Oatly Co.', date: '2023-10-22', isLow: false, isOut: false },
    { id: 'INV-007', name: 'Caramel Drizzle', img: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=50&h=50&fit=crop', cat: 'Syrup', catIcon: Beaker, stock: '0 Bottle', status: 'Out of Stock', reorder: '5 Bottle', supplier: 'Monin Gourmet', date: '2023-09-30', isLow: false, isOut: true },
  ];

  return (
    <div className="flex h-screen bg-[#FBFBFA] font-sans overflow-hidden">
      
      {/* ================= SIDEBAR ================= */}
      <aside className="w-64 bg-[#FBFBFA] border-r border-gray-200 flex flex-col justify-between flex-shrink-0">
        <div>
          <div className="h-20 flex items-center px-6 gap-3 border-b border-gray-100">
            <div className="bg-[#3D261D] p-1.5 rounded-lg">
              <Coffee className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl font-serif text-[#3D261D]">Coffee & Tea</span>
          </div>

          <nav className="p-4 space-y-1">
            <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
              <LayoutDashboard className="w-5 h-5" /> Dashboard
            </Link>
            
            <Link to="/inventory" className="flex items-center gap-3 px-4 py-3 bg-[#3D261D] text-white rounded-lg font-medium shadow-md">
              <Package className="w-5 h-5" /> Inventory
            </Link>
            
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
              <Truck className="w-5 h-5" /> Suppliers
            </a>
            
            <Link to="/reports" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
              <BarChart2 className="w-5 h-5" /> Reports
            </Link>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 space-y-1 border-t border-gray-200">
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
            <Settings className="w-5 h-5" /> Settings
          </a>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg font-medium transition-colors">
            <LogOut className="w-5 h-5" /> Logout
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* HEADER */}
        <header className="h-20 bg-[#FBFBFA] border-b border-gray-200 flex items-center justify-between px-8 flex-shrink-0">
          <div className="relative w-96">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search inventory, orders, or suppliers..." 
              className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3D261D]"
            />
          </div>
          <div className="flex items-center gap-6">
            <button className="relative text-gray-500 hover:text-gray-700">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
              <div className="text-right">
                <p className="text-sm font-bold text-gray-800">Admin User</p>
                <p className="text-xs text-gray-500">Store Manager</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-300 border border-gray-400 overflow-hidden">
                <img src="https://ui-avatars.com/api/?name=Admin+User&background=3D261D&color=fff" alt="User" />
              </div>
            </div>
          </div>
        </header>

        {/* SCROLLABLE INVENTORY CONTENT */}
        <div className="flex-1 overflow-y-auto p-8">
          
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-serif mb-1">Inventory Management</h1>
              <p className="text-gray-500 text-sm">Monitor and manage your coffee shop supplies and ingredients.</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm">
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <button className="flex items-center gap-2 bg-[#3D261D] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2A1A14] transition-colors shadow-sm">
                <Plus className="w-4 h-4" /> Add New Item
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-36">
              <div className="p-2 bg-gray-50 rounded-lg w-fit mb-2">
                <Package className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Total Inventory Items</p>
                <p className="text-2xl font-bold font-serif text-gray-900 mb-1">1,248</p>
                <p className="text-[11px] text-gray-400">Across 12 categories</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-gray-600" />
                </div>
                <span className="bg-red-50 text-red-500 text-[10px] font-bold px-2 py-1 rounded-md">-2.4%</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Low Stock Alerts</p>
                <p className="text-2xl font-bold font-serif text-gray-900 mb-1">14</p>
                <p className="text-[11px] text-gray-400">Action required immediately</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-36">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-red-50 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Out of Stock</p>
                <p className="text-2xl font-bold font-serif text-gray-900 mb-1">3</p>
                <p className="text-[11px] text-gray-400">Affecting 5 menu items</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-36">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <RefreshCcw className="w-5 h-5 text-gray-600" />
                </div>
                <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-1 rounded-md">+1.2%</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Inventory Value</p>
                <p className="text-2xl font-bold font-serif text-gray-900 mb-1">$12,450.00</p>
                <p className="text-[11px] text-gray-400">Current market valuation</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-t-2xl border border-gray-200 border-b-0 flex justify-between items-center">
            <div className="flex gap-3 w-1/2">
              <div className="relative w-full max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search by item name or SKU..." 
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3D261D]"
                />
              </div>
              <button className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                <Filter className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Filter by:</span>
                <select className="border-none bg-transparent font-semibold text-gray-800 focus:outline-none cursor-pointer">
                  <option>Category: All</option>
                  <option>Beans</option>
                  <option>Milk</option>
                </select>
              </div>
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                <button className="p-2 bg-gray-50 text-gray-800 border-r border-gray-200"><List className="w-4 h-4" /></button>
                <button className="p-2 bg-white text-gray-400 hover:text-gray-800"><LayoutGrid className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-b-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 bg-white">
                  <th className="p-4 w-12 text-center"><input type="checkbox" className="rounded border-gray-300 text-[#3D261D] focus:ring-[#3D261D]" /></th>
                  <th className="p-4">Item Details ↑↓</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Current Stock</th>
                  <th className="p-4">Reorder Level</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4">Last Order</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {inventoryItems.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${item.isOut ? 'bg-red-50/50 hover:bg-red-50' : ''}`}
                  >
                    <td className="p-4 text-center">
                      <input type="checkbox" className="rounded border-gray-300 text-[#3D261D] focus:ring-[#3D261D]" />
                    </td>
                    
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                          <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{item.name}</p>
                          <p className="text-[11px] text-gray-400">{item.id}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <div className="p-1.5 bg-gray-100 rounded-md">
                          <item.catIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-medium">{item.cat}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${item.isLow || item.isOut ? 'text-red-500' : 'text-gray-900'}`}>
                          {item.stock}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          item.isOut ? 'bg-red-500 text-white border-red-500' :
                          item.isLow ? 'bg-white text-gray-800 border-gray-300' :
                          'bg-white text-gray-500 border-transparent'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </td>

                    <td className="p-4 text-gray-600 font-medium text-xs">
                      {item.reorder}
                    </td>

                    <td className="p-4 text-gray-600 text-xs">
                      <p className="w-20 truncate" title={item.supplier}>{item.supplier}</p>
                    </td>

                    <td className="p-4 text-gray-500 text-xs">
                      {item.date}
                    </td>

                    <td className="p-4 text-center">
                      <button className="text-gray-400 hover:text-gray-800">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-white">
              <p className="text-xs text-gray-500">
                Showing <span className="font-bold text-gray-900">1-7</span> of <span className="font-bold text-gray-900">148</span> items
              </p>
              <div className="flex gap-1 text-sm">
                <button className="px-3 py-1 border border-gray-200 text-gray-500 rounded-md hover:bg-gray-50 text-xs">Previous</button>
                <button className="px-3 py-1 bg-[#3D261D] text-white rounded-md text-xs font-bold">1</button>
                <button className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-md text-xs font-medium">2</button>
                <button className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-md text-xs font-medium">3</button>
                <button className="px-3 py-1 border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 text-xs">Next</button>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center border-t border-gray-200 pt-6 pb-2">
            <p className="text-[11px] text-gray-400">
              © 2026 Coffee&Tea Inventory Systems. All rights reserved. | System Status: <span className="text-green-500 font-bold">Optimal</span>
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}