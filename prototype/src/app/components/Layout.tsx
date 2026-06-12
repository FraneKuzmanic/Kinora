import { startTransition, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { Search, MapPin, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { useAppContext } from "../context/AppContext";
import Modals from "./Modals";
import { ScrollToTop } from "./ScrollToTop";

export function Layout() {
  const navigate = useNavigate();
  const loc = useLocation();
  const { setActiveModal, location } = useAppContext();

  const navItems = [
    { path: "/", label: "Discover" },
    { path: "/voting", label: "Voting" },
    { path: "/screenings", label: "Screenings" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return loc.pathname === "/";
    return loc.pathname.startsWith(path);
  };

  const handleNavigate = (path: string) => {
    startTransition(() => {
      navigate(path);
    });
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMobileNavigate = (path: string) => {
    setIsMenuOpen(false);
    handleNavigate(path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ScrollToTop />
      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Mobile Dropdown Menu */}
      <div
        className={`fixed top-0 right-0 h-full w-64 bg-background border-l border-border z-50 md:hidden transform transition-transform duration-300 ease-in-out ${
          isMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Close Button */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="font-semibold">Menu</span>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleMobileNavigate(item.path)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  isActive(item.path)
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                {item.label}
              </button>
            ))}
            
            <div className="pt-2 border-t border-border mt-2">
              <button
                onClick={() => handleMobileNavigate("/private-booking")}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  isActive("/private-booking")
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                Private Booking
              </button>
            </div>

            <div className="pt-2 border-t border-border mt-2">
              <button
                onClick={() => handleMobileNavigate("/tickets")}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  isActive("/tickets")
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                My Tickets
              </button>
              <button
                onClick={() => handleMobileNavigate("/cinema-dashboard")}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  isActive("/cinema-dashboard")
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                For Cinemas
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button onClick={() => handleNavigate("/")}><Logo /></button>

            <div className="hidden md:flex items-center gap-6">
              {/* Main Navigation Group */}
              <div className="flex items-center gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      isActive(item.path)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Private Booking Group */}
              <div className="flex items-center">
                <button
                  onClick={() => handleNavigate("/private-booking")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    isActive("/private-booking")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  Private Booking
                </button>
              </div>

              {/* User/Cinema Group */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleNavigate("/tickets")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    isActive("/tickets")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  My Tickets
                </button>
                <button
                  onClick={() => handleNavigate("/cinema-dashboard")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    isActive("/cinema-dashboard")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  For Cinemas
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveModal("search")}
                className="flex items-center gap-2 px-3 py-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <Search className="w-5 h-5 text-muted-foreground" />
                <span className="hidden lg:inline text-sm text-muted-foreground">Search for a movie...</span>
              </button>
              <button className="flex items-center gap-2 px-3 py-2 hover:bg-secondary rounded-lg transition-colors">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm">{location}</span>
              </button>
              
              {/* Mobile Menu Button - Only visible on mobile, positioned at far right */}
              <button
                onClick={() => setIsMenuOpen(true)}
                className="md:hidden p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
        <Outlet />
      </main>

      {/* Modals */}
      <Modals />
    </div>
  );
}