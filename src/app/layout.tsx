import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";

// Self-hosted (not next/font/google): the production build host has
// unreliable outbound access to fonts.googleapis.com, which makes
// next/font/google fail the Docker build intermittently (see git log for
// this file). These .ttf files are the original, full-glyph-coverage
// sources from github.com/google/fonts/tree/main/ofl — same families,
// same weights, no network needed at build time.
const beVietnamPro = localFont({
  src: [
    { path: "../fonts/be-vietnam-pro/BeVietnamPro-Light.ttf", weight: "300", style: "normal" },
    { path: "../fonts/be-vietnam-pro/BeVietnamPro-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/be-vietnam-pro/BeVietnamPro-Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/be-vietnam-pro/BeVietnamPro-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/be-vietnam-pro/BeVietnamPro-Bold.ttf", weight: "700", style: "normal" },
    { path: "../fonts/be-vietnam-pro/BeVietnamPro-ExtraBold.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const cormorantGaramond = localFont({
  src: [
    { path: "../fonts/cormorant-garamond/CormorantGaramond[wght].ttf", weight: "400 600", style: "normal" },
    { path: "../fonts/cormorant-garamond/CormorantGaramond-Italic[wght].ttf", weight: "400 600", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "../fonts/jetbrains-mono/JetBrainsMono[wght].ttf",
  weight: "400 500",
  style: "normal",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Right Home — Quản lý CHDV & VP",
  description: "Phần mềm quản lý căn hộ dịch vụ và văn phòng",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "The Right Home" },
};

export const viewport: Viewport = {
  themeColor: "#c96442",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${beVietnamPro.variable} ${cormorantGaramond.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
        <Toaster position="top-center" richColors closeButton />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
