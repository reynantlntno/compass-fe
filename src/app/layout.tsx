import type { Metadata } from "next";
import { Caveat, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import { AccessibilityLayer } from "@/components/accessibility/accessibility-layer";
import { ServiceStatusProvider } from "@/components/system/service-status-provider";
import { getInitialServiceStatus } from "@/lib/server/system-status";

import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["500", "600", "700", "800"],
});

const caveat = Caveat({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "COMPASS",
    template: "%s | COMPASS",
  },
  description: "A simpler way to find COMPASS support.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const initialStatus = await getInitialServiceStatus();

  return (
    <html
      lang="en"
      className={`h-full ${plusJakarta.variable} ${outfit.variable} ${caveat.variable}`}
    >
      <body className="min-h-full antialiased">
        <AccessibilityLayer>
          <ServiceStatusProvider initialStatus={initialStatus}>
            {children}
          </ServiceStatusProvider>
        </AccessibilityLayer>
      </body>
    </html>
  );
}
