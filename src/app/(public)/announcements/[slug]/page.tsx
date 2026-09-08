import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  PublicContentDetail,
  PublicContentDetailUnavailable,
} from "@/components/public/public-content-pages";
import {
  getPublicContentDetail,
  isSafePublicSlug,
} from "@/lib/public-content";

export const dynamic = "force-dynamic";

type AnnouncementDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: AnnouncementDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isSafePublicSlug(slug)) return { title: "Announcement" };

  const result = await getPublicContentDetail("announcements", slug);
  if (result.state !== "ready") return { title: "Announcement" };

  return {
    title: result.data.title || "Announcement",
    description: result.data.summary || "A public announcement from the office.",
  };
}

export default async function AnnouncementDetailPage({
  params,
}: AnnouncementDetailPageProps) {
  const { slug } = await params;
  if (!isSafePublicSlug(slug)) notFound();

  const result = await getPublicContentDetail("announcements", slug);
  if (result.state === "not_found") notFound();
  if (result.state === "unavailable") {
    return <PublicContentDetailUnavailable kind="announcements" />;
  }

  return <PublicContentDetail content={result.data} kind="announcements" />;
}
