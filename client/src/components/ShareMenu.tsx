import { useEffect, useRef, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { cn } from "@/utils/cn";

type ShareMenuProps = {
  title: string;
  text: string;
  path?: string;
  align?: "left" | "right";
  variant?: "default" | "compact";
  className?: string;
};

function getShareUrl(path?: string) {
  if (path) {
    return path;
  }

  return window.location.href;
}

function copyWithFallback(value: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
    return Promise.resolve();
  } finally {
    document.body.removeChild(textarea);
  }
}

export function ShareMenu({
  title,
  text,
  path,
  align = "right",
  variant = "default",
  className = "",
}: ShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const url = getShareUrl(path);
  const canNativeShare = Boolean(navigator.share);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  async function handleNativeShare() {
    if (!navigator.share) {
      return;
    }

    try {
      await navigator.share({ title, text, url });
      setIsOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      await handleCopy();
    }
  }

  async function handleCopy() {
    await copyWithFallback(url);
    setCopied(true);

    if (copiedTimeoutRef.current !== null) {
      window.clearTimeout(copiedTimeoutRef.current);
    }

    copiedTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      copiedTimeoutRef.current = null;
    }, 1800);
  }

  return (
    <div
      ref={rootRef}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className={cn("relative inline-flex", className)}
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Share"
        className={
          variant === "compact"
            ? "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm border border-[rgba(223,197,106,0.34)] bg-[rgba(12,16,24,0.78)] text-[var(--color-accent)] shadow-[0_10px_22px_rgba(0,0,0,0.24)] backdrop-blur-sm transition-colors hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.14)] hover:text-white"
            : "inline-flex min-h-10 cursor-pointer items-center gap-2 border border-[rgba(223,197,106,0.34)] bg-[rgba(223,197,106,0.08)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.16)] hover:text-white"
        }
      >
        <Share2 className={variant === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {variant === "compact" ? <span className="sr-only">Share</span> : "Share"}
      </button>

      {isOpen ? (
        <div
          role="menu"
          className={`absolute top-[calc(100%+0.5rem)] z-50 min-w-44 border border-[rgba(223,197,106,0.28)] bg-[rgba(12,18,28,0.98)] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-md ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {canNativeShare ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleNativeShare()}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[rgba(223,197,106,0.12)] hover:text-[var(--color-accent)]"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleCopy()}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[rgba(223,197,106,0.12)] hover:text-[var(--color-accent)]"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy Link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
