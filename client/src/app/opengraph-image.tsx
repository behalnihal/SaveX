import { ImageResponse } from "next/og";

export const alt = "SaveX — Video and audio, in your format.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ background: "#000", color: "#fff", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80 }}>
      <div style={{ fontSize: 30, marginBottom: 40 }}>SaveX</div>
      <div style={{ fontSize: 76, letterSpacing: -3 }}>Good things. Worth saving.</div>
      <div style={{ fontSize: 27, color: "#999", marginTop: 30 }}>YouTube, Instagram, X & more. Video or audio. Your format.</div>
    </div>,
    size,
  );
}
