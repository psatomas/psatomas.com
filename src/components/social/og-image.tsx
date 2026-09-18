import { ImageResponse } from "next/og";
import type { SocialDescriptor } from "@/lib/social/metadata";
import { socialImageSize } from "@/lib/social/metadata";
import { brandMark, brandWordmark } from "@/lib/social/brand-assets";
import { titleLayout, supportingLine } from "@/lib/social/image-layout";

/** Bundled ImageResponse Geist: no custom font or runtime font fetch. */
export function renderSocialImage(descriptor: SocialDescriptor, cacheControl: string) {
  const { lines, fontSize } = titleLayout(descriptor.imageTitle ?? descriptor.title);
  const supporting = lines.length < 3 ? supportingLine(descriptor.supporting) : "";
  const route = `psatomas.com${descriptor.path === "/" ? "" : descriptor.path}`;
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%",
      padding: "48px 64px", background: "#0a0b0d", color: "#e6e8eb", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: 26, borderBottom: "1px solid #565b64" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* ImageResponse uses img with embedded bytes, never next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brandMark} alt="" width={70} height={50} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brandWordmark} alt="PSATomas" width={220} height={36} />
        </div>
        <div style={{ display: "flex", color: "#8a919c", fontSize: 20, letterSpacing: 2 }}>
          {descriptor.environment}
        </div>
      </div>
      <div style={{ display: "flex", color: "#38bdf8", fontSize: 20,
        letterSpacing: 2, marginTop: 30, textTransform: "uppercase" }}>{descriptor.category}</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 24, fontSize,
        lineHeight: 1.12, letterSpacing: -1 }}>
        {lines.map((line, index) => <div key={index} style={{ display: "flex" }}>{line}</div>)}
      </div>
      {supporting && <div style={{ display: "flex", fontSize: 26, color: "#8a919c", marginTop: 24 }}>{supporting}</div>}
      <div style={{ display: "flex", marginTop: "auto", paddingTop: 18,
        borderTop: "1px solid #565b64", color: "#8a919c", fontSize: 18 }}>
        {route.length <= 100 ? route : `${route.slice(0, 97)}…`}
      </div>
    </div>,
    { ...socialImageSize, headers: { "Cache-Control": cacheControl } },
  );
}
