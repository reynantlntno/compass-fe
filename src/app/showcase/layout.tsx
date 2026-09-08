import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function ShowcaseLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const environment = process.env.COMPASS_ENVIRONMENT?.trim().toLowerCase();
  const enabled =
    process.env.NODE_ENV === "development" ||
    (process.env.NODE_ENV === "production" &&
      (environment === "staging" || environment === "stage") &&
      process.env.COMPASS_COMPONENT_SHOWCASE_ENABLED === "true");

  if (!enabled) {
    notFound();
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
