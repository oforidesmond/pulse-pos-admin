'use client';

import { useEffect, useState } from 'react';
import { Bell, Search, LogOut, User, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';

type TopBarProps = {
  onMobileMenuClick?: () => void;
};

export default function TopBar({ onMobileMenuClick }: TopBarProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());

    setCurrentDate(formattedDate);
  }, []);

  const handleLogout = () => {
    // Clear authentication data from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    }
    // Redirect to login page
    router.push('/login');
    router.refresh(); // Ensure the app re-renders with the new auth state
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 md:px-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {onMobileMenuClick && (
          <button
            type="button"
            onClick={onMobileMenuClick}
            className="md:hidden p-2 rounded-lg hover:bg-gray-50 text-gray-700"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
        )}

        <div className="relative max-w-md w-full hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <span className="hidden lg:inline text-gray-600 text-sm whitespace-nowrap">
          {currentDate || 'Loading date…'}
        </span>

        <button className="relative p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" aria-label="Notifications">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full" />
        </button>

        <div className="flex items-center gap-2 md:gap-3 md:pl-4 md:border-l md:border-gray-200">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={20} className="text-blue-600" />
          </div>
          <div className="hidden md:block">
            <p className="text-gray-900 text-sm">Admin User</p>
            <p className="text-gray-500 text-xs">Administrator</p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-2 p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
