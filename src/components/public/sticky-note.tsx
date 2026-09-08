import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StickyNote({
  children,
  className,
  rotation = "none",
  showTape = false,
  tone = "butter",
}: {
  children: ReactNode;
  className?: string;
  rotation?: "left" | "none" | "right";
  showTape?: boolean;
  tone?: "butter" | "rose" | "sage";
}) {
  return (
    <article
      className={cn("homepage-sticky-note", className)}
      data-rotation={rotation}
      data-tone={tone}
    >
      {showTape ? (
        <span className="homepage-sticky-note__tape" aria-hidden="true" />
      ) : null}
      {children}
    </article>
  );
}
