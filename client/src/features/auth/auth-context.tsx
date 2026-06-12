import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  ApiError,
  getMe,
  registerAudienceAccount,
  requestPasswordResetEmail,
  requestTwoFactorEmailOtp,
  verifyTwoFactorEmailOtp,
  type MeResponse,
  type ProfileSummary,
  type TwoFactorEmailOtpRequestResponse,
} from "@/lib/api/client";
import {
  clearTwoFactorSessionToken,
  getTwoFactorSessionToken,
  setRememberAuthSession,
  setTwoFactorSessionToken,
} from "@/lib/auth/session-storage";
import { supabase } from "@/lib/supabase/client";
import type { AppRole } from "@/types/auth";

type SignInPayload = {
  email: string;
  password: string;
  rememberMe: boolean;
};

type SignUpPayload = {
  email: string;
  password: string;
};

export type SignUpResult = {
  session: Session | null;
  user: User | null;
};

export type SignInResult = {
  session: Session | null;
  user: User | null;
  requiresTwoFactor: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  backendUser: MeResponse | null;
  profile: ProfileSummary | null;
  role: AppRole;
  isLoading: boolean;
  isSigningOut: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  isPasswordRecoverySession: boolean;
  isTwoFactorRequired: boolean;
  twoFactorEmail: string | null;
  twoFactorExpiresAt: string | null;
  twoFactorResendAvailableAt: string | null;
  authError: string | null;
  signIn: (payload: SignInPayload) => Promise<SignInResult>;
  signUp: (payload: SignUpPayload) => Promise<SignUpResult>;
  resendTwoFactorCode: () => Promise<TwoFactorEmailOtpRequestResponse>;
  verifyTwoFactorCode: (code: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: (credential: string, nonce: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TWO_FACTOR_EXEMPT_EMAILS = new Set([
  "admin@test.com",
  "validator@example.com",
]);
const TRANSIENT_AUTH_RETRY_DELAY_MS = 600;

function getUserRole(user: User | null, backendUser: MeResponse | null): AppRole {
  const role =
    backendUser?.profile?.role ??
    backendUser?.role ??
    user?.app_metadata?.role ??
    user?.user_metadata?.role ??
    "audience";

  if (role === "cinema_admin" || role === "validator") {
    return role;
  }

  return "audience";
}

function getBackendUserId(backendUser: MeResponse | null): string | null {
  return backendUser?.id ?? backendUser?.profile?.user_id ?? null;
}

function requiresEmailTwoFactor(user: User | null): boolean {
  const normalizedEmail = user?.email?.trim().toLowerCase();
  if (normalizedEmail && TWO_FACTOR_EXEMPT_EMAILS.has(normalizedEmail)) {
    return false;
  }

  const provider = user?.app_metadata?.provider;
  const providers = user?.app_metadata?.providers;
  if (provider === "google") return false;
  if (provider === "email") return true;
  return Array.isArray(providers) && providers.includes("email") && !providers.includes("google");
}

function isTwoFactorRequiredError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 403) {
    return false;
  }

  const detail = error.detail;
  if (typeof detail !== "object" || detail === null || !("detail" in detail)) {
    return false;
  }

  const responseDetail = detail.detail;
  return (
    typeof responseDetail === "object" &&
    responseDetail !== null &&
    "code" in responseDetail &&
    responseDetail.code === "two_factor_required"
  );
}

function isTransientFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "TypeError" &&
    /failed to fetch|networkerror|load failed/i.test(error.message)
  );
}

function waitForTransientAuthRetry() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, TRANSIENT_AUTH_RETRY_DELAY_MS);
  });
}

async function retryTransientAuthRequest<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!isTransientFetchError(error)) {
      throw error;
    }

    await waitForTransientAuthRetry();
    return request();
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [backendUser, setBackendUser] = useState<MeResponse | null>(null);
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(() =>
    getTwoFactorSessionToken(),
  );
  const [isTwoFactorRequired, setIsTwoFactorRequired] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState<string | null>(null);
  const [twoFactorExpiresAt, setTwoFactorExpiresAt] = useState<string | null>(null);
  const [twoFactorResendAvailableAt, setTwoFactorResendAvailableAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isPasswordRecoverySession, setIsPasswordRecoverySession] =
    useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasResolvedInitialSession, setHasResolvedInitialSession] = useState(false);
  const backendUserId = getBackendUserId(backendUser);
  const hasBackendUser = Boolean(backendUser);
  const lastSyncedAuthRef = useRef<{
    accessToken: string | null;
    userId: string | null;
  }>({
    accessToken: null,
    userId: null,
  });

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecoverySession(true);
      }

      if (event === "SIGNED_OUT") {
        setIsPasswordRecoverySession(false);
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setHasResolvedInitialSession(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function syncBackendUser() {
      if (!hasResolvedInitialSession) {
        return;
      }

      if (!session?.access_token) {
        setBackendUser(null);
        setAuthError(null);
        setIsTwoFactorRequired(false);
        setTwoFactorEmail(null);
        setIsLoading(false);
        lastSyncedAuthRef.current = {
          accessToken: null,
          userId: null,
        };
        return;
      }

      if (requiresEmailTwoFactor(session.user) && !twoFactorToken) {
        setBackendUser(null);
        setAuthError(null);
        setIsTwoFactorRequired(true);
        setTwoFactorEmail(session.user.email ?? null);
        setIsLoading(false);
        lastSyncedAuthRef.current = {
          accessToken: null,
          userId: null,
        };
        return;
      }

      const currentAccessToken = session.access_token;
      const currentUserId = session.user.id;
      const lastSyncedAuth = lastSyncedAuthRef.current;

      if (
        lastSyncedAuth.accessToken === currentAccessToken &&
        lastSyncedAuth.userId === currentUserId
      ) {
        return;
      }

      const isSameAuthenticatedUser =
        Boolean(currentUserId) && backendUserId === currentUserId;
      const shouldBlockRoute = !hasBackendUser || !isSameAuthenticatedUser;

      // Only block protected routes during the initial auth bootstrap
      // or when the authenticated user identity actually changes.
      if (shouldBlockRoute) {
        setIsLoading(true);
      }

      try {
        const me = await getMe(currentAccessToken);
        setBackendUser(me);
        setAuthError(null);
        setIsTwoFactorRequired(false);
        setTwoFactorEmail(null);
        lastSyncedAuthRef.current = {
          accessToken: currentAccessToken,
          userId: currentUserId,
        };
      } catch (error) {
        if (isTwoFactorRequiredError(error)) {
          clearTwoFactorSessionToken();
          setTwoFactorToken(null);
          setBackendUser(null);
          setAuthError(null);
          setIsTwoFactorRequired(true);
          setTwoFactorEmail(session.user.email ?? null);
          return;
        }

        if (shouldBlockRoute) {
          setBackendUser(null);
        }
        setAuthError("Could not verify the authenticated user with the backend.");
        lastSyncedAuthRef.current = {
          accessToken: null,
          userId: null,
        };
      } finally {
        if (shouldBlockRoute) {
          setIsLoading(false);
        }
      }
    }

    void syncBackendUser();
  }, [
    backendUserId,
    hasBackendUser,
    hasResolvedInitialSession,
    session,
    session?.access_token,
    session?.user?.id,
    twoFactorToken,
  ]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      backendUser,
      profile: backendUser?.profile ?? null,
      role: getUserRole(user, backendUser),
      isLoading,
      isSigningOut,
      isAuthenticated: Boolean(session?.user && backendUser),
      isConfigured: Boolean(supabase),
      isPasswordRecoverySession,
      isTwoFactorRequired,
      twoFactorEmail,
      twoFactorExpiresAt,
      twoFactorResendAvailableAt,
      authError,
      async signIn(payload) {
        if (!supabase) {
          throw new Error("Supabase auth is not configured");
        }

        const authClient = supabase;
        setRememberAuthSession(payload.rememberMe);
        clearTwoFactorSessionToken();
        setTwoFactorToken(null);
        const { data, error } = await retryTransientAuthRequest(() =>
          authClient.auth.signInWithPassword({
            email: payload.email,
            password: payload.password,
          }),
        );
        if (error) throw error;
        setIsPasswordRecoverySession(false);
        setIsSigningOut(false);

        if (data.session && requiresEmailTwoFactor(data.user)) {
          try {
            const otp = await retryTransientAuthRequest(() =>
              requestTwoFactorEmailOtp(data.session.access_token),
            );
            setIsTwoFactorRequired(true);
            setTwoFactorEmail(data.user.email ?? payload.email);
            setTwoFactorExpiresAt(otp.expires_at);
            setTwoFactorResendAvailableAt(otp.resend_available_at);
          } catch (requestError) {
            await authClient.auth.signOut();
            throw requestError;
          }
        }

        return {
          session: data.session,
          user: data.user,
          requiresTwoFactor: Boolean(data.session && requiresEmailTwoFactor(data.user)),
        };
      },
      async signUp(payload) {
        if (!supabase) {
          throw new Error("Supabase auth is not configured");
        }

        await registerAudienceAccount(payload.email, payload.password);
        setIsPasswordRecoverySession(false);
        setIsSigningOut(false);

        return {
          session: null,
          user: null,
        };
      },
      async resendTwoFactorCode() {
        if (!session?.access_token) {
          throw new Error("Sign in again to request a verification code.");
        }

        const otp = await requestTwoFactorEmailOtp(session.access_token);
        setTwoFactorExpiresAt(otp.expires_at);
        setTwoFactorResendAvailableAt(otp.resend_available_at);
        setIsTwoFactorRequired(true);
        setTwoFactorEmail(session.user.email ?? null);
        return otp;
      },
      async verifyTwoFactorCode(code: string) {
        if (!session?.access_token) {
          throw new Error("Sign in again to verify your code.");
        }

        const verification = await verifyTwoFactorEmailOtp(session.access_token, code);
        setTwoFactorSessionToken(
          verification.two_factor_token,
          verification.expires_at,
        );
        setTwoFactorToken(verification.two_factor_token);
        setTwoFactorExpiresAt(null);
        setTwoFactorResendAvailableAt(null);
        setIsTwoFactorRequired(false);
        setTwoFactorEmail(null);

        const me = await getMe(session.access_token);
        setBackendUser(me);
        setAuthError(null);
        lastSyncedAuthRef.current = {
          accessToken: session.access_token,
          userId: session.user.id,
        };
      },
      async requestPasswordReset(email: string) {
        await requestPasswordResetEmail(email);
      },
      async updatePassword(password: string) {
        if (!supabase) {
          throw new Error("Supabase auth is not configured");
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
      async signOut() {
        if (!supabase) {
          throw new Error("Supabase auth is not configured");
        }

        setIsSigningOut(true);
        setSession(null);
        setUser(null);
        setBackendUser(null);
        clearTwoFactorSessionToken();
        setTwoFactorToken(null);
        setIsTwoFactorRequired(false);
        setTwoFactorEmail(null);
        setTwoFactorExpiresAt(null);
        setTwoFactorResendAvailableAt(null);
        setIsPasswordRecoverySession(false);
        setAuthError(null);
        setIsLoading(false);
        lastSyncedAuthRef.current = {
          accessToken: null,
          userId: null,
        };

        try {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
        } catch (error) {
          throw error;
        } finally {
          setIsSigningOut(false);
        }
      },
      async signInWithGoogle(credential: string, nonce: string) {
        if (!supabase) {
          throw new Error("Supabase auth is not configured");
        }

        clearTwoFactorSessionToken();
        setTwoFactorToken(null);
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: credential,
          nonce,
        });
        if (error) throw error;
        setIsPasswordRecoverySession(false);
        setIsSigningOut(false);
      },
    }),
    [
      session,
      user,
      backendUser,
      isLoading,
      isSigningOut,
      isPasswordRecoverySession,
      isTwoFactorRequired,
      twoFactorEmail,
      twoFactorExpiresAt,
      twoFactorResendAvailableAt,
      authError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
