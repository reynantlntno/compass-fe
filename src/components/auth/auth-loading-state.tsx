import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function AuthLoadingState({ label = "Loading this form…" }: { label?: string }) {
  return (
    <div aria-busy="true" className="auth-loading" role="status" aria-live="polite">
      <div className="auth-loading__status">
        <Spinner aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div aria-hidden="true" className="auth-loading__fields">
        <Skeleton className="auth-loading__label" />
        <Skeleton className="auth-loading__input" />
        <Skeleton className="auth-loading__label" />
        <Skeleton className="auth-loading__input" />
        <Skeleton className="auth-loading__action" />
      </div>
    </div>
  );
}
