import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_JP } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const plex = IBM_Plex_Sans_JP({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: { default: "TextNext — 大学の教科書フリマ", template: "%s | TextNext" },
  description: "大学メールで認証した学生同士で、使わなくなった教科書を学内で安く受け渡しできるフリマです。",
  applicationName: "TextNext",
  appleWebApp: { capable: true, title: "TextNext", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

// Applies the saved theme before first paint (no flash).
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={plex.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
