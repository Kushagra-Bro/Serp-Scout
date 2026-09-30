import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Serp-Scout — AI Competitive Intelligence & SEO for Small Businesses',
  description: 'Success is measured by real business outcomes rather than a "visibility score."',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      {/* suppressHydrationWarning applies only to the element it's on (it does
          not cascade), so both tags need it. Clerk and browser extensions such
          as Grammarly/Google Translate inject attributes into <html>/<body>
          after SSR but before React hydrates; without this React logs a spurious
          "Extra attributes from the server" warning. Content mismatches inside
          these elements are still reported normally. */}
      <html lang="en" suppressHydrationWarning>
        <body suppressHydrationWarning>{children}</body>
      </html>
    </ClerkProvider>
  );
}
