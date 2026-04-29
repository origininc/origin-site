"use client";

import type { CSSProperties, ReactNode } from "react";

type GlassOrbProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  tint: {
    b: number;
    g: number;
    r: number;
  };
};

const clampChannel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)));

export default function GlassOrb({
  children,
  className,
  contentClassName,
  tint,
}: GlassOrbProps) {
  const orbStyle = {
    "--orb-tint-r-default": String(clampChannel(tint.r)),
    "--orb-tint-g-default": String(clampChannel(tint.g)),
    "--orb-tint-b-default": String(clampChannel(tint.b)),
  } as CSSProperties;

  return (
    <div className={`orb ${className ?? ""}`} style={orbStyle}>
      <div className={`content ${contentClassName ?? ""}`}>{children}</div>
      <div className="tintLayer" />
      <div className="highlightLayer" />
      <div className="innerStroke" />

      <style jsx>{`
        .orb {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 50%;
          overflow: hidden;
          isolation: isolate;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background:
            radial-gradient(
              circle at 50% 50%,
              rgba(
                var(--orb-tint-r, var(--orb-tint-r-default)),
                var(--orb-tint-g, var(--orb-tint-g-default)),
                var(--orb-tint-b, var(--orb-tint-b-default)),
                0.13
              )
                0%,
              rgba(
                var(--orb-tint-r, var(--orb-tint-r-default)),
                var(--orb-tint-g, var(--orb-tint-g-default)),
                var(--orb-tint-b, var(--orb-tint-b-default)),
                0.06
              )
                48%,
              rgba(
                var(--orb-tint-r, var(--orb-tint-r-default)),
                var(--orb-tint-g, var(--orb-tint-g-default)),
                var(--orb-tint-b, var(--orb-tint-b-default)),
                0.1
              )
                70%,
              rgba(
                var(--orb-tint-r, var(--orb-tint-r-default)),
                var(--orb-tint-g, var(--orb-tint-g-default)),
                var(--orb-tint-b, var(--orb-tint-b-default)),
                0.19
              )
                100%
            ),
            rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow:
            0 26px 80px rgba(0, 0, 0, 0.36),
            inset 0 1px 0 rgba(255, 255, 255, 0.14),
            inset 0 -28px 52px rgba(255, 255, 255, 0.035);
        }

        .content {
          position: absolute;
          inset: 9%;
          z-index: 1;
        }

        .tintLayer,
        .highlightLayer,
        .innerStroke {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
        }

        .tintLayer {
          z-index: 2;
          background:
            radial-gradient(
              circle at 50% 50%,
              rgba(255, 255, 255, 0) 44%,
              rgba(
                var(--orb-tint-r, var(--orb-tint-r-default)),
                var(--orb-tint-g, var(--orb-tint-g-default)),
                var(--orb-tint-b, var(--orb-tint-b-default)),
                0.06
              )
                66%,
              rgba(
                var(--orb-tint-r, var(--orb-tint-r-default)),
                var(--orb-tint-g, var(--orb-tint-g-default)),
                var(--orb-tint-b, var(--orb-tint-b-default)),
                0.26
              )
                100%
            ),
            radial-gradient(
              circle at 30% 22%,
              rgba(
                var(--orb-tint-r, var(--orb-tint-r-default)),
                var(--orb-tint-g, var(--orb-tint-g-default)),
                var(--orb-tint-b, var(--orb-tint-b-default)),
                0.22
              )
                0%,
              rgba(
                var(--orb-tint-r, var(--orb-tint-r-default)),
                var(--orb-tint-g, var(--orb-tint-g-default)),
                var(--orb-tint-b, var(--orb-tint-b-default)),
                0.085
              )
                28%,
              rgba(
                var(--orb-tint-r, var(--orb-tint-r-default)),
                var(--orb-tint-g, var(--orb-tint-g-default)),
                var(--orb-tint-b, var(--orb-tint-b-default)),
                0.03
              )
                52%,
              rgba(255, 255, 255, 0) 72%
            ),
            radial-gradient(
              circle at 68% 78%,
              rgba(
                var(--orb-tint-r, var(--orb-tint-r-default)),
                var(--orb-tint-g, var(--orb-tint-g-default)),
                var(--orb-tint-b, var(--orb-tint-b-default)),
                0.12
              )
                0%,
              rgba(
                var(--orb-tint-r, var(--orb-tint-r-default)),
                var(--orb-tint-g, var(--orb-tint-g-default)),
                var(--orb-tint-b, var(--orb-tint-b-default)),
                0.035
              )
                36%,
              rgba(255, 255, 255, 0) 68%
            );
          mix-blend-mode: screen;
          opacity: 1;
        }

        .highlightLayer {
          z-index: 3;
          background:
            radial-gradient(
              circle at 34% 26%,
              rgba(255, 255, 255, 0.18) 0,
              rgba(255, 255, 255, 0.08) 20%,
              rgba(255, 255, 255, 0.015) 42%,
              rgba(255, 255, 255, 0) 62%
            ),
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.08) 0%,
              rgba(255, 255, 255, 0.025) 34%,
              rgba(255, 255, 255, 0) 72%
            );
        }

        .innerStroke {
          inset: 1px;
          z-index: 4;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            inset 0 0 36px rgba(255, 255, 255, 0.035),
            inset 0 -36px 60px rgba(0, 0, 0, 0.14);
        }
      `}</style>
    </div>
  );
}
