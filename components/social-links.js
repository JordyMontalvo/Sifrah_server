export const SOCIAL_LINKS_ID = "social_links";

export const DEFAULT_SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/profile.php?id=61555335617817",
  youtube: "https://www.youtube.com/@SIFRAHCORP",
  tiktok: "https://www.tiktok.com/@sifrah.corp",
  whatsapp: "https://wa.me/51947254429",
};

function trimStr(value) {
  return String(value == null ? "" : value).trim();
}

export function normalizeUrl(value) {
  const raw = trimStr(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function normalizeWhatsApp(value) {
  const raw = trimStr(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}`;
}

export function formatSocialLinks(doc) {
  const src = doc || {};
  return {
    facebook: normalizeUrl(
      src.facebook != null ? src.facebook : DEFAULT_SOCIAL_LINKS.facebook
    ),
    youtube: normalizeUrl(
      src.youtube != null ? src.youtube : DEFAULT_SOCIAL_LINKS.youtube
    ),
    tiktok: normalizeUrl(
      src.tiktok != null ? src.tiktok : DEFAULT_SOCIAL_LINKS.tiktok
    ),
    whatsapp: normalizeWhatsApp(
      src.whatsapp != null ? src.whatsapp : DEFAULT_SOCIAL_LINKS.whatsapp
    ),
  };
}

export async function getSocialLinks(DashboardConfig) {
  const config = await DashboardConfig.findOne({ id: SOCIAL_LINKS_ID });
  if (!config) return { ...DEFAULT_SOCIAL_LINKS };
  return formatSocialLinks(config);
}
