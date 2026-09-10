import type { LiHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function PortalListRow({
  className,
  ...props
}: LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn("portal-list-row", className)} {...props} />;
}
