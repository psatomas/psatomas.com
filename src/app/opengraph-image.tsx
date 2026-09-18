import { renderSocialImage } from "@/components/social/og-image";
import { staticSocial } from "@/lib/social/content";
import { socialImageAlt } from "@/lib/social/metadata";

export const alt = socialImageAlt(staticSocial.home);
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderSocialImage(staticSocial.home, "public, max-age=3600, s-maxage=3600");
}
