import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { AuthPageFrame } from "@/features/auth/components/auth-page-frame";
import { useAuth } from "@/features/auth/auth-context";

const twoFactorSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit verification code."),
});

type TwoFactorFormValues = z.infer<typeof twoFactorSchema>;

const inputClassName =
  "w-full border-0 border-b border-b-[rgba(223,197,106,0.4)] bg-transparent px-0 py-3 text-center font-display text-3xl tracking-[0.35em] text-[var(--color-text-primary)] outline-none transition-all duration-300 placeholder:text-[rgba(160,165,181,0.25)] focus:border-b-[var(--color-accent)] focus:shadow-[0_10px_20px_-10px_rgba(223,197,106,0.4)]";

function getWorkspaceTarget(role: string, from: string) {
  if (from !== "/" && from !== "/login" && from !== "/register" && from !== "/2fa") {
    return from;
  }
  if (role === "cinema_admin") return "/dashboard";
  if (role === "validator") return "/validator";
  return "/";
}

function getSecondsUntil(value: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000));
}

export function TwoFactorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    session,
    isAuthenticated,
    isLoading,
    isSigningOut,
    isTwoFactorRequired,
    twoFactorEmail,
    twoFactorResendAvailableAt,
    role,
    resendTwoFactorCode,
    verifyTwoFactorCode,
    signOut,
  } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(() =>
    getSecondsUntil(twoFactorResendAvailableAt),
  );
  const [submitHovered, setSubmitHovered] = useState(false);
  const [resendHovered, setResendHovered] = useState(false);

  const locationState = location.state as { from?: { pathname?: string } } | null;
  const from = locationState?.from?.pathname ?? "/";
  const target = useMemo(() => getWorkspaceTarget(role, from), [from, role]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TwoFactorFormValues>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: {
      code: "",
    },
  });

  useEffect(() => {
    setResendSeconds(getSecondsUntil(twoFactorResendAvailableAt));
    const timer = window.setInterval(() => {
      setResendSeconds(getSecondsUntil(twoFactorResendAvailableAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [twoFactorResendAvailableAt]);

  useEffect(() => {
    if (isSigningOut || isLoading) return;
    if (isAuthenticated) {
      navigate(target, { replace: true });
      return;
    }
    if (!session) {
      navigate("/login", { replace: true, state: { from: locationState?.from } });
    }
  }, [
    isAuthenticated,
    isLoading,
    isSigningOut,
    locationState?.from,
    navigate,
    session,
    target,
  ]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      await verifyTwoFactorCode(values.code);
      setSuccessMessage("Verification complete.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not verify that code.",
      );
      setValue("code", "");
    }
  });

  const onResend = async () => {
    try {
      setResendBusy(true);
      setErrorMessage(null);
      const result = await resendTwoFactorCode();
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not send a new code.",
      );
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <AuthPageFrame>
      <div className="mb-7 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Email verification
        </p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.08em] text-white">
          Enter code
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-dim)]">
          We sent a 6-digit code to {twoFactorEmail ?? "your email"}.
        </p>
      </div>

      {errorMessage ? (
        <div className="mb-6 border border-[rgba(244,114,114,0.45)] bg-[rgba(127,29,29,0.18)] px-4 py-3 text-center text-sm text-red-300">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-6 border border-[rgba(223,197,106,0.45)] bg-[rgba(223,197,106,0.06)] px-4 py-3 text-center text-sm text-[var(--color-accent)]">
          {successMessage}
        </div>
      ) : null}

      <form className="space-y-7" onSubmit={onSubmit}>
        <div className="relative">
          <label
            htmlFor="two-factor-code"
            className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]"
          >
            Verification code
          </label>
          <input
            id="two-factor-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className={inputClassName}
            {...register("code")}
          />
          {errors.code ? (
            <p className="mt-2 text-sm text-red-300">{errors.code.message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !isTwoFactorRequired}
          onMouseEnter={() => setSubmitHovered(true)}
          onMouseLeave={() => setSubmitHovered(false)}
          className="group relative flex w-full cursor-pointer items-center justify-center overflow-hidden border border-[var(--color-accent)] px-6 py-5 font-display tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
                  ? "text-[1.1rem] text-[var(--color-bg-primary)]"
                  : "text-[1.1rem] text-[var(--color-accent)] group-hover:text-[var(--color-bg-primary)]"
              }
            >
              {isSubmitting ? "Checking" : "Verify"}
            </span>
            {isSubmitting ? (
              <LoaderCircle
                className={
                  submitHovered
                    ? "h-6 w-6 animate-spin stroke-[var(--color-bg-primary)] transition-all duration-300"
                    : "h-6 w-6 animate-spin text-[var(--color-accent)] transition-all duration-300 group-hover:stroke-[var(--color-bg-primary)]"
                }
              />
            ) : (
              <ShieldCheck
                className={
                  submitHovered
                    ? "h-6 w-6 stroke-[var(--color-bg-primary)] transition-all duration-300"
                    : "h-6 w-6 text-[var(--color-accent)] transition-all duration-300 group-hover:stroke-[var(--color-bg-primary)]"
                }
              />
            )}
          </span>
        </button>
      </form>

      <button
        type="button"
        disabled={resendBusy || resendSeconds > 0}
        onClick={onResend}
        onMouseEnter={() => setResendHovered(true)}
        onMouseLeave={() => setResendHovered(false)}
        className="group mt-5 flex w-full cursor-pointer items-center justify-center gap-2 border border-[rgba(223,197,106,0.35)] px-4 py-3 text-sm text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.06)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {resendBusy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Mail
            className={
              resendHovered ? "h-4 w-4 stroke-white" : "h-4 w-4 stroke-[var(--color-accent)]"
            }
          />
        )}
        {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code on email"}
      </button>

      <p className="mt-7 text-center text-sm text-[var(--color-text-dim)]">
        Wrong account?{" "}
        <Link
          to="/login"
          onClick={() => {
            void signOut();
          }}
          className="inline-flex items-center gap-2 text-[var(--color-accent)] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Login
        </Link>
      </p>
    </AuthPageFrame>
  );
}
