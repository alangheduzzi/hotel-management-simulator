import React, { useState } from "react";
import {
  Check,
  Heart,
  MessageSquare,
  Plus,
  ShieldCheck,
  Star,
  UsersRound,
  X,
} from "lucide-react";
import {
  createServiceRequest,
  getReputationMetrics,
  RESOLUTION_OPTIONS,
  resolveServiceRequest,
  SERVICE_DEPARTMENTS,
} from "./reputation.js";
import "./reputation.css";

const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
const labelDate = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
const blankRequest = () => ({
  guestName: "",
  email: "",
  roomId: "",
  department: "Front Office",
  kind: "complaint",
  priority: "standard",
  title: "",
  description: "",
});

function ScoreCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="rep-score card">
      <div className="rep-score-top">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Stars({ rating }) {
  return (
    <span className="rep-stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={13}
          fill={index < rating ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export default function ReputationPage({ state, act }) {
  const metrics = getReputationMetrics(state);
  const [requestForm, setRequestForm] = useState(false);
  const [draft, setDraft] = useState(blankRequest);
  const [filter, setFilter] = useState("open");
  const [department, setDepartment] = useState("all");
  const [reviewRating, setReviewRating] = useState("all");
  const [resolveId, setResolveId] = useState(null);
  const [resolution, setResolution] = useState("service");
  const [notes, setNotes] = useState("");
  const [historyId, setHistoryId] = useState(null);
  const requests = (state.reputation?.requests || []).filter(
    (request) =>
      (filter === "all" || request.status === filter) &&
      (department === "all" || request.department === department),
  );
  const reviews = (state.reputation?.reviews || []).filter(
    (review) =>
      reviewRating === "all" || review.rating === Number(reviewRating),
  );
  const updateDraft = (field, value) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const submitRequest = (event) => {
    event.preventDefault();
    if (
      act(
        (current) => createServiceRequest(current, draft),
        "Guest request recorded. The responsible department has been notified.",
      )
    ) {
      setDraft(blankRequest());
      setRequestForm(false);
      setFilter("open");
    }
  };
  const submitResolution = (event, id) => {
    event.preventDefault();
    if (
      act(
        (current) => resolveServiceRequest(current, id, { resolution, notes }),
        `Request resolved. ${RESOLUTION_OPTIONS[resolution].cost ? `${money(RESOLUTION_OPTIONS[resolution].cost)} recorded in operating expenses.` : "No additional expense recorded."}`,
      )
    ) {
      setResolveId(null);
      setNotes("");
    }
  };
  const factors = metrics.serviceFactors;
  return (
    <div className="reputation-page">
      <div className="rep-intro">
        <div>
          <span className="rep-eyebrow">THE ART OF HOSPITALITY</span>
          <h2>Guest experience & reputation</h2>
          <p>
            Every impression matters. Follow service quality, resolve concerns
            and welcome guests back.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => setRequestForm((open) => !open)}
        >
          {requestForm ? <X size={15} /> : <Plus size={15} />}
          {requestForm ? "Close form" : "Log guest request"}
        </button>
      </div>

      <div className="rep-score-grid">
        <ScoreCard
          icon={Heart}
          label="Guest satisfaction"
          value={`${metrics.guestSatisfaction.toFixed(1)}`}
          detail="out of 100 · live operational score"
        />
        <ScoreCard
          icon={ShieldCheck}
          label="Hotel reputation"
          value={`${metrics.reputation.toFixed(1)}`}
          detail={`${metrics.averageRating.toFixed(2)} / 5 · ${metrics.reviewCount} recent reviews`}
        />
        <ScoreCard
          icon={MessageSquare}
          label="Open complaints"
          value={metrics.openComplaints}
          detail={`${metrics.openRequests} total requests · ${metrics.resolvedRequests} resolved`}
        />
        <ScoreCard
          icon={UsersRound}
          label="Returning guests"
          value={metrics.returningGuests}
          detail={`${metrics.loyalGuests} Aurelia Circle & Gold members`}
        />
      </div>

      {requestForm && (
        <section className="card rep-request-form">
          <h2>New guest request</h2>
          <p>
            Complaints affect the responsible department’s score until they are
            resolved.
          </p>
          <form onSubmit={submitRequest}>
            <div className="form-grid">
              <label>
                Guest name
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={draft.guestName}
                  onChange={(event) =>
                    updateDraft("guestName", event.target.value)
                  }
                  placeholder="e.g. Eleanor Hayes"
                />
              </label>
              <label>
                Guest email (optional)
                <input
                  type="email"
                  maxLength={160}
                  value={draft.email}
                  onChange={(event) => updateDraft("email", event.target.value)}
                  placeholder="guest@example.com"
                />
              </label>
              <label>
                Department
                <select
                  value={draft.department}
                  onChange={(event) =>
                    updateDraft("department", event.target.value)
                  }
                >
                  {SERVICE_DEPARTMENTS.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Guest room
                <select
                  value={draft.roomId}
                  onChange={(event) =>
                    updateDraft("roomId", event.target.value)
                  }
                >
                  <option value="">No room / public area</option>
                  {state.rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      Room {room.number}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Request type
                <select
                  value={draft.kind}
                  onChange={(event) => updateDraft("kind", event.target.value)}
                >
                  <option value="complaint">Complaint</option>
                  <option value="request">Service request</option>
                </select>
              </label>
              <label>
                Priority
                <select
                  value={draft.priority}
                  onChange={(event) =>
                    updateDraft("priority", event.target.value)
                  }
                >
                  <option value="standard">Standard</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="span-two">
                Subject
                <input
                  required
                  minLength={3}
                  maxLength={100}
                  value={draft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  placeholder="How can we improve this guest’s stay?"
                />
              </label>
              <label className="span-two">
                Details
                <textarea
                  required
                  minLength={5}
                  maxLength={1500}
                  rows={3}
                  value={draft.description}
                  onChange={(event) =>
                    updateDraft("description", event.target.value)
                  }
                  placeholder="Record the concern and the guest’s preferred outcome."
                />
              </label>
            </div>
            <div className="rep-form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setRequestForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="button primary">
                Create request
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="rep-service-grid">
        <section className="card rep-departments">
          <div className="card-heading">
            <div>
              <h2>Service by department</h2>
              <p>
                Coverage, performance, room condition and outstanding concerns
              </p>
            </div>
          </div>
          <div className="rep-department-list">
            {metrics.departmentRatings.map((team) => (
              <div className="rep-department" key={team.department}>
                <div className="rep-department-title">
                  <strong>{team.department}</strong>
                  <span>
                    {team.score.toFixed(1)}
                    <small> / 100</small>
                  </span>
                </div>
                <div className="rep-progress">
                  <span style={{ width: `${team.score}%` }} />
                </div>
                <p>
                  {Math.round(team.coverage * 100)}% staffing coverage ·{" "}
                  {team.performance.toFixed(0)} staff performance
                  {team.openComplaints
                    ? ` · ${team.openComplaints} complaint${team.openComplaints > 1 ? "s" : ""}`
                    : ""}
                  {team.roomPenalty > 0
                    ? ` · room condition −${team.roomPenalty.toFixed(1)}`
                    : ""}
                  {team.equipmentPenalty > 0
                    ? ` · equipment −${team.equipmentPenalty}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="card rep-factors">
          <div className="card-heading">
            <div>
              <h2>What shapes the experience</h2>
              <p>Understand the effect of your management decisions</p>
            </div>
          </div>
          <div className="rep-factor-content">
            <div>
              <strong>{Math.round(factors.coverage * 100)}%</strong>
              <span>Overall staffing coverage</span>
              <p>
                Enough scheduled staff and effective training improve the
                service score. Shortages reduce it.
              </p>
            </div>
            <div>
              <strong>{factors.dirtyRooms + factors.maintenanceRooms}</strong>
              <span>Rooms awaiting attention</span>
              <p>
                {factors.dirtyRooms} awaiting cleaning ·{" "}
                {factors.maintenanceRooms} under maintenance. Resolve issues to
                restore service quality.
              </p>
            </div>
            <div>
              <strong>{factors.overdueComplaints}</strong>
              <span>Complaints older than 2 days</span>
              <p>
                Unresolved complaints lower department scores and, after two
                days, hotel reputation.
              </p>
            </div>
            <div className="rep-factor-note">
              <Heart size={16} />
              <p>
                Service recovery adds up to 6 goodwill points, fading by 30%
                each simulation day. The underlying service problem still needs
                attention.
              </p>
            </div>
            <p className="rep-calculation">
              Satisfaction = 80% live service + 20% recent review score +
              recovery goodwill. Reputation = 60% reviews + 40% satisfaction,
              less overdue concerns. All values are simulated.
            </p>
          </div>
        </section>
      </div>

      <section className="card rep-requests">
        <div className="card-heading">
          <div>
            <h2>Guest relations desk</h2>
            <p>
              Track each concern from first contact to a recorded resolution
            </p>
          </div>
          <span className="rep-count">
            {requests.length} {requests.length === 1 ? "request" : "requests"}
          </span>
        </div>
        <div className="rep-filter-row">
          <div className="rep-filter-group" aria-label="Request status">
            {["open", "resolved", "all"].map((status) => (
              <button
                key={status}
                className={filter === status ? "active" : ""}
                onClick={() => setFilter(status)}
              >
                {status === "all"
                  ? "All requests"
                  : status[0].toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter requests by department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="all">All departments</option>
            {SERVICE_DEPARTMENTS.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="rep-request-list">
          {requests.length === 0 && (
            <div className="rep-empty">
              <Check size={24} />
              <h3>No requests in this view</h3>
              <p>Use the filters to see other guest conversations.</p>
            </div>
          )}
          {requests.map((request) => (
            <article className="rep-request" key={request.id}>
              <div className="rep-request-heading">
                <div>
                  <div className="rep-request-meta">
                    <span className={`rep-status ${request.status}`}>
                      {request.status === "resolved"
                        ? "Resolved"
                        : request.priority === "urgent"
                          ? "Urgent"
                          : request.kind === "complaint"
                            ? "Complaint"
                            : "Service request"}
                    </span>
                    <span>{request.department}</span>
                    <span>{labelDate(request.createdDate)}</span>
                  </div>
                  <h3>{request.title}</h3>
                  <p className="rep-guest-name">
                    {request.guestName}
                    {request.roomId ? ` · Room ${request.roomId}` : ""}
                  </p>
                </div>
                {request.status === "open" && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setResolveId(
                        resolveId === request.id ? null : request.id,
                      );
                      setResolution("service");
                      setNotes("");
                    }}
                  >
                    <Check size={14} />
                    Resolve
                  </button>
                )}
              </div>
              <p className="rep-request-description">{request.description}</p>
              {request.status === "resolved" && (
                <div className="rep-resolution-summary">
                  <Check size={14} />
                  <span>
                    {labelDate(request.resolvedDate)} ·{" "}
                    {request.resolutionNotes} ·{" "}
                    {request.resolutionCost
                      ? `${money(request.resolutionCost)} expense`
                      : "No additional expense"}
                  </span>
                </div>
              )}
              {resolveId === request.id && (
                <form
                  className="rep-resolve-form"
                  onSubmit={(event) => submitResolution(event, request.id)}
                >
                  <div className="form-grid">
                    <label>
                      Resolution method
                      <select
                        value={resolution}
                        onChange={(event) => setResolution(event.target.value)}
                      >
                        {Object.entries(RESOLUTION_OPTIONS).map(
                          ([key, option]) => (
                            <option key={key} value={key}>
                              {option.label} · {money(option.cost)}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      Resolution notes
                      <input
                        maxLength={1000}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="What did the team do for the guest?"
                      />
                    </label>
                  </div>
                  <p>
                    {resolution === "recovery"
                      ? "A $60 simulated courtesy credit is charged once to this department’s guest recovery expenses."
                      : resolution === "repair"
                        ? "A $120 simulated call-out is charged once to maintenance expenses. A linked vacant maintenance room returns to service unless an active equipment breakdown still requires repair in General Manager."
                        : "A personal service follow-up has no additional charge. A linked vacant room awaiting housekeeping returns to service unless an active equipment breakdown still requires repair in General Manager."}
                  </p>
                  <div className="rep-form-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setResolveId(null)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="button primary">
                      Confirm resolution
                    </button>
                  </div>
                </form>
              )}
              <button
                className="rep-history-toggle"
                onClick={() =>
                  setHistoryId(historyId === request.id ? null : request.id)
                }
              >
                {historyId === request.id
                  ? "Hide history"
                  : "View request history"}
              </button>
              {historyId === request.id && (
                <ol className="rep-request-history">
                  {(request.history || []).map((entry, index) => (
                    <li key={index}>
                      <span>{labelDate(entry.date)}</span>
                      {entry.action}
                      {entry.cost ? ` · ${money(entry.cost)}` : ""}
                      {entry.notes && <small>{entry.notes}</small>}
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="rep-bottom-grid">
        <section className="card rep-reviews">
          <div className="card-heading">
            <div>
              <h2>Guest voices</h2>
              <p>Fictional surveys generated from hotel operations</p>
            </div>
            <select
              aria-label="Filter reviews by rating"
              value={reviewRating}
              onChange={(event) => setReviewRating(event.target.value)}
            >
              <option value="all">All ratings</option>
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} stars
                </option>
              ))}
            </select>
          </div>
          <div className="rep-reviews-list">
            {reviews.length === 0 && (
              <div className="rep-empty">
                <p>No reviews match this rating.</p>
              </div>
            )}
            {reviews.slice(0, 12).map((review) => (
              <article className="rep-review" key={review.id}>
                <div>
                  <strong>{review.guestName}</strong>
                  <Stars rating={review.rating} />
                </div>
                <p>“{review.text}”</p>
                <small>
                  {labelDate(review.date)} · {review.source || "Guest survey"} ·{" "}
                  {review.department}
                </small>
              </article>
            ))}
          </div>
        </section>
        <section className="card rep-loyalty">
          <div className="card-heading">
            <div>
              <h2>The Aurelia Circle</h2>
              <p>Returning guests, remembered preferences</p>
            </div>
            <Heart size={19} />
          </div>
          <p className="rep-loyalty-note">
            Circle membership begins at 3 stays; Gold at 6. Counts combine
            completed or current stays with fictional demo stay history.
          </p>
          <div className="rep-loyalty-list">
            {metrics.loyaltyMembers
              .filter((member) => member.totalStays >= 2)
              .slice(0, 12)
              .map((member) => (
                <div
                  className="rep-loyalty-member"
                  key={member.email || member.guestName}
                >
                  <span
                    className={`rep-loyalty-avatar ${member.tier === "Aurelia Gold" ? "gold" : ""}`}
                  >
                    {member.guestName
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <strong>{member.guestName}</strong>
                    <small>{member.tier}</small>
                  </div>
                  <span>
                    {member.totalStays}
                    <small>stays</small>
                  </span>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
