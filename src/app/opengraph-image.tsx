import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: 24,
          padding: 80,
          background: "#0a0b0d",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 64, fontWeight: 600, color: "#e6e8eb" }}>
          {siteConfig.name}
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#38bdf8" }}>
          Protocol Engineer | EVM & SVM
        </div>
      </div>
    ),
    { ...size },
  );
}
