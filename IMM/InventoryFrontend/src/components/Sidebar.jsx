import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Truck, BarChart2, Settings, LogOut, ChevronRight } from 'lucide-react';
import { clearAuthSession } from '../utils/authStorage';
import { useState } from 'react';
import ConfirmModal from './ConfirmModal';

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/suppliers', icon: Truck, label: 'Suppliers' },
    { to: '/reports', icon: BarChart2, label: 'Reports' },
];

export default function Sidebar({ setIsAuthenticated, collapsed, setCollapsed }) {
    const navigate = useNavigate();
    const location = useLocation();

    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const doLogout = () => {
        clearAuthSession();
        setIsAuthenticated(false);
        navigate('/login');
    };

    return (
        <aside className={`hidden md:flex flex-col justify-between shrink-0 bg-white border-r border-gray-100 transition-all duration-300 overflow-visible relative ${collapsed ? 'w-15' : 'w-60'}`}>

            {/* Toggle Button - pure arrow, no background */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-6 top-5.5 z-50 text-gray-500 hover:text-[#27160f] transition-colors duration-200 focus:outline-none"
                style={{ background: 'none', border: 'none', padding: 0 }}
            >
                <ChevronRight className={`w-5 h-5 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`} />
            </button>

            <div>
                {/* Brand */}
                <div className="h-16 flex items-center px-3 gap-2 border-b border-gray-100 overflow-hidden">
                    <div className="shrink-0 p-1.5 rounded-lg">
                        <img src="/Logo.png" alt="Coffee & Tea" className="w-6 h-6 object-contain" draggable="false"/>
                    </div>
                    {!collapsed && (
                        <span className="flex-1 font-semibold text-[15px] text-[#3D261D] tracking-tight whitespace-nowrap">
                            Coffee & Tea
                        </span>
                    )}
                </div>

                {/* Navigation */}
                <nav className="p-2 space-y-0.5">
                    {navItems.map(({ to, icon: Icon, label }) => {
                        const isActive = location.pathname === to;
                        return (
                            <Link
                                key={to}
                                to={to}
                                title={collapsed ? label : undefined}
                                style={{ color: isActive ? '#ffffff' : undefined }}
                                className={`group flex items-center rounded-lg text-[13.5px] font-medium no-underline transition-all duration-200 ${
                                    collapsed ? 'justify-center p-2.5' : 'gap-3 px-2.5 py-2.5'
                                } ${
                                    isActive
                                        ? 'bg-[#3D261D] text-white shadow-sm'
                                        : 'text-gray-500 hover:bg-[#3D261D]/10 hover:text-[#3D261D] hover:shadow-sm'
                                }`}
                            >
                                <Icon
                                    className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110"
                                    style={{ color: isActive ? '#fbbf24' : undefined }}
                                />
                                {!collapsed && (
                                    <span style={{ color: isActive ? '#ffffff' : undefined }} className="whitespace-nowrap">
                                        {label}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom Actions */}
            <div className="p-2 space-y-0.5 border-t border-gray-100">
                <Link
                    to="/settings"
                    title={collapsed ? 'Settings' : undefined}
                    className={`group flex items-center rounded-lg text-[13.5px] font-medium no-underline text-gray-500 hover:bg-[#3D261D]/10 hover:text-[#3D261D] transition-all duration-200 ${
                        collapsed ? 'justify-center p-2.5' : 'gap-3 px-2.5 py-2.5'
                    }`}
                >
                    <Settings className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:rotate-45 group-hover:text-[#3D261D]" />
                    {!collapsed && <span className="whitespace-nowrap">Settings</span>}
                </Link>

                <button
                    onClick={(e) => { e.preventDefault(); setShowLogoutModal(true); }}
                    title={collapsed ? 'Logout' : undefined}
                    className={`group w-full flex items-center rounded-lg text-[13.5px] font-medium text-red-400 hover:text-red-600 transition-all duration-200 ${
                        collapsed ? 'justify-center p-2.5' : 'gap-3 px-2.5 py-2.5'
                    }`}
                >
                    <LogOut className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-red-600" />
                    {!collapsed && <span className="whitespace-nowrap">Logout</span>}
                </button>
                <ConfirmModal
                    open={showLogoutModal}
                    title="Confirm logout"
                    message="Are you sure you want to log out?"
                    onConfirm={() => { setShowLogoutModal(false); doLogout(); }}
                    onCancel={() => setShowLogoutModal(false)}
                />
            </div>
        </aside>
    );
}
