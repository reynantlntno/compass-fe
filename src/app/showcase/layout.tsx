import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function ShowcaseLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const enabled =
    process.env.NODE_ENV === "development" ||
    process.env.COMPASS_COMPONENT_SHOWCASE_ENABLED === "true";

  if (!enabled) {
    notFound();
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
