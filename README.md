# The Aurelia · Hotel management simulator

A working, local hotel operations prototype with a luxury dashboard, 48 rooms, fictional guest profiles, and 90 days of sample revenue history. Built with React, Vite, and Lucide icons. Fonts are bundled locally; the application needs no external services or credentials.

## Open on your MacBook — no installation needed

The complete application is included in **[aurelia-hotel.html](aurelia-hotel.html)** at the repository root. It includes all JavaScript, styles, fonts, licenses, and sample hotel data.

1. On GitHub, choose **Code → Download ZIP**, then double-click the downloaded ZIP in Finder to extract it. You can also open `aurelia-hotel.html` on GitHub and use **Download raw file** to save just that file.
2. Open Google Chrome, press **Command+O**, and select **aurelia-hotel.html** from the extracted repository folder.
3. The simulator opens immediately. No server, Node.js, account, or internet connection is required.

Keep the HTML at the same location to retain browser-local saved changes. If Chrome blocks local storage, the app still runs and displays a message that changes last for the current session. Use **Settings → Reset sample hotel** to start over.

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
npm test         # 13 domain tests
npm run build   # production output in dist/
npm run preview # serve the production build
```

## Explore the hotel

- **Overview:** live occupancy, average daily rate (ADR), revenue per available room (RevPAR), lodging revenue, historical charts, arrivals/departures, and room readiness.
- **Reservations:** create a stay, search guests, view stay details, check in, check out, or cancel a confirmed booking. Dates, room capacity, and overlapping bookings are validated.
- **Rooms:** filter the collection by floor/status, send a room to housekeeping or maintenance, and mark it ready. A checked-out room must be prepared before another check-in.
- **Guests:** search the fictional guestbook and open each guest's stay details.
- **Revenue & analytics:** switch between 7- and 30-day lodging trends, inspect daily performance and total hotel revenue by experience, and export a CSV report.
- **Settings:** advance the hotel day after completing due departures, or reset the sample hotel. Late arrivals remain available for check-in while their booking is valid.

The demo opens on **October 16, 2026**, with 36 occupied rooms, 8 expected arrivals, and 6 departures. Guest data is fictional. There is no payment processing, authentication, backend, or connection to a real property system.

## Metric definitions

- **Occupancy:** rooms currently occupied ÷ 48 rooms. Maintenance rooms remain in the inventory denominator.
- **ADR:** lodging revenue recognized for the hotel day ÷ rooms sold that day.
- **RevPAR:** lodging revenue recognized for the hotel day ÷ 48 rooms.
- **Room revenue:** the current day's recognized lodging charges. Check-in posts a charge once; check-out preserves recognized revenue. Same-day room turnover may generate more room nights sold than rooms currently occupied.
- **Total hotel revenue:** lodging plus simulated restaurant/bar, spa, and other service revenue. Historical charts and daily performance use lodging revenue consistently.

Sample prior-period comparisons use the stored ledger. Today's occupancy is an operational snapshot; historical occupancy counts unique rooms sold and stays within the hotel's inventory. All reports use USD and exclude taxes. The date advances explicitly, rather than following the device clock.

## Project structure

```text
src/App.jsx          Dashboard, operations screens, booking and stay dialogs
src/hotel.js         Pure, immutable hotel simulation and financial calculations
src/styles.css       Responsive visual system
tests/hotel.test.js   Booking, inventory, revenue, and daily advancement tests
public/fonts/        Bundled Open Sans fonts and license
aurelia-hotel.html   Complete offline app ready to open in Chrome
scripts/            Reproducible standalone HTML packaging
```

The prototype was also verified in Chromium for reservation creation, check-in/out, housekeeping, reporting/export, persistence, and responsive navigation. Live processes must be restarted when reopening the development environment.
