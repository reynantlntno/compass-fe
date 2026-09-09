"use client";

import { AuthErrorState } from "@/components/auth/auth-error-state";

export default function StudentActivationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return <AuthErrorState kind="student" reset={reset} />;
}
