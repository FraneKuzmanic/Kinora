/// <reference types="vite/client" />

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

function getDefaultShareBaseUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:5173";
  }

  return window.location.origin;
}

const required = {
  apiBaseUrl,
  shareBaseUrl: import.meta.env.VITE_SHARE_BASE_URL ?? getDefaultShareBaseUrl(),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
};

export const env = required;
