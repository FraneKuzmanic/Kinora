import { AppProvider } from "@/app/providers/provider";
import { AppRouter } from "@/app/router";

export function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
