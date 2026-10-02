import { DashboardShell } from "@/components/dashboard-shell";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <DashboardShell>{children}</DashboardShell>
      </QueryProvider>
    </ThemeProvider>
  );
}
