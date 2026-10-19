# The Aurelia · Hotel management simulator

A connected luxury hotel management simulator with the original Aurelia interface, 48 rooms, 50 fictional employees, restaurant and bar operations, financial management, reputation, and General Manager decisions. Built with React, Vite, and Lucide icons. Fonts and all simulation logic are bundled locally; the application needs no external services, paid accounts, or credentials.

## Open on your MacBook — no installation needed

The complete application is included in **[aurelia-hotel.html](aurelia-hotel.html)** at the repository root. It includes all JavaScript, styles, fonts, licenses, and sample hotel data.

1. On GitHub, choose **Code → Download ZIP**, then double-click the downloaded ZIP in Finder to extract it. You can also open `aurelia-hotel.html` on GitHub and use **Download raw file** to save just that file.
2. Open Google Chrome, press **Command+O**, and select **aurelia-hotel.html** from the extracted repository folder.
3. The simulator opens immediately. No server, Node.js, account, or internet connection is required.

Keep the HTML at the same location to retain browser-local saved changes. If Chrome blocks local storage or its quota is reached, the app still runs and displays a session-only warning. Use **Settings → Export simulation JSON** before replacing the file or moving to another browser; **Import simulation JSON** validates the backup and asks before replacing progress. Existing original-version saves are upgraded without losing rooms, bookings, guests, or recognized sales. **Reset sample hotel** requires confirmation and resets every department.

## Develop locally

Use Node.js 24 or newer. From the repository directory:

```sh
npm ci
npm run dev
```

Vite starts on port 5173 by default. Data is saved automatically in this browser's local storage. Use **Settings → Reset sample hotel** to restore the demo.

To regenerate the standalone version after source changes:

```sh
npm run build:standalone
```

This writes identical, self-contained copies to `aurelia-hotel.html` at the repository root and `dist/aurelia-hotel.html`. Commit the root HTML alongside source changes so the GitHub download stays up to date. The cloud environment's server port is internal and is not a public preview URL.

```sh
npm test         # 56 domain and integration tests
npm run build   # production output in dist/
npm run preview # serve the production build
```

## Explore the hotel

- **Overview:** live occupancy, average daily rate (ADR), revenue per available room (RevPAR), lodging revenue, historical charts, arrivals/departures, and room readiness.
- **Executive:** ten live KPIs, a selectable 7/30-day revenue-and-cost chart, previous-period comparisons, department contributions, staffing and experience indicators.
- **Reservations:** create a stay, search guests, view stay details, check in, check out, or cancel a confirmed booking. Dates, room capacity, and overlapping bookings are validated.
- **Rooms:** filter the collection by floor/status, send a room to housekeeping or maintenance, and mark it ready. A checked-out room must be prepared before another check-in.
- **Guests:** search the fictional guestbook and open each guest's stay details.
- **Restaurant & bar:** The Gilded Table (60 seats), Conservatory Bar (30 seats), room service, interactive tables, time-based bookings, itemized orders and simulated payments. Edit menu prices, restock ingredients, record waste, and inspect costs and margins. Unpaid checks hold their table today until settled; future dining bookings remain available. Historical opening sales are retained and identified separately from new outlet sales.
- **People & shifts:** 50 fictional employees across seven departments, salaries, hiring, confirmed dismissal, daily/future schedules, training, satisfaction, performance, coverage and departmental payroll. New hires begin service and payroll tomorrow. Shift shortages lower service capacity; training improves scores and incurs a real simulated cost.
- **Financial management:** shared sales and expense ledger, day/week/month-to-date profit and loss, cash movements, departmental budgets, payroll, utilities, maintenance, food costs, training, guest recovery, and marketing. Budgets are planning limits rather than cash spending.
- **Guest experience:** fictional reviews, department ratings, satisfaction/reputation scores, loyalty, returning guests, complaints and requests. Service, repair and courtesy recovery actions have explained consequences and recorded costs.
- **General Manager:** advance one day, one week, or a rolling 30-day month. Each step settles departures, housekeeping, arrivals and demand-generated stays, restaurant stock and sales, payroll, operating expenses, morale, reputation, campaigns and events. Seasonal demand, fictional competitors, protected booking rates and dynamic pricing inform decisions. Equipment breakdowns require a paid repair before a room can be released.
- **Revenue & analytics:** switch between 7- and 30-day lodging trends, inspect daily performance and total hotel revenue by experience, and export a CSV report.
- **Settings:** JSON backups and validated imports, a one-day simulation step, property details, and confirmed reset. Manual arrivals/departures continue to work from the original front desk.

The demo opens on **October 16, 2026**, with 36 occupied rooms, 8 expected arrivals, 6 departures, 50 employees, opening working inventory, and $250,000 opening cash before that day's movements. All hotel, competitor, guest, employee and financial data is fictional. Payment buttons simulate settlement; no real payments are processed and no external property system is connected.

## Metric definitions

- **Occupancy:** rooms currently occupied ÷ 48 rooms. Maintenance rooms remain in the inventory denominator.
- **ADR:** lodging revenue recognized for the hotel day ÷ rooms sold that day.
- **RevPAR:** lodging revenue recognized for the hotel day ÷ 48 rooms.
- **Room revenue:** the current day's recognized lodging charges. Check-in posts a charge once; check-out preserves recognized revenue. Same-day room turnover may generate more room nights sold than rooms currently occupied.
- **Total hotel revenue:** positive sales entries across rooms, restaurant/bar/room service, spa and other services. Expenses and inventory purchases never reduce the revenue denominator. The original lodging charts remain lodging-only; executive charts cover all departments.
- **Operating profit / margin:** recognized sales less operating expenses; margin is profit divided by recognized sales. Restaurant **contribution** excludes payroll; restaurant **operating profit** includes Restaurant & Bar and Kitchen departmental costs.
- **Stock and cash:** preparing an order consumes recipe quantities and posts food cost once. Paying posts sales and cash once. Restocking purchases an inventory asset (cash outflow), with no second profit expense; waste is expensed without charging cash twice. Open checks retain their price/cost snapshots when the menu changes. Opening inventory is already funded by the fictional opening balance sheet.
- **Payroll:** monthly salary divided by the actual number of days in the hotel date's month, posted and settled once per employee per day. Dismissal preserves already recognized pay and stops future payroll. Daily baseline costs include $310 utilities, $160 preventive maintenance, $120 administration and $60 base marketing; campaigns are additional and separately identified.
- **Service model:** departmental shift coverage and performance, employee morale, room condition, open complaints and unresolved events influence guest scores. Scores affect reputation and future room demand; staffing and demand affect dining volume. Marketing lifts are bounded and pricing changes protect existing reservation rates.

Sample prior-period comparisons use the stored ledger. Pre-upgrade expense history is modeled by department for meaningful comparison while original sales remain unchanged. Today's occupancy is an operational snapshot; historical occupancy counts unique rooms sold and stays within the hotel's inventory. Operating history closes with final transactions when the clock advances. All reports use USD and exclude tax, financing, depreciation, and capital investment. Demand and events are deterministic simulation rules, not external forecasts. The date advances explicitly, rather than following the device clock.

## Project structure

```text
src/App.jsx          Dashboard, operations screens, booking and stay dialogs
src/hotel.js         Pure, immutable hotel simulation and financial calculations
src/restaurant.js    Tables, orders, ingredient stock and outlet settlement
src/staff.js         Workforce, shifts, service coverage and payroll
src/reputation.js    Satisfaction, reviews, loyalty and service recovery
src/simulation.js    Deterministic daily management, demand and events
src/business.js      Shared ledger, cash and money/date helpers
src/management.js    Migration, reporting, budgets and save validation
src/*Page.jsx        Department management screens
src/styles.css       Responsive visual system
tests/*.test.js      56 financial, operational, persistence and simulation tests
public/fonts/        Bundled Open Sans fonts and license
aurelia-hotel.html   Complete offline app ready to open in Chrome
scripts/            Reproducible standalone HTML packaging
```

The application is verified with 56 automated tests and Chromium workflows covering the original front desk, POS, HR, service recovery, financial reconciliation, 1/7/30-day advancement, backups, reset, and desktop/mobile navigation. The standalone is tested with networking disabled and no server. This execution environment blocks direct file navigation through managed browser policy, so tests load the exact HTML bytes into an offline browser page; macOS itself is not available here. Live development processes must restart when reopening the cloud environment.
