import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "AISD Educational Suitability Assessment",
  description:
    "Field survey tool for Austin ISD Educational Suitability Assessment scores and campus documentation",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AISD Survey",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2563eb",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased safe-top safe-bottom">{children}</body>
    </html>
  )
}
