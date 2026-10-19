export const DEPARTMENTS = [
  "Front Office",
  "Housekeeping",
  "Restaurant & Bar",
  "Kitchen",
  "Maintenance",
  "Spa & Wellness",
  "Management",
];
export const REVENUE_TYPES = [
  "room",
  "food",
  "bar",
  "room-service",
  "spa",
  "other",
];
export const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export const addDays = (date, amount) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + amount * 86400000)
    .toISOString()
    .slice(0, 10);
export const daysInMonth = (date) =>
  new Date(
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0),
  ).getUTCDate();
export const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
export const clamp = (value, low = 0, high = 100) =>
  Math.max(low, Math.min(high, value));

export function validateDate(date, label = "date") {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error(`Enter a valid ${label}.`);
  return date;
}

// Mutation is confined to callers' structured clones. Revenue is positive,
// expenses negative, and cash-only asset movements are excluded from profit.
export function postEntry(state, entry) {
  if (!entry.id || !Number.isFinite(entry.amount))
    throw new Error("A ledger entry needs an ID and a finite amount.");
  if (state.ledger.some((item) => item.id === entry.id)) return state;
  if (entry.type === "expense" && entry.amount > 0)
    throw new Error("Expenses must be negative.");
  if (REVENUE_TYPES.includes(entry.type) && entry.amount < 0)
    throw new Error("Revenue must be positive.");
  state.ledger.push({
    date: state.date,
    cashDelta: roundMoney(entry.amount),
    ...entry,
    amount: roundMoney(entry.amount),
  });
  return state;
}

export function appendLog(state, title, detail, type = "management") {
  state.activity ||= [];
  state.activity.unshift({
    id: `management-${state.date}-${state.activity.length}-${state.ledger.length}`,
    date: state.date,
    time: "GM",
    title,
    detail,
    type,
  });
  state.activity = state.activity.slice(0, 500);
  return state;
}

export function getCashBalance(state) {
  const start = state.finance?.startDate || state.date;
  return roundMoney(
    (state.finance?.openingCash ?? 250000) +
      state.ledger
        .filter((e) => e.date >= start)
        .reduce(
          (sum, e) =>
            sum +
            (Number.isFinite(e.cashDelta)
              ? e.cashDelta
              : REVENUE_TYPES.includes(e.type) ||
                  e.type === "expense" ||
                  e.type === "cash"
                ? e.amount
                : 0),
          0,
        ),
  );
}

export function postFixedDailyExpenses(state) {
  const next = structuredClone(state);
  for (const [category, amount, department, description] of [
    ["utilities", 310, "Maintenance", "Electricity, water, and energy"],
    ["maintenance", 160, "Maintenance", "Preventive maintenance"],
    ["administration", 120, "Management", "Insurance and administration"],
    ["marketing", 60, "Management", "Base marketing operations"],
  ])
    postEntry(next, {
      id: `fixed-${next.date}-${category}`,
      type: "expense",
      category,
      department,
      amount: -amount,
      description,
    });
  return next;
}
