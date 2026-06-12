import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail } from "lucide-react";
import { AuthPageFrame } from "@/features/auth/components/auth-page-frame";
import { useAuth } from "@/features/auth/auth-context";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const inputClassName =
  "w-full border-0 border-b border-b-[rgba(223,197,106,0.4)] bg-transparent px-0 py-2 text-base tracking-[0.03em] text-[var(--color-text-primary)] outline-none transition-all duration-300 placeholder:text-[rgba(160,165,181,0.3)] focus:border-b-[var(--color-accent)] focus:pl-2 focus:shadow-[0_10px_20px_-10px_rgba(223,197,106,0.4)]";

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitHovered, setSubmitHovered] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      await requestPasswordReset(values.email);
      setSuccessMessage(
        "If an account exists for that email, we sent a reset link.",
      );
      reset();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not send reset link",
      );
    }
  });

  return (
    <AuthPageFrame>
      <div className="mb-7 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Password reset
        </p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.08em] text-white">
          Check your email
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-dim)]">
          Enter the email tied to your Kinora account and we will send a secure reset link.
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
            htmlFor="forgot-password-email"
            className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]"
          >
            Email
          </label>
          <input
            id="forgot-password-email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            className={inputClassName}
            {...register("email")}
          />
          {errors.email ? (
            <p className="mt-2 text-sm text-red-300">
              {errors.email.message}
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
              {isSubmitting ? "Sending link" : "Send reset link"}
            </span>
            <Mail
              className={
                submitHovered
                  ? "h-6 w-6 stroke-[var(--color-bg-primary)] transition-all duration-300"
                  : "h-6 w-6 text-[var(--color-accent)] transition-all duration-300 group-hover:stroke-[var(--color-bg-primary)]"
              }
            />
          </span>
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-[var(--color-text-dim)]">
        Remembered it?{" "}
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-[var(--color-accent)] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Login
        </Link>
      </p>
    </AuthPageFrame>
  );
}
