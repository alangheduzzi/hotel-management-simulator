import React, { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  BedDouble,
  CalendarDays,
  UsersRound,
  ChartNoAxesCombined,
  Settings2,
  CircleHelp,
  Bell,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Search,
  X,
  Check,
  LogIn,
  LogOut,
  ArrowRight,
  Sparkles,
  DoorOpen,
  SprayCan,
  Wrench,
  CheckCheck,
  Menu,
  Mail,
  Globe,
  Clock3,
  RotateCcw,
  CalendarClock,
  CreditCard,
  Building2,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import {
  createInitialState,
  getMetrics,
  getDailyActivity,
  getRoomStatusCounts,
  createReservation,
  checkIn,
  checkOut,
  updateRoomStatus,
  advanceDay,
  getRevenueSeries,
  cancelReservation,
} from "./hotel.js";

const STORE = "aurelia-hotel-v1";
const money = (value, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);
const dateLabel = (value, options = { month: "short", day: "numeric" }) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", options);
const nights = (start, end) =>
  Math.round((new Date(end) - new Date(start)) / 86400000);
const initials = (name) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
const addDays = (date, days) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const statusLabels = {
  "checked-in": "In house",
  "checked-out": "Checked out",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  occupied: "Occupied",
  available: "Available",
  reserved: "Reserved",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
};
const statusColors = {
  occupied: "#214e40",
  available: "#a5bd9e",
  reserved: "#cbb477",
  cleaning: "#e4c89d",
  maintenance: "#d7dcd8",
};
const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "rooms", label: "Rooms", icon: BedDouble },
  { id: "reservations", label: "Reservations", icon: CalendarDays },
  { id: "guests", label: "Guests", icon: UsersRound },
  { id: "revenue", label: "Revenue & analytics", icon: ChartNoAxesCombined },
];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (
      saved?.rooms?.length === 48 &&
      saved?.reservations &&
      saved?.ledger &&
      saved?.date
    )
      return saved;
  } catch {}
  return createInitialState();
}
function Avatar({ guest, small = false }) {
  const palette = ["sage", "rose", "sand", "lilac", "blue"];
  const tone =
    palette[(guest.name.charCodeAt(0) + guest.name.length) % palette.length];
  return (
    <span className={`avatar ${tone} ${small ? "small" : ""}`}>
      {guest.initials || initials(guest.name)}
    </span>
  );
}
function Badge({ status, children }) {
  return (
    <span className={`badge ${status}`}>
      <i />
      {children || statusLabels[status] || status}
    </span>
  );
}
function Empty({
  title = "Nothing here just yet",
  text = "Try a different search or filter.",
}) {
  return (
    <div className="empty">
      <Search size={25} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [page, setPage] = useState("overview");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [notifications, setNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const timer = useRef();
  const metrics = getMetrics(state);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const notify = (message, error = false) => {
    setToast({ message, error });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4500);
  };
  const act = (operation, message) => {
    try {
      setState(operation(state));
      notify(message);
      return true;
    } catch (error) {
      notify(error.message, true);
      return false;
    }
  };
  const navigate = (id) => {
    setPage(id);
    setSidebarOpen(false);
    setNotifications(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openGuest = (reservation) => {
    setSelected(reservation.id);
    setModal("reservation");
  };
  const exportReport = () => {
    const rows = [
      ["THE AURELIA — HOTEL REPORT", state.date],
      ["Metric", "Value"],
      ["Total rooms", metrics.totalRooms],
      ["Occupied rooms", metrics.occupiedRooms],
      ["Occupancy (%)", metrics.occupancy],
      ["Average daily rate", metrics.adr],
      ["Revenue per available room", metrics.revpar],
      ["Room revenue", metrics.roomRevenue],
      ["Total hotel revenue", metrics.totalRevenue],
      [],
      [
        "Reservation",
        "Guest",
        "Room",
        "Arrival",
        "Departure",
        "Status",
        "Nightly rate",
        "Total",
      ],
      ...state.reservations.map((r) => [
        r.id,
        r.guest.name,
        r.roomId,
        r.checkIn,
        r.checkOut,
        r.status,
        r.rate,
        r.total,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `aurelia-report-${state.date}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Your hotel report has been exported.");
  };
  const chosenReservation = state.reservations.find((r) => r.id === selected);
  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <a
          className="brand"
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="brand-mark">
            <span>A</span>
            <i />
          </span>
          <span className="brand-name">
            THE AURELIA<small>HOTEL & RESIDENCES</small>
          </span>
        </a>
        <button
          className="property-switch"
          onClick={() => setModal("property")}
        >
          <span className="property-icon">
            <Building2 size={17} />
          </span>
          <span>
            The Aurelia, Florence<small>48 rooms · Boutique collection</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => navigate(id)}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {id === "reservations" && (
                <span className="nav-count">{metrics.pendingArrivals}</span>
              )}
              {page === id && id !== "reservations" && (
                <span className="nav-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="concierge-card">
            <span className="concierge-icon">
              <Sparkles size={20} />
            </span>
            <h3>Hospitality, thoughtfully.</h3>
            <p>
              The little details make
              <br />
              the biggest difference.
            </p>
            <button onClick={() => setModal("help")}>
              Your daily briefing <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={18} strokeWidth={1.7} />
            <span>Settings</span>
          </button>
          <button className="nav-item" onClick={() => setModal("help")}>
            <CircleHelp size={18} strokeWidth={1.7} />
            <span>Help & getting started</span>
            <ArrowUpRight size={14} />
          </button>
          <button className="profile" onClick={() => navigate("settings")}>
            <span className="avatar manager">OB</span>
            <span>
              Olivia Bennett<small>General manager</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {page === "revenue"
                ? "Revenue & analytics"
                : page[0].toUpperCase() + page.slice(1)}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="live-indicator">
              <i />
              Hotel is live
            </span>
            <span className="header-divider" />
            <div className="notification-wrap">
              <button
                className={`icon-button notification-button ${notifications ? "selected" : ""}`}
                aria-label="Notifications"
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                <span />
              </button>
              {notifications && (
                <div className="notification-panel">
                  <div className="popover-heading">
                    Your daily brief <span>{dateLabel(state.date)}</span>
                  </div>
                  <p>
                    <CalendarDays size={18} />
                    <span>
                      <strong>
                        {metrics.pendingArrivals} expected arrivals
                      </strong>
                      <small>Make every first impression count.</small>
                    </span>
                  </p>
                  <p>
                    <LogOut size={18} />
                    <span>
                      <strong>
                        {metrics.pendingDepartures} departures remaining
                      </strong>
                      <small>Review the front desk activity below.</small>
                    </span>
                  </p>
                  <p>
                    <SprayCan size={18} />
                    <span>
                      <strong>
                        {getRoomStatusCounts(state).cleaning || 0} rooms need a
                        little care
                      </strong>
                      <small>Keep your room inventory guest-ready.</small>
                    </span>
                  </p>
                  <button onClick={() => navigate("rooms")}>
                    View room operations <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </div>
            <button
              className="header-avatar"
              aria-label="Manager settings"
              onClick={() => navigate("settings")}
            >
              OB
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span />
                {dateLabel(state.date, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <h1>
                {
                  {
                    overview: "Every stay, exceptional.",
                    rooms: "A room for every story.",
                    reservations: "Your next warm welcome.",
                    guests: "Familiar faces. New stories.",
                    revenue: "A clearer view of growth.",
                    settings: "Make yourself at home.",
                  }[page]
                }
              </h1>
              <p>
                {
                  {
                    overview:
                      "Welcome back, Olivia. Here’s how your hotel is doing today.",
                    rooms:
                      "A live view of your rooms, from arrival-ready to a little TLC.",
                    reservations: "Thoughtful planning for seamless stays.",
                    guests: "The people at the heart of your hospitality.",
                    revenue: "The numbers behind every memorable stay.",
                    settings:
                      "Your property, preferences, and simulation controls.",
                  }[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                onClick={
                  page === "revenue" ? exportReport : () => navigate("revenue")
                }
              >
                <Download size={16} />
                {page === "revenue" ? "Export report" : "View reports"}
              </button>
              <button
                className="button primary"
                onClick={() => setModal("new")}
              >
                <Plus size={18} />
                New reservation
              </button>
            </div>
          </div>
          {storageError && (
            <div className="storage-warning">
              Browser storage is unavailable. Your changes will last for this
              session only.
            </div>
          )}
          {page === "overview" && (
            <>
              <Metrics metrics={metrics} state={state} />
              <div className="analytics-grid">
                <RevenueChart state={state} />
                <OccupancyCard state={state} metrics={metrics} />
              </div>
              <div className="operations-grid">
                <ActivityTable
                  state={state}
                  onOpen={openGuest}
                  act={act}
                  onNew={() => setModal("new")}
                />
                <RoomStatusCard
                  state={state}
                  onView={() => navigate("rooms")}
                />
              </div>
              <div className="daily-note">
                <span>
                  <Sparkles size={15} />
                  <strong>It’s all in the details.</strong> A seamless stay
                  starts with a well-prepared team.
                </span>
                <span>
                  <i />
                  All systems running smoothly
                </span>
              </div>
            </>
          )}
          {page === "rooms" && (
            <RoomsPage state={state} act={act} onOpen={openGuest} />
          )}
          {page === "reservations" && (
            <>
              <div className="summary-strip">
                <span>
                  <CalendarDays size={20} />
                  <strong>
                    {
                      state.reservations.filter((r) => r.status === "confirmed")
                        .length
                    }
                  </strong>{" "}
                  Upcoming reservations
                </span>
                <span>
                  <LogIn size={20} />
                  <strong>{metrics.arrivals}</strong> Arriving today
                </span>
                <span>
                  <LogOut size={20} />
                  <strong>{metrics.departures}</strong> Departing today
                </span>
              </div>
              <ActivityTable
                state={state}
                onOpen={openGuest}
                act={act}
                full
                onNew={() => setModal("new")}
              />
            </>
          )}
          {page === "guests" && <GuestsPage state={state} onOpen={openGuest} />}
          {page === "revenue" && (
            <>
              <Metrics metrics={metrics} state={state} />
              <div className="analytics-grid revenue-layout">
                <RevenueChart state={state} large />
                <RevenueBreakdown state={state} metrics={metrics} />
              </div>
              <RevenueHistory state={state} />
            </>
          )}
          {page === "settings" && (
            <SettingsPage
              state={state}
              act={act}
              onReset={() => setModal("reset")}
            />
          )}
          <footer className="page-footer">
            <span>
              THE AURELIA <i /> A considered approach to hospitality.
            </span>
            <span>
              Florence, Italy <span className="footer-star">✧</span>
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <Modal
          title={
            modal === "new"
              ? "Create a memorable stay."
              : modal === "reservation"
                ? "Stay details"
                : modal === "reset"
                  ? "A fresh beginning?"
                  : modal === "property"
                    ? "The Aurelia, Florence"
                    : "A thoughtful start to your day."
          }
          onClose={() => setModal(null)}
        >
          {modal === "new" && (
            <ReservationForm
              state={state}
              onCancel={() => setModal(null)}
              onSubmit={(input) => {
                try {
                  setState(createReservation(state, input));
                  notify(
                    `A warm welcome awaits ${input.guestName}. Reservation created.`,
                  );
                  setModal(null);
                } catch (error) {
                  throw error;
                }
              }}
            />
          )}
          {modal === "reservation" && chosenReservation && (
            <ReservationDetails
              reservation={chosenReservation}
              state={state}
              act={act}
            />
          )}
          {modal === "reset" && (
            <>
              <p className="modal-copy">
                This will restore the sample hotel to October 16, 2026. Your
                reservations and changes in this browser will be replaced.
              </p>
              <div className="modal-actions">
                <button
                  className="button secondary"
                  onClick={() => setModal(null)}
                >
                  Keep my hotel
                </button>
                <button
                  className="button danger"
                  onClick={() => {
                    setState(createInitialState());
                    setModal(null);
                    notify("Your sample hotel has been restored.");
                  }}
                >
                  Reset sample hotel
                </button>
              </div>
            </>
          )}
          {modal === "property" && (
            <>
              <div className="property-detail">
                <span className="brand-mark">
                  <span>A</span>
                  <i />
                </span>
                <h3>
                  An independent spirit.
                  <br />
                  An extraordinary address.
                </h3>
                <p>
                  48 thoughtfully appointed rooms in the heart of Florence.
                  Classic comforts, Italian warmth, and a little Aurelia magic.
                </p>
              </div>
              <div className="property-facts">
                <span>
                  <BedDouble size={18} />
                  48 rooms
                </span>
                <span>
                  <Globe size={18} />
                  Florence, Italy
                </span>
                <span>
                  <CreditCard size={18} />
                  USD · $
                </span>
              </div>
            </>
          )}
          {modal === "help" && (
            <div className="help-content">
              <p className="modal-copy">
                Everything you need for a beautifully run day.
              </p>
              {[
                [
                  CalendarDays,
                  "Welcome your arrivals",
                  `${metrics.pendingArrivals} guests are expected today. Open a reservation to review their stay, then check them in when their room is ready.`,
                ],
                [
                  SprayCan,
                  "Give every room its moment",
                  "Check-out sends a room to cleaning. Open Rooms and mark it ready to make it available for the next guest.",
                ],
                [
                  ChartNoAxesCombined,
                  "Keep an eye on the bigger picture",
                  "Occupancy uses all 48 rooms. ADR tracks today’s lodging revenue per room sold; RevPAR tracks revenue across all rooms.",
                ],
                [
                  CalendarClock,
                  "Explore a new day",
                  "Use Settings to advance the simulation. Changes are saved in this browser. Export your report at any time.",
                ],
              ].map(([Icon, title, text]) => (
                <div className="help-row" key={title}>
                  <span>
                    <Icon size={21} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      {toast && (
        <div className={`toast ${toast.error ? "error" : ""}`} role="status">
          {toast.error ? <CircleHelp size={19} /> : <CheckCircle2 size={19} />}
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Metrics({ metrics, state }) {
  const daily = getRevenueSeries(state, "week");
  const prior = state.ledger.filter(
    (entry) => entry.date === addDays(state.date, -7) && entry.type === "room",
  );
  const priorRevenue = prior.reduce((sum, entry) => sum + entry.amount, 0);
  const priorSold = prior.reduce(
    (sum, entry) => sum + (entry.soldRooms ?? 1),
    0,
  );
  const historical = daily.map((day) => {
    const entries = state.ledger.filter(
      (e) => e.date === day.date && e.type === "room",
    );
    const revenue = entries.reduce((sum, e) => sum + e.amount, 0);
    const sold = entries.reduce((sum, e) => sum + (e.soldRooms ?? 1), 0);
    return {
      occupancy: day.occupancy,
      adr: sold ? revenue / sold : 0,
      revpar: revenue / 48,
      roomRevenue: revenue,
    };
  });
  const previous = {
    occupancy:
      getRevenueSeries(state, "month").find(
        (day) => day.date === addDays(state.date, -7),
      )?.occupancy ?? 0,
    adr: priorSold ? priorRevenue / priorSold : 0,
    revpar: priorRevenue / 48,
    roomRevenue: priorRevenue,
  };
  const cards = [
    {
      key: "occupancy",
      label: "Occupancy rate",
      value: `${metrics.occupancy.toFixed(1)}%`,
      icon: BedDouble,
      sub: `${metrics.occupiedRooms} of ${metrics.totalRooms} rooms occupied`,
    },
    {
      key: "adr",
      label: "Average daily rate",
      value: money(metrics.adr),
      icon: CreditCard,
      sub: "Per room sold today",
    },
    {
      key: "revpar",
      label: "RevPAR",
      value: money(metrics.revpar),
      icon: ChartNoAxesCombined,
      sub: "Revenue per available room",
    },
    {
      key: "roomRevenue",
      label: "Room revenue",
      value: money(metrics.roomRevenue),
      icon: DoorOpen,
      sub: "Lodging revenue today",
    },
  ];
  return (
    <div className="metrics-grid">
      {cards.map((card, i) => {
        const growth = previous[card.key]
          ? (metrics[card.key] / previous[card.key] - 1) * 100
          : 0;
        const values = historical.map((d) => d[card.key]);
        const min = Math.min(...values) * 0.9;
        const max = Math.max(...values) * 1.05;
        const points = values.map(
          (v, j) =>
            `${(j * 100) / (values.length - 1)},${35 - ((v - min) / (max - min || 1)) * 28}`,
        );
        const TrendIcon = growth >= 0 ? ArrowUpRight : ArrowDownRight;
        return (
          <section className="metric-card" key={card.label}>
            <div className="metric-heading">
              <span>{card.label}</span>
              <card.icon size={18} strokeWidth={1.6} />
            </div>
            <div className="metric-value">
              {card.value}
              <span className={`trend ${growth < 0 ? "down" : ""}`}>
                <TrendIcon size={13} />
                {growth > 0 ? "+" : ""}
                {growth.toFixed(1)}%
              </span>
            </div>
            <div className="metric-bottom">
              <span>{card.sub}</span>
              <svg viewBox="0 0 100 40" aria-hidden="true">
                <defs>
                  <linearGradient id={`spark-${i}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#799878" stopOpacity=".22" />
                    <stop offset="100%" stopColor="#799878" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`M0 40 ${points.map((p) => `L${p.replace(",", " ")}`).join(" ")} L100 40 Z`}
                  fill={`url(#spark-${i})`}
                />
                <polyline
                  points={points.join(" ")}
                  fill="none"
                  stroke="#83a281"
                  strokeWidth="1.7"
                />
              </svg>
            </div>
            <div className="metric-compare">vs. same day last week</div>
          </section>
        );
      })}
    </div>
  );
}

function RevenueChart({ state, large = false }) {
  const [period, setPeriod] = useState("week");
  const [hovered, setHovered] = useState(null);
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const series = getRevenueSeries(state, period);
  const total = series.reduce((sum, d) => sum + d.revenue, 0);
  const previous = series.reduce((sum, d) => sum + d.previousRevenue, 0);
  const growth = previous ? ((total - previous) / previous) * 100 : 0;
  const W = compact ? 440 : 720,
    H = compact ? 210 : large ? 245 : 196,
    left = 49,
    right = 13,
    top = 20,
    bottom = 29;
  const max =
    Math.ceil(
      Math.max(
        ...series.map((d) => Math.max(d.revenue, d.previousRevenue)),
        1,
      ) / 4000,
    ) * 4000;
  const x = (i) =>
    left + (i / Math.max(1, series.length - 1)) * (W - left - right);
  const y = (value) => top + (1 - value / max) * (H - top - bottom);
  const path = (key) =>
    series
      .map((d, i) => {
        if (i === 0) return `M${x(i)},${y(d[key])}`;
        const midpoint = (x(i - 1) + x(i)) / 2;
        return `C${midpoint},${y(series[i - 1][key])} ${midpoint},${y(d[key])} ${x(i)},${y(d[key])}`;
      })
      .join(" ");
  const displayPoints =
    series.length > 10
      ? series.filter((_, i) => i % 5 === 0 || i === series.length - 1)
      : series;
  return (
    <section className="card revenue-card">
      <div className="card-heading">
        <div>
          <h2>Revenue overview</h2>
          <p>A little perspective on your performance.</p>
        </div>
        <div className="segmented" aria-label="Revenue period">
          <button
            className={period === "week" ? "active" : ""}
            onClick={() => {
              setPeriod("week");
              setHovered(null);
            }}
          >
            7 days
          </button>
          <button
            className={period === "month" ? "active" : ""}
            onClick={() => {
              setPeriod("month");
              setHovered(null);
            }}
          >
            30 days
          </button>
        </div>
      </div>
      <div className="revenue-chart-summary">
        <strong>{money(total)}</strong>
        <span className={`chart-growth ${growth < 0 ? "negative" : ""}`}>
          {growth < 0 ? (
            <ArrowDownRight size={14} />
          ) : (
            <ArrowUpRight size={14} />
          )}
          {growth >= 0 ? "+" : ""}
          {growth.toFixed(1)}%<small>vs. previous period</small>
        </span>
        <div className="chart-legend">
          <span>
            <i />
            This period
          </span>
          <span>
            <i />
            Previous period
          </span>
        </div>
      </div>
      <div className="revenue-svg-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Revenue over the last ${period === "week" ? "7" : "30"} days: ${money(total)}`}
        >
          <defs>
            <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#5f8970" stopOpacity=".22" />
              <stop offset="100%" stopColor="#5f8970" stopOpacity=".015" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line
                x1={left}
                y1={y(max * f)}
                x2={W - right}
                y2={y(max * f)}
                stroke="#e9ece7"
                strokeDasharray={f ? "3 4" : "0"}
              />
              <text x={left - 12} y={y(max * f) + 4} textAnchor="end">
                {f ? `$${(max * f) / 1000}k` : "$0"}
              </text>
            </g>
          ))}
          <path
            d={`${path("revenue")} L${x(series.length - 1)},${H - bottom} L${left},${H - bottom} Z`}
            fill="url(#revenue-fill)"
          />
          <path
            d={path("previousRevenue")}
            fill="none"
            stroke="#c6b991"
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinejoin="round"
          />
          <path
            d={path("revenue")}
            fill="none"
            stroke="#406e54"
            strokeWidth="2.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {displayPoints.map((d) => (
            <text
              key={d.date}
              x={x(series.indexOf(d))}
              y={H - 6}
              textAnchor="middle"
            >
              {d.label}
            </text>
          ))}
          {series.map((d, i) => (
            <g
              key={d.date}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect
                x={x(i) - (W - left) / series.length / 2}
                y={top}
                width={(W - left) / series.length}
                height={H - bottom - top}
                fill="transparent"
              />
              <circle
                cx={x(i)}
                cy={y(d.revenue)}
                r={hovered === i ? 5 : 0}
                fill="#406e54"
                stroke="white"
                strokeWidth="2"
              />
            </g>
          ))}
          {hovered !== null && (
            <g pointerEvents="none">
              <rect
                x={Math.min(Math.max(x(hovered) - 56, left), W - 120)}
                y={Math.max(y(series[hovered].revenue) - 50, 0)}
                width="112"
                height="35"
                rx="6"
                fill="#214a3d"
              />
              <text
                x={Math.min(Math.max(x(hovered), left + 56), W - 64)}
                y={Math.max(y(series[hovered].revenue) - 28, 22)}
                textAnchor="middle"
                style={{ fill: "white", fontSize: "12px", fontWeight: 600 }}
              >
                {money(series[hovered].revenue)}
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="chart-footnote">
        <span>
          <span className="tiny-dot" />
          Room revenue · {dateLabel(series[0].date)} –{" "}
          {dateLabel(series.at(-1).date)}, {state.date.slice(0, 4)}
        </span>
        <span>USD</span>
      </div>
    </section>
  );
}

function OccupancyCard({ state, metrics }) {
  const counts = getRoomStatusCounts(state);
  const ordered = [
    "occupied",
    "available",
    "reserved",
    "cleaning",
    "maintenance",
  ];
  let offset = 0;
  const circumference = 2 * Math.PI * 65;
  return (
    <section className="card occupancy-card">
      <div className="card-heading">
        <div>
          <h2>Occupancy snapshot</h2>
          <p>A place for every guest.</p>
        </div>
        <span className="today-tag">Today</span>
      </div>
      <div className="donut-container">
        <svg
          viewBox="0 0 180 180"
          role="img"
          aria-label={`${metrics.occupancy.toFixed(1)} percent occupancy`}
        >
          <circle
            cx="90"
            cy="90"
            r="65"
            fill="none"
            stroke="#f0f2ed"
            strokeWidth="21"
          />
          {ordered.map((status) => {
            const length =
              ((counts[status] || 0) / metrics.totalRooms) * circumference;
            const start = offset;
            offset += length;
            return counts[status] ? (
              <circle
                key={status}
                cx="90"
                cy="90"
                r="65"
                fill="none"
                stroke={statusColors[status]}
                strokeWidth="21"
                strokeDasharray={`${Math.max(0, length - 3)} ${circumference - Math.max(0, length - 3)}`}
                strokeDashoffset={-start}
                transform="rotate(-90 90 90)"
              />
            ) : null;
          })}
          <text x="90" y="90" textAnchor="middle" className="donut-value">
            {Math.round(metrics.occupancy)}
            <tspan>%</tspan>
          </text>
          <text x="90" y="111" textAnchor="middle" className="donut-caption">
            Occupancy rate
          </text>
        </svg>
        <span className="donut-note">
          <span>THE AURELIA</span>
          <strong>
            {metrics.occupiedRooms}
            <small> / {metrics.totalRooms}</small>
          </strong>
          <p>rooms occupied</p>
        </span>
      </div>
      <div className="occupancy-legend">
        {ordered.map((status) => (
          <div key={status}>
            <span>
              <i style={{ background: statusColors[status] }} />
              {statusLabels[status]}
            </span>
            <strong>
              {counts[status] || 0}
              <small>
                {Math.round(((counts[status] || 0) / metrics.totalRooms) * 100)}
                %
              </small>
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityTable({ state, onOpen, act, full = false, onNew }) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(5);
  const tabs = [
    { id: "all", label: full ? "All reservations" : "All activity" },
    { id: "arrivals", label: "Arrivals" },
    { id: "departures", label: "Departures" },
    { id: "inhouse", label: "In house" },
  ];
  const source =
    full && tab === "all"
      ? [...state.reservations].sort((a, b) =>
          b.checkIn.localeCompare(a.checkIn),
        )
      : getDailyActivity(state, tab);
  const filtered = source.filter((r) =>
    `${r.guest.name} ${r.guest.email} ${r.roomId} ${r.id}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const visible = filtered.slice(0, full ? limit * 2 : limit);
  return (
    <section className={`card activity-card ${full ? "full-table" : ""}`}>
      <div className="card-heading">
        <div>
          <h2>{full ? "Reservations" : "Today’s front desk"}</h2>
          <p>
            {full
              ? "Every stay, beautifully organized."
              : "Small moments. Seamless arrivals."}
          </p>
        </div>
        {!full && (
          <span className="activity-count">
            {getDailyActivity(state, "arrivals").filter(
              (r) => r.status === "confirmed",
            ).length +
              getDailyActivity(state, "departures").filter(
                (r) => r.status === "checked-in",
              ).length}{" "}
            expected today
          </span>
        )}
        {full && (
          <button className="text-button" onClick={onNew}>
            <Plus size={16} />
            Add reservation
          </button>
        )}
      </div>
      <div className="table-toolbar">
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => {
                setTab(t.id);
                setLimit(5);
              }}
            >
              {t.label}
              {t.id !== "all" && (
                <span>{getDailyActivity(state, t.id).length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="table-search">
          <Search size={15} />
          <input
            aria-label="Search guests or reservations"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(5);
            }}
            placeholder="Search guests..."
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>GUEST</th>
              <th>ROOM</th>
              <th>{tab === "departures" ? "DEPARTURE" : "STAY"}</th>
              <th>STATUS</th>
              <th className="align-right">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const room = state.rooms.find((room) => room.id === r.roomId);
              const arriving =
                r.status === "confirmed" &&
                r.checkIn <= state.date &&
                r.checkOut > state.date;
              const departing =
                r.status === "checked-in" && r.checkOut <= state.date;
              return (
                <tr key={r.id}>
                  <td>
                    <button className="guest-cell" onClick={() => onOpen(r)}>
                      <Avatar guest={r.guest} />
                      <span>
                        <strong>{r.guest.name}</strong>
                        <small>
                          {r.id} <i>·</i> {r.source}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className="room-number">
                      {room?.number || r.roomId}
                    </span>
                    <small className="room-type">
                      {room?.type || "Classic King"}
                    </small>
                  </td>
                  <td>
                    <span className="stay-dates">
                      {dateLabel(r.checkIn)} <span>–</span>{" "}
                      {dateLabel(r.checkOut)}
                    </span>
                    <small className="room-type">
                      {nights(r.checkIn, r.checkOut)} nights · {r.guests}{" "}
                      {r.guests === 1 ? "guest" : "guests"}
                    </small>
                  </td>
                  <td>
                    <Badge status={r.status}>
                      {departing
                        ? "Due out"
                        : arriving
                          ? "Expected"
                          : statusLabels[r.status]}
                    </Badge>
                  </td>
                  <td className="align-right">
                    {arriving ? (
                      <button
                        className="table-action"
                        onClick={() =>
                          act(
                            (s) => checkIn(s, r.id),
                            `${r.guest.name} is checked in. Welcome to The Aurelia.`,
                          )
                        }
                      >
                        Check in <LogIn size={13} />
                      </button>
                    ) : departing ? (
                      <button
                        className="table-action checkout"
                        onClick={() =>
                          act(
                            (s) => checkOut(s, r.id),
                            `${r.guest.name} has checked out. Room ${r.roomId} is ready for cleaning.`,
                          )
                        }
                      >
                        Check out <LogOut size={13} />
                      </button>
                    ) : (
                      <button
                        className="icon-button details-button"
                        aria-label={`View ${r.guest.name}'s reservation`}
                        onClick={() => onOpen(r)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && <Empty title="No stays found" />}
      </div>
      <div className="table-footer">
        <span>
          Showing {Math.min(visible.length, filtered.length)} of{" "}
          {filtered.length} {full ? "reservations" : "stays"}
        </span>
        {visible.length < filtered.length ? (
          <button onClick={() => setLimit(limit + 5)}>
            View more {full ? "reservations" : "activity"}
            <ArrowRight size={14} />
          </button>
        ) : (
          <span className="table-updated">
            <i />
            Live updates
          </span>
        )}
      </div>
    </section>
  );
}

function RoomStatusCard({ state, onView }) {
  const counts = getRoomStatusCounts(state);
  return (
    <section className="card room-status-card">
      <div className="card-heading">
        <div>
          <h2>Room readiness</h2>
          <p>Good stays begin here.</p>
        </div>
        <span className="icon-soft">
          <DoorOpen size={19} />
        </span>
      </div>
      <div className="ready-value">
        <strong>
          {counts.available || 0}
          <span> / 48</span>
        </strong>
        <span>ready to welcome</span>
      </div>
      <div className="room-mini-grid">
        {state.rooms.map((r) => (
          <span
            key={r.id}
            title={`Room ${r.number}: ${statusLabels[r.status]}`}
            className={`mini-room ${r.status}`}
          >
            {r.number}
          </span>
        ))}
      </div>
      <div className="room-status-callout">
        <SprayCan size={17} />
        <span>
          <strong>{counts.cleaning || 0} rooms</strong> awaiting housekeeping
        </span>
      </div>
      <button className="full-card-link" onClick={onView}>
        Manage rooms
        <ArrowRight size={15} />
      </button>
    </section>
  );
}

function RoomsPage({ state, act, onOpen }) {
  const [filter, setFilter] = useState("all");
  const [floor, setFloor] = useState("all");
  const [query, setQuery] = useState("");
  const counts = getRoomStatusCounts(state);
  const rooms = state.rooms.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      (floor === "all" || r.floor === Number(floor)) &&
      `${r.number} ${r.type}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="room-filter-summary">
        {[
          "all",
          "available",
          "occupied",
          "reserved",
          "cleaning",
          "maintenance",
        ].map((s) => (
          <button
            key={s}
            className={filter === s ? "active" : ""}
            onClick={() => setFilter(s)}
          >
            <i style={{ background: statusColors[s] || "#65776d" }} />
            <span>{s === "all" ? "All rooms" : statusLabels[s]}</span>
            <strong>{s === "all" ? 48 : counts[s] || 0}</strong>
          </button>
        ))}
      </div>
      <div className="section-toolbar">
        <h2>
          Your room collection <span>{rooms.length} rooms</span>
        </h2>
        <div>
          <div className="table-search">
            <Search size={16} />
            <input
              aria-label="Search rooms"
              placeholder="Search rooms..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter by floor"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
          >
            <option value="all">All floors</option>
            {[1, 2, 3, 4].map((f) => (
              <option value={f} key={f}>
                Floor {f}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="rooms-grid">
        {rooms.map((room) => {
          const stay = state.reservations.find(
            (r) => r.roomId === room.id && r.status === "checked-in",
          );
          const arrival = state.reservations.find(
            (r) =>
              r.roomId === room.id &&
              r.status === "confirmed" &&
              r.checkIn <= state.date &&
              r.checkOut > state.date,
          );
          return (
            <article className={`room-card ${room.status}`} key={room.id}>
              <div className="room-card-top">
                <span className="room-card-icon">
                  <BedDouble size={23} strokeWidth={1.4} />
                </span>
                <Badge status={room.status} />
              </div>
              <div className="room-card-title">
                <h3>{room.number}</h3>
                <span>
                  {money(room.rate)}
                  <small> / night</small>
                </span>
              </div>
              <p>
                {room.type}
                <span>Floor {room.floor}</span>
              </p>
              <div className="room-card-guest">
                {stay ? (
                  <button onClick={() => onOpen(stay)}>
                    <Avatar guest={stay.guest} small />
                    <span>
                      {stay.guest.name}
                      <small>Until {dateLabel(stay.checkOut)}</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ) : arrival ? (
                  <button onClick={() => onOpen(arrival)}>
                    <CalendarClock size={20} />
                    <span>
                      {arrival.guest.name}
                      <small>
                        {arrival.checkIn < state.date
                          ? "Arrival pending"
                          : "Arriving today"}
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ) : (
                  <span>
                    <DoorOpen size={17} />
                    {room.status === "cleaning"
                      ? "Preparing for the next story"
                      : room.status === "maintenance"
                        ? "A little attention needed"
                        : "Awaiting a wonderful stay"}
                  </span>
                )}
              </div>
              {room.status !== "occupied" && (
                <div className="room-card-actions">
                  {room.status === "cleaning" ||
                  room.status === "maintenance" ? (
                    <button
                      className="ready-button"
                      onClick={() =>
                        act(
                          (s) => updateRoomStatus(s, room.id, "available"),
                          `Room ${room.number} is guest-ready.`,
                        )
                      }
                    >
                      <CheckCheck size={16} />
                      Mark ready
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        act(
                          (s) => updateRoomStatus(s, room.id, "cleaning"),
                          `Room ${room.number} sent to housekeeping.`,
                        )
                      }
                    >
                      <SprayCan size={15} />
                      Needs cleaning
                    </button>
                  )}
                  {room.status !== "maintenance" && (
                    <button
                      aria-label={`Set room ${room.number} to maintenance`}
                      title="Set to maintenance"
                      onClick={() =>
                        act(
                          (s) => updateRoomStatus(s, room.id, "maintenance"),
                          `Room ${room.number} marked for maintenance.`,
                        )
                      }
                    >
                      <Wrench size={15} />
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!rooms.length && <Empty title="No rooms match your search" />}
    </>
  );
}

function GuestsPage({ state, onOpen }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const matchingStays = state.reservations.filter(
    (r) =>
      `${r.guest.name} ${r.guest.email} ${r.guest.country}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" || r.status === filter),
  );
  const priority = {
    "checked-in": 0,
    confirmed: 1,
    "checked-out": 2,
    cancelled: 3,
  };
  const guestsByEmail = new Map();
  matchingStays
    .sort(
      (a, b) =>
        priority[a.status] - priority[b.status] ||
        b.checkIn.localeCompare(a.checkIn),
    )
    .forEach((r) => {
      const key = (r.guest.email || r.guest.name).toLowerCase();
      if (!guestsByEmail.has(key)) guestsByEmail.set(key, r);
    });
  const guests = [...guestsByEmail.values()];
  return (
    <>
      <div className="section-toolbar">
        <h2>
          Your guestbook <span>{guests.length} guests</span>
        </h2>
        <div>
          <div className="table-search">
            <Search size={16} />
            <input
              aria-label="Search guestbook"
              placeholder="Find a familiar face..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter guests"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All guests</option>
            <option value="checked-in">In house</option>
            <option value="confirmed">Upcoming</option>
            <option value="checked-out">Past guests</option>
          </select>
        </div>
      </div>
      <div className="guest-grid">
        {guests.map((r) => (
          <button className="guest-card" key={r.id} onClick={() => onOpen(r)}>
            <div className="guest-card-heading">
              <Avatar guest={r.guest} />
              <Badge status={r.status} />
            </div>
            <h3>{r.guest.name}</h3>
            <p>
              <Mail size={14} />
              {r.guest.email}
            </p>
            <p>
              <Globe size={14} />
              {r.guest.country || "International guest"}
            </p>
            <div>
              <span>
                Room {r.roomId} · {dateLabel(r.checkIn)} –{" "}
                {dateLabel(r.checkOut)}
              </span>
              <ArrowUpRight size={16} />
            </div>
          </button>
        ))}
      </div>
      {!guests.length && <Empty title="No guests found" />}
    </>
  );
}

function RevenueBreakdown({ state, metrics }) {
  const mix = [
    { type: "room", name: "Room accommodation", color: "#315943" },
    { type: "food", name: "Restaurant & bar", color: "#9bac83" },
    { type: "spa", name: "Spa & wellness", color: "#c6b37d" },
    { type: "other", name: "Other services", color: "#e2d5b6" },
  ].map((item) => ({
    ...item,
    amount: state.ledger
      .filter((e) => e.date === state.date && e.type === item.type)
      .reduce((sum, e) => sum + e.amount, 0),
  }));
  return (
    <section className="card breakdown-card">
      <div className="card-heading">
        <div>
          <h2>Revenue by experience</h2>
          <p>Every part of an extraordinary stay.</p>
        </div>
      </div>
      <div className="breakdown-feature">
        <span>TOTAL HOTEL REVENUE · TODAY</span>
        <strong>{money(metrics.totalRevenue)}</strong>
        <small>Rooms, dining, wellness, and more</small>
        <div className="revenue-mix-bar">
          {mix.map((item) => (
            <i
              key={item.type}
              style={{
                width: `${metrics.totalRevenue ? (item.amount / metrics.totalRevenue) * 100 : 0}%`,
                background: item.color,
              }}
            />
          ))}
        </div>
      </div>
      {mix.map((item) => (
        <div className="breakdown-line" key={item.type}>
          <span>
            <i style={{ background: item.color }} />
            {item.name}
          </span>
          <strong>
            {money(item.amount)}
            <small>
              {metrics.totalRevenue
                ? ((item.amount / metrics.totalRevenue) * 100).toFixed(1)
                : 0}
              %
            </small>
          </strong>
        </div>
      ))}
      <div className="info-note">
        <ShieldCheck size={19} />
        <span>
          Sample daily service revenue is simulated. Reports are in USD and
          exclude taxes.
        </span>
      </div>
    </section>
  );
}

function RevenueHistory({ state }) {
  const series = getRevenueSeries(state, "week");
  return (
    <section className="card history-card">
      <div className="card-heading">
        <div>
          <h2>Daily performance</h2>
          <p>Consistent care. Measurable results.</p>
        </div>
        <span className="today-tag">Last 7 days</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>DATE</th>
              <th>OCCUPANCY</th>
              <th>ROOM REVENUE</th>
              <th>PREVIOUS PERIOD</th>
              <th className="align-right">CHANGE</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((d) => (
              <tr key={d.date}>
                <td>
                  <strong>
                    {dateLabel(d.date, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </strong>
                  {d.date === state.date && (
                    <span className="inline-today">Today</span>
                  )}
                </td>
                <td>{Number(d.occupancy).toFixed(1)}%</td>
                <td>{money(d.revenue)}</td>
                <td>{money(d.previousRevenue)}</td>
                <td
                  className={`align-right ${d.revenue >= d.previousRevenue ? "positive" : "negative"}`}
                >
                  {d.previousRevenue
                    ? `${(((d.revenue - d.previousRevenue) / d.previousRevenue) * 100).toFixed(1)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsPage({ state, act, onReset }) {
  return (
    <div className="settings-grid">
      <section className="card settings-card">
        <div className="card-heading">
          <div>
            <h2>Your property</h2>
            <p>Independent hospitality, beautifully managed.</p>
          </div>
          <Building2 size={20} />
        </div>
        <dl>
          <div>
            <dt>Property name</dt>
            <dd>The Aurelia Hotel & Residences</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>Florence, Italy</dd>
          </div>
          <div>
            <dt>Room collection</dt>
            <dd>48 rooms · 4 floors</dd>
          </div>
          <div>
            <dt>Reporting currency</dt>
            <dd>US Dollar (USD)</dd>
          </div>
          <div>
            <dt>General manager</dt>
            <dd>Olivia Bennett</dd>
          </div>
        </dl>
      </section>
      <section className="card settings-card">
        <div className="card-heading">
          <div>
            <h2>Your simulation</h2>
            <p>A safe space to explore hotel operations.</p>
          </div>
          <CalendarClock size={21} />
        </div>
        <div className="simulation-date">
          <CalendarDays size={26} />
          <div>
            <span>Current hotel date</span>
            <strong>
              {dateLabel(state.date, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </strong>
          </div>
        </div>
        <p className="settings-copy">
          Advance to the next day to simulate a new operating date. Check out
          any guests due to leave first. Rooms awaiting cleaning keep their
          status.
        </p>
        <button
          className="button primary"
          onClick={() =>
            act(
              (s) => advanceDay(s),
              "A new hotel day has begun. Your revenue and arrivals are updated.",
            )
          }
        >
          <ArrowRight size={16} />
          Advance one day
        </button>
        <div className="settings-divider" />
        <h3>A fresh start</h3>
        <p className="settings-copy">
          Restore the original sample guests, reservations, and room inventory.
          This replaces your local changes.
        </p>
        <button className="button secondary" onClick={onReset}>
          <RotateCcw size={15} />
          Reset sample hotel
        </button>
      </section>
      <div className="local-save-note">
        <ShieldCheck size={19} />
        <p>
          <strong>Your hotel, saved right here.</strong> This local prototype
          stores its data in your browser. No guest information is sent to a
          server. Sample guest profiles are fictional.
        </p>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll(
          'button, input, select, textarea, [tabindex="0"]',
        );
        if (!items?.length) return;
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (
          !e.shiftKey &&
          document.activeElement === items[items.length - 1]
        ) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    setTimeout(() => ref.current?.querySelector("input, button")?.focus(), 0);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-heading">
          <div className="eyebrow">
            <span />
            THE AURELIA
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={21} />
          </button>
          <h2 id="modal-title">{title}</h2>
        </div>
        {children}
      </section>
    </div>
  );
}

function ReservationForm({ state, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    guestName: "",
    email: "",
    country: "",
    roomId: "",
    checkIn: state.date,
    checkOut: addDays(state.date, 2),
    guests: 2,
    source: "Direct",
    notes: "",
  });
  const [error, setError] = useState("");
  const set = (name, value) => {
    setForm((f) => ({
      ...f,
      [name]: value,
      ...(name === "checkIn" || name === "checkOut" ? { roomId: "" } : {}),
    }));
    setError("");
  };
  const options = state.rooms
    .filter(
      (r) =>
        (form.checkIn > state.date ||
          !["maintenance", "cleaning"].includes(r.status)) &&
        !state.reservations.some(
          (booking) =>
            booking.roomId === r.id &&
            ["confirmed", "checked-in"].includes(booking.status) &&
            form.checkIn < booking.checkOut &&
            form.checkOut > booking.checkIn,
        ),
    )
    .sort(
      (a, b) =>
        Number(a.status === "occupied") - Number(b.status === "occupied"),
    );
  const room = state.rooms.find((r) => r.id === form.roomId);
  const count = nights(form.checkIn, form.checkOut);
  return (
    <form
      className="reservation-form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onSubmit({ ...form, guests: Number(form.guests) });
        } catch (error) {
          setError(error.message);
        }
      }}
    >
      <p className="modal-copy">
        The first step to an unforgettable experience.
      </p>
      <div className="form-grid">
        <label className="span-two">
          Guest name
          <input
            required
            name="guestName"
            autoComplete="name"
            placeholder="e.g. Charlotte Wilson"
            value={form.guestName}
            onChange={(e) => set("guestName", e.target.value)}
            maxLength={90}
          />
        </label>
        <label>
          Email address
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            placeholder="guest@example.com"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </label>
        <label>
          Country
          <input
            name="country"
            autoComplete="country-name"
            placeholder="e.g. United Kingdom"
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
          />
        </label>
        <label>
          Check-in date
          <input
            required
            type="date"
            name="checkIn"
            min={state.date}
            value={form.checkIn}
            onChange={(e) => set("checkIn", e.target.value)}
          />
        </label>
        <label>
          Check-out date
          <input
            required
            type="date"
            name="checkOut"
            min={addDays(form.checkIn || state.date, 1)}
            value={form.checkOut}
            onChange={(e) => set("checkOut", e.target.value)}
          />
        </label>
        <label className="span-two">
          Choose a room
          <select
            required
            name="roomId"
            value={form.roomId}
            onChange={(e) => set("roomId", e.target.value)}
          >
            <option value="">
              {options.length
                ? `${options.length} rooms available for these dates`
                : "No rooms available for these dates"}
            </option>
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.number} · {r.type} · {money(r.rate)} / night
                {form.checkIn === state.date && r.status === "occupied"
                  ? " · Awaiting checkout"
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Guests
          <select
            name="guests"
            value={form.guests}
            onChange={(e) => set("guests", e.target.value)}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Booking source
          <select
            name="source"
            value={form.source}
            onChange={(e) => set("source", e.target.value)}
          >
            {[
              "Direct",
              "Booking.com",
              "Expedia",
              "Travel agent",
              "Corporate",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="span-two">
          A personal touch <span className="optional">(optional)</span>
          <textarea
            name="notes"
            placeholder="Special requests, arrival details, or a little something extra…"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows="2"
            maxLength={500}
          />
        </label>
      </div>
      {room?.status === "occupied" && form.checkIn === state.date && (
        <div className="turnover-note">
          <Clock3 size={15} />
          This room needs check-out and housekeeping before your guest can check
          in.
        </div>
      )}
      {room && count > 0 && (
        <div className="booking-total">
          <span>
            {count} {count === 1 ? "night" : "nights"} × {money(room.rate)}
            <small>Room only · Taxes excluded</small>
          </span>
          <strong>{money(room.rate * count)}</strong>
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" type="submit">
          <Check size={16} />
          Confirm reservation
        </button>
      </div>
    </form>
  );
}

function ReservationDetails({ reservation: r, state, act }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const room = state.rooms.find((room) => room.id === r.roomId);
  return (
    <div className="reservation-details">
      <div className="reservation-guest">
        <Avatar guest={r.guest} />
        <div>
          <h3>{r.guest.name}</h3>
          <p>
            {r.id} · {r.source}
          </p>
        </div>
        <Badge status={r.status} />
      </div>
      <div className="details-contact">
        <span>
          <Mail size={15} />
          {r.guest.email}
        </span>
        <span>
          <Globe size={15} />
          {r.guest.country || "International guest"}
        </span>
      </div>
      <div className="stay-summary">
        <div>
          <span>CHECK-IN</span>
          <strong>
            {dateLabel(r.checkIn, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </strong>
          <small>From 3:00 PM</small>
        </div>
        <ArrowRight size={20} />
        <div>
          <span>CHECK-OUT</span>
          <strong>
            {dateLabel(r.checkOut, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </strong>
          <small>By 11:00 AM</small>
        </div>
      </div>
      <dl className="details-list">
        <div>
          <dt>Room</dt>
          <dd>
            {r.roomId} · {room?.type}
          </dd>
        </div>
        <div>
          <dt>Guests & duration</dt>
          <dd>
            {r.guests} {r.guests === 1 ? "guest" : "guests"} ·{" "}
            {nights(r.checkIn, r.checkOut)} nights
          </dd>
        </div>
        <div>
          <dt>Nightly rate</dt>
          <dd>{money(r.rate)}</dd>
        </div>
        <div>
          <dt>Stay total</dt>
          <dd>{money(r.total)}</dd>
        </div>
      </dl>
      {r.notes && (
        <div className="guest-note">
          <Sparkles size={17} />
          <p>{r.notes}</p>
        </div>
      )}
      <div className="details-actions">
        {r.status === "confirmed" && (
          <button
            className="cancel-stay-button"
            onClick={() => setConfirmCancel(true)}
          >
            Cancel reservation
          </button>
        )}
        {r.status === "confirmed" &&
          r.checkIn <= state.date &&
          r.checkOut > state.date && (
            <button
              className="button primary"
              onClick={() =>
                act(
                  (s) => checkIn(s, r.id),
                  `${r.guest.name} is checked in. Welcome to The Aurelia.`,
                )
              }
            >
              <LogIn size={16} />
              Check in guest
            </button>
          )}
        {r.status === "checked-in" && (
          <button
            className="button primary"
            onClick={() =>
              act(
                (s) => checkOut(s, r.id),
                `${r.guest.name} has checked out. Room ${r.roomId} is ready for cleaning.`,
              )
            }
          >
            <LogOut size={16} />
            Check out guest
          </button>
        )}
        {r.status === "confirmed" && r.checkIn > state.date && (
          <p>
            <Clock3 size={16} />
            Check-in opens on {dateLabel(r.checkIn)}.
          </p>
        )}
        {r.status === "checked-out" && (
          <p>
            <CheckCircle2 size={17} />
            Stay completed. Until next time.
          </p>
        )}
        {r.status === "cancelled" && (
          <p>
            <CheckCircle2 size={17} />
            This reservation has been cancelled.
          </p>
        )}
      </div>
      {confirmCancel && r.status === "confirmed" && (
        <div className="cancel-confirm">
          <h3>Release this reservation?</h3>
          <p>
            {r.guest.name}’s stay will be cancelled and the room released for
            these dates. This action cannot be undone.
          </p>
          <div>
            <button
              className="button secondary"
              onClick={() => setConfirmCancel(false)}
            >
              Keep reservation
            </button>
            <button
              className="button danger"
              onClick={() => {
                if (
                  act(
                    (s) => cancelReservation(s, r.id),
                    `Reservation ${r.id} has been cancelled.`,
                  )
                )
                  setConfirmCancel(false);
              }}
            >
              Confirm cancellation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
