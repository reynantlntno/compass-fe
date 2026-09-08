import type { Metadata } from "next";

import { PublicContentIndex } from "@/components/public/public-content-pages";
import { getPublicContentIndex, parsePublicPage } from "@/lib/public-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Announcements",
  description: "Updates and reminders from the office.",
};

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const query = await searchParams;
  const page = parsePublicPage(query.page);
  const data = await getPublicContentIndex("announcements", page);

  return <PublicContentIndex data={data} kind="announcements" />;
}
