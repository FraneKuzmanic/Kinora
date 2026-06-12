import type { SVGProps } from "react";
import { cn } from "@/utils/cn";

type CinemaCameraIconProps = SVGProps<SVGSVGElement>;

export function CinemaCameraIcon({ className, ...props }: CinemaCameraIconProps) {
  return (
    <svg
      viewBox="0 0 200 240"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-auto w-full", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      {...props}
    >
      <rect x="50" y="190" width="100" height="10" />
      <rect x="80" y="140" width="40" height="50" />
      <line x1="40" y1="200" x2="160" y2="200" />

      <rect x="40" y="60" width="120" height="80" />
      <rect x="50" y="70" width="100" height="60" />

      <rect x="160" y="85" width="20" height="30" />
      <rect x="180" y="90" width="10" height="20" />
      <polygon points="190,90 200,80 200,120 190,110" />

      <line x1="200" y1="80" x2="230" y2="40" strokeDasharray="4 4" />
      <line x1="200" y1="120" x2="230" y2="160" strokeDasharray="4 4" />

      <g className="reel-spin" style={{ transformOrigin: "90px 40px" }}>
        <circle cx="90" cy="40" r="30" />
        <circle cx="90" cy="40" r="25" />
        <circle cx="90" cy="40" r="5" />
        <line x1="90" y1="10" x2="90" y2="70" />
        <line x1="60" y1="40" x2="120" y2="40" />
        <line x1="68" y1="18" x2="112" y2="62" />
        <line x1="68" y1="62" x2="112" y2="18" />
      </g>

      <path d="M120 40 Q 140 40 140 60 L 140 85" strokeDasharray="2 2" />

      <circle cx="60" cy="120" r="3" />
      <circle cx="70" cy="120" r="3" />
      <circle cx="80" cy="120" r="3" />
    </svg>
  );
}
