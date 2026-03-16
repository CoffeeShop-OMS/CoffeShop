import { Link, useNavigate } from 'react-router-dom';

import { 
  Coffee, LayoutDashboard, Package, Truck, BarChart2, 
  Settings, LogOut, Search, Bell, Calendar, Plus, 
  DollarSign, AlertTriangle, TrendingUp, TrendingDown,
  PlusCircle, Trash2, ShoppingCart, RefreshCw, ArrowUpRight
} from 'lucide-react';

export default function Dashboard({ setIsAuthenticated }) {
  const navigate = useNavigate();

  const handleLogout = (e) => {
    e.preventDefault();
    setIsAuthenticated(false); // Ilo-lock ulit natin ang system
    navigate('/login'); // Ibabalik ka sa Login page
  };

  return (
    // ... (tuloy-tuloy lang ang dating code dito)
    <div className="flex h-screen bg-[#FBFBFA] font-sans overflow-hidden">
      
      {/* ================= SIDEBAR ================= */}
      <aside className="w-64 bg-[#FBFBFA] border-r border-gray-200 flex flex-col justify-between flex-shrink-0">
        <div>
          {/* Brand */}
          <div className="h-20 flex items-center px-6 gap-3 border-b border-gray-100">
            <div className="bg-[#3D261D] p-1.5 rounded-lg">
              <Coffee className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl font-serif text-[#3D261D]">Coffee & Tea</span>
          </div>

          {/* Navigation */}
        
       <nav className="p-4 space-y-1">
         <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 bg-[#3D261D] text-white rounded-lg font-medium shadow-md">
           <LayoutDashboard className="w-5 h-5" /> Dashboard
         </Link>
         <Link to="/inventory" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
           <Package className="w-5 h-5" /> Inventory
         </Link>
         
         <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
           <Truck className="w-5 h-5" /> Suppliers
         </a>
        <Link to="/reports" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
  <BarChart2 className="w-5 h-5" /> 
  Reports
</Link>
       </nav>
        </div>

       {/* Bottom Actions */}
        <div className="p-4 space-y-1 border-t border-gray-200">
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
            <Settings className="w-5 h-5" /> Settings
          </a>
          
          {/* ITO YUNG PAPALITAN MO PARA TAWAGIN ANG LOGOUT FUNCTION: */}
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
                {/* Placeholder image for Avatar */}
                <img src="https://ui-avatars.com/api/?name=Admin+User&background=3D261D&color=fff" alt="User" />
              </div>
            </div>
          </div>
        </header>

        {/* SCROLLABLE DASHBOARD CONTENT */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* Welcome Section */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-serif mb-1">Morning, Arabica Manager</h1>
              <p className="text-gray-500 text-sm">Your inventory health is <span className="font-semibold text-gray-700">92%</span>. 4 items need your attention.</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <Calendar className="w-4 h-4" />
                Jun 12, 2024
              </button>
              <button className="flex items-center gap-2 bg-[#3D261D] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2A1A14] transition-colors">
                <Plus className="w-4 h-4" />
                Add Entry
              </button>
            </div>
          </div>

          {/* Top Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-32">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <Package className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md">
                  <TrendingUp className="w-3 h-3" /> +12% from last week
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Inventory Items</p>
                <p className="text-2xl font-bold font-serif text-gray-900">1,284</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-32">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md">
                  <TrendingUp className="w-3 h-3" /> +3.4% vs last month
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Value (USD)</p>
                <p className="text-2xl font-bold font-serif text-gray-900">$24,580.00</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-32">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-md">
                  <TrendingDown className="w-3 h-3" /> -2 since yesterday
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Low Stock Items</p>
                <p className="text-2xl font-bold font-serif text-gray-900">14</p>
              </div>
            </div>
          </div>

          {/* Middle Section - Graphs & Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* Big Graph - Daily Ingredient Usage */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 relative">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-gray-900">Daily Ingredient Usage</h3>
                  <p className="text-xs text-gray-500">Volume of key ingredients consumed past 7 days</p>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button className="px-3 py-1 bg-white rounded-md text-xs font-bold shadow-sm text-gray-800">Espresso</button>
                  <button className="px-3 py-1 text-xs font-bold text-gray-500">Milk</button>
                </div>
              </div>
              {/* Fake SVG Graph based on design */}
              <div className="h-48 w-full relative">
                {/* Y-Axis labels */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-gray-400 pb-5">
                  <span>24</span><span>18</span><span>12</span><span>6</span><span>0</span>
                </div>
                {/* X-Axis labels */}
                <div className="absolute bottom-0 left-6 right-0 flex justify-between text-[10px] text-gray-400">
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
                {/* Dotted lines */}
                <div className="absolute left-6 right-0 top-2 bottom-6 flex flex-col justify-between">
                  <div className="border-b border-dashed border-gray-200 w-full h-0"></div>
                  <div className="border-b border-dashed border-gray-200 w-full h-0"></div>
                  <div className="border-b border-dashed border-gray-200 w-full h-0"></div>
                  <div className="border-b border-dashed border-gray-200 w-full h-0"></div>
                  <div className="border-b border-gray-300 w-full h-0"></div>
                </div>
                {/* SVG Area Chart */}
                <svg className="absolute left-6 right-0 top-2 bottom-6 w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)]" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="gradientBrown" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3D261D" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#3D261D" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,80 C20,85 40,80 60,70 C80,60 90,65 100,68 L100,100 L0,100 Z" fill="url(#gradientBrown)" />
                  <path d="M0,80 C20,85 40,80 60,70 C80,60 90,65 100,68" fill="none" stroke="#3D261D" strokeWidth="2" />
                </svg>
              </div>
            </div>

            {/* Priority Alerts */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-gray-500" /> Priority Alerts
                  </h3>
                  <p className="text-xs text-gray-500">Items below threshold as of today</p>
                </div>
                <a href="#" className="text-xs text-gray-600 hover:text-gray-900">View All</a>
              </div>
              
              <div className="flex-1 space-y-3">
                {/* Alert 1 */}
                <div className="p-3 border border-gray-100 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm text-gray-900">Ethiopian Yirgacheffe</p>
                    <p className="text-[10px] text-gray-500">Current: 1.2kg / Reorder: 2.0kg</p>
                  </div>
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">critical</span>
                </div>
                {/* Alert 2 */}
                <div className="p-3 border border-gray-100 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm text-gray-900">Oat Milk (Barista Ed.)</p>
                    <p className="text-[10px] text-gray-500">Current: 8L / Reorder: 12L</p>
                  </div>
                  <span className="border border-gray-300 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">warning</span>
                </div>
                {/* Alert 3 */}
                <div className="p-3 border border-gray-100 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm text-gray-900">Caramel Syrup</p>
                    <p className="text-[10px] text-gray-500">Current: 2 bottles / Reorder: 5 bottles</p>
                  </div>
                  <span className="border border-gray-300 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">warning</span>
                </div>
                {/* Alert 4 */}
                <div className="p-3 border border-gray-100 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm text-gray-900">Paper Cups (12oz)</p>
                    <p className="text-[10px] text-gray-500">Current: 150 pcs / Reorder: 500 pcs</p>
                  </div>
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">critical</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-[10px] text-gray-400">Auto-order enabled for 2 items</span>
                <ArrowUpRight className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Bottom Section - 3 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            {/* Stock Distribution */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-1">Stock Distribution</h3>
              <p className="text-xs text-gray-500 mb-6">Capacity usage by category</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">Beans</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-3.5"><div className="bg-[#4A332A] h-3.5 rounded-full" style={{width: '45%'}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">Dairy</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-3.5"><div className="bg-[#4A332A] h-3.5 rounded-full" style={{width: '82%'}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">Syrups</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-3.5"><div className="bg-[#4A332A] h-3.5 rounded-full" style={{width: '35%'}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">Paper</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-3.5"><div className="bg-[#4A332A] h-3.5 rounded-full" style={{width: '60%'}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">Pastry</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-3.5"><div className="bg-[#4A332A] h-3.5 rounded-full" style={{width: '20%'}}></div></div>
                </div>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-4 text-center">
                <div><p className="text-[10px] text-gray-400">Beans</p><p className="font-bold text-gray-900">45%</p></div>
                <div><p className="text-[10px] text-gray-400">Dairy</p><p className="font-bold text-gray-900">82%</p></div>
                <div><p className="text-[10px] text-gray-400">Syrup</p><p className="font-bold text-gray-900">35%</p></div>
              </div>
            </div>

            {/* Inventory Trends */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative">
              <h3 className="font-bold text-gray-900 mb-1">Inventory Trends</h3>
              <p className="text-xs text-gray-500 mb-6">Total monthly inventory valuation</p>
              
              <div className="h-40 w-full relative mb-4">
                 {/* Dotted lines */}
                 <div className="absolute inset-0 flex flex-col justify-between py-2">
                  <div className="border-b border-dashed border-gray-200 w-full h-0"></div>
                  <div className="border-b border-dashed border-gray-200 w-full h-0"></div>
                  <div className="border-b border-dashed border-gray-200 w-full h-0"></div>
                  <div className="border-b border-gray-300 w-full h-0"></div>
                </div>
                {/* Line Chart SVG */}
                <svg className="absolute inset-0 w-full h-full pb-4" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <path d="M0,80 L20,60 L40,75 L60,30 L80,55 L100,10" fill="none" stroke="#4A332A" strokeWidth="2.5" />
                  <circle cx="0" cy="80" r="3" fill="#4A332A" />
                  <circle cx="20" cy="60" r="3" fill="#4A332A" />
                  <circle cx="40" cy="75" r="3" fill="#4A332A" />
                  <circle cx="60" cy="30" r="3" fill="#4A332A" />
                  <circle cx="80" cy="55" r="3" fill="#4A332A" />
                  <circle cx="100" cy="10" r="3" fill="#4A332A" />
                </svg>
                {/* X-Axis labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-gray-400">
                  <span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                </div>
              </div>
              
              <div className="bg-[#FAF8F5] p-3 rounded-lg flex items-center gap-3">
                <div className="bg-[#4A332A] p-1.5 rounded text-white">
                   <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">Healthy Growth</p>
                  <p className="text-[10px] text-gray-500">Inventory value up 18% since Q1</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="font-bold text-gray-900 mb-1">Recent Activity</h3>
              <p className="text-xs text-gray-500 mb-6">Live operational logs</p>
              
              <div className="flex-1 relative">
                {/* Vertical Line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-gray-100"></div>
                
                <div className="space-y-5 relative z-10">
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center bg-white"><PlusCircle className="w-3 h-3 text-gray-600" /></div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Stock Added <span className="font-normal text-[10px] text-gray-400 ml-1">08:15 AM</span></p>
                      <p className="text-xs text-gray-600">20kg Brazilian Santos</p>
                      <p className="text-[10px] text-gray-400 italic">— Marco B.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-red-50 border-2 border-red-100 flex items-center justify-center bg-white"><Trash2 className="w-3 h-3 text-red-400" /></div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Waste Logged <span className="font-normal text-[10px] text-gray-400 ml-1">10:30 AM</span></p>
                      <p className="text-xs text-gray-600">450ml Whole Milk (Exp.)</p>
                      <p className="text-[10px] text-gray-400 italic">— Sarah K.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center bg-white"><ShoppingCart className="w-3 h-3 text-gray-600" /></div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Order Placed <span className="font-normal text-[10px] text-gray-400 ml-1">11:45 AM</span></p>
                      <p className="text-xs text-gray-600">Weekly Dairy Supply</p>
                      <p className="text-[10px] text-gray-400 italic">— System</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center bg-white"><RefreshCw className="w-3 h-3 text-gray-600" /></div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Stock Update <span className="font-normal text-[10px] text-gray-400 ml-1">02:20 PM</span></p>
                      <p className="text-xs text-gray-600">Pastry inventory sync</p>
                      <p className="text-[10px] text-gray-400 italic">— InventoryBot</p>
                    </div>
                  </div>
                </div>
              </div>
              <button className="mt-4 text-[10px] font-semibold text-gray-500 hover:text-gray-800 text-center w-full">Load Older Logs</button>
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
      </main>
    </div>
  );
}