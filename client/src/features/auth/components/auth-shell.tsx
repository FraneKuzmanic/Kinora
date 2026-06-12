import type { PropsWithChildren } from "react";

type AuthShellProps = PropsWithChildren<{
  title: string;
  description: string;
}>;

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="mx-auto max-w-md space-y-6 rounded-lg border border-slate-200 bg-white p-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  );
}
