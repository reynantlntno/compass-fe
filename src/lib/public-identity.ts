import { cache } from "react";

import { organizationsPublicIdentity } from "@/lib/api/generated/organizations/organizations";
import { INSTITUTIONAL_PUBLIC_LINKS } from "@/lib/public-site-copy";

const PRODUCT_NAME = "COMPASS";
const DEFAULT_INSTITUTION_NAME = "University of Camarines Norte";
const DEFAULT_OFFICE_NAME = "Guidance and Counseling Office";

export type PublicSiteLink = {
  label: string;
  url: string;
  owner_label?: string;
};

export type PublicIdentityConfig = {
  productName: string;
  institutionName: string;
  officeName: string;
  campus: string | null;
  address: string | null;
  officeLocation: string | null;
  officeHours: string | null;
  email: string | null;
  phone: string | null;
  officialWebsite: string | null;
  facebookUrl: string | null;
  privacyLinks: ReadonlyArray<PublicSiteLink>;
  footerLinks: ReadonlyArray<PublicSiteLink>;
  isDegraded: boolean;
};

type PublicIdentitySource = {
  institution?: {
    display_name?: string | null;
    campus?: string | null;
    address?: string | null;
    official_website?: string | null;
    facebook_url?: string | null;
  } | null;
  office?: {
    display_name?: string | null;
    location?: string | null;
    office_hours?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

function clean(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function envFallback(name: string, fallback: string) {
  return clean(process.env[name]) ?? fallback;
}

async function loadPublicIdentity(): Promise<PublicIdentityConfig> {
  const identity = await organizationsPublicIdentity()
    .then((response) => response.status === 200
      ? response.data as unknown as PublicIdentitySource
      : undefined)
    .catch(() => undefined);
  const identityAvailable = identity !== undefined;

  const institution = identity?.institution;
  const office = identity?.office;
  const officialWebsite = clean(institution?.official_website) ?? null;
  const facebookUrl = clean(institution?.facebook_url) ?? null;

  return {
    productName: PRODUCT_NAME,
    institutionName:
      clean(institution?.display_name) ??
      envFallback("COMPASS_DEFAULT_INSTITUTION_NAME", DEFAULT_INSTITUTION_NAME),
    officeName:
      clean(office?.display_name) ??
      envFallback("COMPASS_DEFAULT_OFFICE_NAME", DEFAULT_OFFICE_NAME),
    campus: clean(institution?.campus) ?? null,
    address: clean(institution?.address) ?? null,
    officeLocation: clean(office?.location) ?? null,
    officeHours: clean(office?.office_hours) ?? null,
    email: clean(office?.email) ?? null,
    phone: clean(office?.phone) ?? null,
    officialWebsite,
    facebookUrl,
    privacyLinks: [INSTITUTIONAL_PUBLIC_LINKS.privacy],
    footerLinks: [
      ...(officialWebsite
        ? [{ label: "Official university website", url: officialWebsite }]
        : []),
      ...(facebookUrl ? [{ label: "Facebook", url: facebookUrl }] : []),
      INSTITUTIONAL_PUBLIC_LINKS.guidanceOfficeFacebook,
    ],
    isDegraded: !identityAvailable,
  };
}

export const getPublicIdentity = cache(loadPublicIdentity);
