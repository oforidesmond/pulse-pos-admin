import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: 'Sika Ventures Admin',
  description: 'Admin dashboard experience for Sika Ventures.',
  icons: {
    icon: '/pos-icon.ico',
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
