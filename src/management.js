import { createInitialState } from "./hotel.js";
import { createRestaurantData } from "./restaurant.js";
import { createStaffData, getStaffMetrics, postDailyPayroll } from "./staff.js";
import { createReputationData } from "./reputation.js";
import { createSimulationData } from "./simulation.js";
import {
  DEPARTMENTS,
  REVENUE_TYPES,
  addDays,
  daysInMonth,
  roundMoney,
  postEntry,
  postFixedDailyExpenses,
  getCashBalance,
  validateDate,
  appendLog,
} from "./business.js";

export function createManagedDemo() {
  return upgradeState(createInitialState());
}

export function upgradeState(input) {
  const state = structuredClone(input);
  if (state.schemaVersion > 2)
    throw new Error("This save belongs to a newer version of The Aurelia.");
  if (state.schemaVersion === 2) return state;
  Object.assign(state, createStaffData(state.date));
  state.restaurant = createRestaurantData(state.date);
  state.finance = {
    openingCash: 250000,
    startDate: state.date,
    budgets: {
      "Front Office": 33000,
      Housekeeping: 38000,
      "Restaurant & Bar": 40000,
      Kitchen: 33000,
      Maintenance: 22000,
      "Spa & Wellness": 18000,
      Management: 30000,
    },
  };
  state.reputation = createReputationData(state);
  state.simulation = createSimulationData(state);
  state.schemaVersion = 2;
  // Legacy sales are retained. Their modeled costs are added once, never as sales.
  const payrollDepartments = getStaffMetrics(state).departments;
  const dates = [
    ...new Set(
      state.ledger
        .filter((e) => REVENUE_TYPES.includes(e.type))
        .map((e) => e.date),
    ),
  ];
  for (const date of dates) {
    if (date < state.date) {
      for (const d of payrollDepartments)
        postEntry(state, {
          id: `legacy-payroll-${date}-${d.department}`,
          date,
          type: "expense",
          category: "payroll",
          department: d.department,
          amount: -roundMoney(d.monthlyPayroll / daysInMonth(date)),
          description: "Modeled historical payroll (legacy comparison)",
          cashDelta: 0,
        });
      for (const [category, amount, department] of [
        ["utilities", 310, "Maintenance"],
        ["maintenance", 160, "Maintenance"],
        ["administration", 120, "Management"],
        ["marketing", 60, "Management"],
      ])
        postEntry(state, {
          id: `fixed-${date}-${category}`,
          date,
          type: "expense",
          category,
          department,
          amount: -amount,
          cashDelta: 0,
          description: "Modeled historical operating cost",
        });
    }
    const food = state.ledger
      .filter((e) => e.date === date && e.type === "food")
      .reduce((s, e) => s + e.amount, 0);
    if (food)
      postEntry(state, {
        id: `legacy-food-cogs-${date}`,
        date,
        type: "expense",
        category: "cogs",
        department: "Restaurant & Bar",
        amount: -roundMoney(food * 0.3),
        cashDelta: 0,
        description: "Food cost of legacy opening sales",
      });
  }
  return postFixedDailyExpenses(postDailyPayroll(state));
}

function departmentOf(entry) {
  return (
    entry.department ||
    {
      room: "Front Office",
      food: "Restaurant & Bar",
      bar: "Restaurant & Bar",
      "room-service": "Restaurant & Bar",
      spa: "Spa & Wellness",
      other: "Management",
    }[entry.type] ||
    "Management"
  );
}
export function getFinancials(state, period = "day", endDate = state.date) {
  const start =
    period === "month"
      ? `${endDate.slice(0, 7)}-01`
      : period === "week"
        ? addDays(endDate, -6)
        : endDate;
  const entries = state.ledger.filter(
    (e) => e.date >= start && e.date <= endDate,
  );
  const revenueEntries = entries.filter((e) => REVENUE_TYPES.includes(e.type));
  const expenseEntries = entries.filter((e) => e.type === "expense");
  const revenue = roundMoney(revenueEntries.reduce((s, e) => s + e.amount, 0));
  const expenses = roundMoney(
    -expenseEntries.reduce((s, e) => s + e.amount, 0),
  );
  const profit = roundMoney(revenue - expenses);
  const departments = DEPARTMENTS.map((department) => {
    const r = roundMoney(
      revenueEntries
        .filter((e) => departmentOf(e) === department)
        .reduce((s, e) => s + e.amount, 0),
    );
    const cost = roundMoney(
      -expenseEntries
        .filter((e) => departmentOf(e) === department)
        .reduce((s, e) => s + e.amount, 0),
    );
    return {
      department,
      revenue: r,
      expenses: cost,
      profit: roundMoney(r - cost),
      budget: state.finance.budgets[department] || 0,
    };
  });
  const categories = [...new Set(expenseEntries.map((e) => e.category))].map(
    (category) => ({
      category,
      amount: roundMoney(
        -expenseEntries
          .filter((e) => e.category === category)
          .reduce((s, e) => s + e.amount, 0),
      ),
    }),
  );
  const cashEntries = entries.filter((e) => e.date >= state.finance.startDate);
  const deltas = cashEntries.map((e) =>
    Number.isFinite(e.cashDelta)
      ? e.cashDelta
      : REVENUE_TYPES.includes(e.type) ||
          e.type === "expense" ||
          e.type === "cash"
        ? e.amount
        : 0,
  );
  const foodRevenue = roundMoney(
    revenueEntries
      .filter((e) => ["food", "bar", "room-service"].includes(e.type))
      .reduce((s, e) => s + e.amount, 0),
  );
  const foodExpenses = roundMoney(
    -expenseEntries
      .filter((e) => ["Restaurant & Bar", "Kitchen"].includes(departmentOf(e)))
      .reduce((s, e) => s + e.amount, 0),
  );
  return {
    start,
    end: endDate,
    revenue,
    expenses,
    profit,
    margin: revenue ? (profit / revenue) * 100 : 0,
    roomRevenue: roundMoney(
      revenueEntries
        .filter((e) => e.type === "room")
        .reduce((s, e) => s + e.amount, 0),
    ),
    foodRevenue,
    foodExpenses,
    foodProfit: roundMoney(foodRevenue - foodExpenses),
    otherRevenue: roundMoney(
      revenue -
        foodRevenue -
        revenueEntries
          .filter((e) => e.type === "room")
          .reduce((s, e) => s + e.amount, 0),
    ),
    cashBalance: getCashBalance(state),
    cashIn: roundMoney(deltas.filter((n) => n > 0).reduce((s, n) => s + n, 0)),
    cashOut: roundMoney(
      -deltas.filter((n) => n < 0).reduce((s, n) => s + n, 0),
    ),
    departments,
    categories,
    entries,
  };
}

export function getFinancialSeries(state, count = 7) {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(state.date, i - count + 1);
    const f = getFinancials(state, "day", date);
    const p = getFinancials(state, "day", addDays(date, -count));
    return {
      date,
      label: new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      revenue: f.revenue,
      expenses: f.expenses,
      profit: f.profit,
      previousProfit: p.profit,
      cashIn: f.cashIn,
      cashOut: f.cashOut,
    };
  });
}
export function setDepartmentBudget(state, department, amount) {
  amount = Number(amount);
  if (
    !DEPARTMENTS.includes(department) ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 1000000
  )
    throw new Error(
      "Choose a department and a monthly budget between $0 and $1,000,000.",
    );
  const next = structuredClone(state);
  next.finance.budgets[department] = roundMoney(amount);
  appendLog(
    next,
    "Budget updated",
    `${department} monthly plan: $${amount.toLocaleString()}`,
  );
  return next;
}

// Imported saves are data only. Reject corrupted structures before replacing progress.
export function validateSave(input) {
  const state = input?.format === "aurelia-save" ? input.state : input;
  if (
    !state ||
    typeof state !== "object" ||
    !Array.isArray(state.rooms) ||
    state.rooms.length !== 48 ||
    !Array.isArray(state.reservations) ||
    !Array.isArray(state.ledger)
  )
    throw new Error(
      "Choose a valid Aurelia simulation JSON file (48-room property).",
    );
  validateDate(state.date, "hotel date");
  if (
    new Set(state.rooms.map((r) => r.id)).size !== 48 ||
    state.rooms.some(
      (r) =>
        !r.id ||
        !Number.isFinite(r.rate) ||
        r.rate <= 0 ||
        ![
          "occupied",
          "available",
          "reserved",
          "cleaning",
          "maintenance",
        ].includes(r.status),
    )
  )
    throw new Error("The saved room inventory is invalid.");
  const ids = new Set(state.rooms.map((r) => r.id));
  if (
    state.reservations.some(
      (r) =>
        !r.id ||
        !r.guest?.name ||
        !ids.has(r.roomId) ||
        !Number.isFinite(r.rate) ||
        !Number.isFinite(r.total) ||
        !Number.isInteger(r.guests) ||
        !["confirmed", "checked-in", "checked-out", "cancelled"].includes(
          r.status,
        ),
    )
  )
    throw new Error("The saved reservations are invalid.");
  for (const r of state.reservations) {
    validateDate(r.checkIn, "arrival date");
    validateDate(r.checkOut, "departure date");
    if (r.checkOut <= r.checkIn)
      throw new Error("A saved stay has invalid dates.");
  }
  if (
    new Set(state.ledger.map((e) => e.id)).size !== state.ledger.length ||
    state.ledger.some(
      (e) =>
        !e.id ||
        !Number.isFinite(e.amount) ||
        (e.cashDelta !== undefined && !Number.isFinite(e.cashDelta)) ||
        (!REVENUE_TYPES.includes(e.type) &&
          !["expense", "cash"].includes(e.type)) ||
        (e.type === "expense" && e.amount > 0) ||
        (REVENUE_TYPES.includes(e.type) && e.amount < 0),
    )
  )
    throw new Error(
      "The financial ledger is invalid or has duplicate entries.",
    );
  for (const e of state.ledger) validateDate(e.date, "ledger date");
  const occupied = state.reservations.filter((r) => r.status === "checked-in");
  if (
    new Set(occupied.map((r) => r.roomId)).size !== occupied.length ||
    occupied.some(
      (r) =>
        state.rooms.find((room) => room.id === r.roomId).status !== "occupied",
    ) ||
    state.rooms.some(
      (room) =>
        room.status === "occupied" &&
        !occupied.some((r) => r.roomId === room.id),
    )
  )
    throw new Error("The save has conflicting occupied rooms.");
  if (state.schemaVersion === 2) {
    if (
      !Array.isArray(state.employees) ||
      !Array.isArray(state.shifts) ||
      !state.finance?.budgets ||
      !Number.isFinite(state.finance.openingCash) ||
      !state.restaurant ||
      !Array.isArray(state.restaurant.orders) ||
      !Array.isArray(state.restaurant.inventory) ||
      !Array.isArray(state.restaurant.menu) ||
      !state.reputation ||
      !state.simulation
    )
      throw new Error("The management data in this save is incomplete.");
    if (
      state.employees.some(
        (e) => !e.id || !e.name || !Number.isFinite(e.salary) || e.salary < 0,
      )
    )
      throw new Error("The employee data is invalid.");
    if (
      Object.values(state.finance.budgets).some(
        (n) => !Number.isFinite(n) || n < 0,
      )
    )
      throw new Error("The department budgets are invalid.");
    const unique = (list) =>
      new Set(list.map((item) => item.id)).size === list.length;
    const arrays = [
      state.employees,
      state.shifts,
      state.restaurant.inventory,
      state.restaurant.menu,
      state.restaurant.orders,
      state.restaurant.tables,
      state.restaurant.reservations,
      state.reputation.reviews,
      state.reputation.requests,
      state.reputation.loyalty,
      state.reputation.history,
      state.simulation.events,
      state.simulation.campaigns,
      state.simulation.history,
      state.simulation.settledDates,
    ];
    if (
      arrays.some((list) => !Array.isArray(list)) ||
      ![
        state.employees,
        state.shifts,
        state.restaurant.inventory,
        state.restaurant.menu,
        state.restaurant.orders,
        state.restaurant.tables,
        state.restaurant.reservations,
        state.reputation.reviews,
        state.reputation.requests,
        state.simulation.events,
        state.simulation.campaigns,
      ].every(unique)
    )
      throw new Error(
        "The save is missing management collections or contains duplicate IDs.",
      );
    const score = (n) => Number.isFinite(n) && n >= 0 && n <= 100;
    if (
      state.employees.some(
        (e) =>
          !DEPARTMENTS.includes(e.department) ||
          !["active", "dismissed"].includes(e.status) ||
          !score(e.satisfaction) ||
          !score(e.performance) ||
          typeof e.jobTitle !== "string" ||
          e.salary < 1000 ||
          e.salary > 50000,
      )
    )
      throw new Error(
        "The employee roster has invalid salaries or service scores.",
      );
    const employees = new Set(state.employees.map((e) => e.id));
    if (
      state.shifts.some(
        (shift) =>
          !employees.has(shift.employeeId) ||
          !["Morning", "Evening", "Night", "Off"].includes(shift.shift),
      )
    )
      throw new Error("The shift schedule is invalid.");
    if (
      new Set(state.shifts.map((s) => `${s.date}-${s.employeeId}`)).size !==
      state.shifts.length
    )
      throw new Error(
        "An employee is assigned to multiple shifts on the same day.",
      );
    for (const shift of state.shifts) validateDate(shift.date, "shift date");
    validateDate(state.finance.startDate, "cash-flow starting date");
    if (
      DEPARTMENTS.some(
        (d) =>
          !Number.isFinite(state.finance.budgets[d]) ||
          state.finance.budgets[d] < 0,
      )
    )
      throw new Error("A departmental budget is missing or invalid.");
    if (
      state.restaurant.inventory.some(
        (i) =>
          !i.id ||
          !i.name ||
          !Number.isFinite(i.quantity) ||
          i.quantity < 0 ||
          !Number.isFinite(i.unitCost) ||
          i.unitCost <= 0 ||
          !Number.isFinite(i.reorderAt),
      )
    )
      throw new Error("The inventory quantities or costs are invalid.");
    const stock = new Set(state.restaurant.inventory.map((i) => i.id));
    if (
      state.restaurant.menu.some(
        (m) =>
          !m.id ||
          !m.name ||
          !Number.isFinite(m.price) ||
          m.price <= 0 ||
          !Array.isArray(m.channels) ||
          !m.channels.length ||
          m.channels.some(
            (c) => !["restaurant", "bar", "room-service"].includes(c),
          ) ||
          !m.recipe ||
          Object.entries(m.recipe).some(
            ([id, usage]) =>
              !stock.has(id) || !Number.isFinite(usage) || usage <= 0,
          ),
      )
    )
      throw new Error("The restaurant menu is invalid.");
    if (
      !Number.isInteger(state.restaurant.sequence) ||
      !Array.isArray(state.restaurant.simulatedDates) ||
      state.restaurant.tables.some(
        (t) =>
          !t.id ||
          !Number.isInteger(t.seats) ||
          t.seats < 1 ||
          !["restaurant", "bar"].includes(t.channel),
      )
    )
      throw new Error("The restaurant floor plan is invalid.");
    if (
      state.restaurant.tables
        .filter((t) => t.channel === "restaurant")
        .reduce((sum, t) => sum + t.seats, 0) !== 60 ||
      state.restaurant.tables
        .filter((t) => t.channel === "bar")
        .reduce((sum, t) => sum + t.seats, 0) !== 30
    )
      throw new Error(
        "The restaurant and lounge must retain their 60/30-seat capacity.",
      );
    if (
      state.restaurant.orders.some(
        (o) =>
          !o.id ||
          !Array.isArray(o.items) ||
          !Number.isFinite(o.total) ||
          o.total < 0 ||
          !Number.isFinite(o.cost) ||
          o.cost < 0 ||
          !["open", "paid"].includes(o.status) ||
          o.items.some(
            (i) =>
              !Number.isInteger(i.quantity) ||
              i.quantity < 1 ||
              !Number.isFinite(i.unitPrice) ||
              !Number.isFinite(i.cost),
          ),
      )
    )
      throw new Error("The restaurant orders are invalid.");
    const tables = new Set(state.restaurant.tables.map((t) => t.id));
    if (
      state.restaurant.reservations.some(
        (r) =>
          !tables.has(r.tableId) ||
          !r.guestName ||
          !Number.isInteger(r.covers) ||
          r.covers < 1 ||
          ![
            "confirmed",
            "seated",
            "completed",
            "cancelled",
            "expired",
          ].includes(r.status),
      )
    )
      throw new Error("The dining reservations are invalid.");
    for (const r of state.restaurant.reservations)
      validateDate(r.date, "dining date");
    if (
      state.reputation.reviews.some(
        (r) =>
          !r.guestName ||
          !Number.isFinite(r.rating) ||
          r.rating < 1 ||
          r.rating > 5,
      ) ||
      state.reputation.requests.some(
        (r) =>
          !r.guestName ||
          !r.title ||
          !["open", "resolved"].includes(r.status) ||
          !DEPARTMENTS.includes(r.department) ||
          !Array.isArray(r.history),
      )
    )
      throw new Error("The guest reviews or service requests are invalid.");
    const pricing = state.simulation.pricing;
    if (
      !pricing ||
      typeof pricing.dynamic !== "boolean" ||
      !Number.isFinite(pricing.multiplier) ||
      pricing.multiplier < 0.6 ||
      pricing.multiplier > 2 ||
      !pricing.baseRates ||
      ["Classic King", "Deluxe Twin", "Junior Suite", "Aurelia Suite"].some(
        (t) =>
          !Number.isFinite(pricing.baseRates[t]) ||
          pricing.baseRates[t] < 100 ||
          pricing.baseRates[t] > 3000,
      )
    )
      throw new Error("The simulation pricing settings are invalid.");
    if (
      state.simulation.campaigns.some(
        (c) =>
          !c.id ||
          !c.name ||
          !Number.isFinite(c.dailyBudget) ||
          c.dailyBudget < 25 ||
          c.dailyBudget > 2000 ||
          !Number.isFinite(c.lift) ||
          c.lift < 0 ||
          c.lift > 1 ||
          !["active", "paused", "completed"].includes(c.status),
      )
    )
      throw new Error("The marketing campaigns are invalid.");
    for (const c of state.simulation.campaigns) {
      validateDate(c.startDate, "campaign start");
      validateDate(c.endDate, "campaign end");
      if (c.endDate < c.startDate)
        throw new Error("The campaign dates are invalid.");
    }
    if (
      state.simulation.events.some(
        (e) =>
          !e.id ||
          !e.title ||
          !Number.isFinite(e.cost) ||
          e.cost < 0 ||
          !["open", "resolved", "recorded"].includes(e.status),
      )
    )
      throw new Error("The operational events are invalid.");
  }
  return upgradeState(state);
}
export function exportSave(state) {
  return JSON.stringify(
    {
      format: "aurelia-save",
      version: 2,
      exportedAt: new Date().toISOString(),
      state,
    },
    null,
    2,
  );
}
