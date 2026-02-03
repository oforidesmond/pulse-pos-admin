import { LayoutDashboard, Package, TrendingUp, Warehouse, Settings, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  id: 'dashboard' | 'products' | 'sales' | 'inventory' | 'reports' | 'settings';
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', href: '/products', icon: Package },
  { id: 'sales', label: 'Sales Reports', href: '/sales', icon: TrendingUp },
  { id: 'reports', label: 'Detailed Reports', href: '/reports', icon: ClipboardList },
  { id: 'inventory', label: 'Inventory', href: '/inventory', icon: Warehouse },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];
