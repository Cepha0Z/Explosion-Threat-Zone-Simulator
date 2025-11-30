import { useAuth } from '../../context/AuthContext';
import { LogOut, Map, Newspaper, Radio, Settings } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';

import SystemStatusBar from './SystemStatusBar';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: '/', label: 'Alerts', icon: Map },
    { to: '/news', label: 'News', icon: Newspaper },
    { to: '/simulator', label: 'Sim', icon: Radio },
  ];

  if (user?.role === 'admin') {
    navItems.push({ to: '/admin', label: 'Admin', icon: Settings });
  }

  // Determine if current page should show map on right
  const showsMap = location.pathname === '/' || location.pathname === '/simulator';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* System Status Bar - very top */}
      <SystemStatusBar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* LEFT SIDEBAR - Control Panel */}
        <aside className="w-full md:w-[380px] bg-white border-r border-slate-300 flex flex-col shadow-sm">
          
          {/* Header */}
          <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-wide">TMZ 2.0</h1>
              <p className="text-xs text-slate-500 uppercase tracking-[0.18em] mt-0.5">
                Threat Intelligence Platform
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </header>

          {/* Tab Navigation */}
          <nav className="px-4 pt-3 pb-2 border-b border-slate-200 flex gap-2 text-sm font-medium">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex-1 px-3 py-2.5 rounded-lg text-xs md:text-sm flex items-center justify-center gap-1.5 transition-all font-semibold',
                    isActive
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  )
                }
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Left Panel Content - rendered by each page */}
          <section className="flex-1 overflow-hidden">
            <Outlet context={{ renderLocation: 'leftPanel' }} />
          </section>

        </aside>

        {/* RIGHT CONTENT AREA - Map or Empty */}
        <main className={clsx(
          "flex-1 relative",
          showsMap ? "bg-slate-100" : "bg-slate-50"
        )}>
          {showsMap ? (
            <Outlet context={{ renderLocation: 'rightPanel' }} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-base">Content area</p>
                <p className="text-sm mt-1">Map displays on Alerts and Simulator tabs</p>
              </div>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
