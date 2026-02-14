import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/ui/Navigation';

export const metadata: Metadata = {
  title: "Betsy's Commission Tracker",
  description: 'Track commissions across factory partners',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
