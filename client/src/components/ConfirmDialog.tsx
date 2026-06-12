import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, X } from "lucide-react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

type PendingConfirm = Required<ConfirmOptions>;

const ConfirmDialogContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(
  null,
);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setPending({
        title: options.title ?? "Are you sure?",
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Confirm",
        cancelLabel: options.cancelLabel ?? "Cancel",
        tone: options.tone ?? "danger",
      });
    });
  }, []);

  const close = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    if (!pending) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, pending]);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {pending ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-[rgba(19,26,39,0.88)] backdrop-blur-md"
            onClick={() => close(false)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-sm border border-[rgba(223,197,106,0.38)] bg-[var(--color-bg-main)] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <button
              type="button"
              onClick={() => close(false)}
              className="absolute right-4 top-4 cursor-pointer p-2 text-[var(--color-text-dim)] transition-colors hover:text-white"
              aria-label="Close confirmation"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-[rgba(223,197,106,0.16)] bg-gradient-to-b from-white/5 to-transparent px-6 pb-5 pt-7">
              <div className="flex items-start gap-4 pr-10">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-[rgba(223,197,106,0.35)] bg-[rgba(223,197,106,0.08)] text-[var(--color-accent)]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-accent)]">
                    confirmation
                  </p>
                  <h2 className="mt-2 font-heading text-2xl leading-tight text-white">
                    {pending.title}
                  </h2>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm leading-6 text-[var(--color-text-muted)]">
                {pending.message}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[rgba(223,197,106,0.14)] bg-black/20 px-6 py-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => close(false)}
                className="cursor-pointer border border-[rgba(122,132,153,0.35)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-dim)] transition-colors hover:border-[rgba(223,197,106,0.35)] hover:text-white"
              >
                {pending.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`cursor-pointer px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                  pending.tone === "danger"
                    ? "bg-[#f87171] text-[#1b0f12] hover:bg-[#fca5a5]"
                    : "bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:bg-white"
                }`}
              >
                {pending.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const confirm = useContext(ConfirmDialogContext);
  if (!confirm) {
    throw new Error("useConfirmDialog must be used inside ConfirmDialogProvider");
  }
  return confirm;
}
