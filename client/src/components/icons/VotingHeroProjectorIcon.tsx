import type { SVGProps } from "react";
import { cn } from "@/utils/cn";

type VotingHeroProjectorIconProps = SVGProps<SVGSVGElement>;

export function VotingHeroProjectorIcon({
  className,
  ...props
}: VotingHeroProjectorIconProps) {
  return (
    <svg
      viewBox="0 0 140 140"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-auto w-full overflow-visible", className)}
      fill="none"
      stroke="#DFC56A"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <defs>
        <radialGradient
          id="voting-hero-aperture-grad"
          cx="126"
          cy="92.5"
          r="31"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="34%" stopColor="#fff0a8" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#DFC56A" stopOpacity="0" />
        </radialGradient>
        <filter
          id="voting-hero-beam-soften"
          x="120"
          y="-40"
          width="350"
          height="270"
          filterUnits="userSpaceOnUse"
        >
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        <clipPath id="voting-hero-beam-clip" clipPathUnits="userSpaceOnUse">
          <path d="M126.5 83 C176 57 288 16 450 -32 L450 217 C288 169 176 128 126.5 102 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#voting-hero-beam-clip)" className="projector-beam-path">
        <path
          d="M126.5 83 C188 50 304 12 450 -32 L450 217 C304 173 188 135 126.5 102 Z"
          fill="#DFC56A"
          opacity="0.18"
          filter="url(#voting-hero-beam-soften)"
          stroke="none"
        />
        <path
          d="M126.5 88 C194 70 310 48 450 24 L450 161 C310 137 194 115 126.5 97 Z"
          fill="#fff0a8"
          opacity="0.24"
          stroke="none"
        />
        <path
          d="M126.5 86.5 C141 88.5 154 90 170 92.5 C154 95 141 96.5 126.5 98.5 Z"
          fill="url(#voting-hero-aperture-grad)"
          stroke="none"
        />
      </g>
      <g className="reel-group" style={{ transformOrigin: "90px 45px" }}>
        <circle cx="90" cy="45" r="24" fill="#131A27" />
        <circle cx="90" cy="45" r="18" />
        <circle cx="90" cy="45" r="5" fill="#DFC56A" stroke="none" />
        <line x1="90" y1="21" x2="90" y2="69" opacity="0.4" strokeWidth="1.5" />
        <line x1="66" y1="45" x2="114" y2="45" opacity="0.4" strokeWidth="1.5" />
        <line x1="73" y1="28" x2="107" y2="62" opacity="0.4" strokeWidth="1.5" />
        <line x1="107" y1="28" x2="73" y2="62" opacity="0.4" strokeWidth="1.5" />
      </g>
      <g className="reel-group" style={{ transformOrigin: "45px 35px" }}>
        <circle cx="45" cy="35" r="28" fill="#1b2231" />
        <circle cx="45" cy="35" r="22" />
        <circle cx="45" cy="35" r="6" fill="#DFC56A" stroke="none" />
        <line x1="45" y1="7" x2="45" y2="63" opacity="0.5" strokeWidth="2" />
        <line x1="17" y1="35" x2="73" y2="35" opacity="0.5" strokeWidth="2" />
        <line x1="25.2" y1="15.2" x2="64.8" y2="54.8" opacity="0.5" strokeWidth="2" />
        <line x1="64.8" y1="15.2" x2="25.2" y2="54.8" opacity="0.5" strokeWidth="2" />
      </g>
      <rect x="20" y="65" width="80" height="55" rx="8" fill="#1b2231" />
      <line x1="30" y1="65" x2="30" y2="120" opacity="0.3" strokeWidth="2" />
      <line x1="42" y1="65" x2="42" y2="120" opacity="0.3" strokeWidth="2" />
      <rect x="65" y="78" width="24" height="18" rx="3" opacity="0.6" strokeWidth="1.5" />
      <circle cx="88" cy="106" r="4" fill="#DFC56A" opacity="0.8" />
      <line x1="20" y1="95" x2="100" y2="95" opacity="0.2" strokeWidth="1" />
      <rect x="55" y="55" width="35" height="10" fill="#1b2231" />
      <path d="M100 75 l 12 -5 v 45 l -12 -5 z" fill="#1b2231" />
      <path d="M112 70 l 15 -3 v 51 l -15 -3 z" fill="#1b2231" />
      <line x1="106" y1="73" x2="106" y2="112" opacity="0.4" strokeWidth="1" />
      <line x1="119" y1="68" x2="119" y2="117" opacity="0.4" strokeWidth="1.5" />
      <path
        d="M125 67 q 10 25.5 0 51"
        fill="rgba(223, 197, 106, 0.1)"
        stroke="none"
        className="lens-core-path"
      />
    </svg>
  );
}
