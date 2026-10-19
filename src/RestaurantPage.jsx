import React, { useEffect, useMemo, useState } from "react";
import {
  UtensilsCrossed,
  Wine,
  ConciergeBell,
  Plus,
  CreditCard,
  Package,
  UsersRound,
  Check,
  Clock3,
  ArrowUpRight,
} from "lucide-react";
import {
  createTableReservation,
  cancelTableReservation,
  getTableAvailability,
  createOrder,
  payOrder,
  updateMenuPrice,
  restockInventory,
  recordWaste,
  getRestaurantMetrics,
} from "./restaurant.js";
import "./restaurant.css";

const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
const venues = {
  restaurant: "The Gilded Table",
  bar: "The Conservatory Bar",
  "room-service": "In-room dining",
};
const venueIcons = {
  restaurant: UtensilsCrossed,
  bar: Wine,
  "room-service": ConciergeBell,
};
const sum = (items) =>
  items.reduce((total, item) => total + Number(item || 0), 0);

export default function RestaurantPage({ state, act, onNavigate }) {
  const data = state.restaurant;
  const metrics = getRestaurantMetrics(state);
  const [tab, setTab] = useState("floor");
  const [venue, setVenue] = useState("restaurant");
  const [date, setDate] = useState(state.date);
  const [time, setTime] = useState("19:00");
  const [covers, setCovers] = useState("2");
  const [duration, setDuration] = useState("90");
  const [selected, setSelected] = useState("R1");
  const [guest, setGuest] = useState("");
  const [orderChannel, setOrderChannel] = useState("restaurant");
  const [orderTable, setOrderTable] = useState("R1");
  const [orderRoom, setOrderRoom] = useState("");
  const [orderGuest, setOrderGuest] = useState("");
  const [orderReservation, setOrderReservation] = useState("");
  const [quantities, setQuantities] = useState({});
  const [paymentMethods, setPaymentMethods] = useState({});
  const [stockId, setStockId] = useState(data.inventory[0]?.id || "");
  const [stockMode, setStockMode] = useState("restock");
  const [stockQuantity, setStockQuantity] = useState("10");
  const [stockCost, setStockCost] = useState(
    String(data.inventory[0]?.unitCost || 0),
  );
  const [wasteReason, setWasteReason] = useState("Spoilage");
  const [showPaid, setShowPaid] = useState(false);
  useEffect(() => {
    setDate((current) => (current < state.date ? state.date : current));
  }, [state.date]);
  const floor = useMemo(() => {
    try {
      return getTableAvailability(state, {
        channel: venue,
        date,
        time,
        covers,
        duration,
      });
    } catch {
      return data.tables
        .filter((table) => table.channel === venue)
        .map((table) => ({ ...table, available: false }));
    }
  }, [state, venue, date, time, covers, duration]);
  const selectedTable = floor.find((table) => table.id === selected);
  const occupiedRooms = state.rooms.filter(
    (room) => room.status === "occupied",
  );
  const menu = data.menu.filter((item) => item.channels.includes(orderChannel));
  const orderTotal = sum(
    menu.map((item) => item.price * Number(quantities[item.id] || 0)),
  );
  const orders = [...data.orders]
    .reverse()
    .filter((order) => showPaid || order.status === "open");
  const employees = (state.employees || []).filter(
    (employee) =>
      employee.status !== "dismissed" &&
      employee.active !== false &&
      ["Restaurant & Bar", "Kitchen", "Food & Beverage"].includes(
        employee.department,
      ),
  );
  const selectedStock = data.inventory.find((item) => item.id === stockId);
  const activeBookings = data.reservations
    .filter(
      (booking) =>
        booking.date === date &&
        booking.channel === venue &&
        booking.status !== "cancelled",
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  function reserve(event) {
    event.preventDefault();
    if (
      act(
        (current) =>
          createTableReservation(current, {
            tableId: selected,
            guestName: guest,
            covers,
            date,
            time,
            duration,
          }),
        "Dining reservation confirmed.",
      )
    )
      setGuest("");
  }
  function prepare(event) {
    event.preventDefault();
    const items = menu
      .filter((item) => Number(quantities[item.id]) > 0)
      .map((item) => ({ menuId: item.id, quantity: quantities[item.id] }));
    if (
      act(
        (current) =>
          createOrder(current, {
            channel: orderChannel,
            guestName: orderGuest,
            tableId: orderTable,
            roomId: orderRoom,
            reservationId: orderReservation || undefined,
            items,
          }),
        "Order prepared. Ingredients and food cost updated.",
      )
    ) {
      setQuantities({});
      setOrderGuest("");
      setOrderReservation("");
    }
  }
  function inventoryAction(event) {
    event.preventDefault();
    act(
      (current) =>
        stockMode === "restock"
          ? restockInventory(current, stockId, stockQuantity, stockCost)
          : recordWaste(current, stockId, stockQuantity, wasteReason),
      stockMode === "restock"
        ? "Inventory purchased. Cash updated."
        : "Waste recorded. Stock and operating profit updated.",
    );
  }
  function changeVenue(value) {
    setVenue(value);
    setSelected(data.tables.find((table) => table.channel === value)?.id || "");
    setDuration(value === "restaurant" ? "90" : "60");
  }
  return (
    <div className="mgmt-page restaurant-page">
      <div className="restaurant-intro">
        <div>
          <span className="restaurant-eyebrow">THE CULINARY COLLECTION</span>
          <h2>Restaurant & Bar</h2>
          <p>
            Thoughtful service. Exceptional dining. Every detail accounted for.
          </p>
        </div>
        <span className="restaurant-demo-label">
          Fictional operations · {state.date}
        </span>
      </div>
      <div className="mgmt-stats restaurant-stats">
        <Stat
          label="Dining & bar revenue"
          value={money(metrics.revenue)}
          note="Collected today · all outlets"
        />
        <Stat
          label="Food & beverage costs"
          value={money(metrics.foodCost)}
          note={`${money(metrics.waste)} recorded waste`}
        />
        <Stat
          label="F&B contribution"
          value={money(metrics.profit)}
          note={`${metrics.margin.toFixed(1)}% before payroll & shared costs`}
        />
        <Stat
          label="Open checks"
          value={money(metrics.receivables)}
          note={`${metrics.openOrders} unpaid order${metrics.openOrders === 1 ? "" : "s"} · not booked as revenue`}
        />
      </div>
      <div className="restaurant-venues">
        {Object.entries(venues).map(([key, title]) => {
          const Icon = venueIcons[key];
          return (
            <button
              key={key}
              className={`card restaurant-venue ${(tab === "floor" && venue === key) || (tab === "orders" && orderChannel === key) ? "selected" : ""}`}
              onClick={() => {
                if (key === "room-service") {
                  setTab("orders");
                  setOrderChannel(key);
                } else {
                  changeVenue(key);
                  setTab("floor");
                }
              }}
            >
              <span className="restaurant-venue-icon">
                <Icon size={21} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>
                  {key === "restaurant"
                    ? "Fine dining · 60 seats"
                    : key === "bar"
                      ? "Hotel lounge · 30 seats"
                      : `${occupiedRooms.length} occupied rooms · guest delivery`}
                </small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          );
        })}
      </div>
      <div
        className="restaurant-tabs"
        role="tablist"
        aria-label="Restaurant sections"
      >
        {[
          ["floor", "Floor & reservations"],
          ["orders", "Orders & payments"],
          ["inventory", "Menu & inventory"],
        ].map(([key, title]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {title}
            {key === "orders" && metrics.openOrders > 0 && (
              <span>{metrics.openOrders}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "floor" && (
        <>
          <div className="restaurant-floor-layout">
            <section className="card restaurant-section">
              <div className="restaurant-section-heading">
                <div>
                  <h3>{venues[venue]}</h3>
                  <p>
                    Select a table to reserve. Availability reflects your
                    selected time.
                  </p>
                </div>
                <select
                  aria-label="Floor venue"
                  value={venue}
                  onChange={(event) => changeVenue(event.target.value)}
                >
                  <option value="restaurant">Fine dining · 60 seats</option>
                  <option value="bar">Lounge bar · 30 seats</option>
                </select>
              </div>
              <div className="restaurant-floor-controls mgmt-form">
                <label>
                  Dining date
                  <input
                    type="date"
                    min={state.date}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
                <label>
                  Arrival time
                  <input
                    type="time"
                    min="12:00"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </label>
                <label>
                  Party size
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={covers}
                    onChange={(event) => setCovers(event.target.value)}
                  />
                </label>
                <label>
                  Duration
                  <select
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                  >
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">120 minutes</option>
                  </select>
                </label>
              </div>
              <div
                className={`restaurant-floor ${venue === "bar" ? "lounge" : ""}`}
              >
                <div className="restaurant-floor-sign">
                  {venue === "restaurant"
                    ? "GARDEN TERRACE"
                    : "THE CONSERVATORY"}
                </div>
                <div className="restaurant-table-grid">
                  {floor.map((table) => (
                    <button
                      key={table.id}
                      className={`restaurant-table ${table.available ? "available" : "unavailable"} ${table.id === selected ? "selected" : ""}`}
                      onClick={() => setSelected(table.id)}
                      aria-label={`${table.name}, ${table.seats} seats, ${table.available ? "available" : table.tooSmall ? "too small" : table.openOrder ? "open check" : "reserved"}`}
                      aria-pressed={table.id === selected}
                    >
                      <span className="restaurant-table-top">
                        <strong>{table.id}</strong>
                        <small>{table.seats} seats</small>
                      </span>
                      <span className="restaurant-table-status">
                        {table.available
                          ? "Available"
                          : table.tooSmall
                            ? "Too small"
                            : table.openOrder
                              ? "Open check"
                              : "Reserved"}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="restaurant-floor-entrance">
                  RECEPTION & ENTRANCE
                </div>
              </div>
              <div className="restaurant-floor-legend">
                <span>
                  <i className="available" />
                  Available
                </span>
                <span>
                  <i className="unavailable" />
                  Reserved / unavailable
                </span>
                <span>
                  <i className="selected" />
                  Selected
                </span>
              </div>
            </section>
            <section className="card restaurant-section restaurant-booking">
              <div className="restaurant-section-heading">
                <div>
                  <span className="restaurant-eyebrow">YOUR TABLE</span>
                  <h3>{selectedTable?.name || "Select a table"}</h3>
                </div>
                <UtensilsCrossed size={22} />
              </div>
              <div className="restaurant-selected-detail">
                <strong>{selectedTable?.seats || "—"} guests</strong>
                <span>
                  {selectedTable?.available
                    ? "Available for your reservation"
                    : selectedTable?.reservation
                      ? `Reserved for ${selectedTable.reservation.guestName} at ${selectedTable.reservation.time}`
                      : selectedTable?.openOrder
                        ? "An unpaid check is open at this table"
                        : "Choose an available time and table"}
                </span>
              </div>
              <form className="mgmt-form" onSubmit={reserve}>
                <label>
                  Guest name
                  <input
                    required
                    maxLength="100"
                    value={guest}
                    onChange={(event) => setGuest(event.target.value)}
                    placeholder="e.g. Charlotte Whitmore"
                    list="restaurant-guest-names"
                  />
                </label>
                <div className="restaurant-reservation-summary">
                  <span>
                    Date<strong>{date || "Select date"}</strong>
                  </span>
                  <span>
                    Arrival<strong>{time || "Select time"}</strong>
                  </span>
                  <span>
                    Party<strong>{covers || "—"} guests</strong>
                  </span>
                </div>
                <button
                  className="button primary"
                  disabled={!selectedTable?.available}
                  type="submit"
                >
                  <Plus size={15} />
                  Confirm table reservation
                </button>
              </form>
              <p className="restaurant-note">
                Dining hours: noon to midnight. Reservations must fit within the
                table's capacity and cannot overlap. Unpaid checks hold today's
                table until settled; you can still reserve it for a future date.
              </p>
            </section>
          </div>
          <section className="card restaurant-section">
            <div className="restaurant-section-heading">
              <div>
                <h3>Dining reservations</h3>
                <p>
                  {date} · {activeBookings.length} reservations at{" "}
                  {venues[venue]}
                </p>
              </div>
            </div>
            <div className="restaurant-table-wrap">
              <table className="mgmt-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Table</th>
                    <th>Time</th>
                    <th>Party</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>
                        <strong>{booking.guestName}</strong>
                      </td>
                      <td>{booking.tableId}</td>
                      <td>
                        {booking.time} · {booking.duration} min
                      </td>
                      <td>{booking.covers}</td>
                      <td>
                        <span className={`restaurant-pill ${booking.status}`}>
                          {booking.status}
                        </span>
                      </td>
                      <td>
                        {booking.status === "confirmed" && (
                          <>
                            <button
                              className="button secondary"
                              disabled={booking.date !== state.date}
                              onClick={() => {
                                setTab("orders");
                                setOrderChannel(booking.channel);
                                setOrderTable(booking.tableId);
                                setOrderGuest(booking.guestName);
                                setOrderReservation(booking.id);
                              }}
                            >
                              Open order
                            </button>
                            <button
                              className="restaurant-text-button"
                              onClick={() =>
                                act(
                                  (current) =>
                                    cancelTableReservation(current, booking.id),
                                  "Dining reservation cancelled.",
                                )
                              }
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!activeBookings.length && (
                <div className="restaurant-empty">
                  No reservations for this date. Choose a table to welcome your
                  next guest.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {tab === "orders" && (
        <div className="restaurant-orders-layout">
          <section className="card restaurant-section">
            <div className="restaurant-section-heading">
              <div>
                <h3>Create a guest order</h3>
                <p>
                  Ingredients are deducted when prepared. Revenue posts once
                  payment is received.
                </p>
              </div>
              <UtensilsCrossed size={20} />
            </div>
            <form className="mgmt-form" onSubmit={prepare}>
              <div className="restaurant-form-pair">
                <label>
                  Outlet
                  <select
                    value={orderChannel}
                    onChange={(event) => {
                      setOrderChannel(event.target.value);
                      setOrderReservation("");
                      setOrderTable(
                        data.tables.find(
                          (table) => table.channel === event.target.value,
                        )?.id || "",
                      );
                      setQuantities({});
                    }}
                  >
                    <option value="restaurant">Fine-dining restaurant</option>
                    <option value="bar">Hotel lounge bar</option>
                    <option value="room-service">Room service</option>
                  </select>
                </label>
                {orderChannel === "room-service" ? (
                  <label>
                    Occupied room
                    <select
                      required
                      value={orderRoom}
                      onChange={(event) => setOrderRoom(event.target.value)}
                    >
                      <option value="">Choose a room</option>
                      {occupiedRooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          Room {room.number || room.id}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    Table
                    <select
                      required
                      value={orderTable}
                      onChange={(event) => {
                        setOrderTable(event.target.value);
                        setOrderReservation("");
                      }}
                    >
                      {data.tables
                        .filter((table) => table.channel === orderChannel)
                        .map((table) => (
                          <option key={table.id} value={table.id}>
                            {table.name} ({table.seats} seats)
                            {data.orders.some(
                              (order) =>
                                order.tableId === table.id &&
                                order.status === "open",
                            )
                              ? " · open check"
                              : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </div>
              <label>
                Guest / check name
                <input
                  required
                  maxLength="100"
                  value={orderGuest}
                  onChange={(event) => setOrderGuest(event.target.value)}
                  placeholder="Guest or party name"
                  list="restaurant-guest-names"
                />
              </label>
              <div className="restaurant-order-menu">
                {menu.map((item) => (
                  <label key={item.id} className="restaurant-menu-line">
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.category} · {money(item.price)}
                      </small>
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      aria-label={`${item.name} quantity`}
                      value={quantities[item.id] || ""}
                      placeholder="0"
                      onChange={(event) =>
                        setQuantities({
                          ...quantities,
                          [item.id]: event.target.value,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="restaurant-order-total">
                <span>Order total</span>
                <strong>{money(orderTotal)}</strong>
              </div>
              <button
                className="button primary"
                type="submit"
                disabled={!orderTotal}
              >
                <Plus size={15} />
                Prepare order
              </button>
            </form>
            <p className="restaurant-note">
              No hidden tax or gratuity. Price and ingredient costs are saved
              with each order. Menu changes apply to future orders.
            </p>
          </section>
          <section className="card restaurant-section">
            <div className="restaurant-section-heading">
              <div>
                <h3>Guest checks</h3>
                <p>Outstanding balance: {money(metrics.receivables)}</p>
              </div>
              <label className="restaurant-checkbox">
                <input
                  type="checkbox"
                  checked={showPaid}
                  onChange={(event) => setShowPaid(event.target.checked)}
                />
                Include paid
              </label>
            </div>
            <div className="restaurant-checks">
              {orders.slice(0, 60).map((order) => (
                <article className="restaurant-check" key={order.id}>
                  <div className="restaurant-check-heading">
                    <div>
                      <strong>{order.guestName}</strong>
                      <small>
                        {order.id} · {order.date} ·{" "}
                        {order.roomId ? `Room ${order.roomId}` : order.tableId}
                        {order.simulated ? " · service summary" : ""}
                      </small>
                    </div>
                    <span className={`restaurant-pill ${order.status}`}>
                      {order.status === "paid" ? "Paid" : "Open"}
                    </span>
                  </div>
                  <p className="restaurant-check-items">
                    {order.items
                      .map((item) => `${item.quantity} × ${item.name}`)
                      .join(" · ")}
                  </p>
                  <div className="restaurant-check-footer">
                    <strong>{money(order.total)}</strong>
                    {order.status === "open" ? (
                      <div>
                        <select
                          aria-label={`Payment method for ${order.id}`}
                          value={paymentMethods[order.id] || "card"}
                          onChange={(event) =>
                            setPaymentMethods({
                              ...paymentMethods,
                              [order.id]: event.target.value,
                            })
                          }
                        >
                          <option value="card">Card</option>
                          <option value="cash">Cash</option>
                        </select>
                        <button
                          className="button primary"
                          onClick={() =>
                            act(
                              (current) =>
                                payOrder(
                                  current,
                                  order.id,
                                  paymentMethods[order.id] || "card",
                                ),
                              "Payment received. Financial reports updated.",
                            )
                          }
                        >
                          <CreditCard size={13} />
                          Settle check
                        </button>
                      </div>
                    ) : (
                      <span className="restaurant-payment">
                        <Check size={13} />
                        {order.paymentMethod} · {order.paidDate}
                      </span>
                    )}
                  </div>
                </article>
              ))}
              {!orders.length && (
                <div className="restaurant-empty">
                  <CreditCard size={26} />
                  <strong>No {showPaid ? "guest" : "open"} checks</strong>
                  <p>Create an order to begin service.</p>
                </div>
              )}
              {orders.length > 60 && (
                <p className="restaurant-note">
                  Showing the most recent 60 checks. All orders remain in your
                  simulation export.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "inventory" && (
        <>
          <div className="restaurant-inventory-layout">
            <section className="card restaurant-section">
              <div className="restaurant-section-heading">
                <div>
                  <h3>The seasonal menu</h3>
                  <p>
                    Edit selling prices. Existing orders retain their original
                    price.
                  </p>
                </div>
                <UtensilsCrossed size={20} />
              </div>
              <div className="restaurant-menu-editor">
                {data.menu.map((item) => (
                  <MenuPrice
                    key={`${item.id}-${item.price}`}
                    item={item}
                    inventory={data.inventory}
                    act={act}
                  />
                ))}
              </div>
            </section>
            <section className="card restaurant-section">
              <div className="restaurant-section-heading">
                <div>
                  <h3>Inventory operations</h3>
                  <p>
                    {money(metrics.inventoryValue)} held in food & beverage
                    stock
                  </p>
                </div>
                <Package size={20} />
              </div>
              <form className="mgmt-form" onSubmit={inventoryAction}>
                <label>
                  Operation
                  <select
                    value={stockMode}
                    onChange={(event) => setStockMode(event.target.value)}
                  >
                    <option value="restock">
                      Purchase / restock inventory
                    </option>
                    <option value="waste">Record food or beverage waste</option>
                  </select>
                </label>
                <label>
                  Inventory item
                  <select
                    value={stockId}
                    onChange={(event) => {
                      setStockId(event.target.value);
                      setStockCost(
                        String(
                          data.inventory.find(
                            (item) => item.id === event.target.value,
                          )?.unitCost || "",
                        ),
                      );
                    }}
                  >
                    {data.inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="restaurant-form-pair">
                  <label>
                    Quantity ({selectedStock?.unit})
                    <input
                      required
                      type="number"
                      min="0.01"
                      max="10000"
                      step="0.01"
                      value={stockQuantity}
                      onChange={(event) => setStockQuantity(event.target.value)}
                    />
                  </label>
                  {stockMode === "restock" ? (
                    <label>
                      Purchase cost per {selectedStock?.unit}
                      <input
                        required
                        type="number"
                        min="0.01"
                        max="10000"
                        step="0.01"
                        value={stockCost}
                        onChange={(event) => setStockCost(event.target.value)}
                      />
                    </label>
                  ) : (
                    <label>
                      Reason
                      <select
                        value={wasteReason}
                        onChange={(event) => setWasteReason(event.target.value)}
                      >
                        <option>Spoilage</option>
                        <option>Preparation loss</option>
                        <option>Guest return</option>
                        <option>Breakage</option>
                      </select>
                    </label>
                  )}
                </div>
                <div className="restaurant-order-total">
                  <span>
                    {stockMode === "restock"
                      ? "Cash purchase"
                      : "Waste expense"}
                  </span>
                  <strong>
                    {money(
                      Number(stockQuantity) *
                        Number(
                          stockMode === "restock"
                            ? stockCost
                            : selectedStock?.unitCost,
                        ),
                    )}
                  </strong>
                </div>
                <button type="submit" className="button primary">
                  <Package size={15} />
                  {stockMode === "restock"
                    ? "Purchase inventory"
                    : "Record waste"}
                </button>
              </form>
              <p className="restaurant-note">
                Purchases reduce cash and add stock. Ingredients become an
                expense once consumed; waste is expensed separately. This
                prevents counting a purchase twice.
              </p>
            </section>
          </div>
          <section className="card restaurant-section">
            <div className="restaurant-section-heading">
              <div>
                <h3>Food & beverage inventory</h3>
                <p>
                  {metrics.lowStock.length
                    ? `${metrics.lowStock.length} items need replenishing`
                    : "All stock levels are above reorder thresholds"}
                </p>
              </div>
            </div>
            <div className="restaurant-table-wrap">
              <table className="mgmt-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Available</th>
                    <th>Unit cost</th>
                    <th>Stock value</th>
                    <th>Reorder at</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventory.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>
                        {item.quantity.toLocaleString("en-US", {
                          maximumFractionDigits: 3,
                        })}{" "}
                        {item.unit}
                      </td>
                      <td>{money(item.unitCost)}</td>
                      <td>{money(item.quantity * item.unitCost)}</td>
                      <td>
                        {item.reorderAt} {item.unit}
                      </td>
                      <td>
                        <span
                          className={`restaurant-pill ${item.quantity <= item.reorderAt ? "low" : "paid"}`}
                        >
                          {item.quantity <= item.reorderAt
                            ? "Low stock"
                            : "Healthy"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="button secondary"
                          onClick={() => {
                            setStockId(item.id);
                            setStockCost(String(item.unitCost));
                            setStockMode("restock");
                          }}
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <div className="restaurant-bottom-grid">
        <section className="card restaurant-section">
          <div className="restaurant-section-heading">
            <div>
              <h3>Today's outlet performance</h3>
              <p>Shared financial ledger · collected payments only</p>
            </div>
            <Wine size={19} />
          </div>
          <div className="restaurant-revenue-bars">
            {[
              ["Fine dining", metrics.restaurantRevenue],
              ["Lounge bar", metrics.barRevenue],
              ["Room service", metrics.roomServiceRevenue],
              ...(metrics.priorSales
                ? [["Previously booked F&B", metrics.priorSales]]
                : []),
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{money(value)}</strong>
                <i>
                  <b
                    style={{
                      width: `${metrics.revenue ? Math.max(0, (value / metrics.revenue) * 100) : 0}%`,
                    }}
                  />
                </i>
              </div>
            ))}
          </div>
          <button
            className="restaurant-text-button"
            onClick={() => onNavigate("finance")}
          >
            View hotel financial statements <ArrowUpRight size={13} />
          </button>
        </section>
        <section className="card restaurant-section">
          <div className="restaurant-section-heading">
            <div>
              <h3>The team behind the experience</h3>
              <p>Restaurant, bar & kitchen staffing</p>
            </div>
            <UsersRound size={20} />
          </div>
          <div className="restaurant-staff-summary">
            <span>
              <strong>{employees.length}</strong> active team members
            </span>
            <span>
              <strong>
                {employees.length
                  ? (
                      sum(employees.map((employee) => employee.satisfaction)) /
                      employees.length
                    ).toFixed(0)
                  : "—"}
              </strong>{" "}
              average satisfaction
            </span>
          </div>
          <p className="restaurant-note">
            Team size and morale affect service quality and simulated dining
            demand. Plan restaurant and kitchen shifts in the employee
            dashboard.
          </p>
          <button
            className="button secondary"
            onClick={() => onNavigate("employees")}
          >
            <Clock3 size={14} />
            Manage team & shifts
          </button>
        </section>
      </div>
      <datalist id="restaurant-guest-names">
        {state.reservations
          .filter((reservation) => reservation.status === "checked-in")
          .map((reservation) => (
            <option key={reservation.id} value={reservation.guest.name} />
          ))}
      </datalist>
    </div>
  );
}

function Stat({ label, value, note }) {
  return (
    <div className="mgmt-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function MenuPrice({ item, inventory, act }) {
  const [price, setPrice] = useState(String(item.price));
  const cost = sum(
    Object.entries(item.recipe).map(
      ([id, quantity]) =>
        quantity * (inventory.find((entry) => entry.id === id)?.unitCost || 0),
    ),
  );
  return (
    <form
      className="restaurant-price-row"
      onSubmit={(event) => {
        event.preventDefault();
        act(
          (current) => updateMenuPrice(current, item.id, price),
          "Menu price updated for future orders.",
        );
      }}
    >
      <div>
        <strong>{item.name}</strong>
        <small>
          {item.category} · {money(cost)} ingredient cost ·{" "}
          {item.price
            ? (((item.price - cost) / item.price) * 100).toFixed(0)
            : 0}
          % gross margin
        </small>
      </div>
      <div>
        <label>
          <span className="restaurant-sr-only">{item.name} price</span>
          <span aria-hidden="true">$</span>
          <input
            required
            type="number"
            min="1"
            max="2000"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <button
          className="button secondary"
          type="submit"
          aria-label={`Save ${item.name} price`}
        >
          Save
        </button>
      </div>
    </form>
  );
}
