import test from "node:test";
import assert from "node:assert/strict";
import { addDays, getCashBalance } from "../src/business.js";
import { createManagedDemo, getFinancials } from "../src/management.js";
import {
  advanceSimulation,
  getMarketContext,
  getOperatingHistory,
  launchCampaign,
  pauseCampaign,
  resolveEvent,
  updatePricing,
} from "../src/simulation.js";
import { getStaffMetrics, trainEmployee } from "../src/staff.js";
import { createOrder, payOrder } from "../src/restaurant.js";

function verifyState(state) {
  assert.equal(
    new Set(state.ledger.map((entry) => entry.id)).size,
    state.ledger.length,
    "all financial postings have unique IDs",
  );
  assert.ok(
    state.ledger.every((entry) => Number.isFinite(entry.amount)),
    "all amounts are finite",
  );
  const staying = state.reservations.filter(
    (reservation) => reservation.status === "checked-in",
  );
  assert.equal(
    new Set(staying.map((reservation) => reservation.roomId)).size,
    staying.length,
    "one occupant per room",
  );
  for (const reservation of staying) {
    assert.equal(
      state.rooms.find((room) => room.id === reservation.roomId).status,
      "occupied",
    );
    assert.ok(
      reservation.checkOut > state.date,
      "departing guests are checked out before a new night is charged",
    );
  }
  assert.equal(
    state.rooms.filter((room) => room.status === "occupied").length,
    staying.length,
  );
  assert.ok(
    state.restaurant.inventory.every((item) => item.quantity >= 0),
    "inventory never becomes negative",
  );
  const financials = getFinancials(state);
  assert.equal(
    financials.profit,
    Math.round((financials.revenue - financials.expenses) * 100) / 100,
  );
}

test("a simulated day updates rooms, restaurant, payroll, financials and service together without mutating input", () => {
  const original = createManagedDemo();
  const before = structuredClone(original);
  const next = advanceSimulation(original, 1);
  assert.deepEqual(original, before);
  assert.equal(next.date, addDays(original.date, 1));
  assert.ok(
    next.ledger.some((entry) => entry.id.startsWith(`payroll-${next.date}`)),
  );
  assert.ok(
    next.ledger.some((entry) => entry.id === `fixed-${next.date}-utilities`),
  );
  assert.ok(next.restaurant.simulatedDates.includes(next.date));
  assert.equal(next.staffSettledThrough, next.date);
  assert.equal(next.reputation.lastSettledDate, next.date);
  assert.equal(next.simulation.history.at(-1).date, next.date);
  assert.equal(next.simulation.lastReport.days, 1);
  assert.equal(next.simulation.lastReport.revenue, getFinancials(next).revenue);
  assert.equal(
    next.simulation.lastReport.operatingProfit,
    getFinancials(next).profit,
  );
  for (const reservation of original.reservations.filter(
    (item) => item.status === "checked-in" && item.checkOut <= next.date,
  ))
    assert.equal(
      next.ledger.some(
        (entry) => entry.id === `room-${next.date}-${reservation.id}`,
      ),
      false,
      "no departure-day room charge",
    );
  verifyState(next);
});

test("one week has the same deterministic outcome as seven single-day advances", () => {
  const state = createManagedDemo();
  const week = advanceSimulation(state, 7);
  let daily = state;
  for (let day = 0; day < 7; day++) daily = advanceSimulation(daily, 1);
  assert.equal(week.date, daily.date);
  assert.deepEqual(week.ledger, daily.ledger);
  assert.deepEqual(week.rooms, daily.rooms);
  assert.deepEqual(week.restaurant.inventory, daily.restaurant.inventory);
  assert.equal(week.simulation.history.length, 8);
  verifyState(week);
});

test("manual POS payments and training refresh live history and are retained when the operating day closes", () => {
  let state = advanceSimulation(createManagedDemo(), 1);
  const operatingDate = state.date;
  const snapshotBeforeActions = structuredClone(
    state.simulation.history.at(-1),
  );
  state = createOrder(state, {
    channel: "restaurant",
    tableId: "R3",
    guestName: "Fictional dinner guest",
    items: [{ menuId: "steak", quantity: 1 }],
  });
  state = payOrder(state, state.restaurant.orders.at(-1).id, "card");
  state = trainEmployee(state, state.employees[0].id, "service");
  const financials = getFinancials(state);
  const cashAtClose = getCashBalance(state);
  const occupiedAtClose = state.rooms.filter(
    (room) => room.status === "occupied",
  ).length;
  const storedHistory = structuredClone(state.simulation.history);
  const liveRow = getOperatingHistory(state).find(
    (day) => day.date === operatingDate,
  );
  assert.equal(liveRow.revenue, financials.revenue);
  assert.equal(liveRow.expenses, financials.expenses);
  assert.equal(liveRow.operatingProfit, financials.profit);
  assert.equal(liveRow.cashBalance, cashAtClose);
  assert.notEqual(liveRow.revenue, snapshotBeforeActions.revenue);
  assert.notEqual(liveRow.expenses, snapshotBeforeActions.expenses);
  assert.deepEqual(
    state.simulation.history,
    storedHistory,
    "live rendering never mutates saved state",
  );
  const next = advanceSimulation(state, 1);
  const closedRow = next.simulation.history.find(
    (day) => day.date === operatingDate,
  );
  assert.equal(closedRow.revenue, financials.revenue);
  assert.equal(closedRow.expenses, financials.expenses);
  assert.equal(closedRow.operatingProfit, financials.profit);
  assert.equal(closedRow.cashBalance, cashAtClose);
  assert.equal(
    closedRow.occupied,
    occupiedAtClose,
    "occupancy is captured before tomorrow’s departures",
  );
  for (const field of [
    "arrivals",
    "departures",
    "cleaned",
    "walkIns",
    "marketDemand",
  ])
    assert.equal(
      closedRow[field],
      snapshotBeforeActions[field],
      `preserve operational ${field}`,
    );
  assert.deepEqual(
    getOperatingHistory(next).find((day) => day.date === operatingDate),
    closedRow,
    "closed operating days remain immutable in the live view",
  );
});

test("30-day simulation remains coherent across a calendar-month boundary", () => {
  const state = createManagedDemo();
  const next = advanceSimulation(state, 30);
  assert.equal(next.date, addDays(state.date, 30));
  assert.equal(next.simulation.history.length, 31);
  assert.equal(next.simulation.settledDates.length, 30);
  assert.ok(next.simulation.events.some((event) => event.kind === "equipment"));
  assert.ok(next.simulation.events.some((event) => event.kind === "staffing"));
  assert.ok(next.reputation.requests.length > state.reputation.requests.length);
  assert.ok(Number.isFinite(getCashBalance(next)));
  verifyState(next);
});

test("pricing affects future market demand and room rates while retaining booked rates", () => {
  const state = createManagedDemo();
  const originalBookings = state.reservations.map(({ id, rate }) => ({
    id,
    rate,
  }));
  const expensive = updatePricing(state, { multiplier: 1.6 });
  const value = updatePricing(state, { multiplier: 0.8 });
  assert.ok(
    getMarketContext(expensive).targetOccupancy <
      getMarketContext(value).targetOccupancy,
  );
  assert.deepEqual(
    expensive.reservations.map(({ id, rate }) => ({ id, rate })),
    originalBookings,
  );
  assert.equal(expensive.rooms[0].rate, state.rooms[0].rate * 1.6);
  const dynamic = updatePricing(state, { dynamic: true });
  assert.equal(dynamic.simulation.pricing.dynamic, true);
  assert.throws(() => updatePricing(state, { multiplier: 9 }), /60% and 200%/);
  assert.throws(
    () => updatePricing(state, { type: "Classic King", rate: -1 }),
    /between/,
  );
});

test("campaigns charge one day at launch, only their active dates, and stop after expiry or pause", () => {
  const original = createManagedDemo();
  const state = launchCampaign(original, {
    name: "Autumn escapes",
    dailyBudget: 100,
    duration: 3,
    channel: "Direct booking",
  });
  const campaign = state.simulation.campaigns[0];
  assert.equal(getCashBalance(state), getCashBalance(original) - 100);
  assert.ok(
    getMarketContext(state).targetOccupancy >=
      getMarketContext(original).targetOccupancy,
  );
  const next = advanceSimulation(state, 7);
  const charges = next.ledger.filter(
    (entry) => entry.campaignId === campaign.id,
  );
  assert.equal(charges.length, 3);
  assert.equal(
    charges.reduce((sum, entry) => sum + entry.amount, 0),
    -300,
  );
  assert.equal(next.simulation.campaigns[0].status, "completed");
  const paused = pauseCampaign(state, campaign.id);
  const afterPause = advanceSimulation(paused, 1);
  assert.equal(
    afterPause.ledger.filter((entry) => entry.campaignId === campaign.id)
      .length,
    1,
  );
  assert.throws(
    () => launchCampaign(original, { dailyBudget: 100, duration: 0 }),
    /1–30 days/,
  );
});

test("equipment repairs post one cash expense and restore a room to housekeeping", () => {
  const state = advanceSimulation(createManagedDemo(), 7);
  const event = state.simulation.events.find(
    (item) => item.kind === "equipment" && item.status === "open",
  );
  assert.ok(event);
  const cash = getCashBalance(state);
  const next = resolveEvent(state, event.id);
  assert.equal(
    next.simulation.events.find((item) => item.id === event.id).status,
    "resolved",
  );
  assert.equal(
    getCashBalance(next),
    Math.round((cash - event.cost) * 100) / 100,
  );
  assert.equal(
    next.ledger.filter((entry) => entry.id === `repair-${event.id}`).length,
    1,
  );
  if (event.roomId)
    assert.equal(
      next.rooms.find((room) => room.id === event.roomId).status,
      "cleaning",
    );
  assert.throws(() => resolveEvent(next, event.id), /already resolved/);
});

test("front-office staffing shortages measurably reduce forecast demand", () => {
  const state = createManagedDemo();
  const reduced = structuredClone(state);
  for (const employee of reduced.employees.filter(
    (employee) => employee.department === "Front Office",
  ))
    employee.status = "dismissed";
  assert.equal(
    getStaffMetrics(reduced).departments.find(
      (department) => department.department === "Front Office",
    ).coverage,
    0,
  );
  assert.ok(
    getMarketContext(reduced).targetOccupancy <
      getMarketContext(state).targetOccupancy,
  );
  const next = advanceSimulation(reduced, 1);
  assert.equal(next.simulation.lastReport.arrivals, 0);
});

test("simulation accepts only supported bounded time steps", () => {
  const state = createManagedDemo();
  for (const days of [0, -1, 2, 365, "7", Infinity])
    assert.throws(() => advanceSimulation(state, days), /one day/);
});
