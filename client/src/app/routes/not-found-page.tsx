import { ArrowLeft, Film, Home, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[calc(100vh-8rem)] overflow-hidden px-4 py-16 sm:px-8 lg:py-24">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_12%,rgba(223,197,106,0.12),transparent_24rem),linear-gradient(180deg,rgba(19,26,39,0.2),rgba(11,16,26,0.8))]" />

      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <div className="mb-8 flex h-20 w-20 items-center justify-center border border-[rgba(223,197,106,0.32)] bg-[rgba(223,197,106,0.08)] text-[var(--color-accent)] shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <SearchX className="h-9 w-9" />
        </div>

        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
          404 / showtime not found
        </p>
        <h1 className="font-display text-[4.5rem] uppercase leading-none text-white sm:text-[6.5rem]">
          Lost reel
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--color-text-dim)] sm:text-base">
          This page is not on the Kinora schedule. Head back to the live slate
          and find a screening, campaign, or booking request that is actually
          playing.
        </p>

        <div className="mt-10 grid w-full max-w-xl gap-3 sm:grid-cols-2">
          <Link
            to="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 border border-[var(--color-accent)] bg-[var(--color-accent)] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-bg-primary)] transition-colors hover:bg-white"
          >
            <Home className="h-4 w-4" />
            Discover
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 border border-[rgba(223,197,106,0.28)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.08)] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>

        <div className="mt-12 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          <Link
            to="/campaigns"
            className="flex items-center justify-between border border-[rgba(223,197,106,0.16)] bg-[rgba(27,34,49,0.54)] px-4 py-4 text-left text-sm text-white transition-colors hover:border-[rgba(223,197,106,0.34)] hover:text-[var(--color-accent)]"
          >
            <span>Voting campaigns</span>
            <Film className="h-4 w-4 text-[var(--color-accent)]" />
          </Link>
          <Link
            to="/screenings"
            className="flex items-center justify-between border border-[rgba(223,197,106,0.16)] bg-[rgba(27,34,49,0.54)] px-4 py-4 text-left text-sm text-white transition-colors hover:border-[rgba(223,197,106,0.34)] hover:text-[var(--color-accent)]"
          >
            <span>Screenings</span>
            <Film className="h-4 w-4 text-[var(--color-accent)]" />
          </Link>
        </div>
      </div>
    </section>
  );
}
