import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MatchingCV AI',
  description: 'Application française de génération de CV adaptés aux offres.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
