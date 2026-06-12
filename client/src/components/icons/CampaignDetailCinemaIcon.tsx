export function CampaignDetailCinemaIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className="block"
    >
      <defs>
        <linearGradient
          id="campaign-detail-gold-metal"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#F5E6A3" />
          <stop offset="50%" stopColor="#DFC56A" />
          <stop offset="100%" stopColor="#B8954A" />
        </linearGradient>
      </defs>
      <rect
        x="35"
        y="45"
        width="30"
        height="20"
        rx="2"
        fill="url(#campaign-detail-gold-metal)"
        stroke="#B8954A"
        strokeWidth="1.5"
      />
      <rect
        x="42"
        y="58"
        width="16"
        height="6"
        rx="1"
        fill="#131A27"
        stroke="#DFC56A"
        strokeWidth="1"
      />

      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 35 32"
          to="360 35 32"
          dur="4s"
          repeatCount="indefinite"
        />
        <circle
          cx="35"
          cy="32"
          r="14"
          stroke="url(#campaign-detail-gold-metal)"
          strokeWidth="2.5"
          fill="none"
        />
        <circle cx="35" cy="24" r="1.5" fill="#B8954A" />
        <circle cx="43" cy="32" r="1.5" fill="#B8954A" />
        <circle cx="35" cy="40" r="1.5" fill="#B8954A" />
        <circle cx="27" cy="32" r="1.5" fill="#B8954A" />
        <circle
          cx="35"
          cy="32"
          r="3"
          fill="#131A27"
          stroke="url(#campaign-detail-gold-metal)"
          strokeWidth="1"
        />
      </g>

      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 65 32"
          to="-360 65 32"
          dur="4s"
          repeatCount="indefinite"
        />
        <circle
          cx="65"
          cy="32"
          r="14"
          stroke="url(#campaign-detail-gold-metal)"
          strokeWidth="2.5"
          fill="none"
        />
        <circle cx="65" cy="24" r="1.5" fill="#B8954A" />
        <circle cx="73" cy="32" r="1.5" fill="#B8954A" />
        <circle cx="65" cy="40" r="1.5" fill="#B8954A" />
        <circle cx="57" cy="32" r="1.5" fill="#B8954A" />
        <circle
          cx="65"
          cy="32"
          r="3"
          fill="#131A27"
          stroke="url(#campaign-detail-gold-metal)"
          strokeWidth="1"
        />
      </g>

      <path
        d="M40 18 L60 18"
        stroke="url(#campaign-detail-gold-metal)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M49 32 L51 32"
        stroke="url(#campaign-detail-gold-metal)"
        strokeWidth="1"
      />
    </svg>
  );
}
