'use client';

import { useEffect, useState } from 'react';
import { Bell, Search, LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TopBar() {
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
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <span className="text-gray-600 text-sm whitespace-nowrap">
          {currentDate || 'Loading date…'}
        </span>

        <button className="relative p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" aria-label="Notifications">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full" />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={20} className="text-blue-600" />
          </div>
          <div>
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
