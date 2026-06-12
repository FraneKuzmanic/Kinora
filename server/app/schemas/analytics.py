from pydantic import BaseModel


class CampaignFunnelItem(BaseModel):
    campaign_id: str
    campaign_title: str
    views: int
    votes: int
    reservations: int
    threshold: int
    view_to_vote_rate: float
    vote_to_reservation_rate: float


class CampaignFunnelRead(BaseModel):
    total_views: int
    total_votes: int
    total_reservations: int
    view_to_vote_rate: float
    vote_to_reservation_rate: float
    campaigns: list[CampaignFunnelItem]


class ScreeningHealthRead(BaseModel):
    screening_id: str
    title: str
    starts_at: str
    tickets_sold: int
    min_tickets_to_confirm: int
    days_left: int
    projected_likelihood: float
    risk_band: str
    at_risk: bool


class SlotCell(BaseModel):
    dow: int
    hour_bucket: int
    avg_fill_rate: float
    screening_count: int


class SlotSummary(BaseModel):
    dow: int
    hour_bucket: int
    avg_fill_rate: float
    label: str


class SlotPerformanceRead(BaseModel):
    cells: list[SlotCell]
    best_slots: list[SlotSummary]
    worst_slots: list[SlotSummary]


class FilmDemandItem(BaseModel):
    movie_id: str | None
    title: str
    vote_count: int
    recommendation_count: int
    has_screening: bool


class GenreTrendItem(BaseModel):
    genre_name: str
    interaction_count: int


class ContentDemandRead(BaseModel):
    most_voted: list[FilmDemandItem]
    most_recommended: list[FilmDemandItem]
    repeated_demand_no_screening: list[FilmDemandItem]
    genre_trends: list[GenreTrendItem]


class RevenueMetricsRead(BaseModel):
    confirmed_revenue_cents: int
    pending_potential_cents: int
    refund_count: int
    cancelled_screening_count: int
