"use client";

import { useEffect, useState } from "react";

function formatLocalDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    weekday: "long",
    year: "numeric",
  }).format(value);
}

function formatCompactDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  }).format(value);
}

function formatCompactTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function AnalogClock({ now }: { now: Date }) {
  const hourAngle = ((now.getHours() % 12) + now.getMinutes() / 60) * 30;
  const minuteAngle = now.getMinutes() * 6;
  const markers = Array.from({ length: 12 }, (_, index) => index);

  return (
    <div aria-hidden="true" className="portal-clock">
      {markers.map((marker) => (
        <span
          className="portal-clock__marker"
          key={marker}
          style={{ transform: `rotate(${marker * 30}deg)` }}
        />
      ))}
      <span
        className="portal-clock__hand portal-clock__hand--hour"
        style={{ transform: `translateX(-50%) rotate(${hourAngle}deg)` }}
      />
      <span
        className="portal-clock__hand portal-clock__hand--minute"
        style={{ transform: `translateX(-50%) rotate(${minuteAngle}deg)` }}
      />
      <span className="portal-clock__center" />
    </div>
  );
}

export function PortalDateTime({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();

    const intervalId = window.setInterval(update, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className={`portal-time${compact ? " portal-time--compact" : ""}`}>
      {now ? <AnalogClock now={now} /> : <div aria-hidden="true" className="portal-clock portal-clock--placeholder" />}
      <p
        aria-label={
          now
            ? `Local date and time: ${formatLocalDateTime(now)}`
            : "Local date and time"
        }
        className="portal-home__local-time"
      >
        <span className="portal-time__label">Local date and time</span>
        {now ? compact ? (
          <>
            <span className="portal-time__date">{formatCompactDate(now)}</span>
            <time dateTime={now.toISOString()}>{formatCompactTime(now)}</time>
          </>
        ) : (
          <time dateTime={now.toISOString()}>{formatLocalDateTime(now)}</time>
        ) : (
          <span aria-hidden="true">Loading…</span>
        )}
      </p>
    </div>
  );
}
