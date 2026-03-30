import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { 
  LayoutDashboard, 
  Users, 
  HandCoins, 
  CalendarCheck, 
  Wallet, 
  FileText,
  Calendar,
  LogOut, 
  Menu, 
  X,
  Church
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Members', href: '/members', icon: Users },
    { name: 'Staff', href: '/staff', icon: Users },
    { name: 'Tithes', href: '/tithes', icon: HandCoins },
    { name: 'Attendance', href: '/attendance', icon: CalendarCheck },
    { name: 'Finances', href: '/finances', icon: Wallet },
    { name: 'Events', href: '/events', icon: Calendar },
    { name: 'Reports', href: '/reports', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-green-800 border-r border-neutral-200 sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3 border-b border-green-700">
          <div className="bg-white p-2 rounded-lg text-green-800">
            <Church size={24} />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-white truncate">Greater Works</h1>
            <p className="text-xs text-green-200">City Church, Ghana</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-green-700 text-white font-semibold shadow-sm" 
                    : "text-green-100 hover:bg-green-700 hover:text-white"
                )}
              >
                <item.icon size={20} className={cn(isActive ? "text-white" : "text-green-300 group-hover:text-white")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-green-700">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
              {user?.display_name?.[0] || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{user?.display_name}</p>
              <p className="text-xs text-green-200 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-green-700 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-neutral-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-primary-600 p-1.5 rounded-lg text-white">
            <Church size={20} />
          </div>
          <span className="font-bold text-neutral-900">Greater Works</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-neutral-600"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white pt-20 px-4">
          <nav className="space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-4 rounded-xl text-lg",
                    isActive 
                      ? "bg-primary-50 text-primary-600 font-semibold" 
                      : "text-neutral-600"
                  )}
                >
                  <item.icon size={24} />
                  {item.name}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-4 py-4 text-red-600 text-lg"
            >
              <LogOut size={24} />
              Logout
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
