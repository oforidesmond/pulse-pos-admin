import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/layout/app-shell';
import { getBrandConfig } from '@/lib/brand';

const brand = getBrandConfig();

export const metadata: Metadata = {
  title: brand.metaTitle,
  description: brand.metaDescription,
  icons: {
    icon: brand.iconPath,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
