import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/hotel.js";
import { getCashBalance } from "../src/business.js";
import {
  createRestaurantData,
  getTableAvailability,
  createTableReservation,
  cancelTableReservation,
  createOrder,
  payOrder,
  updateMenuPrice,
  restockInventory,
  recordWaste,
  getRestaurantMetrics,
  simulateRestaurantDay,
} from "../src/restaurant.js";

function demo() {
  const state = createInitialState();
  state.restaurant = createRestaurantData(state.date);
  state.finance = { openingCash: 250000, startDate: state.date };
  return state;
}
const orderInput = {
  channel: "restaurant",
  tableId: "R1",
  guestName: "Taylor Guest",
  items: [
    { menuId: "steak", quantity: 2 },
    { menuId: "wine", quantity: 2 },
  ],
};

test("restaurant demo has the promised outlet capacities and shares prior sales without posting duplicates", () => {
  const state = demo();
  const metrics = getRestaurantMetrics(state);
  assert.equal(metrics.restaurantSeats, 60);
  assert.equal(metrics.barSeats, 30);
  assert.equal(
    metrics.revenue,
    state.ledger
      .filter((entry) => entry.date === state.date && entry.type === "food")
      .reduce((sum, entry) => sum + entry.amount, 0),
  );
  assert.equal(metrics.revenue, metrics.priorSales);
  assert.equal(state.restaurant.orders.length, 0);
  assert.equal(state.restaurant.inventory.length, 10);
});

test("table reservations enforce party capacity, valid dates, operating hours, and overlapping intervals", () => {
  const initial = demo();
  const input = {
    tableId: "R1",
    guestName: "Taylor Guest",
    date: initial.date,
    time: "18:00",
    duration: 90,
    covers: 2,
  };
  const booked = createTableReservation(initial, input);
  assert.equal(
    initial.restaurant.reservations.length + 1,
    booked.restaurant.reservations.length,
  );
  assert.equal(
    getTableAvailability(booked, {
      date: initial.date,
      time: "18:30",
      duration: 60,
    }).find((table) => table.id === "R1").available,
    false,
  );
  assert.throws(
    () => createTableReservation(booked, { ...input, time: "19:00" }),
    /unavailable/,
  );
  assert.doesNotThrow(() =>
    createTableReservation(booked, { ...input, time: "19:30" }),
  );
  assert.throws(
    () => createTableReservation(initial, { ...input, covers: 3 }),
    /party size/,
  );
  assert.throws(
    () => createTableReservation(initial, { ...input, date: "2026-02-30" }),
    /valid dining date/,
  );
  assert.throws(
    () => createTableReservation(initial, { ...input, time: "23:30" }),
    /full reservation/,
  );
  assert.throws(
    () => createTableReservation(initial, { ...input, time: "24:00" }),
    /valid dining time/,
  );
  assert.throws(
    () => createTableReservation(initial, { ...input, time: "10:00" }),
    /full reservation/,
  );
  const cancelled = cancelTableReservation(
    booked,
    booked.restaurant.reservations.at(-1).id,
  );
  assert.equal(
    getTableAvailability(cancelled, { time: "18:00" }).find(
      (table) => table.id === "R1",
    ).available,
    true,
  );
});

test("preparing an order consumes exact ingredients and posts cost once; payment recognizes cash and revenue once", () => {
  const initial = demo();
  const previous = getRestaurantMetrics(initial);
  const prepared = createOrder(initial, orderInput);
  const order = prepared.restaurant.orders.at(-1);
  assert.equal(initial.restaurant.orders.length, 0);
  assert.equal(
    prepared.restaurant.inventory.find((item) => item.id === "beef").quantity,
    179.48,
  );
  assert.equal(
    prepared.restaurant.inventory.find((item) => item.id === "wine").quantity,
    599.6,
  );
  assert.equal(order.total, 172);
  assert.equal(order.cost, 32.4);
  assert.equal(getRestaurantMetrics(prepared).revenue, previous.revenue);
  assert.equal(getRestaurantMetrics(prepared).receivables, 172);
  assert.equal(getRestaurantMetrics(prepared).cogs, previous.cogs + 32.4);
  assert.equal(getCashBalance(prepared), getCashBalance(initial));
  assert.throws(() => createOrder(prepared, orderInput), /existing open order/);
  const paid = payOrder(prepared, order.id, "cash");
  assert.equal(getRestaurantMetrics(paid).revenue, previous.revenue + 172);
  assert.equal(getCashBalance(paid), getCashBalance(initial) + 172);
  assert.equal(getRestaurantMetrics(paid).receivables, 0);
  assert.equal(
    paid.ledger.filter((entry) => entry.id === `cogs-${order.id}`).length,
    1,
  );
  assert.equal(
    paid.ledger.filter((entry) => entry.id === `sale-${order.id}`).length,
    1,
  );
  assert.throws(() => payOrder(paid, order.id), /unpaid order/);
});

test("menu price changes do not alter open checks and invalid/insufficient-stock orders leave state unchanged", () => {
  const initial = demo();
  const prepared = createOrder(initial, orderInput);
  const updated = updateMenuPrice(prepared, "steak", 100);
  assert.equal(updated.restaurant.orders[0].items[0].unitPrice, 68);
  assert.equal(updated.restaurant.orders[0].total, 172);
  assert.equal(
    updated.restaurant.menu.find((item) => item.id === "steak").price,
    100,
  );
  const empty = structuredClone(initial);
  empty.restaurant.inventory.find((item) => item.id === "beef").quantity = 0;
  const snapshot = JSON.stringify(empty);
  assert.throws(
    () => createOrder(empty, orderInput),
    /Insufficient prime beef/,
  );
  assert.equal(JSON.stringify(empty), snapshot);
  assert.throws(
    () =>
      createOrder(initial, {
        ...orderInput,
        items: [{ menuId: "steak", quantity: -2 }],
      }),
    /quantity/,
  );
  assert.throws(
    () =>
      createOrder(initial, { ...orderInput, channel: "bar", tableId: "B1" }),
    /unavailable/,
  );
  assert.throws(() => updateMenuPrice(initial, "steak", NaN), /menu price/);
  assert.throws(() => updateMenuPrice(initial, "steak", 0), /menu price/);
});

test("room service requires an in-house guest room and posts the correct outlet revenue", () => {
  const initial = demo();
  const occupied = initial.rooms.find((room) => room.status === "occupied");
  const available = initial.rooms.find((room) => room.status === "available");
  const request = {
    channel: "room-service",
    roomId: occupied.id,
    guestName: "Taylor Guest",
    items: [{ menuId: "burrata", quantity: 1 }],
  };
  const prepared = createOrder(initial, request);
  assert.equal(
    prepared.restaurant.inventory.find((item) => item.id === "cheese").quantity,
    139.875,
  );
  const paid = payOrder(prepared, prepared.restaurant.orders.at(-1).id);
  assert.equal(getRestaurantMetrics(paid).roomServiceRevenue, 24);
  assert.throws(
    () => createOrder(initial, { ...request, roomId: available.id }),
    /occupied guest room/,
  );
});

test("stock purchases affect cash/assets while consumption and waste affect profit without a second cash charge", () => {
  const initial = demo();
  const previous = getRestaurantMetrics(initial);
  const stocked = restockInventory(initial, "beef", 10, 50);
  assert.equal(getCashBalance(stocked), getCashBalance(initial) - 500);
  assert.equal(getRestaurantMetrics(stocked).profit, previous.profit);
  assert.equal(
    stocked.restaurant.inventory.find((item) => item.id === "beef").quantity,
    190,
  );
  const wasted = recordWaste(stocked, "beef", 2, "Spoilage");
  assert.equal(getCashBalance(wasted), getCashBalance(stocked));
  assert.equal(getRestaurantMetrics(wasted).waste, 90.53);
  assert.equal(getRestaurantMetrics(wasted).profit, previous.profit - 90.53);
  assert.throws(() => recordWaste(initial, "beef", 1000), /exceed/);
  assert.throws(() => restockInventory(initial, "beef", -1, 40), /quantity/);
  const noCash = structuredClone(initial);
  noCash.finance.openingCash = -1000000;
  assert.throws(
    () => restockInventory(noCash, "beef", 10, 50),
    /Insufficient cash/,
  );
});

test("daily service is idempotent, shares the order ledger, respects shortages, and never settles a manual check", () => {
  const initial = createOrder(demo(), orderInput);
  const next = simulateRestaurantDay(initial);
  assert.equal(
    next.restaurant.orders.find(
      (order) => order.id === initial.restaurant.orders[0].id,
    ).status,
    "open",
  );
  assert.equal(
    next.restaurant.orders.filter((order) => order.simulated).length,
    4,
  );
  assert.equal(
    next.restaurant.orders.filter(
      (order) => order.simulated && order.status === "paid",
    ).length,
    4,
  );
  assert.ok(
    getRestaurantMetrics(next).revenue > getRestaurantMetrics(initial).revenue,
  );
  assert.equal(simulateRestaurantDay(next), next);
  assert.equal(initial.restaurant.simulatedDates.length, 0);
  const shortage = demo();
  shortage.restaurant.inventory.forEach((item) => {
    item.quantity = 0;
  });
  const constrained = simulateRestaurantDay(shortage);
  assert.equal(constrained.restaurant.orders.length, 0);
  assert.equal(
    getRestaurantMetrics(constrained).revenue,
    getRestaurantMetrics(shortage).revenue,
  );
  assert.equal(
    constrained.activity.filter(
      (item) => item.title === "Dining service constrained",
    ).length,
    4,
  );
  assert.ok(
    constrained.restaurant.inventory.every((item) => item.quantity >= 0),
  );
});

test("seating a dining reservation links the order, marks it seated, and releases the check after payment", () => {
  const initial = demo();
  const reservation = initial.restaurant.reservations[0];
  const prepared = createOrder(initial, {
    ...orderInput,
    tableId: reservation.tableId,
    guestName: reservation.guestName,
    reservationId: reservation.id,
  });
  assert.equal(prepared.restaurant.reservations[0].status, "seated");
  assert.equal(prepared.restaurant.orders[0].reservationId, reservation.id);
  assert.equal(
    getTableAvailability(prepared).find(
      (table) => table.id === reservation.tableId,
    ).available,
    false,
  );
  const paid = payOrder(prepared, prepared.restaurant.orders[0].id);
  assert.equal(
    getTableAvailability(paid).find((table) => table.id === reservation.tableId)
      .available,
    true,
  );
  assert.throws(
    () =>
      createOrder(paid, {
        ...orderInput,
        tableId: reservation.tableId,
        reservationId: reservation.id,
      }),
    /confirmed reservation/,
  );
});

test("unpaid checks keep a table unavailable on later simulation days until payment, while future bookings remain possible", () => {
  const prepared = createOrder(demo(), orderInput);
  const nextDay = structuredClone(prepared);
  nextDay.date = "2026-10-17";
  assert.equal(
    getTableAvailability(nextDay).find((table) => table.id === "R1").available,
    false,
  );
  assert.throws(() => createOrder(nextDay, orderInput), /existing open order/);
  assert.equal(
    getTableAvailability(nextDay, { date: "2026-10-18" }).find(
      (table) => table.id === "R1",
    ).available,
    true,
  );
  const settled = payOrder(nextDay, nextDay.restaurant.orders[0].id);
  assert.equal(
    getTableAvailability(settled).find((table) => table.id === "R1").available,
    true,
  );
  assert.doesNotThrow(() => createOrder(settled, orderInput));
});

test("restaurant scheduling and service performance measurably affect simulated outlet demand", () => {
  const initial = demo();
  initial.employees = Array.from({ length: 12 }, (_, index) => ({
    id: `E${index}`,
    status: "active",
    department: "Restaurant & Bar",
    satisfaction: 90,
    performance: 90,
  }));
  initial.shifts = initial.employees.map((person) => ({
    employeeId: person.id,
    date: initial.date,
    shift: "Evening",
  }));
  const staffed = simulateRestaurantDay(initial);
  const shortage = structuredClone(initial);
  shortage.shifts = shortage.shifts.map((shift) => ({
    ...shift,
    shift: "Off",
  }));
  const understaffed = simulateRestaurantDay(shortage);
  assert.ok(
    getRestaurantMetrics(staffed).revenue >
      getRestaurantMetrics(understaffed).revenue,
  );
  assert.ok(
    getRestaurantMetrics(staffed).cogs >
      getRestaurantMetrics(understaffed).cogs,
  );
  const poorService = structuredClone(initial);
  poorService.employees.forEach((person) => {
    person.satisfaction = 15;
    person.performance = 15;
  });
  assert.ok(
    getRestaurantMetrics(staffed).revenue >
      getRestaurantMetrics(simulateRestaurantDay(poorService)).revenue,
  );
});
