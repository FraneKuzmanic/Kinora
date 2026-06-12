import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Building2,
  CalendarClock,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Ticket,
  Wallet,
  UserCircle2,
  UserPlus,
  X,
} from "lucide-react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/utils/cn";
import { ConfirmDialogProvider } from "@/components/ConfirmDialog";
import { LogoIcon } from "@/components/icons/LogoIcon";
import { useAuth } from "@/features/auth/auth-context";

const navItems = [
  { label: "Discover", to: "/" },
  { label: "Voting", to: "/campaigns" },
  { label: "Screenings", to: "/screenings" },
  { label: "Private Booking", to: "/private-booking" },
];

export type DashboardMobileTab =
  | "campaigns"
  | "validators"
  | "profile"
  | "locations"
  | "bookings";

const dashboardMobileTabs: Array<{
  id: DashboardMobileTab;
  label: string;
  icon: ReactNode;
}> = [
  { id: "campaigns", label: "Campaigns", icon: <CalendarClock className="h-4 w-4" /> },
  { id: "validators", label: "Validators", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "profile", label: "Cinema Profile", icon: <Building2 className="h-4 w-4" /> },
  { id: "locations", label: "Locations & Halls", icon: <MapPin className="h-4 w-4" /> },
  { id: "bookings", label: "Private Bookings", icon: <Ticket className="h-4 w-4" /> },
];

export type RootLayoutOutletContext = {
  searchQuery: string;
  dashboardMobileTab: DashboardMobileTab;
  setDashboardMobileTab: (tab: DashboardMobileTab) => void;
};

const VOTING_SCROLL_STORAGE_KEY = "kinora:scroll:/campaigns";

export function RootLayout() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dashboardMobileTab, setDashboardMobileTab] =
    useState<DashboardMobileTab>("campaigns");
  const location = useLocation();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const previousPathRef = useRef(location.pathname);
  const { isAuthenticated, isLoading, isSigningOut, profile, backendUser, role, user, signOut } = useAuth();

  const accountLabel =
    profile?.display_name?.trim() ||
    backendUser?.email ||
    user?.email ||
    "Account";
  const isAuthRoute =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/reset-password";
  const isCinemaAdminWorkspace = isAuthenticated && role === "cinema_admin";
  const isValidatorWorkspace = isAuthenticated && role === "validator";
  const isCinemaAdminRoute = location.pathname.startsWith("/dashboard");
  const isValidatorRoute = location.pathname.startsWith("/validator");
  const isDiscoverRoute = location.pathname === "/";
  const isAudienceSearchRoute =
    isDiscoverRoute ||
    location.pathname === "/campaigns" ||
    location.pathname === "/screenings";
  const mainTopPadding = isAuthRoute
    ? "pt-0"
    : isCinemaAdminWorkspace
      ? "pt-20 sm:pt-24 lg:pt-32"
      : isValidatorWorkspace
        ? "pt-20 sm:pt-24"
        : "pt-[4.75rem] lg:pt-0";

  useEffect(() => {
    const previousPath = previousPathRef.current;
    let restoreTimeouts: number[] = [];

    if (previousPath === "/campaigns") {
      sessionStorage.setItem(
        VOTING_SCROLL_STORAGE_KEY,
        String(window.scrollY),
      );
    }

    if (
      location.pathname === "/campaigns" &&
      previousPath.startsWith("/campaigns/")
    ) {
      const savedScroll = Number(sessionStorage.getItem(VOTING_SCROLL_STORAGE_KEY) ?? "0");
      const restoreScroll = () => {
        window.scrollTo({
          top: Number.isFinite(savedScroll) ? savedScroll : 0,
          left: 0,
          behavior: "auto",
        });
      };

      window.requestAnimationFrame(restoreScroll);
      restoreTimeouts = [50, 150, 300].map((delay) =>
        window.setTimeout(restoreScroll, delay),
      );
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    previousPathRef.current = location.pathname;

    return () => {
      restoreTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!isAudienceSearchRoute && searchQuery) {
      setSearchQuery("");
    }
  }, [isAudienceSearchRoute, searchQuery]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        event.target instanceof Node &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setIsAccountMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileMenuOpen]);

  if (!isLoading && !isSigningOut && isCinemaAdminWorkspace && !isAuthRoute && !isCinemaAdminRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isLoading && !isSigningOut && isValidatorWorkspace && !isAuthRoute && !isValidatorRoute) {
    return <Navigate to="/validator" replace />;
  }

  return (
    <ConfirmDialogProvider>
    <div className="min-h-screen w-full font-[var(--font-body)] text-white">
      {!isAuthRoute ? (
      isValidatorWorkspace ? (
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(223,197,106,0.18)] bg-[rgba(19,26,39,0.95)] px-3 py-2.5 backdrop-blur-md sm:px-6 sm:py-4 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <NavLink
              to="/validator"
              className="text-stroke-gold marquee-glow cursor-pointer"
            >
              <LogoIcon className="w-28 sm:w-40" />
            </NavLink>

            <ValidatorWorkspaceChip />
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:justify-end">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-text-dim)]">
                signed in as
              </p>
              <p className="mt-1 text-sm text-white">{accountLabel}</p>
            </div>

            <button
              type="button"
              onClick={async () => {
                await signOut();
                window.location.replace("/");
              }}
              className="inline-flex min-h-10 items-center gap-2 border border-[rgba(223,197,106,0.28)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)] transition-colors hover:bg-[rgba(223,197,106,0.08)] hover:text-white sm:px-4 sm:text-[11px] sm:tracking-[0.22em]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>
      ) : isCinemaAdminWorkspace ? (
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(223,197,106,0.18)] bg-[rgba(19,26,39,0.95)] px-3 py-2.5 backdrop-blur-md sm:px-6 sm:py-4 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 lg:gap-8">
          <div className="flex min-w-0 items-center gap-3 lg:gap-8">
              <NavLink
                to="/dashboard"
                className="text-stroke-gold marquee-glow cursor-pointer"
              >
                <LogoIcon className="w-28 sm:w-40" />
              </NavLink>

              <CinemaAdminWorkspaceChip />

            <nav className="hidden flex-wrap items-center gap-2 lg:flex">
              <WorkspaceLink
                to="/dashboard"
                icon={<LayoutDashboard className="h-4 w-4" />}
                label="Dashboard"
              />
              <WorkspaceLink
                to="/dashboard/analytics"
                icon={<BarChart3 className="h-4 w-4" />}
                label="Analytics"
              />
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3 lg:justify-end">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-text-dim)]">
                signed in as
              </p>
              <p className="mt-1 text-sm text-white">{accountLabel}</p>
            </div>

            <button
              type="button"
              onClick={async () => {
                await signOut();
                window.location.replace("/");
              }}
              className="inline-flex min-h-10 items-center gap-2 border border-[rgba(223,197,106,0.28)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)] transition-colors hover:bg-[rgba(223,197,106,0.08)] hover:text-white sm:px-4 sm:text-[11px] sm:tracking-[0.22em]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center border border-[rgba(223,197,106,0.24)] text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:text-white lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      ) : (
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(223,197,106,0.16)] bg-[rgba(19,26,39,0.95)] py-3 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] backdrop-blur-md sm:px-6 lg:relative lg:z-[90] lg:bg-[rgba(19,26,39,0.92)] lg:px-12 lg:py-4">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 lg:flex lg:justify-between">
            <NavLink
              to="/"
              className="text-stroke-gold marquee-glow shrink-0 cursor-pointer"
            >
              <LogoIcon className="w-20 min-[380px]:w-24 sm:w-32 lg:w-40" />
            </NavLink>

            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center space-x-10 min-[1400px]:flex">
              {navItems.map((item) => (
                <AudienceNavLink
                  key={item.to}
                  item={item}
                  pathname={location.pathname}
                />
              ))}
            </nav>

            <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-4 lg:flex-none lg:gap-8">
              {isAudienceSearchRoute ? (
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  className="flex min-w-0 md:hidden"
                />
              ) : null}

              {isAudienceSearchRoute ? (
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  className="hidden md:flex"
                />
              ) : null}

              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((current) => !current)}
                  className="hidden cursor-pointer p-2 text-[var(--color-accent)] transition-colors hover:text-white min-[1400px]:inline-flex"
                  aria-haspopup="menu"
                  aria-expanded={isAccountMenuOpen}
                  aria-label="Open account menu"
                >
                  <UserCircle2 className="h-8 w-8" />
                </button>

                {isAccountMenuOpen ? (
                  <div className="pointer-events-auto absolute right-0 top-[calc(100%+0.75rem)] z-[130] w-[calc(100vw-2rem)] max-w-64 border border-[var(--color-accent-muted)] bg-[#131a27] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.56)]">
                    {isAuthenticated ? (
                      <div className="space-y-4">
                        <div className="border-b border-[rgba(223,197,106,0.16)] pb-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
                            signed in as
                          </p>
                          <p className="mt-2 break-words text-sm text-white">
                            {accountLabel}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <NavLink
                            to="/tickets"
                            onClick={() => setIsAccountMenuOpen(false)}
                            className="account-menu-item flex cursor-pointer items-center gap-3 border border-transparent px-3 py-2 text-sm text-white transition-colors hover:border-[rgba(223,197,106,0.14)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--color-accent)]"
                          >
                            <Wallet className="h-4 w-4 text-[var(--color-accent)]" />
                            <span>My Wallet</span>
                          </NavLink>

                          <button
                            type="button"
                            onClick={async () => {
                              setIsAccountMenuOpen(false);
                              await signOut();
                              window.location.replace("/");
                            }}
                            className="account-menu-item flex w-full cursor-pointer items-center gap-3 border border-transparent px-3 py-2 text-left text-sm text-white transition-colors hover:border-[rgba(223,197,106,0.14)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--color-accent)]"
                          >
                            <LogOut className="h-4 w-4 text-[var(--color-accent)]" />
                            <span>Sign out</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="border-b border-[rgba(223,197,106,0.16)] pb-3">
                          <p className="text-sm text-white">Welcome to Kinora!</p>
                        </div>

                        <div className="space-y-2">
                          <NavLink
                            to="/login"
                            onClick={() => setIsAccountMenuOpen(false)}
                            className="account-menu-item flex cursor-pointer items-center gap-3 border border-transparent px-3 py-2 text-sm lowercase text-white transition-colors hover:border-[rgba(223,197,106,0.14)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--color-accent)]"
                          >
                            <LogIn className="h-4 w-4 text-[var(--color-accent)]" />
                            <span>login</span>
                          </NavLink>
                          <NavLink
                            to="/register"
                            onClick={() => setIsAccountMenuOpen(false)}
                            className="account-menu-item flex cursor-pointer items-center gap-3 border border-transparent px-3 py-2 text-sm lowercase text-white transition-colors hover:border-[rgba(223,197,106,0.14)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--color-accent)]"
                          >
                            <UserPlus className="h-4 w-4 text-[var(--color-accent)]" />
                            <span>register</span>
                          </NavLink>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="col-start-3 inline-flex h-10 w-10 shrink-0 items-center justify-center justify-self-end border border-[rgba(223,197,106,0.24)] text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:text-white min-[1400px]:hidden"
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

        </div>
      </header>
      )) : null}

      {!isAuthRoute && !isValidatorWorkspace ? (
        <MobileNavigationDrawer
          isOpen={isMobileMenuOpen}
          accountLabel={accountLabel}
          isAuthenticated={isAuthenticated}
          isCinemaAdminWorkspace={isCinemaAdminWorkspace}
          pathname={location.pathname}
          dashboardMobileTab={dashboardMobileTab}
          onClose={() => setIsMobileMenuOpen(false)}
          onDashboardTabSelect={setDashboardMobileTab}
          onSignOut={async () => {
            setIsMobileMenuOpen(false);
            await signOut();
            window.location.replace("/");
          }}
        />
      ) : null}

      <main className={cn("w-full flex-grow pb-24", mainTopPadding)}>
        <Outlet
          context={{
            searchQuery,
            dashboardMobileTab,
            setDashboardMobileTab,
          }}
        />
      </main>
    </div>
    </ConfirmDialogProvider>
  );
}

function ValidatorWorkspaceChip() {
  return (
    <div className="inline-flex items-center gap-2 border border-[rgba(223,197,106,0.24)] bg-[rgba(223,197,106,0.08)] px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-[var(--color-accent)]">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      Validate
    </div>
  );
}

function CinemaAdminWorkspaceChip() {
  return (
    <div className="hidden sm:inline-flex items-center gap-2 border border-[rgba(223,197,106,0.24)] bg-[rgba(223,197,106,0.08)] px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-[var(--color-accent)]">
      <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
      Cinema Admin
    </div>
  );
}

function MobileNavigationDrawer({
  isOpen,
  accountLabel,
  isAuthenticated,
  isCinemaAdminWorkspace,
  pathname,
  dashboardMobileTab,
  onClose,
  onDashboardTabSelect,
  onSignOut,
}: {
  isOpen: boolean;
  accountLabel: string;
  isAuthenticated: boolean;
  isCinemaAdminWorkspace: boolean;
  pathname: string;
  dashboardMobileTab: DashboardMobileTab;
  onClose: () => void;
  onDashboardTabSelect: (tab: DashboardMobileTab) => void;
  onSignOut: () => Promise<void>;
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px] transition-opacity min-[1400px]:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-[70] flex h-dvh w-[min(16.5rem,72vw)] max-w-[calc(100vw_-_1rem_-_env(safe-area-inset-left)_-_env(safe-area-inset-right))] flex-col border-l border-[rgba(223,197,106,0.2)] bg-[rgba(19,26,39,0.98)] pr-[env(safe-area-inset-right)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md transition-transform duration-300 sm:w-[17.5rem] min-[1400px]:hidden",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-[rgba(223,197,106,0.14)] px-4 py-4">
          <span className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-accent)]">
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center border border-[rgba(223,197,106,0.2)] text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:text-white"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {isCinemaAdminWorkspace ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <MobileDrawerLink
                  to="/dashboard"
                  label="Dashboard"
                  icon={<LayoutDashboard className="h-4 w-4" />}
                  isActive={pathname === "/dashboard"}
                  onClick={() => {
                    onDashboardTabSelect("campaigns");
                    onClose();
                  }}
                />
                <div className="space-y-2 border-l border-[rgba(223,197,106,0.16)] pl-3">
                  {dashboardMobileTabs.map((tab) => (
                    <MobileDrawerLink
                      key={tab.id}
                      to="/dashboard"
                      label={tab.label}
                      icon={tab.icon}
                      isActive={pathname === "/dashboard" && dashboardMobileTab === tab.id}
                      onClick={() => {
                        onDashboardTabSelect(tab.id);
                        onClose();
                      }}
                    />
                  ))}
                </div>
                <MobileDrawerLink
                  to="/dashboard/analytics"
                  label="Analytics"
                  icon={<BarChart3 className="h-4 w-4" />}
                  isActive={pathname.startsWith("/dashboard/analytics")}
                  onClick={onClose}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {navItems.map((item) => (
                <MobileDrawerLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  isActive={
                    item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)
                  }
                  onClick={onClose}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[rgba(223,197,106,0.14)] p-4">
          {isAuthenticated ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
                  signed in as
                </p>
                <p className="mt-1 break-words text-sm text-white">{accountLabel}</p>
              </div>

              {!isCinemaAdminWorkspace ? (
                <MobileDrawerLink
                  to="/tickets"
                  label="My Wallet"
                  icon={<Wallet className="h-4 w-4" />}
                  isActive={pathname.startsWith("/tickets")}
                  onClick={onClose}
                />
              ) : null}

              <button
                type="button"
                onClick={() => {
                  void onSignOut();
                }}
                className="flex w-full items-center gap-3 border border-transparent px-3 py-3 text-left text-sm text-white transition-colors hover:border-[rgba(223,197,106,0.16)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--color-accent)]"
              >
                <LogOut className="h-4 w-4 text-[var(--color-accent)]" />
                Sign out
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <MobileDrawerLink
                to="/login"
                label="login"
                icon={<LogIn className="h-4 w-4" />}
                isActive={pathname === "/login"}
                onClick={onClose}
              />
              <MobileDrawerLink
                to="/register"
                label="register"
                icon={<UserPlus className="h-4 w-4" />}
                isActive={pathname === "/register"}
                onClick={onClose}
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function MobileDrawerLink({
  to,
  label,
  icon,
  isActive,
  onClick,
}: {
  to: string;
  label: string;
  icon?: ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-3 border px-3 py-3 text-sm transition-colors",
        isActive
          ? "border-[rgba(223,197,106,0.38)] bg-[rgba(223,197,106,0.12)] text-[var(--color-accent)]"
          : "border-transparent text-white hover:border-[rgba(223,197,106,0.16)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--color-accent)]",
      )}
    >
      {icon ? <span className="text-[var(--color-accent)]">{icon}</span> : null}
      <span>{label}</span>
    </NavLink>
  );
}

function WorkspaceLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/dashboard"}
      className={({ isActive }) =>
        cn(
          "inline-flex min-h-10 items-center justify-center gap-2 border px-3 py-2 text-center text-[10px] uppercase tracking-[0.16em] transition-colors sm:text-[11px] sm:tracking-[0.22em]",
          isActive
            ? "border-[rgba(223,197,106,0.4)] bg-[rgba(223,197,106,0.12)] text-[var(--color-accent)]"
            : "border-[rgba(223,197,106,0.18)] text-[var(--color-text-dim)] hover:border-[rgba(223,197,106,0.28)] hover:text-white",
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function AudienceNavLink({
  item,
  pathname,
  compact = false,
}: {
  item: { label: string; to: string };
  pathname: string;
  compact?: boolean;
}) {
  const isActive =
    item.to === "/"
      ? pathname === "/"
      : pathname.startsWith(item.to);

  return (
    <NavLink
      to={item.to}
      className={cn(
        "group relative cursor-pointer whitespace-nowrap font-medium uppercase transition-colors",
        compact
          ? "pb-2 text-[11px] tracking-[0.16em]"
          : "text-sm tracking-[0.2em]",
        compact && isActive
          ? "text-[var(--color-accent)]"
          : compact
            ? "text-[rgba(255,255,255,0.78)]"
            : isActive
              ? "text-[var(--color-accent)]"
              : "text-white hover:text-[var(--color-accent)]",
      )}
    >
      {item.label}
      <span
        className={cn(
          "absolute left-0 h-px w-full origin-left bg-[var(--color-accent)] transition-transform duration-300",
          compact ? "-bottom-0.5" : "-bottom-1",
          isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
        )}
      />
    </NavLink>
  );
}

function SearchInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("group relative min-w-0", className)}>
      <Search className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--color-accent)] transition-colors group-focus-within:text-white" />
      <input
        type="text"
        placeholder="find a movie"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full border border-[var(--color-accent-muted)] bg-[rgba(27,34,49,0.76)] pl-11 pr-4 text-[15px] lowercase leading-none tracking-[0.08em] text-white outline-none transition-all duration-300 placeholder:lowercase placeholder:tracking-[0.08em] placeholder:text-[15px] placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent)] md:w-56 xl:w-64"
      />
    </div>
  );
}
