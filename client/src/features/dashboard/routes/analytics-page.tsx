import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  CreditCard,
  Film,
  Loader2,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { useAuth } from "@/features/auth/auth-context";
import { getMyCinema, listCinemaHalls } from "@/lib/api/cinemas";
import {
  getCampaignFunnel,
  getContentDemand,
  getPrivateBookingAnalytics,
  getRevenue,
  getScreeningHealth,
  getSlotPerformance,
  type ScreeningHealthRead,
} from "@/lib/api/analytics";
import {
  getCinemaRecommendations,
  predictAttendance,
  type AttendancePredictionRequest,
  type AttendancePredictionResponse,
} from "@/lib/api/predictions";

// ─── Shared styling constants ────────────────────────────────────────────────
const panelCls =
  "border border-[rgba(223,197,106,0.18)] bg-[rgba(27,34,49,0.78)] shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-md";
const inputCls =
  "min-w-0 w-full border border-[rgba(223,197,106,0.22)] bg-[rgba(19,26,39,0.76)] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent)] disabled:opacity-60";
const btnCls =
  "inline-flex min-h-10 items-center justify-center gap-2 border px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:opacity-60 sm:px-4 sm:text-[11px] sm:tracking-[0.22em]";
const accentBorder = "border-[rgba(223,197,106,0.22)]";

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className={`border-b ${accentBorder} px-4 py-4 sm:px-6 sm:py-5`}>
      <div className="flex items-start gap-3 sm:items-center">
        <span className="text-[var(--color-accent)]">{icon}</span>
        <h2 className="font-heading text-lg text-white sm:text-xl">{title}</h2>
      </div>
      {subtitle && (
        <p className="mt-2 text-xs leading-5 text-[var(--color-text-dim)] sm:pl-9">{subtitle}</p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className={`min-w-0 border ${accentBorder} bg-[rgba(19,26,39,0.5)] p-3 sm:p-4`}>
      <p className="break-words text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-dim)] sm:tracking-[0.28em]">
        {label}
      </p>
      <p className="mt-1 break-words font-heading text-xl text-white sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--color-text-dim)]">{sub}</p>}
    </div>
  );
}

function RiskBadge({ band }: { band: string }) {
  const map: Record<string, string> = {
    green: "bg-green-500/20 text-green-400 border border-green-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
    red: "bg-red-500/20 text-red-400 border border-red-500/30",
  };
  const labels: Record<string, string> = {
    green: "On track",
    yellow: "At risk",
    red: "Critical",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${map[band] ?? map.yellow}`}
    >
      {labels[band] ?? band}
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden bg-[rgba(255,255,255,0.08)]">
      <div
        className="h-full bg-[var(--color-accent)] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function LoadingSection() {
  return (
    <div className="flex h-32 items-center justify-center text-[var(--color-text-dim)]">
      <Loader2 className="animate-spin" size={20} />
    </div>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <div className="flex h-24 items-center justify-center text-sm text-[var(--color-text-dim)]">
      {text}
    </div>
  );
}

// ─── What-If Predictor form schema ───────────────────────────────────────────
const predictorSchema = z.object({
  hallId: z.string().min(1, "Select a hall"),
  tmdbId: z.string().optional(),
  startsAt: z.string().min(1, "Choose a date and time"),
});
type PredictorForm = z.infer<typeof predictorSchema>;

// ─── Main page ────────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [predResult, setPredResult] = useState<AttendancePredictionResponse | null>(null);

  const cinemaQuery = useQuery({
    queryKey: ["admin", "cinema", token],
    enabled: Boolean(token),
    queryFn: () => getMyCinema(token as string),
  });
  const cinemaId = cinemaQuery.data?.id;

  const hallsQuery = useQuery({
    queryKey: ["admin", "cinema", cinemaId, "halls"],
    enabled: Boolean(cinemaId),
    queryFn: () => listCinemaHalls(cinemaId as string),
  });

  const recsQuery = useQuery({
    queryKey: ["admin", "cinema", cinemaId, "recommendations"],
    enabled: Boolean(cinemaId && token),
    queryFn: () => getCinemaRecommendations(cinemaId as string, token as string),
  });

  const funnelQuery = useQuery({
    queryKey: ["analytics", "funnel", token, startDate, endDate],
    enabled: Boolean(token),
    queryFn: () =>
      getCampaignFunnel(token as string, {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
  });

  const healthQuery = useQuery({
    queryKey: ["analytics", "health", token],
    enabled: Boolean(token),
    queryFn: () => getScreeningHealth(token as string),
  });

  const slotQuery = useQuery({
    queryKey: ["analytics", "slots", token],
    enabled: Boolean(token),
    queryFn: () => getSlotPerformance(token as string),
  });

  const demandQuery = useQuery({
    queryKey: ["analytics", "demand", token],
    enabled: Boolean(token),
    queryFn: () => getContentDemand(token as string),
  });

  const privateQuery = useQuery({
    queryKey: ["analytics", "private-bookings", token],
    enabled: Boolean(token),
    queryFn: () => getPrivateBookingAnalytics(token as string),
  });

  const revenueQuery = useQuery({
    queryKey: ["analytics", "revenue", token, startDate, endDate],
    enabled: Boolean(token),
    queryFn: () =>
      getRevenue(token as string, {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
  });

  const predictMutation = useMutation({
    mutationFn: (body: AttendancePredictionRequest) =>
      predictAttendance(body, token as string),
    onSuccess: (data) => setPredResult(data),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PredictorForm>({ resolver: zodResolver(predictorSchema) });

  function onPredictSubmit(values: PredictorForm) {
    setPredResult(null);
    predictMutation.mutate({
      hall_id: values.hallId,
      tmdb_id: values.tmdbId ? parseInt(values.tmdbId) : undefined,
      starts_at: new Date(values.startsAt).toISOString(),
    });
  }

  const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const HOUR_LABELS: Record<number, string> = {
    0: "0–6h",
    6: "6–12h",
    12: "12–18h",
    18: "18–24h",
  };

  function fillRateColor(rate: number): string {
    if (rate >= 0.7) return "bg-green-500/70";
    if (rate >= 0.4) return "bg-yellow-500/60";
    return "bg-red-500/50";
  }

  function centsToEur(cents: number): string {
    return `€${(cents / 100).toFixed(2)}`;
  }

  return (
    <section className="mx-auto max-w-7xl px-3 pb-16 pt-2 sm:px-8 sm:pt-4 lg:px-10">
      {/* Page header */}
      <div className={`overflow-hidden ${panelCls}`}>
        <div className={`border-b ${accentBorder} px-4 py-5 sm:px-8 sm:py-6`}>
          <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--color-accent)]">
            Cinema Admin
          </p>
          <h1 className="mt-3 font-heading text-3xl text-white sm:text-4xl">
            Analytics
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-dim)]">
            Campaign performance, screening health, demand signals, and revenue.
          </p>
        </div>

        {/* Date range filter */}
        <div className={`border-b ${accentBorder} px-4 py-2.5 sm:px-8`}>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="mr-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-dim)] sm:text-[11px]">
              Range
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`${inputCls} h-9 w-[8.5rem] px-2 py-1 text-xs sm:w-36`}
              placeholder="Start"
            />
            <span className="text-[var(--color-text-dim)]">–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`${inputCls} h-9 w-[8.5rem] px-2 py-1 text-xs sm:w-36`}
              placeholder="End"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="px-2 py-1 text-[11px] text-[var(--color-text-dim)] underline hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-5 sm:mt-8 sm:space-y-8">

        {/* ── 1. Campaign Funnel ───────────────────────────────────────────── */}
        <div className={`overflow-hidden ${panelCls}`}>
          <SectionHeader
            icon={<TrendingUp size={18} />}
            title="Campaign Funnel"
            subtitle="Views → votes → reservations per campaign"
          />
          <div className="p-4 sm:p-6">
            {funnelQuery.isLoading ? (
              <LoadingSection />
            ) : funnelQuery.data ? (
              <>
                <div className="mb-5 grid grid-cols-2 gap-3 sm:mb-6 sm:grid-cols-5 sm:gap-4">
                  <StatCard label="Total Views" value={funnelQuery.data.total_views} />
                  <StatCard label="Total Votes" value={funnelQuery.data.total_votes} />
                  <StatCard label="Reservations" value={funnelQuery.data.total_reservations} />
                  <StatCard
                    label="View → Vote"
                    value={`${(funnelQuery.data.view_to_vote_rate * 100).toFixed(1)}%`}
                  />
                  <StatCard
                    label="Vote → Reservation"
                    value={`${(funnelQuery.data.vote_to_reservation_rate * 100).toFixed(1)}%`}
                  />
                </div>
                {funnelQuery.data.campaigns.length > 0 ? (
                  <>
                  <div className="space-y-3 md:hidden">
                    {funnelQuery.data.campaigns.map((c) => (
                      <div key={c.campaign_id} className={`border ${accentBorder} bg-[rgba(19,26,39,0.42)] p-3`}>
                        <p className="break-words text-sm font-medium text-white">{c.campaign_title}</p>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="uppercase tracking-[0.12em] text-[var(--color-text-dim)]">Views</p>
                            <p className="mt-1 text-white">{c.views}</p>
                          </div>
                          <div>
                            <p className="uppercase tracking-[0.12em] text-[var(--color-text-dim)]">Votes</p>
                            <p className="mt-1 text-white">{c.votes}</p>
                          </div>
                          <div>
                            <p className="uppercase tracking-[0.12em] text-[var(--color-text-dim)]">Reserved</p>
                            <p className="mt-1 text-white">{c.reservations}/{c.threshold}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-[var(--color-text-dim)]">Progress</span>
                            <span className="text-white">
                              {c.threshold > 0
                                ? `${Math.min(Math.round((c.reservations / c.threshold) * 100), 100)}%`
                                : "-"}
                            </span>
                          </div>
                          <ProgressBar value={c.reservations} max={c.threshold} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[680px] text-sm">
                      <thead>
                        <tr className={`border-b ${accentBorder} text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-dim)]`}>
                          <th className="pb-2 text-left">Campaign</th>
                          <th className="pb-2 text-right">Views</th>
                          <th className="pb-2 text-right">Votes</th>
                          <th className="pb-2 text-right">Reservations</th>
                          <th className="pb-2 text-right">Threshold</th>
                          <th className="pb-2 text-right">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {funnelQuery.data.campaigns.map((c) => (
                          <tr key={c.campaign_id} className={`border-b ${accentBorder} last:border-0`}>
                            <td className="py-3 pr-4 text-white">{c.campaign_title}</td>
                            <td className="py-3 text-right text-[var(--color-text-dim)]">{c.views}</td>
                            <td className="py-3 text-right text-[var(--color-text-dim)]">{c.votes}</td>
                            <td className="py-3 text-right text-[var(--color-text-dim)]">{c.reservations}</td>
                            <td className="py-3 text-right text-[var(--color-text-dim)]">{c.threshold}</td>
                            <td className="py-3 pl-4">
                              <div className="min-w-[80px]">
                                <span className="text-xs text-white">
                                  {c.threshold > 0
                                    ? `${Math.min(Math.round((c.reservations / c.threshold) * 100), 100)}%`
                                    : "—"}
                                </span>
                                <ProgressBar value={c.reservations} max={c.threshold} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                ) : (
                  <EmptySection text="No campaigns in the selected period." />
                )}
              </>
            ) : (
              <EmptySection text="No funnel data available." />
            )}
          </div>
        </div>

        {/* ── 2. Screening Health ──────────────────────────────────────────── */}
        <div className={`overflow-hidden ${panelCls}`}>
          <SectionHeader
            icon={<Target size={18} />}
            title="Screening Health"
            subtitle="Active screenings — ticket progress and confirmation risk"
          />
          <div className="p-4 sm:p-6">
            {healthQuery.isLoading ? (
              <LoadingSection />
            ) : healthQuery.data && healthQuery.data.length > 0 ? (
              <>
              <div className="space-y-3 md:hidden">
                {(healthQuery.data as ScreeningHealthRead[]).map((s) => (
                  <div key={s.screening_id} className={`border ${accentBorder} bg-[rgba(19,26,39,0.42)] p-3`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-words text-sm font-medium text-white">
                        {s.at_risk ? (
                          <AlertTriangle size={12} className="mr-1.5 inline text-red-400" />
                        ) : null}
                        {s.title}
                      </p>
                      <RiskBadge band={s.risk_band} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="uppercase tracking-[0.12em] text-[var(--color-text-dim)]">Date</p>
                        <p className="mt-1 text-white">{new Date(s.starts_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.12em] text-[var(--color-text-dim)]">Days left</p>
                        <p className="mt-1 text-white">{s.days_left}d</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.12em] text-[var(--color-text-dim)]">Tickets</p>
                        <p className="mt-1 text-white">{s.tickets_sold} / {s.min_tickets_to_confirm}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.12em] text-[var(--color-text-dim)]">Likelihood</p>
                        <p className="mt-1 text-white">{(s.projected_likelihood * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                    <ProgressBar value={s.tickets_sold} max={s.min_tickets_to_confirm} />
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className={`border-b ${accentBorder} text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-dim)]`}>
                      <th className="pb-2 text-left">Film</th>
                      <th className="pb-2 text-center">Date</th>
                      <th className="pb-2 text-right">Tickets</th>
                      <th className="pb-2 text-right">Days Left</th>
                      <th className="pb-2 text-right">Likelihood</th>
                      <th className="pb-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(healthQuery.data as ScreeningHealthRead[]).map((s) => (
                      <tr key={s.screening_id} className={`border-b ${accentBorder} last:border-0`}>
                        <td className="py-3 pr-4 font-medium text-white">
                          {s.at_risk && (
                            <AlertTriangle size={12} className="mr-1.5 inline text-red-400" />
                          )}
                          {s.title}
                        </td>
                        <td className="py-3 text-center text-[var(--color-text-dim)]">
                          {new Date(s.starts_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-white">{s.tickets_sold}</span>
                          <span className="text-[var(--color-text-dim)]"> / {s.min_tickets_to_confirm}</span>
                        </td>
                        <td className="py-3 text-right text-[var(--color-text-dim)]">{s.days_left}d</td>
                        <td className="py-3 text-right text-white">
                          {(s.projected_likelihood * 100).toFixed(0)}%
                        </td>
                        <td className="py-3 text-center">
                          <RiskBadge band={s.risk_band} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ) : (
              <EmptySection text="No active screenings right now." />
            )}
          </div>
        </div>

        {/* ── 3. Slot Performance ──────────────────────────────────────────── */}
        <div className={`overflow-hidden ${panelCls}`}>
          <SectionHeader
            icon={<CalendarRange size={18} />}
            title="Slot Performance"
            subtitle="Average fill rates by weekday and time — based on confirmed screenings"
          />
          <div className="p-4 sm:p-6">
            {slotQuery.isLoading ? (
              <LoadingSection />
            ) : slotQuery.data && slotQuery.data.cells.length > 0 ? (
              <>
                {/* Heatmap grid */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-xs">
                    <thead>
                      <tr>
                        <th className="pb-2 text-left text-[var(--color-text-dim)]">Hour</th>
                        {DOW_NAMES.map((d) => (
                          <th key={d} className="pb-2 text-center text-[var(--color-text-dim)]">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 6, 12, 18].map((hb) => (
                        <tr key={hb}>
                          <td className="py-1 pr-3 text-[var(--color-text-dim)]">{HOUR_LABELS[hb]}</td>
                          {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                            const cell = slotQuery.data.cells.find(
                              (c) => c.dow === dow && c.hour_bucket === hb
                            );
                            return (
                              <td key={dow} className="py-1 text-center">
                                {cell ? (
                                  <div
                                    className={`mx-auto h-8 w-12 flex items-center justify-center text-[10px] font-semibold text-white ${fillRateColor(cell.avg_fill_rate)}`}
                                    title={`${cell.screening_count} screenings`}
                                  >
                                    {(cell.avg_fill_rate * 100).toFixed(0)}%
                                  </div>
                                ) : (
                                  <div className="mx-auto h-8 w-12 bg-white/5" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {slotQuery.data.best_slots.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-green-400">
                        Best Slots
                      </p>
                      {slotQuery.data.best_slots.map((s, i) => (
                        <p key={i} className="text-sm text-white">{s.label}</p>
                      ))}
                    </div>
                  )}
                  {slotQuery.data.worst_slots.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-red-400">
                        Underused Slots
                      </p>
                      {slotQuery.data.worst_slots.map((s, i) => (
                        <p key={i} className="text-sm text-[var(--color-text-dim)]">{s.label}</p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <EmptySection text="Not enough confirmed screening history yet." />
            )}
          </div>
        </div>

        {/* ── 4. Content Demand ────────────────────────────────────────────── */}
        <div className={`overflow-hidden ${panelCls}`}>
          <SectionHeader
            icon={<Film size={18} />}
            title="Content Demand"
            subtitle="Most voted films, most requested, genre trends"
          />
          <div className="p-4 sm:p-6">
            {demandQuery.isLoading ? (
              <LoadingSection />
            ) : demandQuery.data ? (
              <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2">
                {/* Most voted */}
                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                    Most Voted Films
                  </p>
                  {demandQuery.data.most_voted.length > 0 ? (
                    <div className="space-y-2">
                      {demandQuery.data.most_voted.slice(0, 5).map((f, i) => (
                        <div key={i} className={`flex items-center justify-between border-b ${accentBorder} pb-2 last:border-0`}>
                          <span className="text-sm text-white">{f.title}</span>
                          <span className="text-xs text-[var(--color-text-dim)]">
                            {f.vote_count} votes
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-dim)]">No vote data yet.</p>
                  )}
                </div>

                {/* Most recommended */}
                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                    Most Requested Films
                  </p>
                  {demandQuery.data.most_recommended.length > 0 ? (
                    <div className="space-y-2">
                      {demandQuery.data.most_recommended.slice(0, 5).map((f, i) => (
                        <div key={i} className={`flex items-center justify-between border-b ${accentBorder} pb-2 last:border-0`}>
                          <span className="text-sm text-white">{f.title}</span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[var(--color-text-dim)]">
                              {f.recommendation_count} requests
                            </span>
                            {!f.has_screening && (
                              <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[9px] uppercase text-yellow-400">
                                No screening
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-dim)]">No recommendations yet.</p>
                  )}
                </div>

                {/* Genre trends chart */}
                {demandQuery.data.genre_trends.length > 0 && (
                  <div className="lg:col-span-2">
                    <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                      Genre Trends (by vote interactions)
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={demandQuery.data.genre_trends}>
                        <XAxis
                          dataKey="genre_name"
                          tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(27,34,49,0.95)",
                            border: "1px solid rgba(223,197,106,0.22)",
                            color: "#fff",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="interaction_count" fill="rgba(223,197,106,0.7)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Repeated demand without screening */}
                {demandQuery.data.repeated_demand_no_screening.length > 0 && (
                  <div className="lg:col-span-2">
                    <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-yellow-400">
                      Repeated Demand — No Screening Yet
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {demandQuery.data.repeated_demand_no_screening.map((f, i) => (
                        <span
                          key={i}
                          className="border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-400"
                        >
                          {f.title} ({f.recommendation_count}×)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptySection text="No demand data available." />
            )}
          </div>
        </div>

        {/* ── 5. Private Booking Summary ───────────────────────────────────── */}
        <div className={`overflow-hidden ${panelCls}`}>
          <SectionHeader
            icon={<Users size={18} />}
            title="Private Booking Summary"
            subtitle="Booking request counts, approval rates, and time preferences"
          />
          <div className="p-4 sm:p-6">
            {privateQuery.isLoading ? (
              <LoadingSection />
            ) : privateQuery.data ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                  <StatCard label="Total Requests" value={privateQuery.data.request_count} />
                  <StatCard
                    label="Approval Rate"
                    value={`${(privateQuery.data.approval_rate * 100).toFixed(1)}%`}
                    sub={`${privateQuery.data.approved_count} approved`}
                  />
                  <StatCard
                    label="Avg Group Size"
                    value={
                      privateQuery.data.average_group_size != null
                        ? privateQuery.data.average_group_size.toFixed(1)
                        : "—"
                    }
                  />
                  <StatCard label="Rejected" value={privateQuery.data.rejected_count} />
                </div>

                {privateQuery.data.most_requested_dates.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-dim)]">
                      Most Requested Dates
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {privateQuery.data.most_requested_dates.map((d, i) => (
                        <span
                          key={i}
                          className={`border ${accentBorder} bg-[rgba(19,26,39,0.5)] px-3 py-1.5 text-xs text-white`}
                        >
                          {d.date}{" "}
                          <span className="text-[var(--color-accent)]">({d.request_count}×)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {privateQuery.data.most_requested_time_ranges.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-dim)]">
                      Most Requested Times
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {privateQuery.data.most_requested_time_ranges.map((t, i) => (
                        <span
                          key={i}
                          className={`border ${accentBorder} bg-[rgba(19,26,39,0.5)] px-3 py-1.5 text-xs text-white`}
                        >
                          {new Date(t.hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                          <span className="text-[var(--color-accent)]">({t.request_count}×)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptySection text="No private booking data available." />
            )}
          </div>
        </div>

        {/* ── 6. Revenue Metrics ───────────────────────────────────────────── */}
        <div className={`overflow-hidden ${panelCls}`}>
          <SectionHeader
            icon={<CreditCard size={18} />}
            title="Revenue Metrics"
            subtitle="Confirmed revenue, pending potential, and cancellations"
          />
          <div className="p-4 sm:p-6">
            {revenueQuery.isLoading ? (
              <LoadingSection />
            ) : revenueQuery.data ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                <StatCard
                  label="Confirmed Revenue"
                  value={centsToEur(revenueQuery.data.confirmed_revenue_cents)}
                />
                <StatCard
                  label="Pending Potential"
                  value={centsToEur(revenueQuery.data.pending_potential_cents)}
                  sub="from active screenings"
                />
                <StatCard
                  label="Refunds Processed"
                  value={revenueQuery.data.refund_count}
                />
                <StatCard
                  label="Cancelled Screenings"
                  value={revenueQuery.data.cancelled_screening_count}
                />
              </div>
            ) : (
              <EmptySection text="No revenue data available." />
            )}
          </div>
        </div>

        {/* ── 7. What-If Predictor ─────────────────────────────────────────── */}
        <div className={`overflow-hidden ${panelCls}`}>
          <SectionHeader
            icon={<BarChart2 size={18} />}
            title="What-If Predictor"
            subtitle="Estimate fill rate for a hypothetical screening slot"
          />
          <div className="p-4 sm:p-6">
            <form
              onSubmit={handleSubmit(onPredictSubmit)}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {/* Hall */}
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-dim)]">
                  Hall *
                </label>
                <select {...register("hallId")} className={inputCls}>
                  <option value="">Select hall...</option>
                  {hallsQuery.data?.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} (cap. {h.capacity})
                    </option>
                  ))}
                </select>
                {errors.hallId && (
                  <p className="mt-1 text-[10px] text-red-400">{errors.hallId.message}</p>
                )}
              </div>

              {/* Film (from recommendations) */}
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-dim)]">
                  Film (TMDB)
                </label>
                <select {...register("tmdbId")} className={inputCls}>
                  <option value="">Unknown / custom</option>
                  {recsQuery.data?.map((f) => (
                    <option key={f.tmdb_id} value={String(f.tmdb_id)}>
                      {f.title} (score {f.score})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date + time */}
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-dim)]">
                  Date & Time *
                </label>
                <input
                  type="datetime-local"
                  {...register("startsAt")}
                  className={inputCls}
                />
                {errors.startsAt && (
                  <p className="mt-1 text-[10px] text-red-400">{errors.startsAt.message}</p>
                )}
              </div>

              {/* Submit */}
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={predictMutation.isPending}
                  className={`${btnCls} w-full border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black`}
                >
                  {predictMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    "Predict"
                  )}
                </button>
              </div>
            </form>

            {/* Result */}
            {predResult && (
              <div className={`mt-6 grid grid-cols-2 gap-3 border-t ${accentBorder} pt-6 sm:grid-cols-4 sm:gap-4`}>
                <StatCard
                  label="Predicted Attendance"
                  value={predResult.predicted_attendance}
                />
                <StatCard
                  label="Fill Rate"
                  value={`${(predResult.predicted_fill_rate * 100).toFixed(1)}%`}
                />
                <StatCard
                  label="Suggested Threshold"
                  value={predResult.suggested_threshold}
                  sub="min tickets to confirm"
                />
                <div className={`border ${accentBorder} bg-[rgba(19,26,39,0.5)] p-4`}>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-dim)]">
                    Risk
                  </p>
                  <div className="mt-2">
                    <RiskBadge band={predResult.risk_band} />
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--color-text-dim)]">
                    {predResult.best_slot_hint}
                  </p>
                </div>
              </div>
            )}

            {predictMutation.isError && (
              <p className="mt-4 text-sm text-red-400">
                Prediction failed — check that the hall and film are valid.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
