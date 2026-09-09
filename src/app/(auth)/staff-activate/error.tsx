"use client";

import { AuthErrorState } from "@/components/auth/auth-error-state";

export default function StaffActivationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return <AuthErrorState kind="staff" reset={reset} />;
}
