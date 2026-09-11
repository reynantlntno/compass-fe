"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { useAuthSession } from "@/components/auth/auth-session-provider";

export function HomepageAccountAction() {
  const { status } = useAuthSession();
  const isAuthenticated = status === "authenticated";

  return (
    <Link
      className="homepage-primary-action"
      href={isAuthenticated ? "/portal" : "/login"}
    >
      {isAuthenticated ? "Open COMPASS" : "Sign in to COMPASS"}
      <ArrowUpRight aria-hidden="true" />
    </Link>
  );
}
