import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import "@openbots/ui/globals.css";
import "@openbots/ui/styles/typeset.css";
import { cn } from "@openbots/ui/lib/utils";
import { ThemeProvider } from "@/providers/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "OpenBots — Autonomous Agent Workspace",
    template: "%s | OpenBots",
  },
  description:
    "Autonomous AI agent workspace with multi-tool execution, streaming, and visual artifact rendering.",
  icons: ["/logo.png"],
};

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
