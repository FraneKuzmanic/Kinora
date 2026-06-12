import { cn } from "@/utils/cn";

type ValidatorStatusBadgeProps = {
  label: string;
  tone: "gold" | "green" | "red" | "slate";
  className?: string;
};

const toneClasses: Record<ValidatorStatusBadgeProps["tone"], string> = {
  gold: "border-[rgba(223,197,106,0.32)] bg-[rgba(223,197,106,0.12)] text-[var(--color-accent)]",
  green:
    "border-[rgba(74,222,128,0.28)] bg-[rgba(74,222,128,0.14)] text-emerald-300",
  red: "border-[rgba(248,113,113,0.28)] bg-[rgba(127,29,29,0.24)] text-rose-300",
  slate:
    "border-[rgba(122,132,153,0.28)] bg-[rgba(122,132,153,0.12)] text-[rgba(226,232,240,0.88)]",
};

export function ValidatorStatusBadge({
  label,
  tone,
  className,
}: ValidatorStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] sm:tracking-[0.22em]",
        toneClasses[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
