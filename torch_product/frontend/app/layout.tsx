import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { PostHogPageView } from '@/components/analytics/PostHogPageView';
import { PostHogProvider } from '@/components/analytics/PostHogProvider';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500'],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://torch.lemnisca.bio';
const title = 'Torch · Fermentation Scale-Up Risk Predictor · Lemnisca';
const description =
  'Predict scale-up risk across oxygen, mixing, shear, CO2, and heat. Find the bottleneck before pilot.';
const previewImage = '/preview.png';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s · Torch',
  },
  description,
  applicationName: 'Torch',
  keywords: [
    'fermentation scale-up',
    'bioprocess scale-up',
    'bioreactor scale-up',
    'oxygen transfer',
    'mixing risk',
    'industrial biotech',
    'MOSCH report',
    'Lemnisca',
    'Torch',
  ],
  authors: [{ name: 'Lemnisca' }],
  creator: 'Lemnisca',
  publisher: 'Lemnisca',
  formatDetection: { telephone: false, address: false, email: false },
  alternates: { canonical: siteUrl },
  openGraph: {
    type: 'website',
    siteName: 'Lemnisca',
    title,
    description,
    url: siteUrl,
    images: [{ url: previewImage, width: 1200, height: 630, alt: 'Torch by Lemnisca' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [previewImage],
  },
  robots: { index: true, follow: true },
};

const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Torch',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: siteUrl,
  image: `${siteUrl}${previewImage}`,
  publisher: {
    '@type': 'Organization',
    name: 'Lemnisca',
    url: 'https://lemnisca.bio',
  },
  description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  var theme = localStorage.getItem('torch-theme');
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
} catch (_) {}
            `.trim(),
          }}
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
        />
        <PostHogProvider>
          <PostHogPageView />
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
