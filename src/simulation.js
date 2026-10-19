import { checkIn, checkOut, createReservation, getMetrics } from "./hotel.js";
import {
  addDays,
  appendLog,
  clamp,
  getCashBalance,
  postEntry,
  postFixedDailyExpenses,
  roundMoney,
} from "./business.js";
import {
  ensureDailyShifts,
  getStaffMetrics,
  postDailyPayroll,
  scheduleShift,
  settleEmployeeDay,
} from "./staff.js";
import { simulateRestaurantDay } from "./restaurant.js";
import {
  createServiceRequest,
  getReputationMetrics,
  settleReputationDay,
} from "./reputation.js";

const BASE_RATES = {
  "Classic King": 245,
  "Deluxe Twin": 285,
  "Junior Suite": 425,
  "Aurelia Suite": 690,
};
const SEASONS = [
  0.75, 0.78, 0.88, 0.98, 1.06, 1.12, 1.17, 1.14, 1.08, 1, 0.82, 1.1,
];
const CHANNELS = [
  "Direct booking",
  "Luxury travel partners",
  "Restaurant discovery",
];
const FIRST_NAMES = [
  "Avery",
  "Jordan",
  "Morgan",
  "Alexis",
  "Rowan",
  "Harper",
  "Ellis",
  "Cameron",
  "Taylor",
  "Quinn",
  "Luca",
  "Amara",
  "Sienna",
  "Theo",
  "Camille",
  "Noah",
];
const LAST_NAMES = [
  "Brook",
  "Vale",
  "Hart",
  "Arden",
  "Reed",
  "Blake",
  "Monroe",
  "Finch",
  "Laurent",
  "Cole",
  "Everett",
  "Sinclair",
  "Duarte",
  "Rowe",
  "Ellis",
  "Hayes",
];
const ordinal = (date) =>
  Math.floor(Date.parse(`${date}T12:00:00Z`) / 86400000);
const activeCampaign = (campaign, date) =>
  campaign.status === "active" &&
  campaign.startDate <= date &&
  campaign.endDate >= date;

// Hotel commands validate against the complete room/stay inventory but only
// need today's financial postings. Keep the growing departmental histories out
// of their defensive clones when settling many operating days at once.
function hotelOperation(state, operation, ...args) {
  const todaysEntries = state.ledger.filter(
    (entry) => entry.date === state.date,
  );
  const core = operation(
    {
      date: state.date,
      rooms: state.rooms,
      reservations: state.reservations,
      ledger: todaysEntries,
      activity: state.activity,
    },
    ...args,
  );
  const ids = new Set(todaysEntries.map((entry) => entry.id));
  state.rooms = core.rooms;
  state.reservations = core.reservations;
  state.activity = core.activity;
  state.ledger.push(...core.ledger.filter((entry) => !ids.has(entry.id)));
  return state;
}

export function createSimulationData(state) {
  const baseRates = Object.fromEntries(
    Object.keys(BASE_RATES).map((type) => [
      type,
      state.rooms.find((room) => room.type === type)?.rate || BASE_RATES[type],
    ]),
  );
  return {
    pricing: { dynamic: false, baseRates, multiplier: 1 },
    campaigns: [],
    events: [],
    history: [],
    settledDates: [],
    seasonMultiplier: SEASONS[Number(state.date.slice(5, 7)) - 1],
    demandMultiplier: 1,
    marketingLift: 0,
    lastReport: null,
  };
}

export function getMarketContext(state) {
  const month = Number(state.date.slice(5, 7)) - 1;
  const seasonMultiplier = SEASONS[month];
  const weekday = new Date(`${state.date}T12:00:00Z`).getUTCDay();
  const weekend = weekday === 5 || weekday === 6;
  const reference = 350 * seasonMultiplier * (weekend ? 1.07 : 1);
  const competitors = [
    {
      name: "Maison Bellhaven",
      positioning: "Boutique luxury · 5★",
      rate: roundMoney(reference * 0.96),
    },
    {
      name: "The Veridian Grand",
      positioning: "City landmark · 5★",
      rate: roundMoney(reference * 1.12),
    },
    {
      name: "Palais de Lune",
      positioning: "Design & spa · 5★",
      rate: roundMoney(reference * 1.04),
    },
  ];
  const competitorRate = roundMoney(
    competitors.reduce((sum, hotel) => sum + hotel.rate, 0) /
      competitors.length,
  );
  const averageRate = roundMoney(
    state.rooms.reduce((sum, room) => sum + room.rate, 0) /
      Math.max(1, state.rooms.length),
  );
  const reputation = getReputationMetrics(state);
  const frontOffice = getStaffMetrics(state).departments.find(
    (department) => department.department === "Front Office",
  );
  const campaigns = (state.simulation?.campaigns || []).filter((campaign) =>
    activeCampaign(campaign, state.date),
  );
  const marketingLift = clamp(
    campaigns.reduce((sum, campaign) => sum + campaign.lift, 0),
    0,
    0.45,
  );
  const priceFactor = clamp(
    competitorRate / Math.max(100, averageRate),
    0.45,
    1.3,
  );
  const serviceFactor = 0.55 + 0.45 * (frontOffice?.coverage ?? 1);
  const reputationFactor = 0.72 + reputation.reputation / 280;
  const demand = clamp(
    (0.76 + (weekend ? 0.06 : 0)) *
      seasonMultiplier *
      priceFactor *
      reputationFactor *
      serviceFactor *
      (1 + marketingLift),
    0.12,
    0.98,
  );
  return {
    seasonMultiplier,
    season:
      seasonMultiplier >= 1.1
        ? "High season"
        : seasonMultiplier < 0.9
          ? "Quiet season"
          : "Shoulder season",
    weekend,
    competitors,
    competitorRate,
    averageRate,
    marketingLift,
    priceFactor,
    serviceFactor,
    reputationFactor,
    targetOccupancy: roundMoney(demand * 100),
    demandMultiplier: roundMoney(demand / 0.76),
  };
}

export function updatePricing(state, input = {}) {
  const next = structuredClone(state);
  next.simulation ||= createSimulationData(next);
  const pricing = next.simulation.pricing;
  if (input.dynamic !== undefined) {
    if (typeof input.dynamic !== "boolean")
      throw new Error("Choose whether dynamic pricing is enabled.");
    pricing.dynamic = input.dynamic;
  }
  if (input.multiplier !== undefined) {
    const multiplier = Number(input.multiplier);
    if (!Number.isFinite(multiplier) || multiplier < 0.6 || multiplier > 2)
      throw new Error("Pricing adjustment must be between 60% and 200%.");
    pricing.multiplier = multiplier;
  }
  if (input.type !== undefined) {
    if (!Object.hasOwn(pricing.baseRates, input.type))
      throw new Error("Choose a valid room category.");
    const rate = Number(input.rate);
    if (!Number.isFinite(rate) || rate < 100 || rate > 3000)
      throw new Error("Set a nightly room rate between $100 and $3,000.");
    pricing.baseRates[input.type] = roundMoney(rate);
  }
  applyDailyPricing(next);
  appendLog(
    next,
    "Room pricing updated",
    "New reservations use the published rates. Existing booked rates remain protected.",
  );
  return next;
}

function applyDailyPricing(state) {
  const pricing = state.simulation.pricing;
  const market = getMarketContext(state);
  const dynamicFactor = pricing.dynamic
    ? market.seasonMultiplier * (market.weekend ? 1.07 : 1)
    : 1;
  for (const room of state.rooms)
    room.rate = roundMoney(
      clamp(
        pricing.baseRates[room.type] * pricing.multiplier * dynamicFactor,
        100,
        3000,
      ),
    );
}

export function launchCampaign(state, input) {
  const name = String(input.name || "Aurelia seasonal invitation").trim();
  const channel = input.channel || CHANNELS[0];
  const dailyBudget = Number(input.dailyBudget);
  const duration = Number(input.duration);
  if (name.length < 3 || name.length > 80)
    throw new Error("Campaign name must contain 3–80 characters.");
  if (!CHANNELS.includes(channel))
    throw new Error("Choose a valid marketing channel.");
  if (!Number.isFinite(dailyBudget) || dailyBudget < 25 || dailyBudget > 2000)
    throw new Error("Daily campaign spend must be between $25 and $2,000.");
  if (!Number.isInteger(duration) || duration < 1 || duration > 30)
    throw new Error("Campaign duration must be 1–30 days.");
  if (getCashBalance(state) < dailyBudget)
    throw new Error("Insufficient cash to fund the campaign’s first day.");
  if (
    (state.simulation?.campaigns || []).filter((campaign) =>
      activeCampaign(campaign, state.date),
    ).length >= 3
  )
    throw new Error(
      "Up to three campaigns can run at once. Pause one before adding another.",
    );
  const next = structuredClone(state);
  next.simulation ||= createSimulationData(next);
  const id = `campaign-${next.date}-${next.simulation.campaigns.length + 1}`;
  const lift = roundMoney(
    Math.min(0.2, 0.04 + dailyBudget / 3000) *
      (channel === "Restaurant discovery" ? 0.6 : 1),
  );
  const campaign = {
    id,
    name,
    channel,
    dailyBudget: roundMoney(dailyBudget),
    duration,
    startDate: next.date,
    endDate: addDays(next.date, duration - 1),
    lift,
    status: "active",
  };
  next.simulation.campaigns.unshift(campaign);
  postCampaignExpense(next, campaign);
  appendLog(
    next,
    "Marketing campaign launched",
    `${name}: $${campaign.dailyBudget}/day for ${duration} days; estimated booking demand +${Math.round(lift * 100)}%. First day charged now.`,
  );
  return next;
}

export function pauseCampaign(state, campaignId) {
  const next = structuredClone(state);
  const campaign = next.simulation?.campaigns.find(
    (item) => item.id === campaignId,
  );
  if (!campaign || campaign.status !== "active")
    throw new Error("Choose an active campaign.");
  campaign.status = "paused";
  appendLog(
    next,
    "Campaign paused",
    `${campaign.name}: future daily charges and demand lift stopped. Recognized spend is retained.`,
  );
  return next;
}

function postCampaignExpense(state, campaign) {
  postEntry(state, {
    id: `${campaign.id}-${state.date}`,
    type: "expense",
    category: "marketing",
    department: "Management",
    amount: -campaign.dailyBudget,
    campaignId: campaign.id,
    description: `Campaign: ${campaign.name}`,
  });
}

function settleCampaigns(state) {
  for (const campaign of state.simulation.campaigns) {
    if (campaign.status === "active" && state.date > campaign.endDate)
      campaign.status = "completed";
    if (!activeCampaign(campaign, state.date)) continue;
    if (getCashBalance(state) < campaign.dailyBudget) {
      campaign.status = "paused";
      appendLog(
        state,
        "Campaign paused for cash",
        `${campaign.name}: daily spend would exceed available cash.`,
      );
    } else postCampaignExpense(state, campaign);
  }
}

export function resolveEvent(state, eventId) {
  const event = state.simulation?.events.find((item) => item.id === eventId);
  if (!event || event.status !== "open")
    throw new Error("This event is already resolved or unavailable.");
  if (event.kind !== "equipment")
    throw new Error(
      "This event is informational; review staffing or guest-service actions in its department.",
    );
  if (getCashBalance(state) < event.cost)
    throw new Error("Insufficient cash for this repair.");
  const next = structuredClone(state);
  const updated = next.simulation.events.find((item) => item.id === eventId);
  postEntry(next, {
    id: `repair-${event.id}`,
    type: "expense",
    category: "maintenance",
    department: "Maintenance",
    amount: -event.cost,
    description: event.title,
  });
  updated.status = "resolved";
  updated.resolvedAt = next.date;
  if (event.roomId) {
    const room = next.rooms.find((item) => item.id === event.roomId);
    const otherOpenRepair = next.simulation.events.some(
      (item) =>
        item.id !== eventId &&
        item.roomId === event.roomId &&
        item.status === "open" &&
        item.kind === "equipment",
    );
    if (room?.status === "maintenance" && !otherOpenRepair)
      room.status = "cleaning";
  }
  appendLog(
    next,
    "Equipment repaired",
    `${event.title}. $${event.cost} charged once.${event.roomId ? " Room is ready for housekeeping." : " Service disruption ended."}`,
  );
  return next;
}

function createOperationalEvents(state) {
  const serial = ordinal(state.date);
  if (serial % 7 === 0) {
    const id = `equipment-${state.date}`;
    if (!state.simulation.events.some((event) => event.id === id)) {
      const candidates = state.rooms.filter(
        (room) => room.status !== "occupied" && room.status !== "maintenance",
      );
      const room = candidates[serial % Math.max(1, candidates.length)];
      const cost = room ? 620 : 850;
      if (room) room.status = "maintenance";
      state.simulation.events.unshift({
        id,
        date: state.date,
        kind: "equipment",
        status: "open",
        title: room
          ? `Climate control fault · Room ${room.number}`
          : "Restaurant refrigeration fault",
        detail: room
          ? "Room removed from sale until repaired and cleaned. Existing reservations remain in place."
          : "Restaurant service quality reduced by 8 points until repaired.",
        roomId: room?.id,
        department: room ? "Maintenance" : "Restaurant & Bar",
        cost,
      });
    }
  }
  if (serial % 5 === 0) {
    const eligible = state.employees.filter(
      (employee) =>
        employee.status === "active" &&
        state.shifts.some(
          (shift) =>
            shift.employeeId === employee.id &&
            shift.date === state.date &&
            shift.shift !== "Off",
        ),
    );
    const employee = eligible[serial % Math.max(1, eligible.length)];
    if (employee) {
      state = scheduleShift(state, {
        employeeId: employee.id,
        date: state.date,
        shift: "Off",
      });
      state.simulation.events.unshift({
        id: `absence-${state.date}`,
        date: state.date,
        kind: "staffing",
        status: "recorded",
        title: `Unexpected absence · ${employee.department}`,
        detail: `${employee.name} is off today. Department coverage falls by one shift; payroll remains payable. Reassign an available colleague in Employees & HR.`,
        department: employee.department,
        employeeId: employee.id,
        cost: 0,
      });
    }
  }
  if (serial % 9 === 0) {
    const guest = state.reservations.find(
      (reservation) => reservation.status === "checked-in",
    );
    if (guest) {
      state = createServiceRequest(state, {
        guestName: guest.guest.name,
        email: guest.guest.email,
        roomId: guest.roomId,
        department: "Housekeeping",
        kind: "complaint",
        priority: "standard",
        title: "Evening turndown follow-up",
        description:
          "Our fictional guest reports a missed turndown request. Please contact the guest and coordinate a service recovery.",
      });
      state.simulation.events.unshift({
        id: `guest-issue-${state.date}`,
        date: state.date,
        kind: "guest",
        status: "recorded",
        title: "Guest service recovery requested",
        detail: `${guest.guest.name} · Room ${guest.roomId}. A complaint is now tracked in Guest experience; resolve it there to restore service confidence.`,
        department: "Housekeeping",
        cost: 0,
      });
    }
  }
  return state;
}

function prepareRooms(state) {
  const housekeeping = getStaffMetrics(state).departments.find(
    (department) => department.department === "Housekeeping",
  );
  let capacity = (housekeeping?.scheduled || 0) * 5;
  let cleaned = 0;
  const due = (roomId) =>
    state.reservations.some(
      (reservation) =>
        reservation.roomId === roomId &&
        reservation.status === "confirmed" &&
        reservation.checkIn <= state.date &&
        reservation.checkOut > state.date,
    );
  for (const room of [...state.rooms].sort(
    (a, b) => Number(due(b.id)) - Number(due(a.id)),
  )) {
    if (room.status === "cleaning" && capacity > 0) {
      room.status = due(room.id) ? "reserved" : "available";
      capacity--;
      cleaned++;
    }
    if (["available", "reserved"].includes(room.status))
      room.status = due(room.id) ? "reserved" : "available";
  }
  return cleaned;
}

function admitGuests(state) {
  let next = state;
  const frontOffice = getStaffMetrics(next).departments.find(
    (department) => department.department === "Front Office",
  );
  let capacity = (frontOffice?.scheduled || 0) * 12;
  let arrivals = 0;
  for (const reservation of next.reservations.filter(
    (item) =>
      item.status === "confirmed" &&
      item.checkIn <= next.date &&
      item.checkOut > next.date,
  )) {
    const room = next.rooms.find((item) => item.id === reservation.roomId);
    if (
      capacity > 0 &&
      ["available", "reserved"].includes(room?.status) &&
      !next.reservations.some(
        (item) => item.roomId === room.id && item.status === "checked-in",
      )
    ) {
      next = hotelOperation(next, checkIn, reservation.id);
      capacity--;
      arrivals++;
    }
  }
  const market = getMarketContext(next);
  const target = Math.round((next.rooms.length * market.targetOccupancy) / 100);
  const serial = ordinal(next.date);
  let walkIns = 0;
  for (const room of next.rooms.filter((item) => item.status === "available")) {
    if (
      !capacity ||
      next.rooms.filter((item) => item.status === "occupied").length >= target
    )
      break;
    let nights = 1 + ((serial + walkIns) % 4);
    while (
      nights > 0 &&
      next.reservations.some(
        (reservation) =>
          reservation.roomId === room.id &&
          ["confirmed", "checked-in"].includes(reservation.status) &&
          next.date < reservation.checkOut &&
          addDays(next.date, nights) > reservation.checkIn,
      )
    )
      nights--;
    if (!nights) continue;
    const first = FIRST_NAMES[(serial + walkIns * 3) % FIRST_NAMES.length];
    const last =
      LAST_NAMES[(Math.floor(serial / 3) + walkIns * 5) % LAST_NAMES.length];
    next = hotelOperation(next, createReservation, {
      guestName: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}.${serial}.${walkIns}@example.com`,
      country: "Fictional guest",
      roomId: room.id,
      checkIn: next.date,
      checkOut: addDays(next.date, nights),
      guests: 2,
      source: "Direct",
      notes: "Simulated market demand. Fictional guest and reservation.",
    });
    next = hotelOperation(next, checkIn, next.reservations.at(-1).id);
    capacity--;
    walkIns++;
  }
  return { state: next, arrivals: arrivals + walkIns, walkIns, market };
}

function dailySnapshot(state, report = {}) {
  const entries = state.ledger.filter((entry) => entry.date === state.date);
  const revenue = entries
    .filter((entry) =>
      ["room", "food", "bar", "room-service", "spa", "other"].includes(
        entry.type,
      ),
    )
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = -entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const metrics = getMetrics(state);
  return {
    date: state.date,
    occupancy: roundMoney(metrics.occupancy),
    occupied: metrics.occupiedRooms,
    adr: roundMoney(metrics.adr),
    revpar: roundMoney(metrics.revpar),
    revenue: roundMoney(revenue),
    expenses: roundMoney(expenses),
    operatingProfit: roundMoney(revenue - expenses),
    profitMargin: revenue
      ? roundMoney(((revenue - expenses) / revenue) * 100)
      : 0,
    cashBalance: getCashBalance(state),
    guestSatisfaction: getReputationMetrics(state).guestSatisfaction,
    employeeSatisfaction: getStaffMetrics(state).satisfaction,
    ...report,
  };
}

function operationalFields(snapshot = {}) {
  return Object.fromEntries(
    ["arrivals", "departures", "cleaned", "walkIns", "marketDemand"]
      .filter((field) => Object.hasOwn(snapshot, field))
      .map((field) => [field, snapshot[field]]),
  );
}

// Today's operating row remains live after manual payments, training, repairs,
// and guest movements. Closed dates retain their final point-in-time scores.
export function getOperatingHistory(state) {
  return (state.simulation?.history || []).map((snapshot) =>
    snapshot.date === state.date
      ? dailySnapshot(state, operationalFields(snapshot))
      : snapshot,
  );
}

export function advanceSimulation(state, days = 1) {
  if (![1, 7, 30].includes(days))
    throw new Error("Advance the simulation by one day, one week, or 30 days.");
  let next = structuredClone(state);
  next.simulation ||= createSimulationData(next);
  const startDate = next.date;
  let totalArrivals = 0,
    totalDepartures = 0,
    totalCleaned = 0;
  for (let day = 0; day < days; day++) {
    // Close the operating day before tomorrow's departures change occupancy.
    // Manual departmental transactions made since the prior advance belong
    // in this final snapshot as well as in the shared financial ledger.
    const currentIndex = next.simulation.history.findIndex(
      (snapshot) => snapshot.date === next.date,
    );
    const closingSnapshot = dailySnapshot(
      next,
      operationalFields(next.simulation.history[currentIndex]),
    );
    if (currentIndex < 0) next.simulation.history.push(closingSnapshot);
    else next.simulation.history[currentIndex] = closingSnapshot;
    const newDate = addDays(next.date, 1);
    let departures = 0;
    for (const reservation of next.reservations.filter(
      (item) => item.status === "checked-in" && item.checkOut <= newDate,
    )) {
      next = hotelOperation(next, checkOut, reservation.id);
      next.reservations.find(
        (item) => item.id === reservation.id,
      ).actualCheckOut =
        reservation.checkOut < next.date ? next.date : reservation.checkOut;
      if (next.activity[0]?.type === "check-out")
        next.activity[0].date = next.reservations.find(
          (item) => item.id === reservation.id,
        ).actualCheckOut;
      departures++;
    }
    next.date = newDate;
    next = ensureDailyShifts(next);
    for (const reservation of next.reservations.filter(
      (item) => item.status === "confirmed" && item.checkOut <= next.date,
    )) {
      reservation.status = "cancelled";
      reservation.cancelledAt = next.date;
      reservation.cancellationReason = "Simulated no-show; stay dates expired.";
    }
    settleCampaigns(next);
    applyDailyPricing(next);
    next = createOperationalEvents(next);
    const cleaned = prepareRooms(next);
    const admission = admitGuests(next);
    next = admission.state;
    Object.assign(next.simulation, {
      seasonMultiplier: admission.market.seasonMultiplier,
      demandMultiplier: admission.market.demandMultiplier,
      marketingLift: admission.market.marketingLift,
    });
    for (const reservation of next.reservations.filter(
      (item) => item.status === "checked-in",
    ))
      postEntry(next, {
        id: `room-${next.date}-${reservation.id}`,
        type: "room",
        amount: reservation.rate,
        soldRooms: 1,
        roomId: reservation.roomId,
        reservationId: reservation.id,
        department: "Front Office",
        description: "Room accommodation",
      });
    const occupied = next.rooms.filter(
      (room) => room.status === "occupied",
    ).length;
    const spa = getStaffMetrics(next).departments.find(
      (department) => department.department === "Spa & Wellness",
    );
    if (occupied) {
      postEntry(next, {
        id: `spa-${next.date}`,
        type: "spa",
        department: "Spa & Wellness",
        amount: roundMoney(occupied * 23 * (spa?.coverage ?? 1)),
        description: "Simulated spa & wellness treatments",
      });
      postEntry(next, {
        id: `other-${next.date}`,
        type: "other",
        department: "Front Office",
        amount: occupied * 9,
        description: "Simulated transfers & guest services",
      });
    }
    next = simulateRestaurantDay(next);
    next = postDailyPayroll(next);
    next = postFixedDailyExpenses(next);
    next = settleEmployeeDay(next);
    next = settleReputationDay(next);
    next.simulation.settledDates.push(next.date);
    next.simulation.history.push(
      dailySnapshot(next, {
        arrivals: admission.arrivals,
        departures,
        cleaned,
        walkIns: admission.walkIns,
        marketDemand: admission.market.targetOccupancy,
      }),
    );
    totalArrivals += admission.arrivals;
    totalDepartures += departures;
    totalCleaned += cleaned;
  }
  next.simulation.history = next.simulation.history.slice(-400);
  next.simulation.lastReport = {
    startDate,
    endDate: next.date,
    days,
    arrivals: totalArrivals,
    departures: totalDepartures,
    cleaned: totalCleaned,
    revenue: roundMoney(
      next.simulation.history
        .slice(-days)
        .reduce((sum, item) => sum + item.revenue, 0),
    ),
    operatingProfit: roundMoney(
      next.simulation.history
        .slice(-days)
        .reduce((sum, item) => sum + item.operatingProfit, 0),
    ),
  };
  appendLog(
    next,
    `Simulation advanced ${days} ${days === 1 ? "day" : "days"}`,
    `${totalArrivals} arrivals, ${totalDepartures} departures, ${totalCleaned} rooms cleaned. All departmental revenue, inventory, payroll and service scores settled.`,
  );
  return next;
}

export { CHANNELS as MARKETING_CHANNELS };
