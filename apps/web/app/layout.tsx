import { Geist_Mono, Inter } from "next/font/google";

import "@openbots/ui/globals.css";
import "@openbots/ui/styles/typeset.css";
import { cn } from "@openbots/ui/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

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
      <body>{children}</body>
    </html>
  );
}
