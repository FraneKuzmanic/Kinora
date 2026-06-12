import {
  Vote,
  CheckCircle,
  Ticket,
  Users,
  MousePointerClick,
  DollarSign,
  Calendar,
  Film,
  TrendingUp,
  TrendingDown,
  Eye,
  AlertCircle,
  AlertTriangle,
  Zap,
  Plus,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAppContext } from "../context/AppContext";
import { StateBadge } from "../components/StateBadge";
import {
  demandOverTimeData,
  heatmapData,
  topVotedFilms,
  privateBookingStats,
} from "../data/mockData";

function CinemaDashboardPage() {
  const { filmSuggestions, setActiveModal } = useAppContext();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2">For Cinemas</h1>
          <p className="text-muted-foreground">
            Operational overview and demand insights
          </p>
        </div>
        <button
          onClick={() => setActiveModal("create-campaign")}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Voting Events</span>
            <Vote className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl mb-0.5">3</div>
          <p className="text-xs text-green-400">Active</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Confirmed</span>
            <CheckCircle className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-2xl mb-0.5">5</div>
          <p className="text-xs text-muted-foreground">Screenings</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Tickets Sold</span>
            <Ticket className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl mb-0.5">247</div>
          <p className="text-xs text-green-400">+38%</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Private Bookings</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl mb-0.5">11</div>
          <p className="text-xs text-muted-foreground">This month</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Conversion</span>
            <MousePointerClick className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl mb-0.5">24%</div>
          <p className="text-xs text-green-400">+3%</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Est. Revenue</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl mb-0.5">€8.4k</div>
          <p className="text-xs text-green-400">+22%</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="mb-4">Demand Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={demandOverTimeData}>
              <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#333" />
              <XAxis key="xaxis" dataKey="day" stroke="#888" fontSize={12} />
              <YAxis key="yaxis" stroke="#888" fontSize={12} />
              <Tooltip
                key="tooltip"
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: "8px",
                }}
              />
              <Legend key="legend" wrapperStyle={{ paddingTop: "10px" }} iconType="line" />
              <Line key="views-line" type="monotone" dataKey="views" stroke="#d4a574" strokeWidth={2} name="Views" />
              <Line key="votes-line" type="monotone" dataKey="votes" stroke="#60a5fa" strokeWidth={2} name="Votes" />
              <Line key="tickets-line" type="monotone" dataKey="tickets" stroke="#34d399" strokeWidth={2} name="Tickets" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="mb-4">Day/Time Demand Heatmap</h3>
          <div className="space-y-2">
            {heatmapData.map((row) => (
              <div key={row.time} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-12">{row.time}</span>
                <div className="flex-1 grid grid-cols-7 gap-1">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                    const value = row[day as keyof typeof row] as number;
                    const intensity = Math.min(value / 100, 1);
                    return (
                      <div
                        key={day}
                        className="h-8 rounded flex items-center justify-center text-xs"
                        style={{
                          backgroundColor: `rgba(212, 165, 116, ${0.1 + intensity * 0.9})`,
                        }}
                        title={`${day} ${row.time}: ${value} bookings`}
                      >
                        {value}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Voting Performance & Private Bookings Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="mb-4">Voting Performance</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm text-muted-foreground mb-3">Top Voted Films</h4>
              <div className="space-y-2">
                {topVotedFilms.map((item, index) => (
                  <div key={item.movie.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-4">{index + 1}</span>
                      <span className="text-sm">{item.movie.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{item.votes}</span>
                      <span
                        className={`text-xs flex items-center gap-1 ${item.trend === "up" ? "text-green-400" : "text-red-400"}`}
                      >
                        {item.trend === "up" ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {item.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm text-muted-foreground mb-3">Conversion Funnel</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Views</span>
                      <span className="text-sm">1,591</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "100%" }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Vote className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Votes</span>
                      <span className="text-sm">365</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "23%" }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Ticket className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Tickets</span>
                      <span className="text-sm">247</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "15.5%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="mb-4">Private Booking Insights</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm text-muted-foreground mb-3">Booking Types</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-primary" />
                    <span className="text-sm">Screening</span>
                  </div>
                  <span className="text-sm">{privateBookingStats.screeningBookings}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm">Space Rental</span>
                  </div>
                  <span className="text-sm">{privateBookingStats.rentalBookings}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm text-muted-foreground mb-2">Average Group Size</h4>
              <div className="text-2xl">
                {privateBookingStats.avgGroupSize}{" "}
                <span className="text-sm text-muted-foreground">people</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm text-muted-foreground mb-3">Most Requested Dates</h4>
              <div className="space-y-1">
                {privateBookingStats.mostRequestedDates.map((date, index) => (
                  <div key={date} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span>{date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Demand Section */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="mb-4">Content Demand</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-4 text-xs text-muted-foreground mb-2 px-2">
            <span className="col-span-6">Movie</span>
            <span className="col-span-3">Suggestions</span>
            <span className="col-span-3">Status</span>
          </div>
          {filmSuggestions.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-12 gap-4 items-center bg-secondary/30 rounded-lg p-2"
            >
              <span className="col-span-6 text-sm">{item.title}</span>
              <span className="col-span-3 text-sm">{item.count}</span>
              <span className="col-span-3">
                {item.noScreening ? (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    No screening
                  </span>
                ) : (
                  <span className="text-xs text-green-400">Available</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-yellow-500/30 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h3>Alerts & Actions</h3>
          </div>
          <div className="space-y-3">
            <div className="bg-yellow-500/10 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm mb-1">Oldboy campaign at 86% - likely to confirm</p>
                  <p className="text-xs text-muted-foreground">2 days left to reach threshold</p>
                </div>
              </div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <div>
                  <p className="text-sm mb-1">The Thing voting low at 38%</p>
                  <p className="text-xs text-muted-foreground">Consider promoting or adjusting slot</p>
                </div>
              </div>
            </div>
            <div className="bg-primary/10 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="text-sm mb-1">Saturday 9pm slots oversubscribed</p>
                  <p className="text-xs text-muted-foreground">High demand - consider adding capacity</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-primary/30 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h3>Recommendations</h3>
          </div>
          <div className="space-y-3">
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-sm mb-2">Add "Lost in Translation" screening</p>
              <p className="text-xs text-muted-foreground">
                156 searches, no current screening - high demand
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-sm mb-2">Open Sunday 6pm slot for voting</p>
              <p className="text-xs text-muted-foreground">
                Strong historical performance, 24% conversion rate
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-sm mb-2">Promote Titanic for private bookings</p>
              <p className="text-xs text-muted-foreground">
                Popular for family events, avg. 45 guests
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Requests */}
      <div>
        <h3 className="mb-4">Pending Booking Requests</h3>
        <div className="space-y-4">
          <div className="bg-card border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3>Birthday Screening Request</h3>
                  <StateBadge status="pending" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Requested by: Sarah Johnson
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Sat, Apr 5 • 3:00 PM</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>35 guests</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Film className="w-4 h-4" />
                    <span>Titanic</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl text-primary mb-1">€280</div>
                <p className="text-xs text-muted-foreground">Est. revenue</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveModal("booking-request-detail")}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm transition-colors"
              >
                Review Request
              </button>
              <button className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm transition-colors">
                Decline
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CinemaDashboardPage;
export { CinemaDashboardPage as Component };