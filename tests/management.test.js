import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  getMetrics,
  updateRoomStatus,
} from "../src/hotel.js";
import {
  createManagedDemo,
  upgradeState,
  getFinancials,
  exportSave,
  validateSave,
  setDepartmentBudget,
} from "../src/management.js";
import {
  createOrder,
  payOrder,
  restockInventory,
  recordWaste,
} from "../src/restaurant.js";
import { postDailyPayroll } from "../src/staff.js";
import { advanceSimulation, launchCampaign } from "../src/simulation.js";
import { roundMoney } from "../src/business.js";

test("migration preserves legacy bookings, room state and every recognized sale", () => {
  const legacy = createInitialState();
  legacy.rooms[46].status = "available";
  const before = structuredClone(legacy);
  const next = upgradeState(legacy);
  assert.deepEqual(legacy, before);
  assert.deepEqual(next.rooms, legacy.rooms);
  assert.deepEqual(next.reservations, legacy.reservations);
  for (const entry of legacy.ledger)
    assert.deepEqual(
      next.ledger.find((e) => e.id === entry.id),
      entry,
    );
  assert.equal(next.employees.length, 50);
  assert.equal(getMetrics(next).totalRevenue, getMetrics(legacy).totalRevenue);
  assert.deepEqual(upgradeState(next), next);
  assert.deepEqual(postDailyPayroll(next), next);
});

test("POS preparation, payment, restock and waste reconcile across profit and cash", () => {
  let state = createManagedDemo();
  const initial = getFinancials(state);
  const room = state.rooms.find((r) => r.status === "occupied");
  state = createOrder(state, {
    channel: "room-service",
    roomId: room.id,
    guestName: "Test guest",
    items: [{ menuId: "steak", quantity: 2 }],
  });
  const order = state.restaurant.orders.at(-1),
    prepared = getFinancials(state);
  assert.equal(prepared.revenue, initial.revenue);
  assert.equal(prepared.profit, roundMoney(initial.profit - order.cost));
  assert.equal(prepared.cashBalance, initial.cashBalance);
  state = payOrder(state, order.id);
  const paid = getFinancials(state);
  assert.equal(paid.revenue, roundMoney(initial.revenue + order.total));
  assert.equal(paid.profit, roundMoney(prepared.profit + order.total));
  assert.equal(paid.cashBalance, roundMoney(initial.cashBalance + order.total));
  assert.equal(getMetrics(state).totalRevenue, paid.revenue);
  const purchased = restockInventory(state, "beef", 5, 50),
    stocked = getFinancials(purchased);
  assert.equal(stocked.profit, paid.profit);
  assert.equal(stocked.cashBalance, roundMoney(paid.cashBalance - 250));
  const wasted = recordWaste(purchased, "beef", 1, "Spoilage");
  assert.ok(getFinancials(wasted).profit < stocked.profit);
  assert.equal(getFinancials(wasted).cashBalance, stocked.cashBalance);
  assert.equal(getFinancials(wasted).revenue, getMetrics(wasted).totalRevenue);
});

test("department and expense category totals reconcile with month-to-date profit", () => {
  const s = createManagedDemo(),
    f = getFinancials(s, "month");
  assert.equal(
    roundMoney(f.departments.reduce((sum, d) => sum + d.revenue, 0)),
    f.revenue,
  );
  assert.equal(
    roundMoney(f.departments.reduce((sum, d) => sum + d.expenses, 0)),
    f.expenses,
  );
  assert.equal(
    roundMoney(f.categories.reduce((sum, d) => sum + d.amount, 0)),
    f.expenses,
  );
  assert.equal(f.profit, roundMoney(f.revenue - f.expenses));
  for (const department of f.departments) assert.ok(department.expenses > 0);
});

test("budgets are planning limits and do not create expenditure", () => {
  const s = createManagedDemo(),
    before = getFinancials(s);
  const next = setDepartmentBudget(s, "Housekeeping", 40000);
  assert.equal(next.finance.budgets.Housekeeping, 40000);
  assert.deepEqual(getFinancials(next).entries, before.entries);
  assert.equal(getFinancials(next).cashBalance, before.cashBalance);
  assert.throws(() => setDepartmentBudget(s, "Housekeeping", NaN), /budget/);
});

test("JSON save roundtrips the complete simulation after a month of activity", () => {
  let s = createManagedDemo();
  s = launchCampaign(s, {
    name: "Autumn invitation",
    dailyBudget: 120,
    duration: 4,
    channel: "Direct booking",
  });
  s = advanceSimulation(s, 30);
  const restored = validateSave(JSON.parse(exportSave(s)));
  assert.deepEqual(restored, JSON.parse(JSON.stringify(s)));
  assert.equal(
    getFinancials(restored).revenue,
    getMetrics(restored).totalRevenue,
  );
  assert.equal(
    new Set(restored.ledger.map((e) => e.id)).size,
    restored.ledger.length,
  );
});

test("import rejects corrupted financial, inventory, staffing and simulation data", () => {
  const demo = createManagedDemo();
  for (const mutate of [
    (s) => s.ledger.push({ ...s.ledger[0] }),
    (s) => (s.restaurant.inventory[0].quantity = -1),
    (s) => (s.employees[0].salary = -300),
    (s) => (s.simulation.pricing = {}),
    (s) =>
      (s.simulation.events = [
        { id: "bad", title: "Bad", cost: -20, status: "open" },
      ]),
    (s) =>
      (s.restaurant.orders = [
        { id: "bad", items: [], total: "NaN", cost: 0, status: "paid" },
      ]),
  ]) {
    const bad = structuredClone(demo);
    mutate(bad);
    assert.throws(() => validateSave(bad));
  }
  assert.deepEqual(validateSave(JSON.parse(exportSave(demo))), demo);
});

test("room readiness cannot bypass an unresolved equipment repair", () => {
  const s = createManagedDemo(),
    room = s.rooms.find((r) => r.status === "maintenance");
  s.simulation.events.push({
    id: "broken",
    kind: "equipment",
    roomId: room.id,
    status: "open",
    cost: 850,
    title: "Air conditioning",
  });
  assert.throws(
    () => updateRoomStatus(s, room.id, "available"),
    /equipment repair/,
  );
});
