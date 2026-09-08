import { Paperclip } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PaperSheet({
  children,
  className,
  showClip = true,
  tone = "paper",
}: {
  children: ReactNode;
  className?: string;
  showClip?: boolean;
  tone?: "paper" | "plain" | "sage";
}) {
  return (
    <div
      className={cn("homepage-paper-sheet", className)}
      data-tone={tone}
    >
      {showClip ? (
        <Paperclip
          aria-hidden="true"
          className="homepage-paper-sheet__clip"
        />
      ) : null}
      {children}
    </div>
  );
}
