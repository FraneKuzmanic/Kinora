import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";

export function UnauthorizedPage() {
  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Auth"
        title="Unauthorized"
        description="You are signed in, but you do not have permission to access this page."
      />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
        <Link className="text-blue-700 underline" to="/">
          Return to discover
        </Link>
      </div>
    </section>
  );
}
