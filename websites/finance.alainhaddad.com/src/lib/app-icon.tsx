import { ImageResponse } from "next/og";

/** Shared Family Finance mark for favicon / apple / PWA tiles. */
export function renderAppIcon(size: number) {
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.42);
  const barWidth = Math.round(size * 0.28);
  const barHeight = Math.max(2, Math.round(size * 0.035));
  const barTop = Math.round(size * 0.68);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f6b4c",
          borderRadius: radius,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#f6f4ef",
            fontSize,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          FF
        </div>
        <div
          style={{
            position: "absolute",
            top: barTop,
            width: barWidth,
            height: barHeight,
            background: "#f6f4ef",
            borderRadius: barHeight,
            opacity: 0.85,
          }}
        />
      </div>
    ),
    { width: size, height: size }
  );
}
