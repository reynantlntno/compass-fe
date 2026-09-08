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

type ResourceDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ResourceDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isSafePublicSlug(slug)) return { title: "Resource" };

  const result = await getPublicContentDetail("resources", slug);
  if (result.state !== "ready") return { title: "Resource" };

  return {
    title: result.data.title || "Resource",
    description: result.data.summary || "A public resource from the office.",
  };
}

export default async function ResourceDetailPage({
  params,
}: ResourceDetailPageProps) {
  const { slug } = await params;
  if (!isSafePublicSlug(slug)) notFound();

  const result = await getPublicContentDetail("resources", slug);
  if (result.state === "not_found") notFound();
  if (result.state === "unavailable") {
    return <PublicContentDetailUnavailable kind="resources" />;
  }

  return <PublicContentDetail content={result.data} kind="resources" />;
}
