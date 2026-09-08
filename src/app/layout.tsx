import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "COMPASS",
    template: "%s | COMPASS",
  },
  description: "Guidance and Counseling Office support for UCN students and staff.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body>{children}</body>
    </html>
  );
}
