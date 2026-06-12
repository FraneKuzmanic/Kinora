import type { CSSProperties } from "react";

const customStyles: Record<string, CSSProperties> = {
  textStrokeGold: {
    color: "transparent",
    WebkitTextStroke: "1.5px rgba(223, 197, 106, 0.6)",
  },
  beamFillText: {
    background: "linear-gradient(to bottom, #DFC56A, #DFC56A, transparent)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
    animation: "beamFill 4s ease-in-out infinite",
    pointerEvents: "none",
  },
};

export function ScreeningsPageHero() {
  return (
    <section
      className="relative mb-6 flex min-h-[300px] w-full flex-col items-center justify-center overflow-hidden pb-8 sm:mb-10 sm:min-h-[420px] sm:pb-16"
    >
      <div className="pointer-events-none absolute inset-0 z-0 flex items-end justify-center">
        <div
          className="absolute bottom-0 rounded-t-full"
          style={{
            width: "120%",
            height: "400px",
            backgroundColor: "rgba(223,197,106,0.05)",
            filter: "blur(80px)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 flex justify-between px-20">
          <div
            className="animate-left-beam h-[120%] w-40 -mt-10 opacity-40"
            style={{
              background:
                "linear-gradient(to right, transparent, #DFC56A, transparent)",
              filter: "blur(3rem)",
            }}
          />
          <div
            className="animate-right-beam h-[120%] w-40 -mt-10 opacity-40"
            style={{
              background:
                "linear-gradient(to right, transparent, #DFC56A, transparent)",
              filter: "blur(3rem)",
            }}
          />
        </div>
        <div
          className="relative flex w-full justify-center overflow-hidden"
          style={{ height: "300px" }}
        >
          <svg
            viewBox="0 0 1200 300"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-60"
            preserveAspectRatio="none"
            style={{ width: "150%", maxWidth: "none" }}
          >
            <defs>
              <radialGradient
                id="screenBloom"
                cx="50%"
                cy="100%"
                r="100%"
                fx="50%"
                fy="100%"
              >
                <stop offset="0%" stopColor="#DFC56A" stopOpacity="0.4" />
                <stop offset="40%" stopColor="#DFC56A" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#131A27" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="edgeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="#DFC56A" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
              <clipPath id="screenClip">
                <path d="M0,300 Q600,150 1200,300 L1200,310 L0,310 Z" />
              </clipPath>
            </defs>
            <path
              d="M0,300 Q600,150 1200,300 Z"
              fill="url(#screenBloom)"
              className="animate-screen-glow"
            />
            <path
              d="M0,300 Q600,150 1200,300"
              fill="none"
              stroke="url(#edgeGlow)"
              strokeWidth="2"
            />
            <g style={{ clipPath: "url(#screenClip)" }}>
              <rect
                x="0"
                y="0"
                width="200"
                height="400"
                fill="white"
                opacity="0.8"
                className="animate-light-sweep"
                filter="blur(10px)"
              />
            </g>
          </svg>
        </div>
      </div>

      <div
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-8"
        style={{
          animation: "fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
        >
        <div className="relative isolate mb-4 inline-block">
          <h1
            className="relative z-20 pb-2 text-center font-display text-[3.8rem] uppercase leading-[0.9] tracking-wider select-none sm:text-[5.5rem] lg:text-[8rem]"
            style={{
              fontFamily: "Bebas Neue, sans-serif",
            }}
          >
            <span
              className="absolute inset-0 block opacity-30"
              style={customStyles.textStrokeGold}
            >
              Now Screening
            </span>
            <span
              className="relative z-10 block"
              style={{
                color: "transparent",
                WebkitTextStroke: "1px rgba(223, 197, 106, 0.12)",
                filter: "drop-shadow(0 0 24px rgba(223,197,106,0.14))",
              }}
            >
              Now Screening
            </span>
            <span
              className="absolute inset-0 block"
              style={customStyles.beamFillText}
            >
              Now Screening
            </span>
          </h1>
        </div>

        <p className="relative z-10 max-w-2xl -translate-y-2 px-3 py-2 text-sm font-light leading-relaxed text-[var(--color-text-dim)] sm:-translate-y-3 sm:px-6 sm:text-base md:-translate-y-6 md:text-lg lg:-translate-y-8">
          Experience cinema chosen by the community. From vote to screen, secure
          your seat at screenings and help make it happen.
        </p>
      </div>
    </section>
  );
}
