import { Search, Bell, Menu } from 'lucide-react';

export default function Navbar({ collapsed, setMobileOpen }) {
  return (
    <header className="h-16 bg-[#FBFBFA] border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shrink-0 transition-all duration-300">
      <div className="flex items-center gap-3">
        <button
          aria-label="Open menu"
          className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
          onClick={() => setMobileOpen && setMobileOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative w-full md:w-96">
        </div>
      </div>
      <div className="flex items-center gap-6">
        <button className="relative text-gray-500 hover:text-gray-700">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
          <div className="hidden md:block text-right">
            <p className="text-sm font-bold text-gray-800">Admin User</p>
            <p className="text-xs text-gray-500">Store Manager</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-300 border border-gray-400 overflow-hidden" title="Admin User" aria-label="Admin User">
            <img src="https://ui-avatars.com/api/?name=Admin+User&background=3D261D&color=fff" alt="Admin User avatar" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </header>
  );
}