'use client';

import { ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './sidebar';
import TopBar from './top-bar';

const PUBLIC_PATHS = ['/', '/login', '/reset-password'];

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_PATHS.includes(pathname ?? '/');
  const [isCheckingAuth, setIsCheckingAuth] = useState(!isPublicRoute);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    if (isPublicRoute) {
      setIsCheckingAuth(false);
      return;
    }

    setIsCheckingAuth(true);

    const hasToken = typeof window !== 'undefined' ? Boolean(localStorage.getItem('authToken')) : false;

    if (!hasToken) {
      setIsAuthenticated(false);
      router.replace('/login');
    } else {
      setIsAuthenticated(true);
    }

    setIsCheckingAuth(false);
  }, [isPublicRoute, router]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  // Handle browser/tab close
  useEffect(() => {
    if (isPublicRoute || typeof window === 'undefined') return;

    const handleBeforeUnload = () => {
      // Clear auth token from localStorage when the page is being unloaded
      localStorage.removeItem('authToken');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup the event listener when the component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isPublicRoute]);

  let content: ReactNode;

  if (isPublicRoute) {
    content = children;
  } else if (isCheckingAuth) {
    content = (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-sm">Checking authentication…</p>
      </div>
    );
  } else if (!isAuthenticated) {
    content = (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-sm">Redirecting to login…</p>
      </div>
    );
  } else {
    content = (
      <div className="flex min-h-dvh bg-gray-50">
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <div className="md:hidden">
          <Sidebar isMobileOpen={isMobileNavOpen} onMobileClose={() => setIsMobileNavOpen(false)} />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMobileMenuClick={() => setIsMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
        </div>
      </div>
    );
  }

  return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
}
