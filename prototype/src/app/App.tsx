import { RouterProvider } from "react-router";
import { router } from "./routes.tsx";

// Main app component
export default function App() {
  return <RouterProvider router={router} />;
}