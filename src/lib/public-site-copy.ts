/**
 * Frontend-owned placeholder copy for public pages.
 * Replace it with office-reviewed text before presenting detailed instructions
 * as authoritative public information.
 */
export type PublicCopyLink = {
  text: string;
  href: string;
};

export type PublicCopySegment = string | PublicCopyLink;

export type AboutSection = {
  heading: string;
  paragraphs?: ReadonlyArray<ReadonlyArray<PublicCopySegment>>;
  list?: ReadonlyArray<string>;
};

export type PublicServiceCopy = {
  key: string;
  title: string;
  description: string;
  summary: string;
};

export const ABOUT_PAGE_CONTENT = {
  title: "About COMPASS",
  statusLabel: "Provisional information",
  summary:
    "This page is a temporary placeholder while public information is reviewed.",
  sections: [
    {
      heading: "About this page",
      paragraphs: [
        [
          "A short introduction to COMPASS and the Guidance and Counseling Office will be added here after review.",
        ],
        [
          "For now, ",
          { text: "sign in to COMPASS", href: "/login" },
          " to see the options available to your account, or use ",
          { text: "Contact", href: "/contact" },
          " for a general inquiry.",
        ],
      ],
    },
  ],
} as const satisfies {
  title: string;
  statusLabel: string;
  summary: string;
  sections: ReadonlyArray<AboutSection>;
};

export const PUBLIC_SERVICE_PAGE_CONTENT = {
  title: "Services and support",
  statusLabel: "Provisional information",
  introduction:
    "Public service descriptions are being prepared. Sign in to COMPASS to see the options available to your account.",
  services: [
    {
      key: "current-options",
      title: "Using COMPASS",
      description: "Sign in to view the options available to you.",
      summary:
        "Detailed service instructions will be added after review. This page does not set service requirements, schedules, or availability.",
    },
  ],
} as const satisfies {
  title: string;
  statusLabel: string;
  introduction: string;
  services: ReadonlyArray<PublicServiceCopy>;
};

export const INSTITUTIONAL_PUBLIC_LINKS = {
  privacy: {
    label: "UCN Data Privacy Notice",
    url: "https://ucn.edu.ph/UCN/data-privacy-notice/",
    owner_label: "University of Camarines Norte",
  },
  guidanceOfficeFacebook: {
    label: "Guidance and Counseling Office Facebook page",
    url: "https://www.facebook.com/profile.php?id=61566561807803",
    owner_label: "Guidance and Counseling Office",
  },
} as const;
