import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Header from "../modules/landing/header"
import { ThemeProvider } from "../modules/shared/theme-provider"

const inter = Inter({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
})

export const metadata: Metadata = {
  title: "OpenBots",
  description:
    " AI coworkers built to get things done. They access your apps, operate your tools like a human teammate, and deliver finished results.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.className} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <Header />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
