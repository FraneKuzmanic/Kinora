import type { SupportedStorage } from "@supabase/supabase-js";

const REMEMBER_AUTH_KEY = "kinora.auth.remember";
const TWO_FACTOR_TOKEN_KEY = "kinora.auth.twoFactorToken";
const TWO_FACTOR_EXPIRES_AT_KEY = "kinora.auth.twoFactorExpiresAt";

function isBrowser() {
  return typeof window !== "undefined";
}

function preferredStorage(): Storage | null {
  if (!isBrowser()) return null;
  return shouldRememberAuthSession() ? window.localStorage : window.sessionStorage;
}

function fallbackStorage(): Storage | null {
  if (!isBrowser()) return null;
  return shouldRememberAuthSession() ? window.sessionStorage : window.localStorage;
}

export function shouldRememberAuthSession() {
  if (!isBrowser()) return true;
  return window.sessionStorage.getItem(REMEMBER_AUTH_KEY) !== "false";
}

export function setRememberAuthSession(remember: boolean) {
  if (!isBrowser()) return;

  if (remember) {
    window.localStorage.setItem(REMEMBER_AUTH_KEY, "true");
    window.sessionStorage.removeItem(REMEMBER_AUTH_KEY);
    return;
  }

  window.sessionStorage.setItem(REMEMBER_AUTH_KEY, "false");
  window.localStorage.removeItem(REMEMBER_AUTH_KEY);
}

export const supabaseAuthStorage: SupportedStorage = {
  getItem(key: string) {
    const primary = preferredStorage()?.getItem(key);
    if (primary !== null && primary !== undefined) return primary;
    return fallbackStorage()?.getItem(key) ?? null;
  },
  setItem(key: string, value: string) {
    preferredStorage()?.setItem(key, value);
    fallbackStorage()?.removeItem(key);
  },
  removeItem(key: string) {
    if (!isBrowser()) return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function getTwoFactorSessionToken() {
  const primary = preferredStorage()?.getItem(TWO_FACTOR_TOKEN_KEY);
  if (primary) return primary;
  return fallbackStorage()?.getItem(TWO_FACTOR_TOKEN_KEY) ?? null;
}

export function setTwoFactorSessionToken(token: string, expiresAt: string) {
  preferredStorage()?.setItem(TWO_FACTOR_TOKEN_KEY, token);
  preferredStorage()?.setItem(TWO_FACTOR_EXPIRES_AT_KEY, expiresAt);
  fallbackStorage()?.removeItem(TWO_FACTOR_TOKEN_KEY);
  fallbackStorage()?.removeItem(TWO_FACTOR_EXPIRES_AT_KEY);
}

export function clearTwoFactorSessionToken() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TWO_FACTOR_TOKEN_KEY);
  window.localStorage.removeItem(TWO_FACTOR_EXPIRES_AT_KEY);
  window.sessionStorage.removeItem(TWO_FACTOR_TOKEN_KEY);
  window.sessionStorage.removeItem(TWO_FACTOR_EXPIRES_AT_KEY);
}
