"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import type { PublicServiceCopy } from "@/lib/public-site-copy";

export function PublicServiceGuide({
  services,
}: {
  services: ReadonlyArray<PublicServiceCopy>;
}) {
  return (
    <Accordion
      className="public-service-guide__accordion"
      defaultValue={[services[0]?.key ?? ""]}
      multiple={false}
    >
      {services.map((service, index) => (
        <AccordionItem
          className="public-service-guide__item"
          id={`service-${service.key}`}
          key={service.key}
          value={service.key}
        >
          <AccordionTrigger className="public-service-guide__trigger">
            <span className="public-service-guide__trigger-copy">
              <span aria-hidden="true" className="public-service-guide__number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="public-service-guide__trigger-text">
                <span className="public-service-guide__title">{service.title}</span>
                <span className="public-service-guide__summary">
                  {service.description}
                </span>
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="public-service-guide__content">
            <div className="public-service-guide__overview">
              <p>{service.summary}</p>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function PublicServiceGuideError({ reset }: { reset: () => void }) {
  return (
    <section className="public-section public-content-page public-content-page--state">
      <div className="public-shell public-reading-width">
        <div className="public-content-state" role="alert">
          <h1>We can’t show this right now</h1>
          <p>Try again, or come back later.</p>
          <Button type="button" variant="outline" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    </section>
  );
}

export function PublicServiceGuideLoading() {
  return (
    <section
      aria-busy="true"
      className="public-section public-content-page public-content-loading"
    >
      <div className="public-shell public-reading-width">
        <div className="public-content-loading__status" role="status" aria-live="polite">
          <Spinner aria-hidden="true" className="size-4" />
          <span>Loading services…</span>
        </div>
        <div aria-hidden="true" className="public-content-skeleton__body">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="public-content-skeleton__line" key={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
