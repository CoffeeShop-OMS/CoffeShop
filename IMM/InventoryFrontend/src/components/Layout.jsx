import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout({ children, setIsAuthenticated }) {
  const [collapsed, setCollapsed] = useState(false); // Default to full width on desktop
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // New state for mobile

  return (
    <div className="flex h-screen bg-[#FBFBFA] font-sans overflow-hidden w-screen relative">
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      <Sidebar 
        setIsAuthenticated={setIsAuthenticated} 
        collapsed={collapsed} 
        setCollapsed={setCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden w-full transition-all duration-300">
        <Navbar 
          collapsed={collapsed} 
          setIsMobileMenuOpen={setIsMobileMenuOpen} 
        />
        <div className="flex-1 overflow-y-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}