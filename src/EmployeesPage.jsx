import React, { useEffect, useRef, useState } from "react";
import {
  UserPlus,
  UsersRound,
  GraduationCap,
  Search,
  CalendarDays,
  Banknote,
  Heart,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  STAFF_DEPARTMENTS,
  SHIFT_OPTIONS,
  TRAINING_COURSES,
  getStaffMetrics,
  hireEmployee,
  dismissEmployee,
  scheduleShift,
  trainEmployee,
} from "./staff.js";
import "./employees.css";

const money = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
const displayDate = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
function Score({ value, label }) {
  return (
    <span
      className={`employee-score ${value < 65 ? "low" : ""}`}
      aria-label={`${label} ${Math.round(value)} out of 100`}
    >
      <strong>
        {Math.round(value)}
        <small>/100</small>
      </strong>
      <span>
        <i style={{ width: `${value}%` }} />
      </span>
    </span>
  );
}

export default function EmployeesPage({ state, act }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("active");
  const [shiftDate, setShiftDate] = useState(state.date);
  const [courseId, setCourseId] = useState("service");
  const [showHire, setShowHire] = useState(false);
  const [dismissId, setDismissId] = useState(null);
  const dismissDialogRef = useRef(null);
  const dismissTriggerRef = useRef(null);
  const keepEmployeeRef = useRef(null);
  const employeeSearchRef = useRef(null);
  const [page, setPage] = useState(0);
  const [form, setForm] = useState({
    name: "",
    jobTitle: "",
    department: "Front Office",
    salary: "2800",
  });
  const metrics = getStaffMetrics(state);
  const course = TRAINING_COURSES.find((item) => item.id === courseId);
  const dismissedEmployee = state.employees.find(
    (employee) => employee.id === dismissId,
  );
  const filtered = state.employees.filter(
    (employee) =>
      (status === "all" || employee.status === status) &&
      (department === "all" || employee.department === department) &&
      `${employee.name} ${employee.jobTitle} ${employee.department}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages - 1);
  const shown = filtered.slice(currentPage * 10, currentPage * 10 + 10);
  useEffect(() => setPage(0), [query, department, status]);
  useEffect(() => setShiftDate(state.date), [state.date]);
  useEffect(() => {
    if (!dismissId) return;
    const previousFocus = dismissTriggerRef.current || document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableItems = () =>
      Array.from(
        dismissDialogRef.current?.querySelectorAll(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((item) => item.getClientRects().length > 0);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setDismissId(null);
      } else if (event.key === "Tab") {
        const items = focusableItems();
        const first = items[0];
        const last = items.at(-1);
        const active = document.activeElement;
        if (!first) {
          event.preventDefault();
          dismissDialogRef.current?.focus();
        } else if (
          !dismissDialogRef.current?.contains(active) ||
          (event.shiftKey && active === first) ||
          (!event.shiftKey && active === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    const containFocus = (event) => {
      if (!dismissDialogRef.current?.contains(event.target))
        keepEmployeeRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", containFocus);
    keepEmployeeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", containFocus);
      if (previousFocus?.isConnected && !previousFocus.disabled)
        previousFocus.focus({ preventScroll: true });
      else employeeSearchRef.current?.focus({ preventScroll: true });
      dismissTriggerRef.current = null;
    };
  }, [dismissId]);
  const submitHire = (event) => {
    event.preventDefault();
    if (
      act(
        (current) => hireEmployee(current, form),
        `${form.name} has joined the team. Service and payroll begin tomorrow.`,
      )
    ) {
      setShowHire(false);
      setForm({
        name: "",
        jobTitle: "",
        department: "Front Office",
        salary: "2800",
      });
    }
  };
  return (
    <div className="mgmt-page employees-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> PEOPLE & CULTURE
          </div>
          <h1>Our people, our distinction.</h1>
          <p>
            A considered approach to exceptional service. Manage your team,
            daily coverage, and development.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => setShowHire(!showHire)}
        >
          <UserPlus size={15} />
          {showHire ? "Close hiring form" : "Hire employee"}
        </button>
      </div>
      <div className="mgmt-stats employee-stats">
        <div className="mgmt-stat">
          <UsersRound size={18} />
          <span>Active employees</span>
          <strong>{metrics.headcount}</strong>
          <small>Across seven departments</small>
        </div>
        <div className="mgmt-stat">
          <Banknote size={18} />
          <span>Monthly payroll</span>
          <strong>{money(metrics.monthlyPayroll)}</strong>
          <small>{money(metrics.dailyPayroll)} current daily salary run</small>
        </div>
        <div className="mgmt-stat">
          <Heart size={18} />
          <span>Employee satisfaction</span>
          <strong>
            {Math.round(metrics.satisfaction)}
            <em>/100</em>
          </strong>
          <small>Morale influences service quality</small>
        </div>
        <div className="mgmt-stat">
          <GraduationCap size={18} />
          <span>Service performance</span>
          <strong>
            {Math.round(metrics.performance)}
            <em>/100</em>
          </strong>
          <small>Training improves guest experiences</small>
        </div>
        <div className="mgmt-stat">
          <CalendarDays size={18} />
          <span>Today’s coverage</span>
          <strong>
            {Math.round(metrics.coverage * 100)}
            <em>%</em>
          </strong>
          <small>
            {metrics.scheduled} scheduled · {metrics.required} required
          </small>
        </div>
      </div>

      {showHire && (
        <section className="card employee-hire-card">
          <div className="card-heading">
            <div>
              <h2>Welcome a new colleague</h2>
              <p>
                Monthly salaries are simulated in USD. New hires start service
                and payroll tomorrow.
              </p>
            </div>
            <UserPlus size={19} />
          </div>
          <form className="mgmt-form employee-hire-form" onSubmit={submitHire}>
            <label>
              Full name
              <input
                required
                minLength={2}
                maxLength={80}
                placeholder="e.g. Alessia Mercer"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </label>
            <label>
              Job title
              <input
                required
                minLength={2}
                maxLength={80}
                placeholder="e.g. Guest Relations Agent"
                value={form.jobTitle}
                onChange={(event) =>
                  setForm({ ...form, jobTitle: event.target.value })
                }
              />
            </label>
            <label>
              Department
              <select
                value={form.department}
                onChange={(event) =>
                  setForm({ ...form, department: event.target.value })
                }
              >
                {STAFF_DEPARTMENTS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Monthly salary · USD
              <input
                type="number"
                min="1000"
                max="50000"
                step="0.01"
                required
                value={form.salary}
                onChange={(event) =>
                  setForm({ ...form, salary: event.target.value })
                }
              />
            </label>
            <div className="employee-hire-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setShowHire(false)}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                <UserPlus size={14} />
                Confirm hire
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="employee-overview-grid">
        <section className="card employee-coverage-card">
          <div className="card-heading">
            <div>
              <h2>Department coverage</h2>
              <p>
                Scheduled colleagues against daily service requirements ·{" "}
                {displayDate(state.date)}
              </p>
            </div>
            <span className="employee-tag">LIVE ROSTER</span>
          </div>
          <div className="employee-department-list">
            {metrics.departments.map((item) => (
              <div className="employee-department" key={item.department}>
                <div>
                  <button
                    onClick={() =>
                      setDepartment(
                        department === item.department
                          ? "all"
                          : item.department,
                      )
                    }
                    className={department === item.department ? "selected" : ""}
                  >
                    {item.department}
                  </button>
                  <small>
                    {item.headcount} employees · {money(item.dailyPayroll)} /
                    day
                  </small>
                </div>
                <div className="employee-coverage">
                  <span>
                    {item.scheduled}
                    <small> / {item.required} needed</small>
                  </span>
                  <div>
                    <i
                      style={{
                        width: `${item.coverage * 100}%`,
                        background:
                          item.coverage < 0.75 ? "#b48656" : undefined,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="card employee-culture-card">
          <div className="card-heading">
            <div>
              <h2>Service begins with people</h2>
              <p>Decisions with visible consequences</p>
            </div>
            <GraduationCap size={21} />
          </div>
          <div className="employee-culture-body">
            <div>
              <span className="employee-note-number">01</span>
              <p>
                <strong>Balance the daily roster.</strong> Unfilled shifts
                reduce departmental coverage, service quality, and guest
                satisfaction. Persistent shortages lower morale.
              </p>
            </div>
            <div>
              <span className="employee-note-number">02</span>
              <p>
                <strong>Invest in development.</strong> Every completed course
                increases performance and satisfaction, with its cost recorded
                in your financial statement.
              </p>
            </div>
            <div>
              <span className="employee-note-number">03</span>
              <p>
                <strong>Manage a sustainable team.</strong> Salaried employees
                accrue pay on working and rest days. Dismissals stop future pay
                and reduce team morale by 2 points.
              </p>
            </div>
            <p className="employee-accounting-note">
              Payroll uses each month’s actual day count. Already recognized
              payroll is retained when staffing changes. The restaurant and bar
              use this same team roster.
            </p>
          </div>
        </section>
      </div>

      <section className="card employee-roster-card">
        <div className="card-heading">
          <div>
            <h2>The Aurelia team</h2>
            <p>
              Meet your colleagues. Plan their shifts, recognize their
              contribution, and nurture their potential.
            </p>
          </div>
          <span className="employee-tag">
            {state.employees.length} PEOPLE ON RECORD
          </span>
        </div>
        <div className="mgmt-toolbar employee-roster-toolbar">
          <label className="employee-search">
            <Search size={15} />
            <input
              ref={employeeSearchRef}
              aria-label="Search employees"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, role, department…"
            />
          </label>
          <select
            aria-label="Employee department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="all">All departments</option>
            {STAFF_DEPARTMENTS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Employment status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="active">Active employees</option>
            <option value="dismissed">Dismissed employees</option>
            <option value="all">All employees</option>
          </select>
        </div>
        <div className="employee-roster-options">
          <label>
            <CalendarDays size={14} />
            <span>Shift date</span>
            <input
              aria-label="Roster shift date"
              type="date"
              min={state.date}
              value={shiftDate}
              onChange={(event) =>
                setShiftDate(event.target.value || state.date)
              }
            />
          </label>
          <label>
            <GraduationCap size={15} />
            <span>Training course</span>
            <select
              aria-label="Training course"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              {TRAINING_COURSES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {money(item.cost)}
                </option>
              ))}
            </select>
          </label>
          <small>
            Course benefit: +{course.performance} performance · +
            {course.satisfaction} satisfaction, capped at 100
          </small>
        </div>
        <div className="employee-table-scroll">
          <table className="mgmt-table employee-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Salary / month</th>
                <th>Satisfaction</th>
                <th>Performance</th>
                <th>Shift · {displayDate(shiftDate)}</th>
                <th>Development</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((employee) => {
                const shift = state.shifts.find(
                  (item) =>
                    item.employeeId === employee.id && item.date === shiftDate,
                );
                const hasTrained = employee.training.some(
                  (item) =>
                    item.course === courseId && item.date === state.date,
                );
                return (
                  <tr
                    key={employee.id}
                    className={
                      employee.status === "dismissed"
                        ? "employee-dismissed-row"
                        : ""
                    }
                  >
                    <td>
                      <div className="employee-identity">
                        <span className="employee-avatar">
                          {initials(employee.name)}
                        </span>
                        <div>
                          <strong>{employee.name}</strong>
                          <small>{employee.jobTitle}</small>
                          {employee.status === "dismissed" && (
                            <em>
                              Dismissed {displayDate(employee.dismissedAt)}
                            </em>
                          )}
                          {employee.payrollStartsAt > state.date && (
                            <em>Starts tomorrow</em>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{employee.department}</td>
                    <td>
                      <strong>{money(employee.salary)}</strong>
                      <small className="employee-pay-detail">
                        Salaried · USD
                      </small>
                    </td>
                    <td>
                      <Score
                        value={employee.satisfaction}
                        label="Satisfaction"
                      />
                    </td>
                    <td>
                      <Score value={employee.performance} label="Performance" />
                    </td>
                    <td>
                      <select
                        aria-label={`Shift for ${employee.name}`}
                        disabled={employee.status !== "active"}
                        value={shift?.shift || ""}
                        onChange={(event) =>
                          act(
                            (current) =>
                              scheduleShift(current, {
                                employeeId: employee.id,
                                date: shiftDate,
                                shift: event.target.value,
                              }),
                            `${employee.name}’s ${displayDate(shiftDate)} shift has been updated.`,
                          )
                        }
                      >
                        <option value="" disabled>
                          Automatic roster
                        </option>
                        {SHIFT_OPTIONS.map((item) => (
                          <option
                            key={item}
                            disabled={
                              employee.payrollStartsAt > shiftDate &&
                              item !== "Off"
                            }
                          >
                            {item}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className="employee-train-button"
                        disabled={employee.status !== "active" || hasTrained}
                        onClick={() =>
                          act(
                            (current) =>
                              trainEmployee(current, employee.id, courseId),
                            `${employee.name} completed ${course.name.toLowerCase()}. ${money(course.cost)} training expense recorded.`,
                          )
                        }
                      >
                        <GraduationCap size={13} />
                        {hasTrained
                          ? "Completed today"
                          : `Train · ${money(course.cost)}`}
                      </button>
                      <small className="employee-pay-detail">
                        {employee.training.length} courses completed
                      </small>
                    </td>
                    <td>
                      <button
                        className="employee-dismiss-button"
                        disabled={employee.status !== "active"}
                        onClick={(event) => {
                          dismissTriggerRef.current = event.currentTarget;
                          setDismissId(employee.id);
                        }}
                      >
                        Dismiss
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && (
            <div className="employee-empty">
              <UsersRound size={25} />
              <h3>No employees match your filters</h3>
              <p>Try another name, department, or employment status.</p>
            </div>
          )}
        </div>
        <div className="employee-table-footer">
          <span>
            {filtered.length
              ? `Showing ${currentPage * 10 + 1}–${Math.min((currentPage + 1) * 10, filtered.length)} of ${filtered.length}`
              : "0 employees"}
          </span>
          <div>
            <button
              aria-label="Previous employee page"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            <span>
              {currentPage + 1} / {pages}
            </span>
            <button
              aria-label="Next employee page"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {dismissedEmployee && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              event.preventDefault();
              setDismissId(null);
            }
          }}
        >
          <div
            ref={dismissDialogRef}
            className="modal employee-dismiss-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dismiss-title"
            tabIndex={-1}
          >
            <div className="modal-heading">
              <div className="eyebrow">
                <span /> PEOPLE & CULTURE
              </div>
              <h2 id="dismiss-title">Dismiss {dismissedEmployee.name}?</h2>
              <button
                className="icon-button"
                aria-label="Cancel dismissal"
                onClick={() => setDismissId(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="employee-dismiss-copy">
              <p>
                This removes an active{" "}
                {dismissedEmployee.jobTitle.toLowerCase()} from{" "}
                {dismissedEmployee.department} and stops future salary accruals
                of {money(dismissedEmployee.salary)} per month.
              </p>
              <p>
                Today’s recognized pay remains. Departmental colleagues lose 2
                satisfaction points; lower coverage can affect guest service. No
                severance is charged in this fictional demo.
              </p>
            </div>
            <div className="modal-actions">
              <button
                ref={keepEmployeeRef}
                className="button secondary"
                onClick={() => setDismissId(null)}
              >
                Keep employee
              </button>
              <button
                className="button employee-confirm-dismiss"
                onClick={() => {
                  if (
                    act(
                      (current) => dismissEmployee(current, dismissId),
                      `${dismissedEmployee.name} has been dismissed. Historical payroll is unchanged.`,
                    )
                  )
                    setDismissId(null);
                }}
              >
                Confirm dismissal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
