import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10 sm:py-12">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] text-primary">
              COMPASS
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              UCN Guidance and Counseling Office
            </p>
          </div>
          <Badge variant="outline">Portal in preparation</Badge>
        </header>

        <section className="grid flex-1 items-center gap-12 py-20 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:gap-20">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
              For UCN students and staff
            </p>
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
              Support should be easier to find.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              COMPASS is the new web portal for the UCN Guidance and Counseling
              Office. We are building a simpler way to find support, request an
              appointment, and understand what comes next.
            </p>
          </div>

          <aside className="border-l-2 border-primary/30 pl-6 lg:pl-8">
            <p className="text-sm font-semibold text-foreground">What we are preparing</p>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />Guidance services and wellbeing resources</li>
              <li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />Appointment requests and updates</li>
              <li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />Private access for students and staff</li>
            </ul>
          </aside>
        </section>

        <Separator />

        <footer className="flex flex-col gap-1 pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>University of Camarines Norte</span>
          <span>Guidance and Counseling Office</span>
        </footer>
      </div>
    </main>
  );
}
