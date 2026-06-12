import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { env } from "@/config/env";
import { useAuth } from "@/features/auth/auth-context";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (callback?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  // Use plain hex (URL-safe, no padding) for both nonces so Google's JWT
  // nonce claim matches SHA-256(raw) byte-for-byte.
  const raw = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = bytesToHex(new Uint8Array(hash));
  return { raw, hashed };
}

// Module-level singleton: GSI must only be initialized once per page load
// to keep the nonce and callback consistent.
let gsiNonce: { raw: string; hashed: string } | null = null;
let gsiInitialized = false;

type CallbackFn = (credential: string, rawNonce: string) => Promise<void>;

// The active callback is stored globally so all hook instances share one reference.
// Updating this ref keeps the callback fresh without re-initializing GSI.
const activeCallbackRef: { current: CallbackFn | null } = { current: null };

async function ensureGSIInitialized(clientId: string) {
  if (gsiInitialized) return;
  if (!window.google) return;

  if (!gsiNonce) {
    gsiNonce = await generateNonce();
  }

  gsiInitialized = true;

  window.google.accounts.id.initialize({
    client_id: clientId,
    nonce: gsiNonce.hashed,
    callback: (response: { credential: string }) => {
      void activeCallbackRef.current?.(response.credential, gsiNonce!.raw);
    },
  });
}

export function useGoogleOneTap({
  redirectTo,
  onError,
}: {
  redirectTo: string;
  onError?: (message: string) => void;
}) {
  const { signInWithGoogle, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isAvailable = Boolean(env.googleClientId);

  // Keep a ref to the latest deps so the GSI callback is always fresh
  // without needing to re-initialize GSI (which would generate a new nonce).
  const redirectToRef = useRef(redirectTo);
  const onErrorRef = useRef(onError);
  const signInRef = useRef(signInWithGoogle);

  useEffect(() => { redirectToRef.current = redirectTo; }, [redirectTo]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { signInRef.current = signInWithGoogle; }, [signInWithGoogle]);

  // Register this hook instance's callback as the active one
  useEffect(() => {
    activeCallbackRef.current = async (credential, rawNonce) => {
      try {
        await signInRef.current(credential, rawNonce);
        navigate(redirectToRef.current, { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Google sign-in failed";
        console.error("[Google One Tap] sign-in error:", err);
        onErrorRef.current?.(message);
      }
    };
  }, [navigate]);

  const initGSI = useCallback(async () => {
    if (!isAvailable) return;
    await ensureGSIInitialized(env.googleClientId);
  }, [isAvailable]);

  const promptOneTap = useCallback(async () => {
    if (isAuthenticated || !isAvailable) return;
    await initGSI();
    window.google?.accounts.id.prompt();
  }, [isAuthenticated, isAvailable, initGSI]);

  const renderButton = useCallback(
    async (element: HTMLElement) => {
      if (!isAvailable) return;
      await initGSI();
      window.google?.accounts.id.renderButton(element, {
        theme: "outline",
        size: "large",
        width: element.offsetWidth || 400,
        text: "continue_with",
        shape: "rectangular",
      });
    },
    [isAvailable, initGSI],
  );

  return { promptOneTap, renderButton, isAvailable };
}
