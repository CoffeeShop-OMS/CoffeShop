import { Search, Bell, Menu } from 'lucide-react';

export default function Navbar({ collapsed, setIsMobileMenuOpen }) {
  return (
    <header className="h-16 bg-[#FBFBFA] border-b border-gray-200 flex items-center justify-between px-4 md:px-8 flex-shrink-0 transition-all duration-300 w-full">
      
      {/* Left Side: Hamburger & Search */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        {/* Hamburger Menu Button (Mobile Only) */}
        <button 
          className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Search Bar */}
        <div className="relative flex-1 md:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search globally..." 
            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#3D261D] transition-shadow"
          />
        </div>
      </div>

      {/* Right Side: Profile & Notifications */}
      <div className="flex items-center gap-4 md:gap-6 ml-4">
        <button className="relative text-gray-500 hover:text-gray-700 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#FBFBFA]"></span>
        </button>
        
        <div className="flex items-center gap-3 border-l border-gray-200 pl-4 md:pl-6">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-800 leading-tight">Admin User</p>
            <p className="text-[11px] text-gray-500 font-medium">Store Manager</p>
          </div>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-300 border border-gray-200 overflow-hidden flex-shrink-0 shadow-sm">
            <img src="https://ui-avatars.com/api/?name=Admin+User&background=3D261D&color=fff" alt="User Profile" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </header>
  );
}