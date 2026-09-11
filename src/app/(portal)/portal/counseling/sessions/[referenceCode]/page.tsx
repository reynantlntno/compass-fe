import { PortalCounselingSessionWorkspace } from "@/components/portal/portal-counseling-session-workspace";

export const dynamic = "force-dynamic";

export default async function CounselingSessionPage({
  params,
}: {
  params: Promise<{ referenceCode: string }>;
}) {
  const { referenceCode } = await params;

  return <PortalCounselingSessionWorkspace referenceCode={referenceCode} />;
}
