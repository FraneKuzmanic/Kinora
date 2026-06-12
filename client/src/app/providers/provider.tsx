import type { PropsWithChildren } from "react";
import { AuthProvider } from "@/features/auth/auth-context";
import { QueryProvider } from "@/lib/query/query-provider";

export function AppProvider({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}
