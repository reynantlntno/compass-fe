import { cache } from "react";

import {
  organizationsPublicBranding,
  organizationsPublicBrandingAsset,
  organizationsPublicIdentity,
} from "@/lib/api/generated/organizations/organizations";
import type {
  PublicBrandingAssetMetadataSchema,
  PublicLinkItemSchema,
} from "@/lib/api/generated/model";

const PRODUCT_NAME = "COMPASS";
const DEFAULT_INSTITUTION_NAME = "University of Camarines Norte";
const DEFAULT_OFFICE_NAME = "Guidance and Counseling Office";

export type ResolvedBrandAsset = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  placement: string;
};

export type BrandingConfig = {
  productName: string;
  institutionName: string;
  officeName: string;
  campus: string | null;
  address: string | null;
  officeLocation: string | null;
  officeHours: string | null;
  email: string | null;
  phone: string | null;
  headerAssets: ResolvedBrandAsset[];
  footerIdentityAssets: ResolvedBrandAsset[];
  footerPrivacyAssets: ResolvedBrandAsset[];
  privacyLinks: PublicLinkItemSchema[];
  footerLinks: PublicLinkItemSchema[];
  isDegraded: boolean;
};

function clean(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function envFallback(name: string, fallback: string) {
  return clean(process.env[name]) ?? fallback;
}

function browserAssetUrl(url: string) {
  try {
    const parsed = new URL(url, "http://compass.invalid");
    if (parsed.origin !== "http://compass.invalid") {
      return undefined;
    }

    if (!parsed.pathname.startsWith("/api/v1/")) {
      return undefined;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return undefined;
  }
}

async function resolveAssets(
  assets: PublicBrandingAssetMetadataSchema[] | undefined,
) {
  const resolved = await Promise.all(
    (assets ?? []).map(async (asset) => {
      const assetId = Number(asset.id);
      if (!Number.isSafeInteger(assetId)) {
        return null;
      }

      try {
        const response = await organizationsPublicBrandingAsset(assetId);
        if (response.status !== 200) {
          return null;
        }

        const src = browserAssetUrl(response.data.url);
        const alt = clean(asset.alt_text);
        if (!src || !alt) {
          return null;
        }

        return {
          id: asset.id,
          src,
          alt,
          width: Math.max(1, asset.width),
          height: Math.max(1, asset.height),
          placement: asset.placement,
        } satisfies ResolvedBrandAsset;
      } catch {
        return null;
      }
    }),
  );

  if (resolved.some((asset) => asset === null)) {
    return [];
  }

  return resolved.filter((asset): asset is ResolvedBrandAsset => asset !== null);
}

function sortLinks(groups: Array<PublicLinkItemSchema[] | undefined>) {
  return groups
    .flatMap((group) => group ?? [])
    .filter((link) => clean(link.label) && clean(link.url))
    .toSorted((left, right) => left.display_order - right.display_order);
}

function isPrivacyLink(link: PublicLinkItemSchema) {
  const searchable = `${link.label} ${link.url}`.toLowerCase();
  return link.link_type.toUpperCase() === "POLICY" && searchable.includes("privacy");
}

async function loadPublicBranding(): Promise<BrandingConfig> {
  const [identityResult, brandingResult] = await Promise.allSettled([
    organizationsPublicIdentity(),
    organizationsPublicBranding(),
  ]);

  const identity =
    identityResult.status === "fulfilled" && identityResult.value.status === 200
      ? identityResult.value.data
      : undefined;
  const branding =
    brandingResult.status === "fulfilled" && brandingResult.value.status === 200
      ? brandingResult.value.data
      : undefined;
  const identityAvailable =
    identityResult.status === "fulfilled" && identityResult.value.status === 200;
  const brandingAvailable =
    brandingResult.status === "fulfilled" && brandingResult.value.status === 200;

  const [headerAssets, footerIdentityAssets, footerPrivacyAssets] = await Promise.all([
    resolveAssets(branding?.header_identity),
    resolveAssets(branding?.footer_identity_row),
    resolveAssets(branding?.footer_privacy_credentials),
  ]);

  const institution = identity?.institution;
  const office = identity?.office;
  const publicLinks = identity?.public_links;
  const allFooterLinks = sortLinks([
    publicLinks?.compass_links,
    publicLinks?.institution_links,
    publicLinks?.office_links,
  ]);

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
    headerAssets,
    footerIdentityAssets,
    footerPrivacyAssets,
    privacyLinks: allFooterLinks.filter(isPrivacyLink),
    footerLinks: allFooterLinks.filter((link) => !isPrivacyLink(link)),
    isDegraded:
      !identityAvailable ||
      !brandingAvailable ||
      headerAssets.length !== (branding?.header_identity?.length ?? 0) ||
      footerIdentityAssets.length !== (branding?.footer_identity_row?.length ?? 0) ||
      footerPrivacyAssets.length !==
        (branding?.footer_privacy_credentials?.length ?? 0),
  };
}

export const getPublicBranding = cache(loadPublicBranding);
