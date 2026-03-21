import { Coffee, Download, Plus } from 'lucide-react';

export default function InventoryHeader({ onAddClick, btnBrown, onExportCSV }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 lg:mb-8">
      <div className="flex items-center gap-3">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold text-[#1C100A] tracking-tight"
            style={{ fontFamily: "serif" }}
          >
            Inventory Management
          </h1>
          <p className="text-xs text-[#9E8A7A] mt-0.5 hidden sm:block">Monitor and manage your coffee shop supplies</p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onExportCSV} className="flex items-center gap-1.5 bg-white text-[#3D261D] px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-[#E2DDD8] hover:bg-[#FAF6F2] hover:border-[#C4A882] transition-all duration-150 shadow-sm">
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </button>
        <button
          onClick={onAddClick}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm shadow-md ${btnBrown}`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add New Item</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>
    </div>
  );
}
