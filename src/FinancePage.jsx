import React, { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  TrendingUp,
  Landmark,
  PieChart,
  UsersRound,
  HeartHandshake,
  BedDouble,
} from "lucide-react";
import { getMetrics } from "./hotel.js";
import {
  getFinancials,
  getFinancialSeries,
  setDepartmentBudget,
} from "./management.js";
import { getStaffMetrics } from "./staff.js";
import { getReputationMetrics } from "./reputation.js";
import { money, addDays, DEPARTMENTS } from "./business.js";

export function Stat({ label, value, note, change, icon: Icon }) {
  return (
    <article className="mgmt-stat">
      <div>
        <span>{label}</span>
        {Icon && <Icon size={17} />}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
      {Number.isFinite(change) && (
        <span className={`mgmt-change ${change < 0 ? "loss" : ""}`}>
          {change >= 0 ? (
            <ArrowUpRight size={12} />
          ) : (
            <ArrowDownRight size={12} />
          )}{" "}
          {change > 0 ? "+" : ""}
          {change.toFixed(1)}% vs previous day
        </span>
      )}
    </article>
  );
}

export function BusinessChart({ state }) {
  const [days, setDays] = useState(7);
  const [chosen, setChosen] = useState(null);
  const data = getFinancialSeries(state, days);
  const max =
    Math.max(...data.flatMap((d) => [d.revenue, d.expenses]), 1) * 1.15;
  const selected = data[chosen ?? data.length - 1];
  return (
    <section className="card business-chart">
      <div className="card-heading">
        <div>
          <h2>Revenue, costs & decisions</h2>
          <p>One ledger across the whole hotel. Select a day for detail.</p>
        </div>
        <div className="segmented">
          <button
            className={days === 7 ? "active" : ""}
            onClick={() => {
              setDays(7);
              setChosen(null);
            }}
          >
            7 days
          </button>
          <button
            className={days === 30 ? "active" : ""}
            onClick={() => {
              setDays(30);
              setChosen(null);
            }}
          >
            30 days
          </button>
        </div>
      </div>
      <div className="business-chart-legend">
        <span>
          <i />
          Revenue
        </span>
        <span>
          <i />
          Operating expenses
        </span>
        <strong>
          {selected.label}: {money(selected.profit)} profit ·{" "}
          {money(selected.previousProfit)} previous period
        </strong>
      </div>
      <div
        className="business-bars"
        role="group"
        aria-label="Daily revenue and expense comparison"
      >
        {data.map((d, i) => (
          <button
            key={d.date}
            className={selected.date === d.date ? "selected" : ""}
            onClick={() => setChosen(i)}
            aria-label={`${d.date}: revenue ${money(d.revenue)}, expenses ${money(d.expenses)}, profit ${money(d.profit)}`}
            title={`${d.label}: revenue ${money(d.revenue)} · expenses ${money(d.expenses)}`}
          >
            <span className="bars-pair">
              <i style={{ height: `${(d.revenue / max) * 100}%` }} />
              <i style={{ height: `${(d.expenses / max) * 100}%` }} />
            </span>
            <small>
              {days === 7 || i % 5 === 0 || i === data.length - 1
                ? d.label
                : ""}
            </small>
          </button>
        ))}
      </div>
      <div className="mgmt-info">
        Revenue recognizes sales once. Stock purchases affect cash; food
        consumption affects profit. Historical pre-upgrade expenses are modeled
        comparisons.
      </div>
    </section>
  );
}

export function ExecutiveDashboard({ state, onNavigate }) {
  const h = getMetrics(state),
    f = getFinancials(state),
    previous = getFinancials(state, "day", addDays(state.date, -1)),
    staff = getStaffMetrics(state),
    rep = getReputationMetrics(state);
  const change = previous.revenue
    ? (f.revenue / previous.revenue - 1) * 100
    : undefined;
  return (
    <div className="mgmt-page">
      <div className="mgmt-stats executive-stats">
        <Stat
          label="Occupancy"
          value={`${h.occupancy.toFixed(1)}%`}
          note={`${h.occupiedRooms} of 48 rooms`}
          icon={BedDouble}
        />
        <Stat
          label="Average daily rate"
          value={money(h.adr)}
          note="Per room sold"
        />
        <Stat
          label="RevPAR"
          value={money(h.revpar)}
          note="Per available room"
        />
        <Stat
          label="Total hotel revenue"
          value={money(f.revenue)}
          note="All departments · today"
          change={change}
          icon={TrendingUp}
        />
        <Stat
          label="Operating profit"
          value={money(f.profit)}
          note="After all recognized costs"
          icon={Landmark}
        />
        <Stat
          label="Profit margin"
          value={`${f.margin.toFixed(1)}%`}
          note="Operating profit / revenue"
          icon={PieChart}
        />
        <Stat
          label="Employee satisfaction"
          value={`${Math.round(staff.satisfaction)}/100`}
          note={`${staff.headcount} active colleagues`}
          icon={UsersRound}
        />
        <Stat
          label="Guest satisfaction"
          value={`${Math.round(rep.guestSatisfaction)}/100`}
          note="Staff, service & room condition"
          icon={HeartHandshake}
        />
        <Stat
          label="Restaurant operating profit"
          value={money(f.foodProfit)}
          note="F&B sales less food and both teams"
        />
        <Stat
          label="Cash balance"
          value={money(f.cashBalance)}
          note="Opening cash + actual movements"
          icon={Wallet}
        />
      </div>
      <BusinessChart state={state} />
      <div className="mgmt-grid">
        <section className="card mgmt-panel">
          <h2>The decisions that matter</h2>
          <p>Financial results and service quality move together.</p>
          <div className="executive-links">
            {[
              [
                "employees",
                "Staff coverage",
                `${Math.round(staff.coverage * 100)}% of required shifts covered`,
              ],
              [
                "reputation",
                "Guest experience",
                `${rep.openComplaints} open complaints · reputation ${Math.round(rep.reputation)}/100`,
              ],
              [
                "restaurant",
                "Restaurant & bar",
                `${money(f.foodRevenue)} sales · ${money(f.foodExpenses)} operating costs`,
              ],
              [
                "simulation",
                "General Manager mode",
                "Pricing, demand, campaigns, and operational events",
              ],
            ].map(([id, label, note]) => (
              <button key={id} onClick={() => onNavigate(id)}>
                <span>
                  <strong>{label}</strong>
                  <small>{note}</small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
        </section>
        <section className="card mgmt-panel">
          <h2>Department contribution</h2>
          <p>Shared overhead remains in its responsible department.</p>
          <table className="mgmt-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Revenue</th>
                <th>Costs</th>
              </tr>
            </thead>
            <tbody>
              {f.departments.map((d) => (
                <tr key={d.department}>
                  <td>{d.department}</td>
                  <td>{money(d.revenue)}</td>
                  <td>{money(d.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export default function FinancePage({ state, act }) {
  const [period, setPeriod] = useState("month");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [budget, setBudget] = useState("");
  const f = getFinancials(state, period),
    month = getFinancials(state, "month");
  return (
    <div className="mgmt-page">
      <div className="mgmt-toolbar">
        <div>
          <h2>Financial control</h2>
          <p>USD · recognized sales and costs, with separate cash movements</p>
        </div>
        <select
          aria-label="Financial reporting period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="day">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">Month to date</option>
        </select>
      </div>
      <div className="mgmt-stats">
        <Stat
          label="Recognized revenue"
          value={money(f.revenue)}
          note={`${f.start} – ${f.end}`}
        />
        <Stat
          label="Operating expenses"
          value={money(f.expenses)}
          note="Includes salaries and consumed stock"
        />
        <Stat
          label="Operating profit"
          value={money(f.profit)}
          note={`${f.margin.toFixed(1)}% margin`}
        />
        <Stat
          label="Available cash"
          value={money(f.cashBalance)}
          note={`Cash movements from ${state.finance.startDate}`}
        />
      </div>
      <div className="mgmt-grid">
        <section className="card mgmt-panel">
          <h2>{period === "month" ? "Monthly" : "Period"} profit & loss</h2>
          <table className="mgmt-table">
            <tbody>
              {[
                ["Room accommodation", f.roomRevenue],
                ["Restaurant, bar & room service", f.foodRevenue],
                ["Other services & wellness", f.otherRevenue],
                ["Total revenue", f.revenue],
              ].map(([label, v]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{money(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="mgmt-table">
            <tbody>
              {f.categories.map((c) => (
                <tr key={c.category}>
                  <td className="capitalize">
                    {c.category.replaceAll("-", " ")}
                  </td>
                  <td>({money(c.amount)})</td>
                </tr>
              ))}
              <tr className="mgmt-total">
                <td>Operating profit</td>
                <td>{money(f.profit)}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section className="card mgmt-panel">
          <h2>Cash-flow dashboard</h2>
          <p>Cash and profit are intentionally different.</p>
          <dl className="mgmt-definition">
            <div>
              <dt>Opening cash ({state.finance.startDate})</dt>
              <dd>{money(state.finance.openingCash)}</dd>
            </div>
            <div>
              <dt>Cash received in selected period</dt>
              <dd>{money(f.cashIn)}</dd>
            </div>
            <div>
              <dt>Cash spent in selected period</dt>
              <dd>{money(f.cashOut)}</dd>
            </div>
            <div>
              <dt>Current cash balance</dt>
              <dd>{money(f.cashBalance)}</dd>
            </div>
          </dl>
          <div className="mgmt-info">
            Restocking is an inventory asset purchase, not a second food
            expense. Orders recognize food cost when prepared; payments
            recognize sales. Salaries are accrued and settled daily. Tax, debt
            and capital depreciation are outside this operating model.
          </div>
        </section>
      </div>
      <BusinessChart state={state} />
      <section className="card mgmt-panel">
        <h2>Department budgets</h2>
        <p>
          Monthly planning limits flag overspend; allocating a budget does not
          spend cash.
        </p>
        <div className="mgmt-table-scroll">
          <table className="mgmt-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Monthly budget</th>
                <th>Month-to-date costs</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {month.departments.map((d) => (
                <tr key={d.department}>
                  <td>{d.department}</td>
                  <td>{money(d.budget)}</td>
                  <td>{money(d.expenses)}</td>
                  <td className={d.budget < d.expenses ? "mgmt-negative" : ""}>
                    {money(d.budget - d.expenses)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="mgmt-form compact"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              act(
                (s) => setDepartmentBudget(s, department, budget),
                "Department budget updated.",
              )
            )
              setBudget("");
          }}
        >
          <label>
            Department
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Monthly budget (USD)
            <input
              type="number"
              required
              min="0"
              max="1000000"
              step="1"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder={String(state.finance.budgets[department] || 0)}
            />
          </label>
          <button className="button primary">Allocate budget</button>
        </form>
      </section>
      <section className="card mgmt-panel">
        <h2>Recent ledger entries</h2>
        <p>
          Every recognized sale, cost, and inventory purchase has its own entry.
        </p>
        <div className="mgmt-table-scroll">
          <table className="mgmt-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th>P&L amount</th>
                <th>Cash change</th>
              </tr>
            </thead>
            <tbody>
              {[...f.entries]
                .reverse()
                .slice(0, 20)
                .map((e) => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.description || e.category}</td>
                    <td>{e.type}</td>
                    <td>{e.type === "cash" ? "—" : money(e.amount)}</td>
                    <td>{money(e.cashDelta ?? e.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
