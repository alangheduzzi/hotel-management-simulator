import React, { useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Megaphone,
  TrendingUp,
  Wrench,
  Sparkles,
} from "lucide-react";
import { money } from "./business.js";
import {
  advanceSimulation,
  getMarketContext,
  getOperatingHistory,
  launchCampaign,
  MARKETING_CHANNELS,
  pauseCampaign,
  resolveEvent,
  updatePricing,
} from "./simulation.js";
import "./simulation.css";

const dateLabel = (value) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export default function SimulationPage({ state, act }) {
  const [advanceDays, setAdvanceDays] = useState(null);
  const [advancing, setAdvancing] = useState(false);
  const [roomType, setRoomType] = useState("Classic King");
  const [rate, setRate] = useState(
    state.simulation.pricing.baseRates["Classic King"],
  );
  const [multiplier, setMultiplier] = useState(
    Math.round(state.simulation.pricing.multiplier * 100),
  );
  const [campaign, setCampaign] = useState({
    name: "Aurelia seasonal invitation",
    channel: MARKETING_CHANNELS[0],
    dailyBudget: 150,
    duration: 7,
  });
  const market = getMarketContext(state);
  const simulation = state.simulation;
  const openEvents = simulation.events.filter(
    (event) => event.status === "open",
  );
  const report = simulation.lastReport;
  const setCampaignField = (field, value) =>
    setCampaign((current) => ({ ...current, [field]: value }));
  const confirmAdvance = () => {
    setAdvancing(true);
    // Let Chrome paint progress before settling a month of operations offline.
    window.setTimeout(() => {
      try {
        if (
          act(
            (current) => advanceSimulation(current, advanceDays),
            `The hotel advanced ${advanceDays} ${advanceDays === 1 ? "day" : "days"}. All departments updated.`,
          )
        )
          setAdvanceDays(null);
      } finally {
        setAdvancing(false);
      }
    }, 40);
  };
  return (
    <div className="sim-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE GENERAL MANAGER’S OFFICE</span>
          <h1>Management simulation</h1>
          <p>
            Thoughtful decisions. Measurable results. All hotel information and
            financial data are fictional.
          </p>
        </div>
      </div>
      <section className="sim-control card">
        <div className="sim-control-copy">
          <div className="sim-kicker">
            <CalendarClock size={15} /> THE HOTEL CLOCK
          </div>
          <h2>{dateLabel(state.date)}</h2>
          <p>Choose the pace of your next chapter at The Aurelia.</p>
        </div>
        <div className="sim-advance-buttons">
          {[
            [1, "One day"],
            [7, "One week"],
            [30, "30 days"],
          ].map(([days, label]) => (
            <button
              key={days}
              className="button primary"
              disabled={advancing}
              onClick={() => setAdvanceDays(days)}
            >
              <span>{label}</span>
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
      </section>
      {advanceDays && (
        <section className="sim-confirm" role="alert" aria-busy={advancing}>
          <div>
            <strong>
              {advancing
                ? "Settling all hotel departments…"
                : `Advance ${advanceDays} ${advanceDays === 1 ? "day" : "days"}?`}
            </strong>
            <p>
              Automatic operations settle departing guests, clean rooms within
              staff capacity, welcome booked arrivals and simulated guests,
              consume restaurant stock, charge payroll and expenses, and update
              service scores. Unresolved repairs stay open.
            </p>
            <p>
              Export your progress in Settings to keep a checkpoint. One month
              means 30 consecutive operating days.
            </p>
          </div>
          <div>
            <button
              className="button secondary"
              disabled={advancing}
              onClick={() => setAdvanceDays(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={advancing}
              onClick={confirmAdvance}
            >
              {advancing ? "Advancing…" : "Confirm advance"}
            </button>
          </div>
        </section>
      )}
      <div className="sim-metrics">
        <div className="metric-card">
          <span className="metric-heading">Seasonal demand</span>
          <strong>{market.season}</strong>
          <small>
            {Math.round(market.seasonMultiplier * 100)}% of shoulder-season
            demand{market.weekend ? " · weekend uplift" : ""}
          </small>
        </div>
        <div className="metric-card">
          <span className="metric-heading">Estimated demand</span>
          <strong>{market.targetOccupancy.toFixed(1)}%</strong>
          <small>Target occupancy before room and staffing limits</small>
        </div>
        <div className="metric-card">
          <span className="metric-heading">Market comparison</span>
          <strong>{money(market.competitorRate)}</strong>
          <small>
            Competitor average · Aurelia {money(market.averageRate)}
          </small>
        </div>
        <div className="metric-card">
          <span className="metric-heading">Open repairs</span>
          <strong>{openEvents.length}</strong>
          <small>
            {money(openEvents.reduce((sum, event) => sum + event.cost, 0))} to
            restore affected operations
          </small>
        </div>
      </div>
      {report && (
        <section className="sim-report card">
          <div className="sim-report-title">
            <CheckCircle2 size={23} />
            <div>
              <h2>
                Last simulation advance · {report.days}{" "}
                {report.days === 1 ? "day" : "days"}
              </h2>
              <p>
                {dateLabel(report.startDate)} → {dateLabel(report.endDate)} ·
                Results when the clock advanced
              </p>
            </div>
          </div>
          <div>
            <span>
              Arrivals<strong>{report.arrivals}</strong>
            </span>
            <span>
              Departures<strong>{report.departures}</strong>
            </span>
            <span>
              Rooms cleaned<strong>{report.cleaned}</strong>
            </span>
            <span>
              Revenue<strong>{money(report.revenue)}</strong>
            </span>
            <span>
              Operating profit
              <strong
                className={report.operatingProfit < 0 ? "sim-negative" : ""}
              >
                {money(report.operatingProfit)}
              </strong>
            </span>
          </div>
        </section>
      )}
      <div className="sim-grid">
        <section className="card sim-panel">
          <div className="sim-panel-heading">
            <TrendingUp size={18} />
            <div>
              <h2>Room pricing & positioning</h2>
              <p>Protect booked rates. Shape future demand.</p>
            </div>
          </div>
          <label className="sim-toggle">
            <input
              type="checkbox"
              checked={simulation.pricing.dynamic}
              onChange={(event) =>
                act(
                  (current) =>
                    updatePricing(current, { dynamic: event.target.checked }),
                  "Dynamic pricing updated. Existing reservations retain their rates.",
                )
              }
            />
            <span>
              <strong>Seasonal dynamic pricing</strong>
              <small>
                Apply seasonal and weekend factors to published rates each day.
              </small>
            </span>
          </label>
          <form
            className="sim-form"
            onSubmit={(event) => {
              event.preventDefault();
              act(
                (current) => updatePricing(current, { type: roomType, rate }),
                "Base room rate updated for new reservations.",
              );
            }}
          >
            <div className="sim-fields">
              <label>
                Room category
                <select
                  value={roomType}
                  onChange={(event) => {
                    setRoomType(event.target.value);
                    setRate(simulation.pricing.baseRates[event.target.value]);
                  }}
                >
                  {Object.keys(simulation.pricing.baseRates).map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Base nightly rate ($)
                <input
                  aria-label="Base nightly rate"
                  type="number"
                  min="100"
                  max="3000"
                  step="0.01"
                  value={rate}
                  required
                  onChange={(event) => setRate(event.target.value)}
                />
              </label>
            </div>
            <button className="button secondary" type="submit">
              Update base rate
            </button>
          </form>
          <form
            className="sim-form"
            onSubmit={(event) => {
              event.preventDefault();
              act(
                (current) =>
                  updatePricing(current, {
                    multiplier: Number(multiplier) / 100,
                  }),
                "Hotel-wide price adjustment applied to new bookings.",
              );
            }}
          >
            <label>
              Hotel-wide adjustment · {multiplier}%
              <input
                aria-label="Hotel-wide price adjustment"
                type="range"
                min="60"
                max="200"
                step="5"
                value={multiplier}
                onChange={(event) => setMultiplier(event.target.value)}
              />
            </label>
            <div className="sim-range-labels">
              <span>Value · 60%</span>
              <span>Premium · 200%</span>
            </div>
            <button className="button secondary" type="submit">
              Apply price adjustment
            </button>
          </form>
          <div className="sim-explainer">
            <Sparkles size={17} />
            <p>
              Higher prices increase the rate per new booking and reduce
              estimated demand relative to competitors. Service quality,
              reputation, season and marketing also affect bookings. Existing
              bookings retain their original nightly rates.
            </p>
          </div>
          <div className="sim-published">
            {Object.entries(simulation.pricing.baseRates).map(([type]) => (
              <span key={type}>
                {type}
                <strong>
                  {money(state.rooms.find((room) => room.type === type)?.rate)}
                </strong>
              </span>
            ))}
          </div>
        </section>
        <section className="card sim-panel">
          <div className="sim-panel-heading">
            <Megaphone size={18} />
            <div>
              <h2>Demand & marketing</h2>
              <p>Invest with a clear daily commitment.</p>
            </div>
          </div>
          <div className="sim-competitors">
            <span className="sim-kicker">
              FICTIONAL COMPETITOR RATES · TODAY
            </span>
            {market.competitors.map((hotel) => (
              <div key={hotel.name}>
                <span>
                  <strong>{hotel.name}</strong>
                  <small>{hotel.positioning}</small>
                </span>
                <b>{money(hotel.rate)}</b>
              </div>
            ))}
          </div>
          <form
            className="sim-form"
            onSubmit={(event) => {
              event.preventDefault();
              act(
                (current) => launchCampaign(current, campaign),
                "Campaign launched. Its first operating day has been charged.",
              );
            }}
          >
            <label>
              Campaign name
              <input
                value={campaign.name}
                maxLength="80"
                required
                onChange={(event) =>
                  setCampaignField("name", event.target.value)
                }
              />
            </label>
            <label>
              Channel
              <select
                value={campaign.channel}
                onChange={(event) =>
                  setCampaignField("channel", event.target.value)
                }
              >
                {MARKETING_CHANNELS.map((channel) => (
                  <option key={channel}>{channel}</option>
                ))}
              </select>
            </label>
            <div className="sim-fields">
              <label>
                Daily budget ($)
                <input
                  type="number"
                  min="25"
                  max="2000"
                  step="0.01"
                  value={campaign.dailyBudget}
                  required
                  onChange={(event) =>
                    setCampaignField("dailyBudget", event.target.value)
                  }
                />
              </label>
              <label>
                Duration (days)
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={campaign.duration}
                  required
                  onChange={(event) =>
                    setCampaignField("duration", event.target.value)
                  }
                />
              </label>
            </div>
            <p className="sim-form-note">
              Planned spend{" "}
              {money(Number(campaign.dailyBudget) * Number(campaign.duration))}.
              First day charged now, then once per active day; insufficient cash
              pauses a campaign. Estimated demand lift{" "}
              {Math.round(
                Math.min(0.2, 0.04 + Number(campaign.dailyBudget) / 3000) *
                  (campaign.channel === "Restaurant discovery" ? 0.6 : 1) *
                  100,
              )}
              %, before capacity limits.
            </p>
            <button className="button primary" type="submit">
              <Megaphone size={14} />
              Launch campaign
            </button>
          </form>
        </section>
      </div>
      {!!simulation.campaigns.length && (
        <section className="card sim-panel">
          <div className="sim-panel-heading">
            <h2>Campaign portfolio</h2>
            <p>Combined demand lift is capped at 45%.</p>
          </div>
          <div className="table-scroll">
            <table className="sim-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Dates</th>
                  <th>Daily / recognized spend</th>
                  <th>Demand lift</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {simulation.campaigns.map((item) => {
                  const spent = -state.ledger
                    .filter((entry) => entry.campaignId === item.id)
                    .reduce((sum, entry) => sum + entry.amount, 0);
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.channel}</small>
                      </td>
                      <td>
                        {dateLabel(item.startDate)}
                        <small>through {dateLabel(item.endDate)}</small>
                      </td>
                      <td>
                        {money(item.dailyBudget)} / {money(spent)}
                      </td>
                      <td>+{Math.round(item.lift * 100)}%</td>
                      <td>
                        <span className={`sim-status ${item.status}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {item.status === "active" ? (
                          <button
                            className="button secondary"
                            onClick={() =>
                              act(
                                (current) => pauseCampaign(current, item.id),
                                "Campaign paused. Future campaign spend stopped.",
                              )
                            }
                          >
                            Pause
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="card sim-panel">
        <div className="sim-panel-heading">
          <Wrench size={18} />
          <div>
            <h2>Operations & unexpected events</h2>
            <p>
              Events follow a repeatable simulated calendar. Repairs charge
              once, when you approve them.
            </p>
          </div>
        </div>
        {simulation.events.length ? (
          <div className="sim-events">
            {simulation.events.slice(0, 30).map((event) => (
              <article key={event.id} className={`sim-event ${event.status}`}>
                <div className="sim-event-symbol">
                  {event.kind === "equipment" ? (
                    <Wrench size={18} />
                  ) : (
                    <CalendarClock size={18} />
                  )}
                </div>
                <div>
                  <div className="sim-event-top">
                    <h3>{event.title}</h3>
                    <span className={`sim-status ${event.status}`}>
                      {event.status}
                    </span>
                  </div>
                  <p>{event.detail}</p>
                  <small>
                    {dateLabel(event.date)} · {event.department}
                    {event.resolvedAt
                      ? ` · repaired ${dateLabel(event.resolvedAt)}`
                      : ""}
                  </small>
                </div>
                {event.kind === "equipment" && event.status === "open" && (
                  <button
                    className="button primary"
                    onClick={() =>
                      act(
                        (current) => resolveEvent(current, event.id),
                        "Repair completed and charged once. A repaired room now needs housekeeping.",
                      )
                    }
                  >
                    Repair · {money(event.cost)}
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="sim-empty">
            <CheckCircle2 size={27} />
            <h3>A composed start to the day</h3>
            <p>
              Advance the simulation to encounter seasonal demand, guest-service
              requests, staff absences and equipment repairs.
            </p>
          </div>
        )}
      </section>
      {!!simulation.history.length && (
        <section className="card sim-panel">
          <div className="sim-panel-heading">
            <h2>Operating history</h2>
            <p>
              The last 14 operating days · today updates live · full financial
              history in Finance.
            </p>
          </div>
          <div className="table-scroll">
            <table className="sim-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Occupancy</th>
                  <th>ADR</th>
                  <th>Revenue</th>
                  <th>Operating profit</th>
                  <th>Guests</th>
                  <th>Team</th>
                  <th>Cash balance</th>
                </tr>
              </thead>
              <tbody>
                {getOperatingHistory(state)
                  .slice(-14)
                  .reverse()
                  .map((day) => (
                    <tr key={day.date}>
                      <td>
                        {dateLabel(day.date)}
                        {day.date === state.date && (
                          <small>Live operating day</small>
                        )}
                      </td>
                      <td>{day.occupancy.toFixed(1)}%</td>
                      <td>{money(day.adr)}</td>
                      <td>{money(day.revenue)}</td>
                      <td
                        className={
                          day.operatingProfit < 0 ? "sim-negative" : ""
                        }
                      >
                        {money(day.operatingProfit)}
                      </td>
                      <td>{Number(day.guestSatisfaction).toFixed(0)} / 100</td>
                      <td>
                        {Number(day.employeeSatisfaction).toFixed(0)} / 100
                      </td>
                      <td>{money(day.cashBalance)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
