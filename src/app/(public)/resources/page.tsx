import type { Metadata } from "next";

import { PublicContentIndex } from "@/components/public/public-content-pages";
import { getPublicContentIndex, parsePublicPage } from "@/lib/public-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resources",
  description: "Practical reading and trusted links from the office.",
};

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const query = await searchParams;
  const page = parsePublicPage(query.page);
  const data = await getPublicContentIndex("resources", page);

  return <PublicContentIndex data={data} kind="resources" />;
}
