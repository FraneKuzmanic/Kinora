import { AppProvider } from "../context/AppContext";
import { Layout } from "./Layout";

// Root layout wrapper with AppProvider
export function RootLayout() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}