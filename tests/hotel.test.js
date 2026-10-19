import test from "node:test";
import assert from "node:assert/strict";
import {
  TODAY,
  createInitialState,
  getMetrics,
  getDailyActivity,
  getRoomStatusCounts,
  createReservation,
  cancelReservation,
  checkIn,
  checkOut,
  updateRoomStatus,
  advanceDay,
  getRevenueSeries,
} from "../src/hotel.js";

test("the sample hotel opens with consistent occupancy, arrivals, and revenue", () => {
  const state = createInitialState();
  const metrics = getMetrics(state);
  assert.equal(state.date, TODAY);
  assert.equal(state.rooms.length, 48);
  assert.equal(new Set(state.rooms.map((room) => room.id)).size, 48);
  assert.equal(metrics.occupiedRooms, 36);
  assert.equal(metrics.occupancy, 75);
  assert.equal(metrics.arrivals, 8);
  assert.equal(metrics.departures, 6);
  assert.equal(metrics.adr, metrics.roomRevenue / 36);
  assert.equal(metrics.revpar, metrics.roomRevenue / 48);
  assert.ok(metrics.totalRevenue > metrics.roomRevenue);
  assert.equal(
    Object.values(getRoomStatusCounts(state)).reduce(
      (sum, count) => sum + count,
      0,
    ),
    48,
  );
});

test("check-in posts one room charge, updates occupancy, and preserves the original state", () => {
  const state = createInitialState();
  const reservation = getDailyActivity(state, "arrivals")[0];
  const next = checkIn(state, reservation.id);
  assert.equal(
    state.reservations.find((item) => item.id === reservation.id).status,
    "confirmed",
  );
  assert.equal(
    next.reservations.find((item) => item.id === reservation.id).status,
    "checked-in",
  );
  assert.equal(
    next.rooms.find((room) => room.id === reservation.roomId).status,
    "occupied",
  );
  assert.equal(getMetrics(next).occupiedRooms, 37);
  assert.equal(
    getMetrics(next).roomRevenue,
    getMetrics(state).roomRevenue + reservation.rate,
  );
  assert.throws(() => checkIn(next, reservation.id), /Only a confirmed/);
});

test("checkout preserves recognized revenue and requires housekeeping before another check-in", () => {
  const state = createInitialState();
  const departure = getDailyActivity(state, "departures")[0];
  const checkedOut = checkOut(state, departure.id);
  assert.equal(getMetrics(checkedOut).occupiedRooms, 35);
  assert.equal(
    getMetrics(checkedOut).roomRevenue,
    getMetrics(state).roomRevenue,
  );
  assert.equal(getMetrics(checkedOut).adr, getMetrics(state).adr);
  assert.equal(
    checkedOut.rooms.find((room) => room.id === departure.roomId).status,
    "cleaning",
  );
  assert.throws(() => checkOut(checkedOut, departure.id), /Only an in-house/);
  const ready = updateRoomStatus(checkedOut, departure.roomId, "available");
  const booked = createReservation(ready, {
    guestName: "Taylor Guest",
    email: "taylor@example.com",
    roomId: departure.roomId,
    checkIn: TODAY,
    checkOut: "2026-10-18",
    guests: 2,
  });
  const reservation = booked.reservations.at(-1);
  const dirty = updateRoomStatus(booked, departure.roomId, "cleaning");
  assert.throws(() => checkIn(dirty, reservation.id), /not ready/);
  const prepared = updateRoomStatus(dirty, departure.roomId, "available");
  assert.equal(
    prepared.rooms.find((room) => room.id === departure.roomId).status,
    "reserved",
  );
  assert.equal(getMetrics(checkIn(prepared, reservation.id)).occupiedRooms, 36);
});

test("booking validates dates and conflicts while allowing a future stay in an occupied room", () => {
  const state = createInitialState();
  const room = state.rooms.find((candidate) => candidate.status === "occupied");
  const input = {
    guestName: "Taylor Guest",
    email: "taylor@example.com",
    roomId: room.id,
    checkIn: "2026-11-01",
    checkOut: "2026-11-03",
    guests: 2,
  };
  const next = createReservation(state, input);
  assert.equal(next.reservations.at(-1).total, room.rate * 2);
  assert.equal(
    next.rooms.find((candidate) => candidate.id === room.id).status,
    "occupied",
  );
  assert.equal(state.reservations.length + 1, next.reservations.length);
  assert.throws(
    () => createReservation(next, input),
    /already has a reservation/,
  );
  assert.throws(
    () => createReservation(state, { ...input, checkIn: "2026-10-15" }),
    /past/,
  );
  assert.throws(
    () => createReservation(state, { ...input, checkOut: input.checkIn }),
    /after check-in/,
  );
  assert.throws(
    () => createReservation(state, { ...input, checkIn: "2026-02-30" }),
    /valid check-in/,
  );
  assert.throws(
    () => createReservation(state, { ...input, guests: 8 }),
    /accommodates/,
  );
  assert.throws(
    () => createReservation(state, { ...input, rate: -1 }),
    /positive/,
  );
});

test("reservations allow adjacent stays but prevent simultaneous occupancy", () => {
  let state = createInitialState();
  const departure = getDailyActivity(state, "departures")[0];
  state = createReservation(state, {
    guestName: "Next Guest",
    roomId: departure.roomId,
    checkIn: TODAY,
    checkOut: "2026-10-17",
    guests: 2,
  });
  const arrival = state.reservations.at(-1);
  assert.throws(() => checkIn(state, arrival.id), /not ready/);
  state = updateRoomStatus(
    checkOut(state, departure.id),
    departure.roomId,
    "available",
  );
  state = checkIn(state, arrival.id);
  assert.equal(
    state.rooms.find((room) => room.id === departure.roomId).status,
    "occupied",
  );
  assert.equal(getMetrics(state).soldRooms, 37);
});

test("operational room changes cannot bypass guest check-in and check-out", () => {
  const state = createInitialState();
  const occupied = state.rooms.find((room) => room.status === "occupied");
  const available = state.rooms.find((room) => room.status === "available");
  assert.throws(
    () => updateRoomStatus(state, occupied.id, "available"),
    /Check out/,
  );
  assert.throws(
    () => updateRoomStatus(state, available.id, "occupied"),
    /Use guest check-in/,
  );
  assert.throws(
    () => updateRoomStatus(state, available.id, "reserved"),
    /does not have/,
  );
});

test("cancelling a confirmed arrival releases reserved inventory without affecting recognized revenue", () => {
  const state = createInitialState();
  const arrival = getDailyActivity(state, "arrivals")[0];
  const next = cancelReservation(state, arrival.id);
  assert.equal(
    state.reservations.find((reservation) => reservation.id === arrival.id)
      .status,
    "confirmed",
  );
  assert.equal(
    next.reservations.find((reservation) => reservation.id === arrival.id)
      .status,
    "cancelled",
  );
  assert.equal(
    next.rooms.find((room) => room.id === arrival.roomId).status,
    "available",
  );
  assert.equal(getMetrics(next).pendingArrivals, 7);
  assert.equal(getMetrics(next).availableRooms, 3);
  assert.equal(getMetrics(next).roomRevenue, getMetrics(state).roomRevenue);
  assert.throws(() => cancelReservation(next, arrival.id), /Only a confirmed/);
  assert.throws(
    () =>
      cancelReservation(
        state,
        state.reservations.find(
          (reservation) => reservation.status === "checked-in",
        ).id,
      ),
    /Only a confirmed/,
  );
});

test("cancelling a future reservation preserves another arrival’s reserved inventory", () => {
  const state = createInitialState();
  const arrival = getDailyActivity(state, "arrivals")[0];
  const booked = createReservation(state, {
    guestName: "Future Guest",
    roomId: arrival.roomId,
    checkIn: arrival.checkOut,
    checkOut: "2026-11-01",
    guests: 2,
  });
  const cancelled = cancelReservation(booked, booked.reservations.at(-1).id);
  assert.equal(
    cancelled.rooms.find((room) => room.id === arrival.roomId).status,
    "reserved",
  );
  assert.equal(getMetrics(cancelled).pendingArrivals, 8);
  const futureInOccupiedRoom = state.reservations.find(
    (reservation) =>
      reservation.status === "confirmed" && reservation.checkIn > TODAY,
  );
  const occupiedCancellation = cancelReservation(
    state,
    futureInOccupiedRoom.id,
  );
  assert.equal(
    occupiedCancellation.rooms.find(
      (room) => room.id === futureInOccupiedRoom.roomId,
    ).status,
    "occupied",
  );
});

test("due and overdue departures block day advancement, and overdue rooms block future bookings", () => {
  const state = createInitialState();
  assert.throws(() => advanceDay(state), /Complete check-out for 6 guests/);
  const overdue = structuredClone(state);
  const departure = getDailyActivity(overdue, "departures")[0];
  departure.checkOut = "2026-10-15";
  assert.equal(getMetrics(overdue).pendingDepartures, 6);
  assert.ok(
    getDailyActivity(overdue, "departures").some(
      (reservation) => reservation.id === departure.id,
    ),
  );
  assert.throws(() => advanceDay(overdue), /Complete check-out/);
  assert.throws(
    () =>
      createReservation(overdue, {
        guestName: "Future Guest",
        roomId: departure.roomId,
        checkIn: "2026-12-01",
        checkOut: "2026-12-03",
        guests: 2,
      }),
    /overdue guest/,
  );
  const checkedOut = checkOut(overdue, departure.id);
  assert.doesNotThrow(() =>
    createReservation(checkedOut, {
      guestName: "Future Guest",
      roomId: departure.roomId,
      checkIn: "2026-12-01",
      checkOut: "2026-12-03",
      guests: 2,
    }),
  );
});

test("advancing the business date posts a fresh daily ledger without modifying history", () => {
  let state = createInitialState();
  for (const departure of getDailyActivity(state, "departures"))
    state = checkOut(state, departure.id);
  const next = advanceDay(state);
  assert.equal(next.date, "2026-10-17");
  assert.equal(state.date, TODAY);
  assert.equal(getMetrics(next).soldRooms, 30);
  assert.equal(getMetrics(next).occupiedRooms, 30);
  assert.ok(next.ledger.length > state.ledger.length);
  assert.deepEqual(
    next.ledger.filter((entry) => entry.date === TODAY),
    state.ledger.filter((entry) => entry.date === TODAY),
  );
  assert.equal(getRevenueSeries(next).length, 7);
  assert.equal(
    getRevenueSeries(next).at(-1).revenue,
    getMetrics(next).roomRevenue,
  );
  assert.equal(getRevenueSeries(next, "month").length, 30);
  assert.ok(
    getRevenueSeries(next, "month").every(
      (point) => point.revenue > 0 && point.previousRevenue > 0,
    ),
  );
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(next)));
});

test("room-revenue charts exclude ancillary sales for current and comparison periods", () => {
  const state = createInitialState();
  const series = getRevenueSeries(state);
  const today = series.at(-1);
  assert.equal(today.revenue, getMetrics(state).roomRevenue);
  assert.notEqual(today.revenue, getMetrics(state).totalRevenue);
  const comparisonDate = "2026-10-09";
  assert.equal(
    today.previousRevenue,
    state.ledger
      .filter((entry) => entry.date === comparisonDate && entry.type === "room")
      .reduce((sum, entry) => sum + entry.amount, 0),
  );
});

test("turnover counts each historical room once and keeps today's occupancy live", () => {
  let state = createInitialState();
  const departures = getDailyActivity(state, "departures");
  for (const departure of departures) {
    state = updateRoomStatus(
      checkOut(state, departure.id),
      departure.roomId,
      "available",
    );
  }
  for (const arrival of getDailyActivity(state, "arrivals")) {
    state = checkIn(state, arrival.id);
  }
  const replacementIds = [];
  for (const [index, departure] of departures.entries()) {
    state = createReservation(state, {
      guestName: `Turnover Guest ${index + 1}`,
      email: `turnover${index + 1}@example.com`,
      roomId: departure.roomId,
      checkIn: TODAY,
      checkOut: "2026-10-17",
      guests: 2,
    });
    const replacementId = state.reservations.at(-1).id;
    replacementIds.push(replacementId);
    state = checkIn(state, replacementId);
  }
  assert.equal(getMetrics(state).soldRooms, 50);
  assert.equal(getMetrics(state).occupiedRooms, 44);
  assert.equal(
    getRevenueSeries(state).at(-1).occupancy,
    getMetrics(state).occupancy,
  );
  assert.ok(getRevenueSeries(state).every((point) => point.occupancy <= 100));
  assert.equal(
    getRevenueSeries(state).at(-1).revenue,
    getMetrics(state).roomRevenue,
  );

  for (const reservationId of replacementIds)
    state = checkOut(state, reservationId);
  assert.equal(
    getRevenueSeries(state).at(-1).occupancy,
    getMetrics(state).occupancy,
  );
  assert.equal(getMetrics(state).occupiedRooms, 38);
  const charges = state.ledger.filter((entry) => entry.date === TODAY);
  const next = advanceDay(state);
  const previousDay = getRevenueSeries(next).find(
    (point) => point.date === TODAY,
  );
  assert.equal(previousDay.occupancy, (44 / 48) * 100);
  assert.equal(previousDay.revenue, getMetrics(state).roomRevenue);
  assert.deepEqual(
    next.ledger.filter((entry) => entry.date === TODAY),
    charges,
  );
});

test("historical occupancy combines aggregate and individual records within hotel capacity", () => {
  const state = createInitialState();
  state.ledger.push(
    {
      id: "historical-room-one",
      date: "2026-10-15",
      type: "room",
      roomId: "101",
      amount: 245,
    },
    {
      id: "historical-room-repeat",
      date: "2026-10-15",
      type: "room",
      roomId: "101",
      amount: 245,
    },
    {
      id: "historical-extra-aggregate",
      date: "2026-10-15",
      type: "room",
      soldRooms: 48,
      amount: 1000,
    },
  );
  const point = getRevenueSeries(state).find(
    (day) => day.date === "2026-10-15",
  );
  assert.equal(point.occupancy, 100);
  assert.equal(
    point.revenue,
    state.ledger
      .filter((entry) => entry.date === point.date && entry.type === "room")
      .reduce((total, entry) => total + entry.amount, 0),
  );
});
