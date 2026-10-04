import { cookies } from "next/headers";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QueryProvider } from "@/providers/query-provider";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <QueryProvider>
      <DashboardShell defaultOpen={defaultOpen}>{children}</DashboardShell>
    </QueryProvider>
  );
}
