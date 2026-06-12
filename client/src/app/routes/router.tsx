import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "@/app/routes/root-layout";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { CampaignsPage } from "@/features/campaigns/routes/campaigns-page";
import { DiscoverPage } from "@/features/discover/routes/DiscoverPage";
import { ScreeningsPage } from "@/features/screenings/routes/screenings-page";

const NotFoundPage = lazy(() =>
  import("@/app/routes/not-found-page").then(({ NotFoundPage }) => ({
    default: NotFoundPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("@/features/auth/routes/ForgotPasswordPage").then(
    ({ ForgotPasswordPage }) => ({ default: ForgotPasswordPage }),
  ),
);
const LoginPage = lazy(() =>
  import("@/features/auth/routes/LoginPage").then(({ LoginPage }) => ({
    default: LoginPage,
  })),
);
const RegisterPage = lazy(() =>
  import("@/features/auth/routes/RegisterPage").then(({ RegisterPage }) => ({
    default: RegisterPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("@/features/auth/routes/ResetPasswordPage").then(
    ({ ResetPasswordPage }) => ({ default: ResetPasswordPage }),
  ),
);
const TwoFactorPage = lazy(() =>
  import("@/features/auth/routes/TwoFactorPage").then(({ TwoFactorPage }) => ({
    default: TwoFactorPage,
  })),
);
const UnauthorizedPage = lazy(() =>
  import("@/features/auth/routes/unauthorized-page").then(
    ({ UnauthorizedPage }) => ({ default: UnauthorizedPage }),
  ),
);
const CampaignDetailPage = lazy(() =>
  import("@/features/campaigns/routes/campaign-detail-page").then(
    ({ CampaignDetailPage }) => ({ default: CampaignDetailPage }),
  ),
);
const AnalyticsPage = lazy(() =>
  import("@/features/dashboard/routes/analytics-page").then(
    ({ AnalyticsPage }) => ({ default: AnalyticsPage }),
  ),
);
const DashboardPage = lazy(() =>
  import("@/features/dashboard/routes/dashboard-page").then(
    ({ DashboardPage }) => ({ default: DashboardPage }),
  ),
);
const PrivateBookingPage = lazy(() =>
  import("@/features/private-bookings/routes/private-booking-page").then(
    ({ PrivateBookingPage }) => ({ default: PrivateBookingPage }),
  ),
);
const ScreeningDetailPage = lazy(() =>
  import("@/features/screenings/routes/screening-detail-page").then(
    ({ ScreeningDetailPage }) => ({ default: ScreeningDetailPage }),
  ),
);
const TicketsPage = lazy(() =>
  import("@/features/tickets/routes/tickets-page").then(({ TicketsPage }) => ({
    default: TicketsPage,
  })),
);
const ValidatorPage = lazy(() =>
  import("@/features/validator/routes/validator-page").then(
    ({ ValidatorPage }) => ({ default: ValidatorPage }),
  ),
);

function RouteLoadingFallback() {
  return (
    <div
      className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-4 text-sm text-[var(--color-text-dim)] sm:px-8"
      aria-live="polite"
    >
      Loading...
    </div>
  );
}

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={<RouteLoadingFallback />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <DiscoverPage />,
      },
      {
        path: "campaigns",
        element: <CampaignsPage />,
      },
      {
        path: "campaigns/:campaignId",
        element: lazyRoute(<CampaignDetailPage />),
      },
      {
        path: "screenings",
        element: <ScreeningsPage />,
      },
      {
        path: "screenings/:screeningId",
        element: lazyRoute(<ScreeningDetailPage />),
      },
      {
        path: "private-booking",
        element: lazyRoute(<PrivateBookingPage />),
      },
      {
        path: "tickets",
        element: <AuthGuard allowedRoles={["audience", "cinema_admin"]} />,
        children: [
          {
            index: true,
            element: lazyRoute(<TicketsPage />),
          },
        ],
      },
      {
        path: "dashboard",
        element: <AuthGuard allowedRoles={["cinema_admin"]} />,
        children: [
          {
            index: true,
            element: lazyRoute(<DashboardPage />),
          },
          {
            path: "analytics",
            element: lazyRoute(<AnalyticsPage />),
          },
        ],
      },
      {
        path: "validator",
        element: <AuthGuard allowedRoles={["validator"]} />,
        children: [
          {
            index: true,
            element: lazyRoute(<ValidatorPage />),
          },
        ],
      },
      {
        path: "login",
        element: lazyRoute(<LoginPage />),
      },
      {
        path: "2fa",
        element: lazyRoute(<TwoFactorPage />),
      },
      {
        path: "forgot-password",
        element: lazyRoute(<ForgotPasswordPage />),
      },
      {
        path: "reset-password",
        element: lazyRoute(<ResetPasswordPage />),
      },
      {
        path: "register",
        element: lazyRoute(<RegisterPage />),
      },
      {
        path: "unauthorized",
        element: lazyRoute(<UnauthorizedPage />),
      },
      {
        path: "*",
        element: lazyRoute(<NotFoundPage />),
      },
    ],
  },
]);
