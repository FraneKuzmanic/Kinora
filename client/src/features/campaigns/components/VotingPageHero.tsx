import { VotingHeroProjectorIcon } from "@/components/icons/VotingHeroProjectorIcon";

export function VotingPageHero() {
  return (
    <section className="animate-fade-up relative mx-auto mb-10 mt-10 flex max-w-7xl flex-col items-center px-4 text-center sm:px-8 md:mb-12 md:mt-16">
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[300px] w-full -translate-x-1/2 -translate-y-1/2 overflow-hidden opacity-40 md:h-[400px]">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(223,197,106,0.1)] animate-[spin_30s_linear_infinite]" />
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(223,197,106,0.05)] animate-[spin_30s_linear_infinite_reverse]" />
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <linearGradient
              id="voting-fade-gradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#131A27" stopOpacity="1" />
              <stop offset="50%" stopColor="#131A27" stopOpacity="0" />
              <stop offset="100%" stopColor="#131A27" stopOpacity="1" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#voting-fade-gradient)" />
        </svg>
      </div>

      <div className="camera-wrapper relative z-10 mb-5 grid grid-cols-[3.5rem_auto] items-center justify-center gap-2 md:mb-6 md:flex md:gap-8">
        <div className="relative z-30 flex h-14 w-14 flex-shrink-0 -translate-y-2 items-center justify-center overflow-visible sm:h-20 sm:w-20 sm:-translate-y-2.5 md:h-32 md:w-32 md:-translate-y-4">
          <VotingHeroProjectorIcon className="h-full w-full overflow-visible" />
        </div>

        <div className="relative z-20 flex h-14 items-center sm:h-20 md:h-auto md:-ml-2">
          <h1 className="font-display relative block select-none pb-0 text-left text-[3rem] leading-none uppercase tracking-wider sm:text-[3.75rem] md:pb-2 md:text-left md:text-[7rem] md:leading-[0.9]">
            <span className="text-stroke-gold absolute inset-0 opacity-40">
              Now Voting
            </span>
            <span className="animate-text-sweep relative z-10 block text-[var(--color-accent)] drop-shadow-xl">
              Now Voting
            </span>
          </h1>
        </div>
      </div>

      <p className="relative z-10 max-w-2xl text-sm font-light leading-relaxed text-[var(--color-text-dim)] md:text-lg">
        Shape the future of cinema. Vote for your favorite films and secure
        their place on the big screen at a cinema near you.
      </p>
    </section>
  );
}
