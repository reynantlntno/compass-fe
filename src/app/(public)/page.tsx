import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getPublicBranding } from "@/lib/branding";

export default async function Home() {
  const branding = await getPublicBranding();

  return (
    <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:gap-20">
      <div className="max-w-3xl">
        <Badge variant="outline">Portal in preparation</Badge>
        <p className="mt-6 mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
          For {branding.institutionName} students and staff
        </p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Support should be easier to find.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          {branding.productName} is the new web portal for the {branding.officeName}.
          We are building a simpler way to find support, request an appointment,
          and understand what comes next.
        </p>
      </div>

      <aside className="border-l-2 border-primary/30 pl-6 lg:pl-8">
        <p className="text-sm font-semibold text-foreground">What we are preparing</p>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            Guidance services and wellbeing resources
          </li>
          <li className="flex gap-3">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            Appointment requests and updates
          </li>
          <li className="flex gap-3">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            Private access for students and staff
          </li>
        </ul>
      </aside>
    </section>
  );
}
