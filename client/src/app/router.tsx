import { RouterProvider } from "react-router-dom";
import { router } from "@/app/routes/router";

export function AppRouter() {
  return <RouterProvider router={router} />;
}
