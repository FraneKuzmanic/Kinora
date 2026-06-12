import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { AuthPageFrame } from "@/features/auth/components/auth-page-frame";
import { useAuth } from "@/features/auth/auth-context";

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z
      .string()
      .min(6, "Password must be at least 6 characters."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const inputClassName =
  "w-full border-0 border-b border-b-[rgba(223,197,106,0.4)] bg-transparent px-0 py-2 text-base tracking-[0.03em] text-[var(--color-text-primary)] outline-none transition-all duration-300 placeholder:text-[rgba(160,165,181,0.3)] focus:border-b-[var(--color-accent)] focus:pl-2 focus:shadow-[0_10px_20px_-10px_rgba(223,197,106,0.4)]";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const {
    isConfigured,
    isPasswordRecoverySession,
    updatePassword,
    signOut,
  } = useAuth();
  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitHovered, setSubmitHovered] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    if (!isConfigured || isPasswordRecoverySession) {
      setIsCheckingLink(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsCheckingLink(false);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [isConfigured, isPasswordRecoverySession]);

  const onSubmit = handleSubmit(async (values) => {
    if (!isPasswordRecoverySession) {
      setErrorMessage("This reset link is invalid or expired.");
      return;
    }

    try {
      setErrorMessage(null);
      await updatePassword(values.password);
      await signOut();
      navigate("/login", {
        replace: true,
        state: { passwordReset: true },
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update password",
      );
    }
  });

  if (isCheckingLink) {
    return (
      <AuthPageFrame>
        <div className="flex flex-col items-center py-8 text-center">
          <LoaderCircle className="mb-5 h-9 w-9 animate-spin text-[var(--color-accent)]" />
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Checking reset link
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-dim)]">
            We are confirming your secure recovery session.
          </p>
        </div>
      </AuthPageFrame>
    );
  }

  if (!isConfigured) {
    return (
      <AuthPageFrame>
        <div className="border border-[rgba(223,197,106,0.45)] bg-[rgba(223,197,106,0.06)] px-4 py-3 text-center text-sm text-[var(--color-accent)]">
          Supabase Auth is not configured in <code>client/.env</code>.
        </div>
      </AuthPageFrame>
    );
  }

  if (!isPasswordRecoverySession) {
    return (
      <AuthPageFrame>
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Reset link expired
          </p>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.08em] text-white">
            Request a new link
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-dim)]">
            This password reset link is invalid, expired, or has already been used.
          </p>
        </div>

        <div className="mt-8 grid gap-3">
          <Link
            to="/forgot-password"
            className="group relative flex w-full items-center justify-center overflow-hidden border border-[var(--color-accent)] px-6 py-4 font-display tracking-[0.12em]"
          >
            <span className="absolute inset-0 z-0 origin-left scale-x-0 bg-[var(--color-accent)] transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-x-100" />
            <span className="relative z-10 flex items-center gap-3 text-[1.1rem] text-[var(--color-accent)] transition-colors group-hover:text-[var(--color-bg-primary)]">
              Get new link
              <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 py-2 text-sm text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-accent)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>
      </AuthPageFrame>
    );
  }

  return (
    <AuthPageFrame>
      <div className="mb-7 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]">
          New password
        </p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.08em] text-white">
          Reset access
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-dim)]">
          Choose a new password. After it is saved, you will sign in again.
        </p>
      </div>

      {errorMessage ? (
        <div className="mb-6 border border-[rgba(244,114,114,0.45)] bg-[rgba(127,29,29,0.18)] px-4 py-3 text-center text-sm text-red-300">
          {errorMessage}
        </div>
      ) : null}

      <form className="space-y-7" onSubmit={onSubmit}>
        <div className="relative">
          <label
            htmlFor="reset-password"
            className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]"
          >
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder="Create your new password"
            className={inputClassName}
            {...register("password")}
          />
          {errors.password ? (
            <p className="mt-2 text-sm text-red-300">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="relative">
          <label
            htmlFor="reset-confirm-password"
            className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]"
          >
            Confirm password
          </label>
          <input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm your new password"
            className={inputClassName}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="mt-2 text-sm text-red-300">
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
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
              {isSubmitting ? "Saving password" : "Save new password"}
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
              <ArrowRight
                className={
                  submitHovered
                    ? "h-6 w-6 stroke-[var(--color-bg-primary)] transition-all duration-300"
                    : "h-6 w-6 text-[var(--color-accent)] transition-all duration-300 group-hover:translate-x-1 group-hover:stroke-[var(--color-bg-primary)]"
                }
              />
            )}
          </span>
        </button>
      </form>
    </AuthPageFrame>
  );
}
