import { 
  Download, TrendingUp, Search,
  TrendingDown, Trash2, Layers, Calendar, Filter, ArrowRight,
  ChevronDown, Coffee
} from 'lucide-react';

export default function Reports({ setIsAuthenticated }) {
  
  // Data para sa Detailed Waste Log table
  const wasteLogs = [
    { id: 1, name: 'Ethiopian Yirgacheffe', cat: 'Beans', reason: 'Expired', isExpired: true, cost: '₱85.00', date: '2023-10-24' },
    { id: 2, name: 'Whole Milk', cat: 'Dairy', reason: 'Spilled', isExpired: false, cost: '₱24.00', date: '2023-10-23' },
    { id: 3, name: 'Butter Croissants', cat: 'Pastries', reason: 'Defective', isExpired: false, cost: '₱16.40', date: '2023-10-22' },
    { id: 4, name: 'Oat Milk', cat: 'Dairy', reason: 'Expired', isExpired: true, cost: '₱14.00', date: '2023-10-21' },
    { id: 5, name: 'Paper Cups (12oz)', cat: 'Packaging', reason: 'Damaged', isExpired: false, cost: '₱5.50', date: '2023-10-20' },
  ];

  return (
    <div className="w-full p-8">
          
          {/* Page Header */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-serif mb-1">Inventory Reports</h1>
              <p className="text-gray-500 text-sm">Deep-dive analysis of your stock performance and waste tracking.</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm">
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <button className="flex items-center gap-2 bg-[#3D261D] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2A1A14] transition-colors shadow-sm">
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>

          {/* Top Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Card 1 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-36">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Turnover</p>
                <div className="p-1.5 bg-gray-50 border border-gray-100 rounded-md">
                  <TrendingUp className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold font-serif text-gray-900 mb-3">8.4x</p>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">
                    <TrendingUp className="w-3 h-3" /> +12.5%
                  </span>
                  <span className="text-[11px] text-gray-400">vs. last month</span>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-36">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Waste Rate</p>
                <div className="p-1.5 bg-gray-50 border border-gray-100 rounded-md">
                  <Trash2 className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold font-serif text-gray-900 mb-3">2.8%</p>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                    <TrendingDown className="w-3 h-3" /> -0.5%
                  </span>
                  <span className="text-[11px] text-gray-400">of total inventory</span>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-36">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total COGS</p>
                <div className="p-1.5 bg-gray-50 border border-gray-100 rounded-md">
                  <Layers className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold font-serif text-gray-900 mb-3">₱14,280</p>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">
                    <TrendingUp className="w-3 h-3" /> +3.2%
                  </span>
                  <span className="text-[11px] text-gray-400">Cost of Goods Sold</span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* Graph - Monthly Spending Trends */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 relative">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-gray-900">Monthly Spending Trends</h3>
                  <p className="text-xs text-gray-500">Financial outflow for inventory vs. waste losses</p>
                </div>
                <div className="border border-gray-200 px-3 py-1 text-[11px] font-bold text-gray-600 rounded-full">
                  Live Data
                </div>
              </div>

              {/* Fake SVG Area Chart */}
              <div className="h-56 w-full relative">
                {/* Y-Axis labels */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-gray-400 pb-6">
                  <span>₱6000</span><span>₱4500</span><span>₱3000</span><span>₱1500</span><span>₱0</span>
                </div>
                {/* X-Axis labels */}
                <div className="absolute bottom-0 left-10 right-0 flex justify-between text-[10px] text-gray-400">
                  <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                </div>
                {/* Dotted lines */}
                <div className="absolute left-10 right-0 top-2 bottom-6 flex flex-col justify-between">
                  <div className="border-b border-dashed border-gray-200 w-full h-0"></div>
                  <div className="border-b border-dashed border-gray-200 w-full h-0"></div>
                  <div className="border-b border-dashed border-gray-200 w-full h-0"></div>
                  <div className="border-b border-dashed border-gray-200 w-full h-0"></div>
                  <div className="border-b border-gray-300 w-full h-0"></div>
                </div>
                {/* Area Chart Path */}
                <svg className="absolute left-10 right-0 top-2 bottom-6 w-[calc(100%-2.5rem)] h-[calc(100%-1.5rem)]" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="gradientTrend" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3D261D" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#3D261D" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,45 C15,50 25,50 40,30 C55,30 65,40 80,15 C90,15 100,25 100,25 L100,100 L0,100 Z" fill="url(#gradientTrend)" />
                  <path d="M0,45 C15,50 25,50 40,30 C55,30 65,40 80,15 C90,15 100,25 100,25" fill="none" stroke="#3D261D" strokeWidth="2.5" />
                </svg>
              </div>
              <div className="flex justify-center mt-2">
                <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <div className="w-2 h-2 bg-[#3D261D] rounded-sm"></div> Total Spending
                </span>
              </div>
            </div>

            {/* Report Filters */}
            <div className="bg-[#FAF8F6] p-6 rounded-2xl border border-[#F0EBE6] shadow-sm flex flex-col">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-6">
                <Filter className="w-4 h-4" /> Report Filters
              </h3>
              
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Date Range</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" value="Last 30 Days" readOnly className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-800 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                  <div className="relative">
                    <Layers className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-800 outline-none appearance-none">
                      <option>All Categories</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Supplier</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="All Suppliers" className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-800 outline-none" />
                  </div>
                </div>
              </div>
              
              <button className="w-full bg-[#3D261D] text-white py-3 rounded-lg text-sm font-semibold hover:bg-[#2A1A14] transition-colors mt-6">
                Apply Filters
              </button>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* Detailed Waste Log Table */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-gray-900">Detailed Waste Log</h3>
                  <p className="text-xs text-gray-500">Recent recorded inventory losses and reasons</p>
                </div>
                <button className="text-xs font-semibold text-gray-600 flex items-center gap-1 hover:text-gray-900">
                  View All Log <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-800">
                      <th className="pb-3 w-1/3">Item Name</th>
                      <th className="pb-3 text-center">Category</th>
                      <th className="pb-3">Reason</th>
                      <th className="pb-3 text-right">Cost Loss</th>
                      <th className="pb-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wasteLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-3 font-semibold text-gray-800">{log.name}</td>
                        <td className="py-3 text-center">
                          <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-md font-medium">{log.cat}</span>
                        </td>
                        <td className="py-3 text-gray-600 flex items-center gap-1.5">
                          {log.isExpired && <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>}
                          {log.reason}
                        </td>
                        <td className="py-3 text-right font-bold text-red-500">{log.cost}</td>
                        <td className="py-3 text-right text-xs text-gray-400">{log.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Side - Value by Category & Insights */}
            <div className="flex flex-col gap-6">
              
              {/* Value by Category Donut Chart */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-1">Value by Category</h3>
                <p className="text-[11px] text-gray-500 mb-6">Capital distribution across stock groups</p>
                
                <div className="flex justify-center mb-6">
                  {/* Fake SVG Donut Chart */}
                  <svg viewBox="0 0 36 36" className="w-32 h-32 transform -rotate-90">
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#F3F4F6" strokeWidth="6" />
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#3D261D" strokeWidth="6" strokeDasharray="45 55" strokeDashoffset="0" />
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#1A1A1A" strokeWidth="6" strokeDasharray="25 75" strokeDashoffset="-45" />
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#F0EBE6" strokeWidth="6" strokeDasharray="15 85" strokeDashoffset="-70" />
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#D1D5DB" strokeWidth="6" strokeDasharray="10 90" strokeDashoffset="-85" />
                  </svg>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-gray-900"><div className="w-2 h-2 rounded-full bg-[#3D261D]"></div>Coffee Beans</span><span className="font-bold text-gray-900">45%</span></div>
                  <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-gray-900"><div className="w-2 h-2 rounded-full bg-[#1A1A1A]"></div>Dairy & Milk</span><span className="font-bold text-gray-900">25%</span></div>
                  <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-gray-900"><div className="w-2 h-2 rounded-full bg-[#F0EBE6]"></div>Pastries</span><span className="font-bold text-gray-900">15%</span></div>
                  <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-gray-900"><div className="w-2 h-2 rounded-full bg-[#D1D5DB]"></div>Packaging</span><span className="font-bold text-gray-900">10%</span></div>
                </div>
              </div>

              {/* Efficiency Insight Card */}
              <div className="bg-[#3D261D] p-6 rounded-2xl text-white shadow-sm flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <div className="border border-white/20 p-1 rounded-full"><Coffee className="w-3 h-3 text-white/80" /></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Efficiency Insight</span>
                </div>
                <h4 className="font-serif text-lg leading-snug font-bold mb-4">
                  Your Coffee Beans turnover is 22% faster than average. Consider increasing reorder quantity to save on shipping costs.
                </h4>
                <a href="#" className="text-xs text-white/80 flex items-center gap-1 hover:text-white transition-colors mt-auto">
                  View Logistics Optimization <ArrowRight className="w-3 h-3" />
                </a>
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