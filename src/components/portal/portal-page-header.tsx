import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { PortalBreadcrumb } from "@/components/portal/portal-breadcrumb";

type PortalPageHeaderProps = {
  actions?: ReactNode;
  className?: string;
  current: string;
  description?: ReactNode;
  headingId: string;
  meta?: ReactNode;
  title: ReactNode;
};

export function PortalPageHeader({
  actions,
  className,
  current,
  description,
  headingId,
  meta,
  title,
}: PortalPageHeaderProps) {
  return (
    <>
      <PortalBreadcrumb current={current} />
      <header className={cn("portal-page-header", className)}>
        <div className="portal-page-header__heading-row">
          <h1 id={headingId}>{title}</h1>
          {meta ? <div className="portal-page-header__meta">{meta}</div> : null}
          {actions ? (
            <div className="portal-page-header__actions">{actions}</div>
          ) : null}
        </div>
        {description ? <p>{description}</p> : null}
      </header>
    </>
  );
}
