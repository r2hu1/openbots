import Dither from "@openbots/ui/components/ui/Dither";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  });
  if (data.data?.session) return redirect("/");
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-4">
      {children}
      <div className="absolute inset-0 -z-10 opacity-40 grayscale">
        <Dither
          waveColor={[0.38823529411764707, 0.4, 0.9450980392156862]}
          disableAnimation={false}
          enableMouseInteraction={false}
          mouseRadius={1}
          colorNum={4}
          pixelSize={2}
          waveAmplitude={0.3}
          waveFrequency={3}
          waveSpeed={0.05}
        />
      </div>
    </div>
  );
}
