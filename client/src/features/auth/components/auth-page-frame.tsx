import type { PropsWithChildren, ReactNode } from "react";
import { CinemaCameraIcon } from "@/components/icons/CinemaCameraIcon";
import { LogoIcon } from "@/components/icons/LogoIcon";

type AuthPageFrameProps = PropsWithChildren<{
  notice?: ReactNode;
}>;

export function AuthPageFrame({ children, notice }: AuthPageFrameProps) {
  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-x-hidden overflow-y-auto px-6 py-5 text-white md:py-6">
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(223, 197, 106, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(223, 197, 106, 0.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[-20vh] z-[2] h-screen w-screen -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(223, 197, 106, 0.1) 0%, rgba(19, 26, 39, 0) 70%)",
        }}
      />

      <main className="relative z-20 w-full max-w-[470px] p-6 md:p-7">
        <div className="relative border border-[rgba(223,197,106,0.4)] bg-[var(--color-bg-primary)] p-[3px]">
          <span className="absolute -left-[5px] -top-[5px] z-[2] h-[10px] w-[10px] border border-[var(--color-accent)] bg-[var(--color-bg-primary)]" />
          <span className="absolute -right-[5px] -top-[5px] z-[2] h-[10px] w-[10px] border border-[var(--color-accent)] bg-[var(--color-bg-primary)]" />
          <span className="absolute -bottom-[5px] -left-[5px] z-[2] h-[10px] w-[10px] border border-[var(--color-accent)] bg-[var(--color-bg-primary)]" />
          <span className="absolute -bottom-[5px] -right-[5px] z-[2] h-[10px] w-[10px] border border-[var(--color-accent)] bg-[var(--color-bg-primary)]" />

          <div className="relative border border-[var(--color-accent)] bg-[linear-gradient(180deg,rgba(26,35,51,0.4)_0%,rgba(19,26,39,0.9)_100%)] px-8 py-9 md:px-10 md:py-10">
            <header className="mb-8 flex flex-col items-center text-center md:mb-9">
              <div className="mb-4 w-20 text-[var(--color-accent)] md:w-24">
                <CinemaCameraIcon />
              </div>

              <div className="mb-1 w-48 text-[var(--color-accent)] drop-shadow-[0_0_20px_rgba(223,197,106,0.2)] md:w-52">
                <LogoIcon />
              </div>
            </header>

            {notice}
            {children}
          </div>
        </div>
      </main>
    </section>
  );
}
