import {
  roundMoney,
  postEntry,
  appendLog,
  getCashBalance,
} from "./business.js";

const clone = (state) => structuredClone(state);
const roundQuantity = (value) =>
  Math.round((value + Number.EPSILON) * 1000000) / 1000000;
const channels = ["restaurant", "bar", "room-service"];
const required = (value, label, max = 100) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max)
    throw new Error(`Enter ${label} (up to ${max} characters).`);
  return text;
};
const number = (value, label, min, max, integer = false) => {
  if (value === "" || value === null || typeof value === "boolean")
    throw new Error(`Enter a valid ${label}.`);
  const result = Number(value);
  if (
    !Number.isFinite(result) ||
    result < min ||
    result > max ||
    (integer && !Number.isInteger(result))
  )
    throw new Error(
      `Enter ${label} between ${min} and ${max}${integer ? " as a whole number" : ""}.`,
    );
  return result;
};
function requireDate(date) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error("Enter a valid dining date.");
}
function minutes(time) {
  if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time))
    throw new Error("Enter a valid dining time.");
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) throw new Error("Enter a valid dining time.");
  return hour * 60 + minute;
}
function restaurant(state) {
  if (!state.restaurant) throw new Error("Restaurant data is not initialized.");
  return state.restaurant;
}
function nextId(data, prefix) {
  data.sequence = (Number(data.sequence) || 0) + 1;
  return `${prefix}-${data.sequence}`;
}
function log(state, title, detail, type = "service") {
  appendLog(state, title, detail, type);
}

export function createRestaurantData(date) {
  requireDate(date);
  const inventory = [
    ["beef", "Prime beef", "kg", 180, 45, 12],
    ["fish", "Atlantic salmon", "kg", 180, 32, 12],
    ["rice", "Arborio rice", "kg", 180, 6, 15],
    ["vegetables", "Seasonal vegetables", "kg", 450, 5, 25],
    ["cheese", "Burrata & parmesan", "kg", 140, 16, 12],
    ["dessert", "Patisserie ingredients", "portion", 900, 3.2, 60],
    ["spirits", "Premium spirits", "liter", 130, 24, 10],
    ["wine", "House wine selection", "bottle", 600, 18, 40],
    ["coffee", "Coffee beans", "kg", 50, 22, 5],
    ["juice", "Fresh juice", "liter", 160, 4, 15],
  ].map(([id, name, unit, quantity, unitCost, reorderAt]) => ({
    id,
    name,
    unit,
    quantity,
    unitCost,
    reorderAt,
  }));
  const menu = [
    {
      id: "steak",
      name: "Dry-aged tenderloin",
      category: "Main",
      price: 68,
      channels: ["restaurant", "room-service"],
      recipe: { beef: 0.26, vegetables: 0.18 },
    },
    {
      id: "salmon",
      name: "Citrus Atlantic salmon",
      category: "Main",
      price: 48,
      channels: ["restaurant", "room-service"],
      recipe: { fish: 0.24, vegetables: 0.18 },
    },
    {
      id: "risotto",
      name: "Wild mushroom risotto",
      category: "Main",
      price: 36,
      channels: ["restaurant", "room-service"],
      recipe: { rice: 0.13, vegetables: 0.18, cheese: 0.04 },
    },
    {
      id: "burrata",
      name: "Garden burrata",
      category: "Starter",
      price: 24,
      channels: ["restaurant", "bar", "room-service"],
      recipe: { cheese: 0.125, vegetables: 0.15 },
    },
    {
      id: "dessert",
      name: "Signature chocolate fondant",
      category: "Dessert",
      price: 18,
      channels: ["restaurant", "bar", "room-service"],
      recipe: { dessert: 1 },
    },
    {
      id: "cocktail",
      name: "Aurelia botanical cocktail",
      category: "Bar",
      price: 22,
      channels: ["restaurant", "bar", "room-service"],
      recipe: { spirits: 0.06, juice: 0.12 },
    },
    {
      id: "wine",
      name: "Sommelier's house wine",
      category: "Bar",
      price: 18,
      channels: ["restaurant", "bar", "room-service"],
      recipe: { wine: 0.2 },
    },
    {
      id: "coffee",
      name: "Artisan coffee",
      category: "Bar",
      price: 7,
      channels: ["restaurant", "bar", "room-service"],
      recipe: { coffee: 0.02 },
    },
  ];
  const tables = [
    ...Array.from({ length: 15 }, (_, i) => ({
      id: `R${i + 1}`,
      name: `Table ${i + 1}`,
      channel: "restaurant",
      seats: i < 5 ? 2 : i < 10 ? 4 : 6,
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `B${i + 1}`,
      name: `Lounge ${i + 1}`,
      channel: "bar",
      seats: i < 5 ? 2 : 4,
    })),
  ];
  return {
    tables,
    menu,
    inventory,
    orders: [],
    sequence: 3,
    simulatedDates: [],
    reservations: [
      {
        id: "DIN-1",
        tableId: "R7",
        channel: "restaurant",
        guestName: "Charlotte Whitmore",
        covers: 2,
        date,
        time: "19:00",
        duration: 90,
        status: "confirmed",
      },
      {
        id: "DIN-2",
        tableId: "R12",
        channel: "restaurant",
        guestName: "Alexander Laurent",
        covers: 5,
        date,
        time: "20:00",
        duration: 90,
        status: "confirmed",
      },
      {
        id: "DIN-3",
        tableId: "B6",
        channel: "bar",
        guestName: "Sofia Rossi",
        covers: 3,
        date,
        time: "18:30",
        duration: 60,
        status: "confirmed",
      },
    ],
  };
}

export function getTableAvailability(
  state,
  {
    channel = "restaurant",
    date = state.date,
    time = "19:00",
    duration = 90,
    covers = 1,
  } = {},
) {
  const data = restaurant(state);
  requireDate(date);
  const start = minutes(time);
  const length = number(duration, "duration in minutes", 30, 240, true);
  const guests = number(covers, "party size", 1, 6, true);
  return data.tables
    .filter((table) => table.channel === channel)
    .map((table) => {
      const reservation = data.reservations.find(
        (item) =>
          item.status === "confirmed" &&
          item.tableId === table.id &&
          item.date === date &&
          start < minutes(item.time) + item.duration &&
          minutes(item.time) < start + length,
      );
      const openOrder = data.orders.find(
        (order) =>
          order.tableId === table.id &&
          date === state.date &&
          order.status === "open",
      );
      return {
        ...table,
        available: table.seats >= guests && !reservation && !openOrder,
        reservation,
        openOrder,
        tooSmall: table.seats < guests,
      };
    });
}

export function createTableReservation(state, input) {
  const data = restaurant(state);
  const date = input.date || state.date;
  requireDate(date);
  if (date < state.date)
    throw new Error("Dining reservations cannot be in the past.");
  const table = data.tables.find((item) => item.id === input.tableId);
  if (!table) throw new Error("Choose a dining or lounge table.");
  const covers = number(input.covers, "party size", 1, table.seats, true);
  const duration = number(
    input.duration ?? (table.channel === "restaurant" ? 90 : 60),
    "duration in minutes",
    30,
    240,
    true,
  );
  const start = minutes(input.time);
  if (start < 12 * 60 || start + duration > 24 * 60)
    throw new Error(
      "Tables operate from 12:00 to midnight; the full reservation must fit these hours.",
    );
  const guestName = required(input.guestName, "a guest name");
  if (
    !getTableAvailability(state, {
      channel: table.channel,
      date,
      time: input.time,
      duration,
      covers,
    }).find((item) => item.id === table.id)?.available
  )
    throw new Error(
      "This table is unavailable at that time. Choose another table or time.",
    );
  const next = clone(state);
  next.restaurant.reservations.push({
    id: nextId(next.restaurant, "DIN"),
    date,
    time: input.time,
    duration,
    tableId: table.id,
    channel: table.channel,
    covers,
    guestName,
    status: "confirmed",
  });
  log(
    next,
    "Dining reservation created",
    `${guestName} · ${table.name} · ${date} ${input.time}`,
  );
  return next;
}

export function cancelTableReservation(state, id) {
  const next = clone(state);
  const booking = restaurant(next).reservations.find((item) => item.id === id);
  if (!booking || booking.status !== "confirmed")
    throw new Error("Only a confirmed dining reservation can be cancelled.");
  booking.status = "cancelled";
  log(
    next,
    "Dining reservation cancelled",
    `${booking.guestName} · ${booking.tableId}`,
  );
  return next;
}

export function createOrder(state, input) {
  const data = restaurant(state);
  if (!channels.includes(input.channel))
    throw new Error("Choose restaurant, bar, or room service.");
  const guestName = required(input.guestName, "a guest name");
  let roomId;
  let tableId;
  let reservation;
  if (input.channel === "room-service") {
    const room = state.rooms?.find(
      (item) => String(item.id) === String(input.roomId),
    );
    if (!room || room.status !== "occupied")
      throw new Error("Room service requires an occupied guest room.");
    roomId = room.id;
  } else {
    const table = data.tables.find(
      (item) => item.id === input.tableId && item.channel === input.channel,
    );
    if (!table) throw new Error("Choose a table in the selected venue.");
    if (
      data.orders.some(
        (order) => order.tableId === table.id && order.status === "open",
      )
    )
      throw new Error("Settle the existing open order for this table first.");
    tableId = table.id;
    if (input.reservationId) {
      reservation = data.reservations.find(
        (item) =>
          item.id === input.reservationId &&
          item.tableId === tableId &&
          item.date === state.date &&
          item.status === "confirmed",
      );
      if (!reservation)
        throw new Error("Choose a confirmed reservation for this table today.");
    }
  }
  if (
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > 50
  )
    throw new Error(
      "Add at least one menu item to the order (maximum 50 lines).",
    );
  const merged = new Map();
  input.items.forEach((line) => {
    const item = data.menu.find((candidate) => candidate.id === line.menuId);
    if (!item || !item.channels.includes(input.channel))
      throw new Error("This menu item is unavailable in the selected venue.");
    const quantity = number(line.quantity, "item quantity", 1, 100, true);
    merged.set(item.id, (merged.get(item.id) || 0) + quantity);
  });
  const needs = {};
  const items = [...merged].map(([id, quantity]) => {
    if (quantity > 100)
      throw new Error("Maximum quantity is 100 per menu item.");
    const item = data.menu.find((candidate) => candidate.id === id);
    let unitCost = 0;
    Object.entries(item.recipe).forEach(([inventoryId, usage]) => {
      const stock = data.inventory.find((entry) => entry.id === inventoryId);
      if (!stock) throw new Error(`Missing inventory for ${item.name}.`);
      needs[inventoryId] = roundQuantity(
        (needs[inventoryId] || 0) + usage * quantity,
      );
      unitCost += usage * stock.unitCost;
    });
    return {
      menuId: id,
      name: item.name,
      quantity,
      unitPrice: item.price,
      unitCost: roundMoney(unitCost),
      total: roundMoney(item.price * quantity),
      cost: roundMoney(unitCost * quantity),
    };
  });
  for (const [id, amount] of Object.entries(needs)) {
    const stock = data.inventory.find((entry) => entry.id === id);
    if (stock.quantity + 0.00001 < amount)
      throw new Error(
        `Insufficient ${stock.name.toLowerCase()}. Restock before preparing this order.`,
      );
  }
  const next = clone(state);
  const id = nextId(next.restaurant, "ORD");
  const order = {
    id,
    date: state.date,
    channel: input.channel,
    guestName,
    tableId,
    roomId,
    reservationId: reservation?.id,
    status: "open",
    items,
    total: roundMoney(items.reduce((sum, item) => sum + item.total, 0)),
    cost: roundMoney(items.reduce((sum, item) => sum + item.cost, 0)),
  };
  for (const [inventoryId, amount] of Object.entries(needs)) {
    const stock = next.restaurant.inventory.find(
      (entry) => entry.id === inventoryId,
    );
    stock.quantity = roundQuantity(stock.quantity - amount);
  }
  if (reservation)
    next.restaurant.reservations.find(
      (item) => item.id === reservation.id,
    ).status = "seated";
  next.restaurant.orders.push(order);
  postEntry(next, {
    id: `cogs-${id}`,
    date: next.date,
    type: "expense",
    category: "cogs",
    department: "Restaurant & Bar",
    amount: -order.cost,
    cashDelta: 0,
    description: `Ingredients prepared · ${id}`,
  });
  log(
    next,
    "Order prepared",
    `${id} · ${guestName} · $${order.total.toFixed(2)}`,
  );
  return next;
}

export function payOrder(state, id, method = "card") {
  if (!["card", "cash"].includes(method))
    throw new Error("Choose card or cash payment.");
  const next = clone(state);
  const order = restaurant(next).orders.find((item) => item.id === id);
  if (!order || order.status !== "open")
    throw new Error("Only an unpaid order can be settled.");
  order.status = "paid";
  order.paidDate = state.date;
  order.paymentMethod = method;
  postEntry(next, {
    id: `sale-${order.id}`,
    date: state.date,
    type: "food",
    category: order.channel,
    department: "Restaurant & Bar",
    amount: order.total,
    cashDelta: order.total,
    description: `${order.channel} sale · ${order.id}`,
  });
  log(
    next,
    "Payment received",
    `${order.id} · ${method} · $${order.total.toFixed(2)}`,
  );
  return next;
}

export function updateMenuPrice(state, id, price) {
  const next = clone(state);
  const item = restaurant(next).menu.find((entry) => entry.id === id);
  if (!item) throw new Error("Choose a menu item.");
  item.price = roundMoney(number(price, "menu price", 1, 2000));
  log(
    next,
    "Menu price updated",
    `${item.name} · $${item.price.toFixed(2)} each`,
  );
  return next;
}

export function restockInventory(state, id, quantity, unitCost) {
  const next = clone(state);
  const stock = restaurant(next).inventory.find((item) => item.id === id);
  if (!stock) throw new Error("Choose an inventory item.");
  const units = number(quantity, "restock quantity", 0.01, 10000);
  const cost = roundMoney(number(unitCost, "unit purchase cost", 0.01, 10000));
  const amount = roundMoney(units * cost);
  if (amount > getCashBalance(next))
    throw new Error("Insufficient cash for this stock purchase.");
  const value = stock.quantity * stock.unitCost + amount;
  stock.quantity = roundQuantity(stock.quantity + units);
  stock.unitCost = roundQuantity(value / stock.quantity);
  const transactionId = nextId(next.restaurant, "STK");
  postEntry(next, {
    id: transactionId,
    date: state.date,
    type: "cash",
    category: "inventory",
    department: "Restaurant & Bar",
    amount: -amount,
    cashDelta: -amount,
    description: `${stock.name} · ${units} ${stock.unit}`,
  });
  log(
    next,
    "Inventory restocked",
    `${stock.name} · ${units} ${stock.unit} · $${amount.toFixed(2)}`,
  );
  return next;
}

export function recordWaste(state, id, quantity, reason = "Spoilage") {
  const next = clone(state);
  const stock = restaurant(next).inventory.find((item) => item.id === id);
  if (!stock) throw new Error("Choose an inventory item.");
  const units = number(quantity, "waste quantity", 0.01, 10000);
  if (units > stock.quantity)
    throw new Error("Waste cannot exceed available stock.");
  const description = required(reason, "a waste reason", 180);
  const amount = roundMoney(units * stock.unitCost);
  stock.quantity = roundQuantity(stock.quantity - units);
  const transactionId = nextId(next.restaurant, "WASTE");
  postEntry(next, {
    id: transactionId,
    date: state.date,
    type: "expense",
    category: "waste",
    department: "Restaurant & Bar",
    amount: -amount,
    cashDelta: 0,
    description: `${stock.name} · ${units} ${stock.unit} · ${description}`,
  });
  log(
    next,
    "Food waste recorded",
    `${stock.name} · $${amount.toFixed(2)} · ${description}`,
  );
  return next;
}

export function getRestaurantMetrics(state, date = state.date) {
  const data = restaurant(state);
  const entries = state.ledger.filter((entry) => entry.date === date);
  const sum = (predicate) =>
    roundMoney(
      entries
        .filter(predicate)
        .reduce((total, entry) => total + entry.amount, 0),
    );
  const revenue = sum((entry) => entry.type === "food");
  const cogs = -sum(
    (entry) => entry.type === "expense" && entry.category === "cogs",
  );
  const waste = -sum(
    (entry) => entry.type === "expense" && entry.category === "waste",
  );
  const profit = roundMoney(revenue - cogs - waste);
  return {
    revenue,
    cogs,
    waste,
    foodCost: roundMoney(cogs + waste),
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    restaurantRevenue: sum(
      (entry) => entry.type === "food" && entry.category === "restaurant",
    ),
    barRevenue: sum(
      (entry) => entry.type === "food" && entry.category === "bar",
    ),
    roomServiceRevenue: sum(
      (entry) => entry.type === "food" && entry.category === "room-service",
    ),
    priorSales: sum(
      (entry) => entry.type === "food" && !channels.includes(entry.category),
    ),
    inventoryValue: roundMoney(
      data.inventory.reduce(
        (total, item) => total + item.quantity * item.unitCost,
        0,
      ),
    ),
    receivables: roundMoney(
      data.orders
        .filter((order) => order.status === "open")
        .reduce((total, order) => total + order.total, 0),
    ),
    lowStock: data.inventory.filter((item) => item.quantity <= item.reorderAt),
    paidOrders: data.orders.filter((order) => order.paidDate === date).length,
    openOrders: data.orders.filter((order) => order.status === "open").length,
    restaurantSeats: data.tables
      .filter((item) => item.channel === "restaurant")
      .reduce((sum, item) => sum + item.seats, 0),
    barSeats: data.tables
      .filter((item) => item.channel === "bar")
      .reduce((sum, item) => sum + item.seats, 0),
  };
}

export function simulateRestaurantDay(state) {
  const data = restaurant(state);
  if (data.simulatedDates.includes(state.date)) return state;
  let next = clone(state);
  const occupied = (state.rooms || []).filter(
    (room) => room.status === "occupied",
  );
  const activeEmployees = (state.employees || []).filter(
    (person) =>
      person.status !== "dismissed" &&
      person.active !== false &&
      (!person.payrollStartsAt || person.payrollStartsAt <= state.date) &&
      ["Restaurant & Bar", "Kitchen", "Food & Beverage"].includes(
        person.department,
      ),
  );
  const workingIds = new Set(
    (state.shifts || [])
      .filter((shift) => shift.date === state.date && shift.shift !== "Off")
      .map((shift) => shift.employeeId),
  );
  const working = Array.isArray(state.shifts)
    ? activeEmployees.filter((person) => workingIds.has(person.id))
    : activeEmployees;
  const serviceQuality = activeEmployees.length
    ? activeEmployees.reduce(
        (total, person) =>
          total +
          (Number(person.satisfaction) || 75) * 0.5 +
          (Number(person.performance) || 75) * 0.5,
        0,
      ) / activeEmployees.length
    : 50;
  const staffingFactor = Array.isArray(state.employees)
    ? Math.max(0.2, Math.min(1.2, working.length / 12)) *
      (0.7 + serviceQuality / 300)
    : 1;
  const seasonal =
    Number(state.simulation?.seasonMultiplier) ||
    0.85 + (new Date(`${state.date}T12:00:00Z`).getUTCMonth() % 4) * 0.1;
  const demand = Math.min(
    1.8,
    Math.max(0.5, Number(state.simulation?.demandMultiplier) || 1),
  );
  const marketingLift = Math.min(
    0.5,
    Math.max(0, Number(state.simulation?.marketingLift) || 0),
  );
  const covers = Math.min(
    95,
    Math.max(
      2,
      Math.round(
        (occupied.length * 0.7 + 12) *
          staffingFactor *
          seasonal *
          demand *
          (1 + marketingLift),
      ),
    ),
  );
  const requests = [
    {
      channel: "restaurant",
      tableId: "R1",
      guestName: "Simulated lunch service",
      items: [
        { menuId: "risotto", quantity: Math.ceil(covers * 0.55) },
        { menuId: "wine", quantity: Math.ceil(covers * 0.3) },
      ],
    },
    {
      channel: "restaurant",
      tableId: "R2",
      guestName: "Simulated dinner service",
      items: [
        { menuId: "steak", quantity: Math.ceil(covers * 0.4) },
        { menuId: "salmon", quantity: Math.ceil(covers * 0.35) },
        { menuId: "dessert", quantity: Math.ceil(covers * 0.35) },
      ],
    },
    {
      channel: "bar",
      tableId: "B1",
      guestName: "Simulated lounge service",
      items: [
        { menuId: "cocktail", quantity: Math.ceil(covers * 0.7) },
        { menuId: "wine", quantity: Math.ceil(covers * 0.35) },
        { menuId: "coffee", quantity: Math.ceil(covers * 0.5) },
      ],
    },
  ];
  if (occupied.length)
    requests.push({
      channel: "room-service",
      roomId: occupied[0].id,
      guestName: "Simulated room-service deliveries",
      items: [
        {
          menuId: "burrata",
          quantity: Math.max(1, Math.round(occupied.length * 0.16)),
        },
        {
          menuId: "salmon",
          quantity: Math.max(1, Math.round(occupied.length * 0.1)),
        },
      ],
    });
  requests.forEach((request) => {
    // Service summaries consume ingredients and collect revenue through the same rules as manual orders.
    // A manager's unsettled table is never silently paid by the simulation.
    if (
      request.tableId &&
      next.restaurant.orders.some(
        (order) => order.tableId === request.tableId && order.status === "open",
      )
    ) {
      const free = next.restaurant.tables.find(
        (table) =>
          table.channel === request.channel &&
          !next.restaurant.orders.some(
            (order) => order.tableId === table.id && order.status === "open",
          ),
      );
      if (!free) {
        log(
          next,
          "Dining capacity reduced",
          "All tables have unsettled orders; simulated service could not run.",
        );
        return;
      }
      request.tableId = free.id;
    }
    try {
      const prepared = createOrder(next, request);
      const order = prepared.restaurant.orders.at(-1);
      order.simulated = true;
      next = payOrder(prepared, order.id, "card");
    } catch (error) {
      log(next, "Dining service constrained", error.message, "warning");
    }
  });
  next.restaurant.simulatedDates.push(state.date);
  next.restaurant.reservations.forEach((reservation) => {
    if (reservation.date < state.date && reservation.status === "confirmed")
      reservation.status = "expired";
  });
  return next;
}
