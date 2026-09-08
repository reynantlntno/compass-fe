import Link from "next/link";

import { ExternalLink } from "@/components/public/external-link";

export function isExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function PublicLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const content = <span>{label}</span>;

  return isExternalUrl(href) ? (
    <ExternalLink href={href}>{content}</ExternalLink>
  ) : (
    <Link href={href}>{content}</Link>
  );
}
