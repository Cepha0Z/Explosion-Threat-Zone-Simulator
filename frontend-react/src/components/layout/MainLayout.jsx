import { useAuth } from '../../context/AuthContext';
import { LogOut, Shield, Radio, Newspaper, Settings, Map } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';

export default function MainLayout() {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/', label: 'Live Alerts', icon: Map },
    { to: '/news', label: 'News Feed', icon: Newspaper },
    { to: '/simulator', label: 'Simulator', icon: Radio },
  ];

  if (user?.role === 'admin') {
    navItems.push({ to: '/admin', label: 'Admin Panel', icon: Settings });
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Top Bar */}
      <header className="bg-gray-800 border-b border-gray-700 h-16 flex items-center justify-between px-6 shadow-md z-10">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-red-500" />
          <span className="text-xl font-bold tracking-wide">TMZ 2.0</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-sm text-gray-400">
            Logged in as <span className="text-white font-medium">{user?.email}</span>
            {user?.role === 'admin' && (
              <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30">ADMIN</span>
            )}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-gray-800/50 border-r border-gray-700 flex flex-col">
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          
          <div className="p-4 border-t border-gray-700">
            <div className="text-xs text-gray-500 text-center">
              TMZ System v2.0.1 (React)
            </div>
          </div>
        </aside>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gray-900 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
