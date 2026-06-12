import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, BadgePercent, Film, Receipt, Ticket as TicketIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/features/auth/auth-context";
import { TicketCard } from "@/features/tickets/components/TicketCard";
import { TicketPreviewModal } from "@/features/tickets/components/TicketPreviewModal";
import { deriveTicketBucket } from "@/features/tickets/lib/tickets";
import { useMyTickets } from "@/features/tickets/queries/use-my-tickets";
import {
  downloadAdmissionPdf,
  requestAdmissionRefund,
  type AdmissionRead,
} from "@/lib/api/tickets";
import {
  createRewardCoupon,
  getMyLoyaltyWallet,
  type LoyaltyWalletRead,
} from "@/lib/api/loyalty";

type TabId = "active" | "pending" | "refund" | "past";

const TABS: Array<{ id: TabId; label: string; countStyle: string }> = [
  {
    id: "active",
    label: "Active",
    countStyle: "bg-[rgba(223,197,106,0.2)] text-[var(--color-accent)]",
  },
  {
    id: "pending",
    label: "Pending Outcome",
    countStyle: "bg-white/10 text-[var(--color-text-dim)]",
  },
  {
    id: "refund",
    label: "Refund Available",
    countStyle: "bg-[rgba(248,113,113,0.2)] text-[#f87171]",
  },
  {
    id: "past",
    label: "Past",
    countStyle: "bg-white/10 text-[var(--color-text-dim)]",
  },
];

function TicketsLoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border border-[rgba(223,197,106,0.2)]" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-[var(--color-accent)] border-t-[var(--color-accent)]" />
        <div className="absolute inset-3 rounded-full border border-[rgba(223,197,106,0.25)]" />
        <div className="absolute inset-[18px] rounded-full bg-[rgba(223,197,106,0.18)] shadow-[0_0_24px_rgba(223,197,106,0.35)]" />
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: TabId }) {
  if (tab === "active") {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-white/10 bg-[rgba(27,34,49,0.3)] py-20 text-center">
        <TicketIcon className="mb-4 h-12 w-12 text-[rgba(122,132,153,0.5)]" />
        <h3 className="font-heading text-xl text-white">No active tickets</h3>
        <p className="mt-2 max-w-md text-sm text-[var(--color-text-dim)]">
          Buy a screening ticket or secure an Early Bird admission to start your
          collection.
        </p>
        <Link
          to="/screenings"
          className="mt-6 border border-[var(--color-accent)] px-6 py-2 text-xs font-bold uppercase tracking-widest text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
        >
          Browse Screenings
        </Link>
      </div>
    );
  }

  if (tab === "pending") {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-white/10 bg-[rgba(27,34,49,0.3)] py-20 text-center">
        <Film className="mb-4 h-12 w-12 text-[rgba(122,132,153,0.5)]" />
        <h3 className="font-heading text-xl text-white">
          No pending admissions
        </h3>
        <p className="mt-2 max-w-md text-sm text-[var(--color-text-dim)]">
          Early Bird and threshold-based tickets will appear here while they are
          still awaiting confirmation.
        </p>
      </div>
    );
  }

  if (tab === "refund") {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-white/10 bg-[rgba(27,34,49,0.3)] py-20 text-center">
        <Receipt className="mb-4 h-12 w-12 text-[rgba(122,132,153,0.5)]" />
        <h3 className="font-heading text-xl text-white">
          No refund actions waiting
        </h3>
        <p className="mt-2 max-w-md text-sm text-[var(--color-text-dim)]">
          If an Early Bird selection loses and becomes refundable, it will be
          surfaced here clearly.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-white/10 bg-[rgba(27,34,49,0.3)] py-20 text-center">
      <TicketIcon className="mb-4 h-12 w-12 text-[rgba(122,132,153,0.5)]" />
      <h3 className="font-heading text-xl text-white">No past tickets</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--color-text-dim)]">
        Redeemed and refunded tickets will be archived here after their
        lifecycle is complete.
      </p>
    </div>
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function LoyaltyWalletPanel({
  wallet,
  isLoading,
  isCreatingCoupon,
  onCreateCoupon,
}: {
  wallet: LoyaltyWalletRead | undefined;
  isLoading: boolean;
  isCreatingCoupon: boolean;
  onCreateCoupon: (discountPercent: number) => void;
}) {
  const badges = wallet?.badges.slice(0, 8) ?? [];
  const coupons = wallet?.coupons ?? [];

  return (
    <section className="mb-10 border border-[rgba(223,197,106,0.18)] bg-[rgba(19,26,39,0.62)] p-5">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[rgba(223,197,106,0.32)] bg-[rgba(223,197,106,0.08)] text-[var(--color-accent)]">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-text-dim)]">
                Kinora Wallet
              </p>
              <p className="font-heading text-xl text-white">
                {isLoading ? "Loading..." : `${wallet?.points ?? 0} points`}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
                Level
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {wallet?.level_name ?? "Newcomer"}
              </p>
              {wallet?.next_level_name && wallet.points_to_next_level !== null ? (
                <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">
                  {wallet.points_to_next_level} points to {wallet.next_level_name}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">
                  Top loyalty tier
                </p>
              )}
            </div>
            <div className="border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
                Coupons
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {coupons.length} available
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">
                Use on a future ticket checkout
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {wallet?.voucher_options.map((option) => (
              <button
                key={option.discount_percent}
                type="button"
                disabled={!option.available || isCreatingCoupon}
                onClick={() => onCreateCoupon(option.discount_percent)}
                className="inline-flex items-center gap-2 border border-[rgba(223,197,106,0.25)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)] transition-colors hover:bg-[rgba(223,197,106,0.1)] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-[var(--color-text-dim)]"
              >
                <BadgePercent className="h-3.5 w-3.5" />
                {option.discount_percent}% for {option.points_cost} pts
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-dim)]">
              Badges
            </p>
            {badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <span
                    key={badge.id}
                    title={badge.description}
                    className="border border-[rgba(223,197,106,0.18)] bg-[rgba(223,197,106,0.07)] px-2.5 py-1.5 text-[11px] font-medium text-white"
                  >
                    {badge.title}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-dim)]">
                Vote, buy tickets, and attend screenings to earn badges.
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-dim)]">
              Available Coupons
            </p>
            {coupons.length > 0 ? (
              <div className="space-y-2">
                {coupons.slice(0, 3).map((coupon) => (
                  <div
                    key={coupon.id}
                    className="border border-white/10 bg-white/[0.03] px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-white">
                      {coupon.discount_percent}% off
                    </p>
                    <p className="text-[11px] text-[var(--color-text-dim)]">
                      Max {formatCurrency(coupon.max_discount_cents)} · expires{" "}
                      {new Date(coupon.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-dim)]">
                Exchange points for 10% or 20% ticket coupons.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TicketsPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const confirm = useConfirmDialog();
  const [activeTab, setActiveTab] = useState<TabId>("active");
  const [previewAdmission, setPreviewAdmission] =
    useState<AdmissionRead | null>(null);
  const {
    data: admissions = [],
    isLoading,
    isError,
  } = useMyTickets(session?.access_token ?? null);
  const loyaltyQuery = useQuery({
    queryKey: ["loyalty", "me", session?.access_token],
    enabled: Boolean(session?.access_token),
    queryFn: () => getMyLoyaltyWallet(session?.access_token as string),
  });

  const groupedTickets = useMemo(() => {
    return admissions.reduce<Record<TabId, AdmissionRead[]>>(
      (groups, admission) => {
        groups[deriveTicketBucket(admission)].push(admission);
        return groups;
      },
      {
        active: [],
        pending: [],
        refund: [],
        past: [],
      },
    );
  }, [admissions]);

  const refundMutation = useMutation({
    mutationFn: async (admission: AdmissionRead) => {
      if (!session?.access_token) {
        throw new Error("Authentication token is missing.");
      }

      return requestAdmissionRefund(admission.id, session.access_token);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets", "me"] });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (admission: AdmissionRead) => {
      if (!session?.access_token) {
        throw new Error("Authentication token is missing.");
      }

      await downloadAdmissionPdf(admission.id, session.access_token);
    },
  });

  const createCouponMutation = useMutation({
    mutationFn: async (discountPercent: number) => {
      if (!session?.access_token) {
        throw new Error("Authentication token is missing.");
      }
      return createRewardCoupon(discountPercent, session.access_token);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loyalty", "me"] });
    },
  });

  return (
    <section className="w-full pb-24">
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <section className="mb-12">
          <div className="relative border-b border-white/10 pb-6">
            <div>
              <h1 className="flex items-center gap-4 font-display text-5xl uppercase tracking-wider text-white drop-shadow-[0_0_15px_rgba(223,197,106,0.15)] md:text-6xl">
                My Wallet
                <span className="inline-block rounded-sm border border-[var(--color-accent)] bg-[rgba(223,197,106,0.05)] px-3 py-1.5 text-[10px] tracking-[0.3em] text-[var(--color-accent)]">
                  PROFILE
                </span>
              </h1>
              <p className="mt-2 max-w-md text-sm font-light tracking-wide text-[var(--color-text-dim)]">
                Your cinema wallet. Access tickets, points, badges, coupons,
                and Early Bird outcomes in one place.
              </p>
            </div>

            <div className="absolute bottom-0 right-0 h-32 w-64 bg-[rgba(223,197,106,0.05)] blur-[50px]" />
          </div>
        </section>

        <LoyaltyWalletPanel
          wallet={loyaltyQuery.data}
          isLoading={loyaltyQuery.isLoading}
          isCreatingCoupon={createCouponMutation.isPending}
          onCreateCoupon={async (discountPercent) => {
            const option = loyaltyQuery.data?.voucher_options.find(
              (item) => item.discount_percent === discountPercent,
            );
            const confirmed = await confirm({
              title: "Create coupon?",
              message: `Exchange ${option?.points_cost ?? "your"} points for a ${discountPercent}% coupon? This cannot be undone.`,
              confirmLabel: "Create coupon",
            });
            if (confirmed) {
              createCouponMutation.mutate(discountPercent);
            }
          }}
        />

        <section className="mb-10">
          <div className="flex gap-8 overflow-x-auto border-b border-white/5 pb-[1px]">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`cursor-pointer whitespace-nowrap border-b-2 pb-4 text-xs uppercase tracking-widest transition-colors ${
                  activeTab === tab.id
                    ? "border-[var(--color-accent)] font-semibold text-[var(--color-accent)]"
                    : "border-transparent font-medium text-[var(--color-text-dim)] hover:text-white"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 rounded-sm px-1.5 py-0.5 text-[9px] ${tab.countStyle}`}
                >
                  {groupedTickets[tab.id].length}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          {isLoading ? <TicketsLoadingState /> : null}

          {isError ? (
            <div className="rounded-sm border border-[rgba(248,113,113,0.2)] bg-[rgba(27,34,49,0.45)] p-6 text-sm text-[#f87171]">
              Could not load your tickets.
            </div>
          ) : null}

          {!isLoading && !isError ? (
            groupedTickets[activeTab].length > 0 ? (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {groupedTickets[activeTab].map((admission) => (
                  <TicketCard
                    key={admission.id}
                    admission={admission}
                    isRefunding={
                      refundMutation.isPending &&
                      refundMutation.variables?.id === admission.id
                    }
                    isDownloading={
                      downloadMutation.isPending &&
                      downloadMutation.variables?.id === admission.id
                    }
                    onViewTicket={setPreviewAdmission}
                    onDownloadPdf={(selectedAdmission) =>
                      downloadMutation.mutateAsync(selectedAdmission)
                    }
                    onRequestRefund={async (selectedAdmission) => {
                      const confirmed = await confirm({
                        title: "Request refund?",
                        message:
                          "Request a refund for this ticket? This will start the refund flow and may change the ticket status.",
                        confirmLabel: "Request refund",
                      });
                      if (!confirmed) {
                        return;
                      }
                      await refundMutation.mutateAsync(selectedAdmission);
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState tab={activeTab} />
            )
          ) : null}
        </section>
      </div>

      <TicketPreviewModal
        admission={previewAdmission}
        isOpen={Boolean(previewAdmission)}
        isDownloading={
          downloadMutation.isPending &&
          downloadMutation.variables?.id === previewAdmission?.id
        }
        onClose={() => setPreviewAdmission(null)}
        onDownload={(admission) => downloadMutation.mutateAsync(admission)}
      />
    </section>
  );
}
