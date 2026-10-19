export const TODAY = "2026-10-16";
export const HOTEL_NAME = "The Aurelia";

const DAY = 86400000;
const ROOM_TYPES = [
  "Classic King",
  "Deluxe Twin",
  "Junior Suite",
  "Aurelia Suite",
];
const RATES = {
  "Classic King": 245,
  "Deluxe Twin": 285,
  "Junior Suite": 425,
  "Aurelia Suite": 690,
};
const CAPACITY = {
  "Classic King": 2,
  "Deluxe Twin": 2,
  "Junior Suite": 3,
  "Aurelia Suite": 4,
};
const COLORS = [
  "#a47d59",
  "#698a78",
  "#7c799c",
  "#a77079",
  "#6d8f9e",
  "#ad9459",
];
const NAMES = [
  ["Charlotte Whitmore", "United Kingdom"],
  ["James Anderson", "United States"],
  ["Sofia Rossi", "Italy"],
  ["Oliver Bennett", "United Kingdom"],
  ["Amelia Chen", "Singapore"],
  ["Alexander Laurent", "France"],
  ["Isabella Martinez", "Spain"],
  ["William Thompson", "United States"],
  ["Emma Dubois", "France"],
  ["Henry Williams", "Australia"],
  ["Mia Nakamura", "Japan"],
  ["Sebastian Fischer", "Germany"],
  ["Grace Sullivan", "Ireland"],
  ["Lucas Moreau", "France"],
  ["Ava Robinson", "Canada"],
  ["Theodore Hughes", "United Kingdom"],
  ["Freya Lindberg", "Sweden"],
  ["Leo Campbell", "Australia"],
  ["Camila Oliveira", "Brazil"],
  ["Ethan Brooks", "United States"],
  ["Aria Kapoor", "India"],
  ["Noah Wilson", "Canada"],
  ["Zoe Papadopoulos", "Greece"],
  ["Hugo Schmidt", "Germany"],
  ["Lily Morgan", "United Kingdom"],
  ["Felix Bergström", "Sweden"],
  ["Chloe Bernard", "France"],
  ["Oscar Jensen", "Denmark"],
  ["Elena Petrova", "Bulgaria"],
  ["Daniel Park", "South Korea"],
  ["Nora Eriksson", "Norway"],
  ["Louis Beaumont", "France"],
  ["Victoria Hayes", "United States"],
  ["Matteo Ricci", "Italy"],
  ["Alice Henderson", "United Kingdom"],
  ["Benjamin Clarke", "New Zealand"],
  ["Sophie Laurent", "France"],
  ["Michael Chen", "United States"],
  ["Emma Wilson", "United Kingdom"],
  ["David Kim", "South Korea"],
  ["Isabella Romano", "Italy"],
  ["Oliver James", "Australia"],
  ["Olivia Parker", "Canada"],
  ["Alexander Weber", "Germany"],
  ["Harper Collins", "United States"],
  ["Gabriel Silva", "Portugal"],
  ["Stella Andersson", "Sweden"],
  ["Julian Meier", "Switzerland"],
  ["Ella Taylor", "United Kingdom"],
  ["Adrian Costa", "Spain"],
  ["Ruby Thomas", "Australia"],
  ["Arthur Martin", "France"],
];

const addDays = (date, amount) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + amount * DAY)
    .toISOString()
    .slice(0, 10);
const nightsBetween = (start, end) =>
  Math.round((Date.parse(end) - Date.parse(start)) / DAY);
const clone = (state) => structuredClone(state);
const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const currentReservations = (state) =>
  state.reservations.filter(
    (reservation) => reservation.status === "checked-in",
  );
const dueReservation = (state, roomId) =>
  state.reservations.find(
    (reservation) =>
      reservation.roomId === roomId &&
      reservation.status === "confirmed" &&
      reservation.checkIn <= state.date &&
      reservation.checkOut > state.date,
  );

function requireDate(date, label) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Enter a valid ${label} date.`);
  }
}

function makeGuest(index) {
  const [name, country] = NAMES[index % NAMES.length];
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, ".");
  return {
    name,
    country,
    email: `${slug}@example.com`,
    initials: initials(name),
    color: COLORS[index % COLORS.length],
  };
}

function makeReservation(room, index, checkInDate, checkOutDate, status) {
  const sources = [
    "Direct",
    "Booking.com",
    "Direct",
    "Expedia",
    "Travel agent",
  ];
  return {
    id: `AU-${2401 + index}`,
    guest: makeGuest(index),
    roomId: room.id,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    guests: index % 7 === 0 ? 1 : 2,
    status,
    rate: room.rate,
    total: room.rate * nightsBetween(checkInDate, checkOutDate),
    source: sources[index % sources.length],
    notes:
      index % 9 === 0
        ? "Prefers a quiet room. Feather-free pillows requested."
        : index % 11 === 0
          ? "Celebrating an anniversary. Welcome amenity arranged."
          : "",
  };
}

function roomCharge(state, reservation) {
  const id = `room-${state.date}-${reservation.id}`;
  if (state.ledger.some((entry) => entry.id === id)) return;
  state.ledger.push({
    id,
    date: state.date,
    type: "room",
    amount: reservation.rate,
    soldRooms: 1,
    roomId: reservation.roomId,
    reservationId: reservation.id,
    description: "Room accommodation",
  });
}

function recordActivity(
  state,
  title,
  detail,
  kind = "reservation",
  reservationId,
) {
  const time = new Date().toISOString().slice(11, 16);
  state.activity.unshift({
    id: `activity-${state.date}-${state.activity.length + 1}`,
    date: state.date,
    time,
    title,
    detail,
    type: kind,
    reservationId,
  });
  state.activity = state.activity.slice(0, 100);
}

export function createInitialState() {
  const nonOccupied = new Set([4, 8, 13, 17, 23, 29, 35, 40, 43, 45, 46, 47]);
  const arrivalIndexes = [4, 8, 13, 17, 23, 29, 35, 40];
  const rooms = Array.from({ length: 48 }, (_, index) => {
    const floor = Math.floor(index / 12) + 1;
    const number = `${floor}${String((index % 12) + 1).padStart(2, "0")}`;
    const position = index % 12;
    const type =
      ROOM_TYPES[position < 5 ? 0 : position < 9 ? 1 : position < 11 ? 2 : 3];
    return {
      id: number,
      number,
      floor,
      type,
      rate: RATES[type],
      status: nonOccupied.has(index)
        ? arrivalIndexes.includes(index)
          ? "reserved"
          : index === 46
            ? "cleaning"
            : index === 47
              ? "maintenance"
              : "available"
        : "occupied",
    };
  });
  const reservations = [];
  rooms
    .filter((room) => room.status === "occupied")
    .forEach((room, index) => {
      reservations.push(
        makeReservation(
          room,
          index,
          addDays(TODAY, -((index % 4) + 1)),
          index < 6 ? TODAY : addDays(TODAY, (index % 5) + 1),
          "checked-in",
        ),
      );
    });
  arrivalIndexes.forEach((roomIndex, index) =>
    reservations.push(
      makeReservation(
        rooms[roomIndex],
        36 + index,
        TODAY,
        addDays(TODAY, (index % 4) + 2),
        "confirmed",
      ),
    ),
  );
  [0, 5, 11, 18].forEach((roomIndex, index) => {
    const room = rooms[roomIndex];
    const existing = reservations.find(
      (reservation) => reservation.roomId === room.id,
    );
    const start = addDays(existing.checkOut, index + 2);
    reservations.push(
      makeReservation(room, 44 + index, start, addDays(start, 3), "confirmed"),
    );
  });
  [2, 8, 14, 20].forEach((roomIndex, index) =>
    reservations.push({
      ...makeReservation(
        rooms[roomIndex],
        48 + index,
        addDays(TODAY, -9),
        addDays(TODAY, -5),
        "checked-out",
      ),
      actualCheckOut: addDays(TODAY, -5),
    }),
  );
  const state = { date: TODAY, rooms, reservations, ledger: [], activity: [] };
  // Historical aggregate entries keep the demo useful over both weekly and monthly views.
  for (let daysAgo = 90; daysAgo >= 1; daysAgo--) {
    const date = addDays(TODAY, -daysAgo);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const soldRooms =
      29 + ((daysAgo * 7) % 13) + (weekday === 5 || weekday === 6 ? 4 : 0);
    const adr = 310 + ((daysAgo * 19) % 84);
    state.ledger.push({
      id: `history-room-${date}`,
      date,
      type: "room",
      amount: soldRooms * adr,
      soldRooms,
      description: "Room accommodation",
    });
    state.ledger.push({
      id: `history-food-${date}`,
      date,
      type: "food",
      amount: 1600 + ((daysAgo * 157) % 1150),
      description: "Restaurant & bar",
    });
    state.ledger.push({
      id: `history-spa-${date}`,
      date,
      type: "spa",
      amount: 650 + ((daysAgo * 89) % 900),
      description: "Spa & wellness",
    });
    state.ledger.push({
      id: `history-other-${date}`,
      date,
      type: "other",
      amount: 180 + ((daysAgo * 41) % 300),
      description: "Other services",
    });
  }
  currentReservations(state).forEach((reservation) =>
    roomCharge(state, reservation),
  );
  state.ledger.push(
    {
      id: `food-${TODAY}`,
      date: TODAY,
      type: "food",
      amount: 2180,
      description: "Restaurant & bar",
    },
    {
      id: `spa-${TODAY}`,
      date: TODAY,
      type: "spa",
      amount: 1260,
      description: "Spa & wellness",
    },
    {
      id: `other-${TODAY}`,
      date: TODAY,
      type: "other",
      amount: 340,
      description: "Other services",
    },
  );
  state.activity = [
    {
      id: "initial-1",
      date: TODAY,
      time: "09:42",
      title: "New reservation",
      detail: "Sophie Laurent · Room 105 · 2 nights",
      type: "reservation",
      reservationId: "AU-2437",
    },
    {
      id: "initial-2",
      date: TODAY,
      time: "09:28",
      title: "Room ready",
      detail: "Room 408 is ready to welcome guests",
      type: "housekeeping",
    },
    {
      id: "initial-3",
      date: TODAY,
      time: "09:15",
      title: "Spa appointment confirmed",
      detail: "Grace Sullivan · Signature treatment at 14:00",
      type: "service",
    },
    {
      id: "initial-4",
      date: TODAY,
      time: "08:56",
      title: "Guest request",
      detail: "Charlotte Whitmore · Airport transfer arranged",
      type: "service",
    },
  ];
  return state;
}

export function getRoomStatusCounts(state) {
  return state.rooms.reduce(
    (counts, room) => {
      counts[room.status] = (counts[room.status] || 0) + 1;
      return counts;
    },
    { occupied: 0, available: 0, reserved: 0, cleaning: 0, maintenance: 0 },
  );
}

export function getMetrics(state) {
  const entries = state.ledger.filter((entry) => entry.date === state.date);
  const roomEntries = entries.filter((entry) => entry.type === "room");
  const roomRevenue = roomEntries.reduce(
    (total, entry) => total + entry.amount,
    0,
  );
  const soldRooms = roomEntries.reduce(
    (total, entry) => total + (entry.soldRooms ?? 1),
    0,
  );
  const counts = getRoomStatusCounts(state);
  const arrivals = getDailyActivity(state, "arrivals");
  const departures = getDailyActivity(state, "departures");
  return {
    occupancy: state.rooms.length
      ? (counts.occupied / state.rooms.length) * 100
      : 0,
    adr: soldRooms ? roomRevenue / soldRooms : 0,
    revpar: state.rooms.length ? roomRevenue / state.rooms.length : 0,
    roomRevenue,
    totalRevenue: entries.reduce((total, entry) => total + entry.amount, 0),
    occupiedRooms: counts.occupied,
    totalRooms: state.rooms.length,
    soldRooms,
    arrivals: arrivals.length,
    departures: departures.length,
    availableRooms: counts.available,
    pendingArrivals: arrivals.filter(
      (reservation) => reservation.status === "confirmed",
    ).length,
    pendingDepartures: departures.filter(
      (reservation) => reservation.status === "checked-in",
    ).length,
  };
}

export function getDailyActivity(state, filter = "all") {
  return state.reservations.filter((reservation) => {
    if (reservation.status === "cancelled") return false;
    const arrives =
      reservation.checkIn === state.date ||
      reservation.actualCheckIn === state.date ||
      (reservation.status === "confirmed" &&
        reservation.checkIn < state.date &&
        reservation.checkOut > state.date);
    const departs =
      (reservation.actualCheckOut || reservation.checkOut) === state.date ||
      (reservation.status === "checked-in" &&
        reservation.checkOut < state.date);
    const inhouse = reservation.status === "checked-in";
    return filter === "arrivals"
      ? arrives
      : filter === "departures"
        ? departs
        : filter === "inhouse"
          ? inhouse
          : arrives || departs || inhouse;
  });
}

export function createReservation(state, input) {
  const guestName = String(input.guestName || "").trim();
  if (guestName.length < 2)
    throw new Error("Please enter the guest’s full name.");
  const email = String(input.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid email address.");
  requireDate(input.checkIn, "check-in");
  requireDate(input.checkOut, "check-out");
  if (input.checkIn < state.date)
    throw new Error("A new reservation cannot start in the past.");
  if (input.checkOut <= input.checkIn)
    throw new Error("Check-out must be after check-in.");
  const room = state.rooms.find(
    (candidate) => candidate.id === String(input.roomId),
  );
  if (!room) throw new Error("Please select a valid room.");
  const guests = Number(input.guests ?? 2);
  if (!Number.isInteger(guests) || guests < 1 || guests > CAPACITY[room.type])
    throw new Error(
      `${room.type} accommodates up to ${CAPACITY[room.type]} guests.`,
    );
  const rate =
    input.rate === undefined || input.rate === ""
      ? room.rate
      : Number(input.rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100000)
    throw new Error("The nightly rate must be a positive amount.");
  const conflict = state.reservations.some(
    (reservation) =>
      reservation.roomId === room.id &&
      ["confirmed", "checked-in"].includes(reservation.status) &&
      input.checkIn < reservation.checkOut &&
      input.checkOut > reservation.checkIn,
  );
  if (conflict)
    throw new Error(
      `Room ${room.number} already has a reservation for these dates.`,
    );
  if (
    state.reservations.some(
      (reservation) =>
        reservation.roomId === room.id &&
        reservation.status === "checked-in" &&
        reservation.checkOut < state.date,
    )
  )
    throw new Error(
      `Room ${room.number} is still occupied by an overdue guest. Complete their check-out before accepting another reservation.`,
    );
  if (
    input.checkIn === state.date &&
    ["cleaning", "maintenance"].includes(room.status)
  )
    throw new Error(`Room ${room.number} is not ready for an arrival today.`);
  const next = clone(state);
  const sequence =
    Math.max(
      2400,
      ...next.reservations.map(
        (reservation) => Number(reservation.id.replace(/\D/g, "")) || 0,
      ),
    ) + 1;
  const reservation = {
    id: `AU-${sequence}`,
    guest: {
      name: guestName,
      email,
      country: String(input.country || "Not specified"),
      initials: initials(guestName),
      color: COLORS[sequence % COLORS.length],
    },
    roomId: room.id,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests,
    status: "confirmed",
    rate,
    total: rate * nightsBetween(input.checkIn, input.checkOut),
    source: input.source || "Direct",
    notes: String(input.notes || ""),
  };
  next.reservations.push(reservation);
  if (input.checkIn === state.date && room.status === "available")
    next.rooms.find((candidate) => candidate.id === room.id).status =
      "reserved";
  recordActivity(
    next,
    "New reservation",
    `${guestName} · Room ${room.number} · ${nightsBetween(input.checkIn, input.checkOut)} nights`,
    "reservation",
    reservation.id,
  );
  return next;
}

export function cancelReservation(state, reservationId) {
  const reservation = state.reservations.find(
    (candidate) => candidate.id === reservationId,
  );
  if (!reservation) throw new Error("Reservation not found.");
  if (reservation.status !== "confirmed")
    throw new Error("Only a confirmed reservation can be cancelled.");
  const next = clone(state);
  const updated = next.reservations.find(
    (candidate) => candidate.id === reservationId,
  );
  updated.status = "cancelled";
  updated.cancelledAt = next.date;
  const room = next.rooms.find((candidate) => candidate.id === updated.roomId);
  if (room.status === "reserved" && !dueReservation(next, room.id))
    room.status = "available";
  recordActivity(
    next,
    "Reservation cancelled",
    `${updated.guest.name} · Room ${room.number}`,
    "reservation",
    reservationId,
  );
  return next;
}

export function checkIn(state, reservationId) {
  const reservation = state.reservations.find(
    (candidate) => candidate.id === reservationId,
  );
  if (!reservation) throw new Error("Reservation not found.");
  if (reservation.status !== "confirmed")
    throw new Error("Only a confirmed reservation can be checked in.");
  if (reservation.checkIn > state.date)
    throw new Error("This guest’s arrival date has not been reached.");
  if (reservation.checkOut <= state.date)
    throw new Error(
      "This reservation has expired. Please create a new reservation.",
    );
  const room = state.rooms.find(
    (candidate) => candidate.id === reservation.roomId,
  );
  if (!room || !["available", "reserved"].includes(room.status))
    throw new Error(
      `Room ${reservation.roomId} is not ready for check-in. Please prepare the room first.`,
    );
  if (
    state.reservations.some(
      (candidate) =>
        candidate.id !== reservationId &&
        candidate.roomId === room.id &&
        candidate.status === "checked-in",
    )
  )
    throw new Error(`Room ${room.number} is already occupied.`);
  const next = clone(state);
  const updated = next.reservations.find(
    (candidate) => candidate.id === reservationId,
  );
  updated.status = "checked-in";
  updated.actualCheckIn = next.date;
  next.rooms.find((candidate) => candidate.id === room.id).status = "occupied";
  roomCharge(next, updated);
  recordActivity(
    next,
    "Guest checked in",
    `${updated.guest.name} · Room ${room.number}`,
    "check-in",
    reservationId,
  );
  return next;
}

export function checkOut(state, reservationId) {
  const reservation = state.reservations.find(
    (candidate) => candidate.id === reservationId,
  );
  if (!reservation) throw new Error("Reservation not found.");
  if (reservation.status !== "checked-in")
    throw new Error("Only an in-house guest can be checked out.");
  const next = clone(state);
  const updated = next.reservations.find(
    (candidate) => candidate.id === reservationId,
  );
  updated.status = "checked-out";
  updated.actualCheckOut = next.date;
  const room = next.rooms.find((candidate) => candidate.id === updated.roomId);
  room.status = "cleaning";
  recordActivity(
    next,
    "Guest checked out",
    `${updated.guest.name} · Room ${room.number} sent to housekeeping`,
    "check-out",
    reservationId,
  );
  return next;
}

export function updateRoomStatus(state, roomId, status) {
  const room = state.rooms.find((candidate) => candidate.id === String(roomId));
  if (!room) throw new Error("Room not found.");
  if (
    !["occupied", "available", "reserved", "cleaning", "maintenance"].includes(
      status,
    )
  )
    throw new Error("Choose a valid room status.");
  if (room.status === status) return clone(state);
  if (room.status === "occupied")
    throw new Error("Check out the guest before changing this room’s status.");
  if (status === "occupied")
    throw new Error("Use guest check-in to mark a room as occupied.");
  if (status === "reserved" && !dueReservation(state, room.id))
    throw new Error("This room does not have a reservation due today.");
  const next = clone(state);
  const updated = next.rooms.find((candidate) => candidate.id === room.id);
  updated.status =
    status === "available" && dueReservation(next, room.id)
      ? "reserved"
      : status;
  recordActivity(
    next,
    updated.status === "available" || updated.status === "reserved"
      ? "Room ready"
      : "Room status updated",
    `Room ${room.number} · ${updated.status}`,
    "housekeeping",
  );
  return next;
}

export function advanceDay(state) {
  const pendingDepartures = currentReservations(state).filter(
    (reservation) => reservation.checkOut <= state.date,
  );
  if (pendingDepartures.length)
    throw new Error(
      `Complete check-out for ${pendingDepartures.length} ${pendingDepartures.length === 1 ? "guest" : "guests"} due to depart before advancing the day.`,
    );
  const next = clone(state);
  next.date = addDays(state.date, 1);
  for (const room of next.rooms) {
    if (["available", "reserved"].includes(room.status))
      room.status = dueReservation(next, room.id) ? "reserved" : "available";
  }
  const occupied = currentReservations(next);
  occupied.forEach((reservation) => roomCharge(next, reservation));
  if (occupied.length) {
    next.ledger.push({
      id: `food-${next.date}`,
      date: next.date,
      type: "food",
      amount: occupied.length * 42,
      description: "Restaurant & bar",
    });
    next.ledger.push({
      id: `spa-${next.date}`,
      date: next.date,
      type: "spa",
      amount: occupied.length * 23,
      description: "Spa & wellness",
    });
  }
  recordActivity(
    next,
    "A new day at The Aurelia",
    "Daily room charges posted. Review arrivals, departures, and housekeeping.",
    "system",
  );
  return next;
}

export function getRevenueSeries(state, period = "week") {
  const count =
    period === "month" || period === "30d" ? 30 : period === "quarter" ? 90 : 7;
  const previousOffset = count;
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(state.date, index - count + 1);
    const previousDate = addDays(date, -previousOffset);
    const entries = state.ledger.filter(
      (entry) => entry.date === date && entry.type === "room",
    );
    // A room may generate charges for more than one stay during turnover.
    // Count its inventory once when reporting a completed operating date.
    const individualRooms = new Set(
      entries.filter((entry) => entry.roomId).map((entry) => entry.roomId),
    ).size;
    const aggregateRooms = entries
      .filter((entry) => !entry.roomId)
      .reduce((total, entry) => total + (entry.soldRooms ?? 1), 0);
    const occupiedRooms =
      date === state.date
        ? getRoomStatusCounts(state).occupied
        : Math.min(state.rooms.length, individualRooms + aggregateRooms);
    return {
      date,
      label: new Date(`${date}T12:00:00Z`).toLocaleDateString(
        "en-US",
        count === 7
          ? { weekday: "short", timeZone: "UTC" }
          : { month: "short", day: "numeric", timeZone: "UTC" },
      ),
      revenue: entries.reduce((total, entry) => total + entry.amount, 0),
      previousRevenue: state.ledger
        .filter((entry) => entry.date === previousDate && entry.type === "room")
        .reduce((total, entry) => total + entry.amount, 0),
      occupancy: state.rooms.length
        ? (occupiedRooms / state.rooms.length) * 100
        : 0,
    };
  });
}

export const formatCurrency = (number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(number);
