import { CompassErrorPage } from "@/components/system/compass-error-page";

export default function NotFound() {
  return (
    <CompassErrorPage
      code="404"
      description="The address may be out of date, or the page may have moved."
      title="That page isn’t here."
    />
  );
}
