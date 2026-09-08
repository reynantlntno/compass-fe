import type { ReactNode } from "react";

import { Compass } from "lucide-react";
import Link from "next/link";

const SAFE_ERROR_REFERENCE = /^ERR-[0-9]{4}-[0-9]{6}$/;

export function CompassErrorPage({
  code,
  title,
  description,
  action,
  referenceCode,
}: {
  code: string;
  title: string;
  description: string;
  action?: ReactNode;
  referenceCode?: string | null;
}) {
  const safeReferenceCode =
    referenceCode && SAFE_ERROR_REFERENCE.test(referenceCode) ? referenceCode : null;

  return (
    <main aria-labelledby="compass-system-error-heading" className="compass-system-error">
      <div className="compass-system-error__content">
        <Compass aria-hidden="true" className="compass-system-error__icon" />
        <p className="compass-system-error__code">{code}</p>
        <h1 id="compass-system-error-heading">{title}</h1>
        <p>{description}</p>
        {safeReferenceCode ? (
          <p className="compass-system-error__reference">
            Reference code: <code>{safeReferenceCode}</code>
          </p>
        ) : null}
        <div className="compass-system-error__actions">
          {action}
          <Link className="compass-status-action compass-status-action--quiet" href="/">
            Back to COMPASS
          </Link>
        </div>
      </div>
    </main>
  );
}
