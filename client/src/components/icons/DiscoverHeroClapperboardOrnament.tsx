import type { SVGProps } from "react";
import { cn } from "@/utils/cn";

type DiscoverHeroClapperboardOrnamentProps = SVGProps<SVGSVGElement>;

export function DiscoverHeroClapperboardOrnament({
  className,
  ...props
}: DiscoverHeroClapperboardOrnamentProps) {
  return (
    <svg
      width="140"
      height="140"
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-auto w-full", className)}
      {...props}
    >
      <rect
        x="15"
        y="35"
        width="110"
        height="80"
        rx="4"
        stroke="#DFC56A"
        strokeWidth="1.5"
        strokeOpacity="0.3"
        fill="rgba(19, 26, 39, 0.6)"
      />
      <line
        x1="25"
        y1="60"
        x2="115"
        y2="60"
        stroke="#DFC56A"
        strokeWidth="1"
        strokeOpacity="0.15"
      />
      <line
        x1="25"
        y1="85"
        x2="115"
        y2="85"
        stroke="#DFC56A"
        strokeWidth="1"
        strokeOpacity="0.15"
      />
      <line
        x1="55"
        y1="60"
        x2="55"
        y2="85"
        stroke="#DFC56A"
        strokeWidth="1"
        strokeOpacity="0.15"
      />
      <line
        x1="85"
        y1="60"
        x2="85"
        y2="85"
        stroke="#DFC56A"
        strokeWidth="1"
        strokeOpacity="0.15"
      />
      <rect
        x="15"
        y="35"
        width="110"
        height="16"
        rx="2"
        stroke="#DFC56A"
        strokeWidth="1.5"
        strokeOpacity="0.5"
        fill="rgba(19, 26, 39, 0.8)"
      />
      <path
        d="M25 35 L35 51 M45 35 L55 51 M65 35 L75 51 M85 35 L95 51 M105 35 L115 51"
        stroke="#DFC56A"
        strokeWidth="1.5"
        strokeOpacity="0.3"
      />
      <g className="discover-clapper-top">
        <rect
          x="15"
          y="19"
          width="110"
          height="16"
          rx="2"
          stroke="#DFC56A"
          strokeWidth="1.5"
          strokeOpacity="0.6"
          fill="rgba(19, 26, 39, 0.9)"
        />
        <path
          d="M25 19 L35 35 M45 19 L55 35 M65 19 L75 35 M85 19 L95 35 M105 19 L115 35"
          stroke="#DFC56A"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />
      </g>
      <text
        x="30"
        y="75"
        fill="#DFC56A"
        fillOpacity="0.4"
        fontFamily="monospace"
        fontSize="8"
        letterSpacing="1"
      >
        PROD.
      </text>
      <text
        x="62"
        y="75"
        fill="#DFC56A"
        fillOpacity="0.4"
        fontFamily="monospace"
        fontSize="8"
        letterSpacing="1"
      >
        SCENE
      </text>
      <text
        x="94"
        y="75"
        fill="#DFC56A"
        fillOpacity="0.4"
        fontFamily="monospace"
        fontSize="8"
        letterSpacing="1"
      >
        TAKE
      </text>
      <text
        x="28"
        y="102"
        fill="#DFC56A"
        fillOpacity="0.7"
        fontFamily="monospace"
        fontSize="10"
      >
        KINORA
      </text>
      <text
        x="68"
        y="102"
        fill="#DFC56A"
        fillOpacity="0.7"
        fontFamily="monospace"
        fontSize="14"
      >
        24
      </text>
      <text
        x="100"
        y="102"
        fill="#DFC56A"
        fillOpacity="0.7"
        fontFamily="monospace"
        fontSize="14"
      >
        1
      </text>
      <text
        x="25"
        y="120"
        fill="#DFC56A"
        fillOpacity="0.3"
        fontFamily="monospace"
        fontSize="6"
      >
        DIR: ALAN SMITHEE
      </text>
      <text
        x="85"
        y="120"
        fill="#DFC56A"
        fillOpacity="0.3"
        fontFamily="monospace"
        fontSize="6"
      >
        CAM: ARRI 35
      </text>
    </svg>
  );
}
