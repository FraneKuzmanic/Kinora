import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import DiscoverPage from "./pages/DiscoverPage";
import VotingPage from "./pages/VotingPage";
import ScreeningsPage from "./pages/ScreeningsPage";
import ScreeningDetailPage from "./pages/ScreeningDetailPage";
import PrivateBookingPage from "./pages/PrivateBookingPage";
import MyTicketsPage from "./pages/MyTicketsPage";
import CinemaDashboardPage from "./pages/CinemaDashboardPage";

// Router configuration for Kinora app
export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { 
        index: true, 
        Component: DiscoverPage,
      },
      { 
        path: "voting", 
        Component: VotingPage,
      },
      { 
        path: "screenings", 
        Component: ScreeningsPage,
      },
      { 
        path: "screening/:id", 
        Component: ScreeningDetailPage,
      },
      { 
        path: "private-booking", 
        Component: PrivateBookingPage,
      },
      { 
        path: "tickets", 
        Component: MyTicketsPage,
      },
      { 
        path: "cinema-dashboard", 
        Component: CinemaDashboardPage,
      },
    ],
  },
]);