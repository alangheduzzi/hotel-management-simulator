import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/hotel.js";
import { addDays, getCashBalance } from "../src/business.js";
import { createStaffData, trainEmployee } from "../src/staff.js";
import {
  createReputationData,
  createServiceRequest,
  getReputationMetrics,
  resolveServiceRequest,
  settleReputationDay,
} from "../src/reputation.js";

function setup() {
  const state = createInitialState();
  Object.assign(state, createStaffData(state.date));
  state.reputation = createReputationData(state);
  return state;
}

function requestInput(overrides = {}) {
  return {
    guestName: "Eleanor Guest",
    email: "eleanor.guest@example.com",
    department: "Front Office",
    kind: "complaint",
    priority: "standard",
    title: "A quiet room requested",
    description:
      "The guest would appreciate a personal follow-up about a quieter room.",
    ...overrides,
  };
}

test("reputation demo includes fictional dated reviews, tracked requests and returning guests", () => {
  const state = setup();
  const metrics = getReputationMetrics(state);
  assert.equal(metrics.departmentRatings.length, 7);
  assert.equal(metrics.openComplaints, 1);
  assert.equal(metrics.openRequests, 2);
  assert.equal(metrics.resolvedRequests, 1);
  assert.ok(metrics.returningGuests >= 8);
  assert.ok(metrics.loyalGuests > 0);
  assert.ok(metrics.averageRating >= 1 && metrics.averageRating <= 5);
  for (const review of state.reputation.reviews) {
    assert.ok(review.date < state.date);
    assert.match(review.email, /@example\.com$/);
    assert.ok(review.rating >= 1 && review.rating <= 5);
  }
  assert.ok(metrics.guestSatisfaction >= 0 && metrics.guestSatisfaction <= 100);
  assert.ok(metrics.reputation >= 0 && metrics.reputation <= 100);
});

test("staff shortages, poor performance and room condition have measurable satisfaction consequences", () => {
  const state = setup();
  const healthy = getReputationMetrics(state);
  const short = structuredClone(state);
  short.employees
    .filter((employee) => employee.department === "Housekeeping")
    .forEach((employee) => {
      employee.status = "dismissed";
    });
  const shortage = getReputationMetrics(short);
  assert.ok(shortage.guestSatisfaction < healthy.guestSatisfaction - 8);
  assert.equal(
    shortage.departmentRatings.find(
      (team) => team.department === "Housekeeping",
    ).coverage,
    0,
  );
  const neglected = structuredClone(state);
  neglected.rooms.forEach((room, index) => {
    room.status = index < 24 ? "cleaning" : "maintenance";
  });
  assert.ok(
    getReputationMetrics(neglected).guestSatisfaction <
      healthy.guestSatisfaction - 5,
  );
  const poorlyTrained = structuredClone(state);
  poorlyTrained.employees.forEach((employee) => {
    employee.performance = 10;
    employee.satisfaction = 20;
  });
  assert.ok(
    getReputationMetrics(poorlyTrained).guestSatisfaction <
      healthy.guestSatisfaction - 15,
  );
  const trainee = state.employees.find(
    (employee) => employee.department === "Front Office",
  );
  const trained = getReputationMetrics(trainEmployee(state, trainee.id));
  assert.ok(
    trained.departmentRatings.find((team) => team.department === "Front Office")
      .score >
      healthy.departmentRatings.find(
        (team) => team.department === "Front Office",
      ).score,
  );
  assert.ok(trained.guestSatisfaction >= healthy.guestSatisfaction);
});

test("complaints and overdue complaints lower the responsible score and reputation", () => {
  const state = setup();
  const before = getReputationMetrics(state);
  const opened = createServiceRequest(
    state,
    requestInput({ priority: "urgent" }),
  );
  assert.equal(
    state.reputation.requests.length + 1,
    opened.reputation.requests.length,
  );
  assert.ok(
    getReputationMetrics(opened).guestSatisfaction < before.guestSatisfaction,
  );
  assert.equal(
    getReputationMetrics(opened).openComplaints,
    before.openComplaints + 1,
  );
  const overdue = structuredClone(opened);
  overdue.date = addDays(overdue.date, 3);
  assert.ok(
    getReputationMetrics(overdue).reputation <
      getReputationMetrics(opened).reputation,
  );
  assert.ok(
    getReputationMetrics(overdue).serviceFactors.overdueComplaints >= 2,
  );
});

test("service recovery posts one expense, reduces cash once and records an immutable resolution history", () => {
  const state = createServiceRequest(setup(), requestInput());
  const request = state.reputation.requests[0];
  const before = getReputationMetrics(state);
  const balance = getCashBalance(state);
  const resolved = resolveServiceRequest(state, request.id, {
    resolution: "recovery",
    notes: "A personal apology and courtesy credit were provided.",
  });
  assert.equal(state.reputation.requests[0].status, "open");
  assert.equal(resolved.reputation.requests[0].status, "resolved");
  assert.equal(resolved.reputation.requests[0].resolvedDate, state.date);
  assert.equal(resolved.reputation.requests[0].history.length, 2);
  const entry = resolved.ledger.find(
    (item) => item.id === `service-recovery-${request.id}`,
  );
  assert.equal(entry.amount, -60);
  assert.equal(entry.cashDelta, -60);
  assert.equal(entry.department, "Front Office");
  assert.equal(entry.category, "guest-recovery");
  assert.equal(getCashBalance(resolved), balance - 60);
  assert.ok(
    getReputationMetrics(resolved).guestSatisfaction > before.guestSatisfaction,
  );
  const repeated = resolveServiceRequest(resolved, request.id, {
    resolution: "repair",
  });
  assert.strictEqual(repeated, resolved);
  assert.equal(repeated.ledger.length, resolved.ledger.length);
  assert.equal(getCashBalance(repeated), balance - 60);
});

test("repair restores a linked vacant maintenance room while preserving occupied guest rooms", () => {
  const state = setup();
  const maintenance = state.rooms.find((room) => room.status === "maintenance");
  const requested = createServiceRequest(
    state,
    requestInput({
      department: "Maintenance",
      roomId: maintenance.id,
      title: "Repair the cooling unit",
    }),
  );
  const next = resolveServiceRequest(
    requested,
    requested.reputation.requests[0].id,
    { resolution: "repair" },
  );
  assert.equal(
    next.rooms.find((room) => room.id === maintenance.id).status,
    "available",
  );
  assert.equal(next.ledger.at(-1).amount, -120);
  const occupied = state.rooms.find((room) => room.status === "occupied");
  const inHouse = createServiceRequest(
    state,
    requestInput({ department: "Housekeeping", roomId: occupied.id }),
  );
  const followedUp = resolveServiceRequest(
    inHouse,
    inHouse.reputation.requests[0].id,
  );
  assert.equal(
    followedUp.rooms.find((room) => room.id === occupied.id).status,
    "occupied",
  );
});

test("guest request resolution cannot bypass an open equipment event repair", () => {
  const state = setup();
  const room = state.rooms.find((item) => item.status === "maintenance");
  state.simulation = {
    events: [
      {
        id: "equipment-room",
        kind: "equipment",
        status: "open",
        roomId: room.id,
        cost: 850,
      },
    ],
  };
  const requested = createServiceRequest(
    state,
    requestInput({ department: "Maintenance", roomId: room.id }),
  );
  const resolved = resolveServiceRequest(
    requested,
    requested.reputation.requests[0].id,
    { resolution: "repair" },
  );
  assert.equal(resolved.reputation.requests[0].status, "resolved");
  assert.equal(resolved.reputation.requests[0].history.length, 2);
  assert.equal(resolved.ledger.at(-1).amount, -120);
  assert.equal(
    resolved.rooms.find((item) => item.id === room.id).status,
    "maintenance",
  );
  assert.equal(resolved.simulation.events[0].status, "open");
  const cleaning = structuredClone(requested);
  cleaning.rooms.find((item) => item.id === room.id).status = "cleaning";
  cleaning.reputation.requests[0].department = "Housekeeping";
  assert.equal(
    resolveServiceRequest(cleaning, cleaning.reputation.requests[0].id, {
      resolution: "service",
    }).rooms.find((item) => item.id === room.id).status,
    "cleaning",
  );
});

test("resolution goodwill is capped, decays by simulation day and daily settlement is idempotent", () => {
  let state = setup();
  for (let index = 0; index < 12; index += 1) {
    state = createServiceRequest(state, requestInput());
    state = resolveServiceRequest(state, state.reputation.requests[0].id, {
      resolution: "recovery",
    });
  }
  assert.equal(state.reputation.recoveryBoost, 6);
  const previous = structuredClone(state);
  state.date = addDays(state.date, 1);
  const settled = settleReputationDay(state);
  assert.equal(settled.reputation.recoveryBoost, 4.2);
  assert.equal(
    settled.reputation.reviews.length,
    previous.reputation.reviews.length + 1,
  );
  assert.equal(settled.reputation.history.length, 1);
  assert.strictEqual(settleReputationDay(settled), settled);
  assert.equal(settled.reputation.lastSettledDate, state.date);
});

test("returning guests use shared guest identities and cancelled reservations do not create loyalty", () => {
  const state = setup();
  state.reputation.loyalty = [];
  const guest = state.reservations[0].guest;
  const before = getReputationMetrics(state).returningGuests;
  state.reservations.push({
    ...structuredClone(state.reservations[0]),
    id: "repeat-stay",
    status: "checked-out",
    guest: { ...guest, email: guest.email.toUpperCase() },
  });
  assert.equal(getReputationMetrics(state).returningGuests, before + 1);
  state.reservations.at(-1).status = "cancelled";
  assert.equal(getReputationMetrics(state).returningGuests, before);
});

test("requests validate departments, rooms, text and resolution choices", () => {
  const state = setup();
  assert.throws(
    () => createServiceRequest(state, requestInput({ department: "Unknown" })),
    /department/,
  );
  assert.throws(
    () => createServiceRequest(state, requestInput({ guestName: "A" })),
    /guest name/,
  );
  assert.throws(
    () => createServiceRequest(state, requestInput({ roomId: "999" })),
    /existing guest room/,
  );
  assert.throws(
    () => createServiceRequest(state, requestInput({ description: "" })),
    /request details/,
  );
  assert.throws(
    () => resolveServiceRequest(state, "missing"),
    /could not be found/,
  );
  assert.throws(
    () =>
      resolveServiceRequest(state, "request-demo-1", {
        resolution: "unlimited-cash",
      }),
    /resolution method/,
  );
});

test("unrepaired restaurant equipment lowers dining service and fixing the event restores the score", () => {
  const state = setup();
  const before = getReputationMetrics(state);
  state.simulation = {
    events: [
      {
        id: "oven-event",
        kind: "equipment",
        status: "open",
        department: "Food & Beverage",
      },
    ],
  };
  const broken = getReputationMetrics(state);
  assert.ok(broken.guestSatisfaction < before.guestSatisfaction);
  assert.equal(
    broken.departmentRatings.find((team) => team.department === "Kitchen")
      .equipmentPenalty,
    8,
  );
  state.simulation.events[0].status = "resolved";
  assert.equal(
    getReputationMetrics(state).guestSatisfaction,
    before.guestSatisfaction,
  );
});
