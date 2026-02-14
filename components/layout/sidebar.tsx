'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/navigation';
import { getBrandConfig } from '@/lib/brand';

type SidebarProps = {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const brand = getBrandConfig();

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
        />
      )}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col w-64 shrink-0 ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 z-50 shadow-xl'
            : 'hidden md:flex'
        }`}
      >
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white">{brand.logoText}</span>
          </div>
          <span className="text-gray-900 truncate">{brand.businessName}</span>
        </div>
        {isMobileOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={onMobileClose}
            className="ml-auto md:hidden p-2 rounded-lg hover:bg-gray-50"
          >
            <X size={18} className="text-gray-600" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 overflow-y-auto overscroll-contain">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={isMobileOpen ? onMobileClose : undefined}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <a
          href={brand.supportUrl}
          target={brand.supportUrl.startsWith('http') ? '_blank' : undefined}
          rel={brand.supportUrl.startsWith('http') ? 'noreferrer' : undefined}
          className="block bg-blue-50 rounded-lg p-4"
        >
          <p className="text-blue-900 mb-1">Need Help?</p>
          <p className="text-blue-700 text-sm">Check our documentation</p>
        </a>
      </div>
      </aside>
    </>
  );
}
