import { addDays, appendLog, postEntry, roundMoney } from "./business.js";
import { getStaffMetrics } from "./staff.js";

export const SERVICE_DEPARTMENTS = [
  "Front Office",
  "Housekeeping",
  "Restaurant & Bar",
  "Kitchen",
  "Maintenance",
  "Spa & Wellness",
  "Management",
];

export const RESOLUTION_OPTIONS = {
  service: { label: "Personal service follow-up", cost: 0 },
  repair: { label: "Repair / specialist call-out", cost: 120 },
  recovery: { label: "Courtesy credit", cost: 60 },
};

const clamp = (value, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));
const score = (value) => Math.round(clamp(Number(value) || 0) * 10) / 10;
const emailKey = (guest) =>
  String(guest?.email || guest?.name || "")
    .trim()
    .toLowerCase();
const dayDistance = (earlier, later) =>
  Math.max(0, Math.round((Date.parse(later) - Date.parse(earlier)) / 86400000));
const finite = (value, fallback) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const hash = (value) =>
  [...String(value)].reduce(
    (sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );

function staffMetrics(state) {
  if (!Array.isArray(state.employees))
    return {
      headcount: 50,
      satisfaction: 82,
      performance: 84,
      coverage: 1,
      departments: [],
    };
  try {
    return getStaffMetrics(state);
  } catch {
    return {
      headcount: 50,
      satisfaction: 82,
      performance: 84,
      coverage: 1,
      departments: [],
    };
  }
}

function reputationData(state) {
  return state.reputation || createReputationData(state);
}

function guestAt(state, index) {
  return (
    state.reservations?.[index % (state.reservations?.length || 1)]?.guest || {
      name: ["Eleanor Hayes", "Julian Laurent", "Sofia Moretti"][index % 3],
      email: `fictional.guest.${index}@example.com`,
    }
  );
}

export function createReputationData(state) {
  const copy = [
    [
      5,
      "A thoughtful welcome and a beautifully quiet suite. The concierge made our anniversary feel special.",
      "Front Office",
    ],
    [
      4,
      "Excellent dining and a very comfortable stay. Breakfast service was a little slow on our last morning.",
      "Restaurant & Bar",
    ],
    [
      5,
      "Immaculate rooms, discreet service and wonderful attention to detail.",
      "Housekeeping",
    ],
    [
      4,
      "The team arranged a lovely spa afternoon. We would happily return.",
      "Spa & Wellness",
    ],
    [
      4,
      "The air conditioning needed attention, but maintenance responded promptly.",
      "Maintenance",
    ],
    [
      5,
      "A memorable tasting menu and an exceptionally warm welcome.",
      "Kitchen",
    ],
    [
      4,
      "An elegant hotel with a helpful reception team. Our room was not quite ready at arrival.",
      "Front Office",
    ],
    [
      5,
      "Our second visit was as wonderful as the first. The team remembered our preferences.",
      "Management",
    ],
    [
      4,
      "A peaceful room and a very good lounge bar. A small billing query was resolved with care.",
      "Restaurant & Bar",
    ],
    [
      5,
      "Beautifully maintained surroundings and outstanding personal service.",
      "Housekeeping",
    ],
  ];
  const reviews = copy.map(([rating, text, department], index) => {
    const guest = guestAt(state, index);
    return {
      id: `review-demo-${index + 1}`,
      date: addDays(state.date, -(index + 1)),
      guestName: guest.name,
      email: guest.email,
      rating,
      text,
      department,
      source: "Post-stay survey",
    };
  });
  const loyalty = Array.from({ length: 8 }, (_, index) => {
    const guest = guestAt(state, index);
    return {
      email: guest.email,
      guestName: guest.name,
      previousStays: 2 + (index % 4),
      joined: addDays(state.date, -(120 + index * 17)),
    };
  });
  const guest = guestAt(state, 0);
  const secondGuest = guestAt(state, 4);
  return {
    reviews,
    loyalty,
    requests: [
      {
        id: "request-demo-1",
        guestName: guest.name,
        email: guest.email,
        roomId: state.reservations?.[0]?.roomId || "",
        kind: "complaint",
        department: "Restaurant & Bar",
        priority: "standard",
        title: "Breakfast service delay",
        description:
          "Guest waited twenty minutes for breakfast and would appreciate a personal follow-up.",
        status: "open",
        createdDate: state.date,
        history: [{ date: state.date, action: "Opened by guest relations" }],
      },
      {
        id: "request-demo-2",
        guestName: secondGuest.name,
        email: secondGuest.email,
        roomId: state.reservations?.[4]?.roomId || "",
        kind: "request",
        department: "Housekeeping",
        priority: "standard",
        title: "Feather-free pillows",
        description:
          "Please deliver hypoallergenic pillows before the evening turndown.",
        status: "open",
        createdDate: state.date,
        history: [{ date: state.date, action: "Opened by guest relations" }],
      },
      {
        id: "request-demo-3",
        guestName: guestAt(state, 2).name,
        email: guestAt(state, 2).email,
        roomId: "",
        kind: "complaint",
        department: "Front Office",
        priority: "standard",
        title: "Airport transfer clarification",
        description: "Transfer timing was unclear in the confirmation email.",
        status: "resolved",
        createdDate: addDays(state.date, -2),
        resolvedDate: addDays(state.date, -1),
        resolution: "service",
        resolutionNotes:
          "Concierge confirmed the transfer and personally contacted the guest.",
        resolutionCost: 0,
        history: [
          {
            date: addDays(state.date, -2),
            action: "Opened by guest relations",
          },
          {
            date: addDays(state.date, -1),
            action: "Resolved with personal service follow-up",
            cost: 0,
          },
        ],
      },
    ],
    recoveryBoost: 0,
    lastSettledDate: state.date,
    history: [],
  };
}

export function getReputationMetrics(state) {
  const data = reputationData(state);
  const staffing = staffMetrics(state);
  const openRequests = data.requests.filter(
    (request) => request.status === "open",
  );
  const complaints = openRequests.filter(
    (request) => request.kind === "complaint",
  );
  const rooms = state.rooms || [];
  const dirtyRooms = rooms.filter(
    (room) => room.status === "cleaning" || room.status === "dirty",
  ).length;
  const maintenanceRooms = rooms.filter(
    (room) => room.status === "maintenance",
  ).length;
  const weights = [0.18, 0.25, 0.17, 0.1, 0.12, 0.08, 0.1];
  const departmentRatings = SERVICE_DEPARTMENTS.map((department, index) => {
    const team = staffing.departments?.find(
      (item) => item.department === department,
    );
    const coverage = clamp(
      finite(team?.coverage, finite(staffing.coverage, 1)),
      0,
      1,
    );
    const performance = clamp(
      finite(team?.performance, finite(staffing.performance, 84)),
    );
    const satisfaction = clamp(
      finite(team?.satisfaction, finite(staffing.satisfaction, 82)),
    );
    const departmentComplaints = complaints.filter(
      (request) => request.department === department,
    );
    const complaintPenalty = Math.min(
      15,
      departmentComplaints.reduce(
        (sum, request) =>
          sum +
          (request.priority === "urgent" ? 5 : 3) +
          Math.min(3, dayDistance(request.createdDate, state.date)),
        0,
      ),
    );
    const roomPenalty =
      department === "Housekeeping"
        ? Math.min(24, (dirtyRooms / Math.max(1, rooms.length)) * 100)
        : department === "Maintenance"
          ? Math.min(30, (maintenanceRooms / Math.max(1, rooms.length)) * 150)
          : 0;
    const equipmentPenalty =
      department === "Restaurant & Bar" || department === "Kitchen"
        ? Math.min(
            16,
            (state.simulation?.events || []).filter(
              (event) =>
                event.status === "open" &&
                event.kind === "equipment" &&
                !event.roomId,
            ).length * 8,
          )
        : 0;
    return {
      department,
      score: score(
        38 +
          performance * 0.42 +
          satisfaction * 0.1 +
          coverage * 9 -
          (1 - coverage) * 28 -
          complaintPenalty -
          roomPenalty -
          equipmentPenalty,
      ),
      weight: weights[index],
      coverage,
      performance,
      satisfaction,
      openComplaints: departmentComplaints.length,
      complaintPenalty: score(complaintPenalty),
      roomPenalty: score(roomPenalty),
      equipmentPenalty,
    };
  });
  const recentReviews = data.reviews
    .filter((review) => dayDistance(review.date, state.date) <= 90)
    .slice(0, 60);
  const averageRating = recentReviews.length
    ? recentReviews.reduce((sum, review) => sum + review.rating, 0) /
      recentReviews.length
    : 4.4;
  const serviceQuality = departmentRatings.reduce(
    (sum, department) => sum + department.score * department.weight,
    0,
  );
  const recoveryBoost = clamp(finite(data.recoveryBoost, 0), 0, 6);
  const guestSatisfaction = score(
    serviceQuality * 0.8 + averageRating * 20 * 0.2 + recoveryBoost,
  );
  const overdueComplaints = complaints.filter(
    (request) => dayDistance(request.createdDate, state.date) >= 2,
  ).length;
  const reputation = score(
    averageRating * 20 * 0.6 +
      guestSatisfaction * 0.4 -
      Math.min(8, overdueComplaints * 1.5),
  );
  const guestMap = new Map();
  for (const reservation of state.reservations || []) {
    if (reservation.status === "cancelled") continue;
    const key = emailKey(reservation.guest);
    if (!key) continue;
    const member = guestMap.get(key) || {
      email: reservation.guest?.email || "",
      guestName: reservation.guest?.name || "Guest",
      stays: 0,
      previousStays: 0,
    };
    if (["checked-in", "checked-out"].includes(reservation.status))
      member.stays += 1;
    guestMap.set(key, member);
  }
  for (const seeded of data.loyalty || []) {
    const key = emailKey(seeded);
    if (!key) continue;
    const member = guestMap.get(key) || {
      email: seeded.email || "",
      guestName: seeded.guestName || "Guest",
      stays: 0,
      previousStays: 0,
    };
    member.previousStays = Math.max(
      member.previousStays,
      Math.max(0, Number(seeded.previousStays) || 0),
    );
    member.joined = seeded.joined;
    guestMap.set(key, member);
  }
  const loyaltyMembers = [...guestMap.values()]
    .map((member) => {
      const totalStays = member.stays + member.previousStays;
      return {
        ...member,
        totalStays,
        tier:
          totalStays >= 6
            ? "Aurelia Gold"
            : totalStays >= 3
              ? "Aurelia Circle"
              : "Welcome",
      };
    })
    .sort((a, b) => b.totalStays - a.totalStays);
  return {
    guestSatisfaction,
    reputation,
    departmentRatings,
    averageRating: Math.round(averageRating * 100) / 100,
    reviewCount: recentReviews.length,
    loyalGuests: loyaltyMembers.filter((member) => member.totalStays >= 3)
      .length,
    returningGuests: loyaltyMembers.filter((member) => member.totalStays >= 2)
      .length,
    loyaltyMembers,
    openComplaints: complaints.length,
    openRequests: openRequests.length,
    resolvedRequests: data.requests.filter(
      (request) => request.status === "resolved",
    ).length,
    serviceQuality: score(serviceQuality),
    serviceFactors: {
      dirtyRooms,
      maintenanceRooms,
      coverage: clamp(finite(staffing.coverage, 1), 0, 1),
      staffPerformance: score(staffing.performance),
      recoveryBoost: score(recoveryBoost),
      overdueComplaints,
    },
  };
}

export function createServiceRequest(state, input = {}) {
  const guestName = String(input.guestName || "").trim();
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  if (guestName.length < 2 || guestName.length > 80)
    throw new Error("Enter a guest name between 2 and 80 characters.");
  if (title.length < 3 || title.length > 100)
    throw new Error("Enter a request title between 3 and 100 characters.");
  if (description.length < 5 || description.length > 1500)
    throw new Error("Enter request details between 5 and 1,500 characters.");
  if (!SERVICE_DEPARTMENTS.includes(input.department))
    throw new Error("Choose a valid service department.");
  const kind = input.kind || "request";
  const priority = input.priority || "standard";
  if (!["request", "complaint"].includes(kind))
    throw new Error("Choose a service request or complaint.");
  if (!["standard", "urgent"].includes(priority))
    throw new Error("Choose a valid priority.");
  const roomId = String(input.roomId || "");
  if (roomId && !state.rooms.some((room) => room.id === roomId))
    throw new Error("Choose an existing guest room.");
  const next = structuredClone(state);
  next.reputation ||= createReputationData(next);
  let sequence = next.reputation.requests.length + 1;
  while (
    next.reputation.requests.some(
      (request) => request.id === `request-${state.date}-${sequence}`,
    )
  )
    sequence += 1;
  const request = {
    id: `request-${state.date}-${sequence}`,
    guestName,
    email: String(input.email || "")
      .trim()
      .slice(0, 160),
    roomId,
    title,
    description,
    department: input.department,
    kind,
    priority,
    status: "open",
    createdDate: state.date,
    history: [{ date: state.date, action: "Opened by guest relations" }],
  };
  next.reputation.requests.unshift(request);
  appendLog(
    next,
    "Guest service request",
    `${guestName}: ${title} · ${input.department}`,
    "service",
  );
  return next;
}

export function resolveServiceRequest(state, id, input = {}) {
  const data = reputationData(state);
  const original = data.requests.find((request) => request.id === id);
  if (!original) throw new Error("This guest request could not be found.");
  if (original.status === "resolved") return state;
  const resolution = input.resolution || "service";
  const option = RESOLUTION_OPTIONS[resolution];
  if (!option) throw new Error("Choose a valid resolution method.");
  const notes = String(input.notes || "").trim();
  if (notes.length > 1000)
    throw new Error("Keep the resolution note under 1,000 characters.");
  const next = structuredClone(state);
  next.reputation ||= createReputationData(next);
  const request = next.reputation.requests.find((item) => item.id === id);
  request.status = "resolved";
  request.resolvedDate = next.date;
  request.resolution = resolution;
  request.resolutionNotes = notes || option.label;
  request.resolutionCost = option.cost;
  request.history ||= [
    { date: request.createdDate, action: "Opened by guest relations" },
  ];
  request.history.push({
    date: next.date,
    action: `Resolved with ${option.label.toLowerCase()}`,
    notes: request.resolutionNotes,
    cost: option.cost,
  });
  if (option.cost)
    postEntry(next, {
      id: `service-recovery-${request.id}`,
      date: next.date,
      type: "expense",
      category: resolution === "repair" ? "maintenance" : "guest-recovery",
      department: request.department,
      amount: -roundMoney(option.cost),
      cashDelta: -roundMoney(option.cost),
      description: `${option.label}: ${request.title}`,
    });
  // An addressed complaint removes its live penalty; the extra goodwill is capped and fades each day.
  if (request.kind === "complaint")
    next.reputation.recoveryBoost = clamp(
      finite(next.reputation.recoveryBoost, 0) +
        (resolution === "recovery" ? 0.7 : 0.35),
      0,
      6,
    );
  const room = next.rooms.find((item) => item.id === request.roomId);
  const stillOccupied = next.reservations.some(
    (reservation) =>
      reservation.roomId === request.roomId &&
      reservation.status === "checked-in",
  );
  const unresolvedEquipment = (next.simulation?.events || []).some(
    (event) =>
      event.kind === "equipment" &&
      event.status === "open" &&
      event.roomId === request.roomId,
  );
  if (
    room &&
    !stillOccupied &&
    !unresolvedEquipment &&
    ((resolution === "repair" && room.status === "maintenance") ||
      (request.department === "Housekeeping" &&
        resolution === "service" &&
        room.status === "cleaning"))
  ) {
    room.status = next.reservations.some(
      (reservation) =>
        reservation.roomId === room.id &&
        reservation.status === "confirmed" &&
        reservation.checkIn <= next.date &&
        reservation.checkOut > next.date,
    )
      ? "reserved"
      : "available";
  }
  appendLog(
    next,
    "Guest request resolved",
    `${request.guestName}: ${request.title} · ${option.label}${option.cost ? ` · $${option.cost}` : " · no additional cost"}`,
    "service",
  );
  return next;
}

export function settleReputationDay(state) {
  const next = structuredClone(state);
  next.reputation ||= createReputationData(next);
  if (next.reputation.lastSettledDate === next.date) return state;
  next.reputation.recoveryBoost = Math.max(
    0,
    roundMoney(finite(next.reputation.recoveryBoost, 0) * 0.7),
  );
  const metrics = getReputationMetrics(next);
  const departed = next.reservations.filter(
    (reservation) =>
      reservation.status === "checked-out" &&
      reservation.checkOut >= addDays(next.date, -1) &&
      reservation.checkOut <= next.date,
  );
  const inHouse = next.reservations.filter(
    (reservation) => reservation.status === "checked-in",
  );
  const guests = departed.length ? departed : inHouse;
  if (guests.length) {
    const reservation = guests[hash(next.date) % guests.length];
    const guest = reservation.guest;
    const weakest = [...metrics.departmentRatings].sort(
      (a, b) => a.score - b.score,
    )[0];
    const variation = (hash(`${next.date}-${guest.name}`) % 15) - 7;
    const rating = clamp(
      Math.round((metrics.guestSatisfaction + variation) / 20),
      1,
      5,
    );
    const text =
      rating >= 5
        ? "Thoughtful service, a beautifully prepared room and a memorable stay. We look forward to returning."
        : rating >= 4
          ? "A comfortable and elegant stay. The team were attentive, with a little room to improve the pace of service."
          : rating >= 3
            ? `Lovely surroundings, but ${weakest.department.toLowerCase()} service needed more attention. We appreciated the team's willingness to listen.`
            : `Our experience fell short of expectations. ${weakest.department} service requires improvement and a clear follow-up.`;
    const id = `review-${next.date}`;
    if (!next.reputation.reviews.some((review) => review.id === id))
      next.reputation.reviews.unshift({
        id,
        date: next.date,
        guestName: guest.name,
        email: guest.email,
        rating,
        text,
        department: weakest.department,
        source: departed.length ? "Post-stay survey" : "In-house feedback",
      });
    if (
      weakest.score < 72 &&
      next.reputation.requests.filter((request) => request.status === "open")
        .length < 12 &&
      !next.reputation.requests.some(
        (request) => request.id === `service-auto-${next.date}`,
      )
    ) {
      next.reputation.requests.unshift({
        id: `service-auto-${next.date}`,
        guestName: guest.name,
        email: guest.email,
        roomId: reservation.roomId || "",
        title: `${weakest.department} service follow-up`,
        description:
          "The guest reported delayed or inconsistent service. Review staffing coverage and contact the guest personally.",
        kind: "complaint",
        department: weakest.department,
        priority: weakest.score < 55 ? "urgent" : "standard",
        status: "open",
        createdDate: next.date,
        history: [
          { date: next.date, action: "Created from daily guest feedback" },
        ],
      });
      appendLog(
        next,
        "Guest complaint received",
        `${guest.name} · ${weakest.department} service follow-up`,
        "service",
      );
    }
  }
  next.reputation.reviews = next.reputation.reviews.slice(0, 180);
  const finalMetrics = getReputationMetrics(next);
  next.reputation.history.push({
    date: next.date,
    guestSatisfaction: finalMetrics.guestSatisfaction,
    reputation: finalMetrics.reputation,
    openComplaints: finalMetrics.openComplaints,
  });
  next.reputation.history = next.reputation.history.slice(-365);
  next.reputation.lastSettledDate = next.date;
  return next;
}
