import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { LogoIcon } from "@/components/icons/LogoIcon";
import { CinemaCameraIcon } from "@/components/icons/CinemaCameraIcon";
import { useAuth } from "@/features/auth/auth-context";
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton";
import { useGoogleOneTap } from "@/features/auth/hooks/use-google-one-tap";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  rememberMe: z.boolean().default(true),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, isAuthenticated, isLoading, role, isConfigured } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAwaitingRedirect, setIsAwaitingRedirect] = useState(false);
  const [submitHovered, setSubmitHovered] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: true,
    },
  });

  const locationState =
    location.state as
      | { from?: { pathname?: string }; passwordReset?: boolean }
      | null;
  const from = locationState?.from?.pathname ?? "/";
  const passwordWasReset = Boolean(locationState?.passwordReset);
  const isLoginBusy = isSubmitting || isAwaitingRedirect;

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return;
    }

    const shouldUseWorkspaceHome =
      from === "/" || from === "/login" || from === "/register";

    const target = shouldUseWorkspaceHome
      ? role === "cinema_admin"
        ? "/dashboard"
        : role === "validator"
          ? "/validator"
          : "/"
      : from;

    navigate(target, { replace: true });
  }, [from, isAuthenticated, isLoading, navigate, role]);

  const { promptOneTap } = useGoogleOneTap({
    redirectTo: from,
    onError: setErrorMessage,
  });

  useEffect(() => {
    void promptOneTap();
  }, [promptOneTap]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      setErrorMessage(null);
      setIsAwaitingRedirect(true);
      const result = await signIn(values);
      if (result.requiresTwoFactor) {
        navigate("/2fa", {
          replace: true,
          state: { from: locationState?.from ?? { pathname: from } },
        });
      }
    } catch (error) {
      setIsAwaitingRedirect(false);
      setErrorMessage(error instanceof Error ? error.message : "Login failed");
    }
  });

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
            <header className="mb-9 flex flex-col items-center text-center md:mb-10">
              <div className="mb-4 w-20 text-[var(--color-accent)] md:w-24">
                <CinemaCameraIcon />
              </div>

              <div className="mb-1 w-48 text-[var(--color-accent)] drop-shadow-[0_0_20px_rgba(223,197,106,0.2)] md:w-52">
                <LogoIcon />
              </div>
            </header>

            {!isConfigured ? (
              <div className="mb-6 border border-[rgba(223,197,106,0.45)] bg-[rgba(223,197,106,0.06)] px-4 py-3 text-center text-sm text-[var(--color-accent)]">
                Supabase Auth is not configured in <code>client/.env</code>.
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mb-6 border border-[rgba(244,114,114,0.45)] bg-[rgba(127,29,29,0.18)] px-4 py-3 text-center text-sm text-red-300">
                {errorMessage}
              </div>
            ) : null}

            {passwordWasReset ? (
              <div className="mb-6 border border-[rgba(223,197,106,0.45)] bg-[rgba(223,197,106,0.06)] px-4 py-3 text-center text-sm text-[var(--color-accent)]">
                Password updated. Sign in with your new password.
              </div>
            ) : null}

            <form className="space-y-6 md:space-y-7" onSubmit={onSubmit}>
              <div className="relative">
                <label
                  htmlFor="email"
                  className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent)] transition-colors"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  className="w-full border-0 border-b border-b-[rgba(223,197,106,0.4)] bg-transparent px-0 py-2 text-base tracking-[0.03em] text-[var(--color-text-primary)] outline-none transition-all duration-300 placeholder:text-[rgba(160,165,181,0.3)] focus:border-b-[var(--color-accent)] focus:pl-2 focus:shadow-[0_10px_20px_-10px_rgba(223,197,106,0.4)]"
                  {...register("email")}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
                {errors.email ? (
                  <p className="mt-2 text-sm text-red-300">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="relative">
                <label
                  htmlFor="password"
                  className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent)] transition-colors"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full border-0 border-b border-b-[rgba(223,197,106,0.4)] bg-transparent px-0 py-2 text-base tracking-[0.03em] text-[var(--color-text-primary)] outline-none transition-all duration-300 placeholder:text-[rgba(160,165,181,0.3)] focus:border-b-[var(--color-accent)] focus:pl-2 focus:shadow-[0_10px_20px_-10px_rgba(223,197,106,0.4)]"
                  {...register("password")}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                {errors.password ? (
                  <p className="mt-2 text-sm text-red-300">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              <label className="flex cursor-pointer items-center gap-3 text-sm text-[var(--color-text-dim)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer border border-[rgba(223,197,106,0.45)] bg-transparent accent-[var(--color-accent)]"
                  {...register("rememberMe")}
                />
                <span>Remember me</span>
              </label>

              <div className="flex flex-col gap-5 pt-1 md:gap-6">
                <Link
                  to="/forgot-password"
                  className="group inline-flex w-fit cursor-pointer items-center gap-2 self-end text-sm text-[rgba(223,197,106,0.4)] transition-colors hover:text-[var(--color-accent)]"
                >
                  <span className="inline-block h-px w-3 bg-[rgba(223,197,106,0.4)] transition-all duration-300 group-hover:w-6 group-hover:bg-[var(--color-accent)]" />
                  Forgot my password
                </Link>

                <button
                  type="submit"
                  disabled={isLoginBusy || !isConfigured}
                  onMouseEnter={() => setSubmitHovered(true)}
                  onMouseLeave={() => setSubmitHovered(false)}
                  className="group relative flex w-full cursor-pointer items-center justify-center overflow-hidden border border-[var(--color-accent)] px-6 py-5 font-display text-[1.9rem] tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    className={
                      submitHovered
                        ? "absolute inset-0 z-0 origin-left scale-x-100 bg-[var(--color-accent)] transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]"
                        : "absolute inset-0 z-0 origin-left scale-x-0 bg-[var(--color-accent)] transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-x-100"
                    }
                  />
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    <span
                      className={
                        submitHovered
                          ? "text-[1.2rem] text-[var(--color-bg-primary)] "
                          : "text-[1.2rem] text-[var(--color-accent)] group-hover:text-[var(--color-bg-primary)]"
                      }
                    >
                      Login
                    </span>
                    {isLoginBusy ? (
                      <LoaderCircle
                        className={
                          submitHovered
                            ? "h-7 w-7 animate-spin stroke-[var(--color-bg-primary)] transition-all duration-300"
                            : "h-7 w-7 animate-spin text-[var(--color-accent)] transition-all duration-300 group-hover:stroke-[var(--color-bg-primary)]"
                        }
                      />
                    ) : (
                      <ArrowRight
                        className={
                          submitHovered
                            ? "h-7 w-7 stroke-[var(--color-bg-primary)] transition-all duration-300"
                            : "h-7 w-7 text-[var(--color-accent)] transition-all duration-300 group-hover:translate-x-1 group-hover:stroke-[var(--color-bg-primary)]"
                        }
                      />
                    )}
                  </span>
                </button>
              </div>
            </form>

            <div className="mt-8 flex items-center gap-3 md:mt-9">
              <div className="h-px flex-1 bg-[rgba(223,197,106,0.25)]" />
              <span className="text-xs uppercase tracking-[0.15em] text-[rgba(223,197,106,0.45)]">or</span>
              <div className="h-px flex-1 bg-[rgba(223,197,106,0.25)]" />
            </div>

            <div className="mt-5 md:mt-6">
              <GoogleSignInButton redirectTo={from} onError={setErrorMessage} />
            </div>

            <div className="mt-8 flex items-center justify-center gap-4 opacity-60 md:mt-9">
              <div className="h-px w-10 bg-[rgba(223,197,106,0.4)]" />
              <div className="h-1.5 w-1.5 rotate-45 bg-[var(--color-accent)]" />
              <div className="h-px w-10 bg-[rgba(223,197,106,0.4)]" />
            </div>

            <p className="mt-6 text-center text-sm text-[var(--color-text-dim)] md:mt-7">
              No account yet?{" "}
              <Link
                to="/register"
                className="text-[var(--color-accent)] transition-colors hover:text-white"
              >
                Register
              </Link>
            </p>
          </div>
        </div>
      </main>
    </section>
  );
}
