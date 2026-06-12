import type { SVGProps } from "react";
import { cn } from "@/utils/cn";

type DiscoverHeroCameraOrnamentProps = SVGProps<SVGSVGElement>;

export function DiscoverHeroCameraOrnament({
  className,
  ...props
}: DiscoverHeroCameraOrnamentProps) {
  return (
    <svg
      width="180"
      height="160"
      viewBox="0 0 180 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-auto w-full", className)}
      {...props}
    >
      <path
        d="M50 120 L90 120 L100 150 L40 150 Z"
        stroke="#DFC56A"
        strokeWidth="1"
        strokeOpacity="0.2"
        fill="none"
      />
      <rect
        x="55"
        y="100"
        width="30"
        height="20"
        stroke="#DFC56A"
        strokeWidth="1"
        strokeOpacity="0.3"
        fill="none"
      />
      <rect
        x="40"
        y="60"
        width="60"
        height="40"
        rx="6"
        stroke="#DFC56A"
        strokeWidth="1.5"
        strokeOpacity="0.4"
        fill="none"
      />
      <g
        className="reel-spin"
        style={{ transformOrigin: "55px 50px", animationDuration: "8s" }}
      >
        <circle
          cx="55"
          cy="50"
          r="25"
          stroke="#DFC56A"
          strokeWidth="1"
          strokeOpacity="0.4"
          fill="none"
        />
        <circle
          cx="55"
          cy="50"
          r="6"
          stroke="#DFC56A"
          strokeWidth="1.5"
          strokeOpacity="0.6"
          fill="none"
        />
        <line x1="55" y1="25" x2="55" y2="75" stroke="#DFC56A" strokeOpacity="0.3" />
        <line x1="30" y1="50" x2="80" y2="50" stroke="#DFC56A" strokeOpacity="0.3" />
        <path
          d="M80 50 C 90 50, 95 60, 95 70"
          stroke="#DFC56A"
          strokeWidth="1"
          strokeOpacity="0.4"
          fill="none"
        />
      </g>
      <g
        className="reel-spin-reverse"
        style={{ transformOrigin: "90px 40px", animationDuration: "8s" }}
      >
        <circle
          cx="90"
          cy="40"
          r="20"
          stroke="#DFC56A"
          strokeWidth="1"
          strokeOpacity="0.3"
          fill="none"
        />
        <circle
          cx="90"
          cy="40"
          r="5"
          stroke="#DFC56A"
          strokeWidth="1"
          strokeOpacity="0.5"
          fill="none"
        />
        <line x1="90" y1="20" x2="90" y2="60" stroke="#DFC56A" strokeOpacity="0.2" />
        <line x1="70" y1="40" x2="110" y2="40" stroke="#DFC56A" strokeOpacity="0.2" />
      </g>
      <path
        d="M100 70 L120 65 L120 95 L100 90"
        stroke="#DFC56A"
        strokeWidth="1.5"
        strokeOpacity="0.4"
        fill="none"
      />
      <line x1="105" y1="70" x2="105" y2="90" stroke="#DFC56A" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="110" y1="68" x2="110" y2="92" stroke="#DFC56A" strokeWidth="1" strokeOpacity="0.3" />
      <g className="animate-pulse" style={{ animationDuration: "4s" }}>
        <path d="M120 70 L170 40 L170 120 L120 90 Z" fill="#DFC56A" fillOpacity="0.03" />
        <path d="M120 75 L150 55 L150 105 L120 85 Z" fill="#DFC56A" fillOpacity="0.06" />
        <circle
          cx="140"
          cy="70"
          r="1"
          fill="#DFC56A"
          fillOpacity="0.5"
          className="animate-ping"
          style={{ animationDuration: "2s" }}
        />
        <circle
          cx="155"
          cy="90"
          r="1"
          fill="#DFC56A"
          fillOpacity="0.4"
          className="animate-ping"
          style={{ animationDuration: "3s", animationDelay: "1s" }}
        />
        <circle
          cx="160"
          cy="60"
          r="1.5"
          fill="#DFC56A"
          fillOpacity="0.3"
          className="animate-ping"
          style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
        />
      </g>
    </svg>
  );
}
