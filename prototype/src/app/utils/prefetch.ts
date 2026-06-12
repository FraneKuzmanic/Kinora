/**
 * Prefetch all route modules in the background
 */
export function prefetchRoutes() {
  // Prefetch all lazy-loaded pages
  const routes = [
    () => import("../pages/DiscoverPage"),
    () => import("../pages/VotingPage"),
    () => import("../pages/ScreeningsPage"),
    () => import("../pages/ScreeningDetailPage"),
    () => import("../pages/PrivateBookingPage"),
    () => import("../pages/MyTicketsPage"),
    () => import("../pages/CinemaDashboardPage"),
  ];

  // Start prefetching after a short delay to not block initial render
  setTimeout(() => {
    routes.forEach((importFn) => {
      importFn().catch(() => {
        // Silently fail - routes will still load on demand if prefetch fails
      });
    });
  }, 100);
}
