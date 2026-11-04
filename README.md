# 🚌 Karavali-Transit (ಕರಾವಳಿ ಸಾರಿಗೆ)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React: 19](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg)](https://vite.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900.svg)](https://leafletjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101.svg)](https://socket.io/)
[![Express](https://img.shields.io/badge/Express-5.3-gray.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20SQLite-336791.svg)](https://www.postgresql.org/)
[![Oxlint: Passed](https://img.shields.io/badge/Oxlint-0%20warnings%200%20errors-success.svg)](https://oxc.rs/)

> **Real-Time Private Bus Tracking and Passenger Information Platform**  
> *Dedicated to the Mangaluru – Surathkal – Mulki – Udupi – Kundapura NH-66 Coastal Corridor*

---

## 📌 Overview

**Karavali-Transit** is a real-time public transit information and telemetry platform serving private bus operators, conductors, and commuters across the coastal Karnataka highway corridor (NH-66).

### 🛣️ Strict 9-Stop Corridor Alignment
The entire platform strictly serves the 9 designated corridor stations in fixed sequential order:
1. **Mangaluru** (Statebank, Hampankatta, Central)
2. **Kuntikana** (AJ Hospital & Research Centre)
3. **Kulur** (Kulur Bridge, KIADB)
4. **Surathkal** (NITK Surathkal, Junction)
5. **Mulki** (Bappanadu Temple, Bus Stand)
6. **Padubidri** (Blue Flag Beach Road, Mahaganapathi Temple)
7. **Kaup** (Lighthouse, Marigudi)
8. **Udupi** (City & Service Bus Stand, Sri Krishna Matha)
9. **Kundapura** (Shastri Circle, New Bus Stand)

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Conductors["👤 Conductor Operations"]
        C1["Onboard Mobile Browser"] -->|"HTML5 Geolocation / WebSocket"| C2["Shift Terminal & GPS Streamer"]
    end

    subgraph Backend["⚙️ Central Real-Time Node.js Backend"]
        B1["Express REST API (Port 5000)"] <--> B2["Socket.IO Telemetry Relay"]
        B1 --> B3[("PostgreSQL Database\n(buses, conductors, shifts, telemetry)")]
    end

    subgraph Passengers["🧍 Public Passenger Portal"]
        P1["Journey Search (From ➔ To)"] --> P2["Matching Buses & Planned Timetable"]
        P2 --> P3["Bus Route Details & 9-Stop Timeline"]
        P3 --> P4["Live GPS Map & Floating Status HUD"]
    end

    subgraph FleetOwners["🏢 Fleet Owner Console"]
        O1["Email OTP Authentication"] --> O2["Fleet Command Dashboard"]
        O2 --> O3["Bus Registration & Timetable Management"]
        O2 --> O4["Conductor Authorization & PIN Assignment"]
    end

    C2 -->|"emit('update_location')"| B2
    B2 -->|"broadcast('bus_location_update')"| P4
```

---

## 🚀 Key Platform Features

### 1. Passenger Portal
- **Zero Registration Required**: 100% open access for passengers without signups or accounts.
- **Single-Page Progressive Journey**:
  - `Homepage`: Searchable autocomplete boarding & destination selection with 1-click popular journeys.
  - `Bus Results`: Real-time active shift breakdown (`Active`, `All`, `Scheduled`) with planned departure/arrival times.
  - `Bus Details`: Verified vertical timeline of all 9 corridor stops with boarding (green) and destination (red) indicators.
  - `Live Tracking`: Interactive Leaflet map with NH-66 polyline, labeled stop pins, live bus marker, and floating HUD (`Next Stop`, `ETA`, `Speed`).
- **Zero Ticket Fare Policy**: No pricing, ticket fares, or booking fees are displayed anywhere on the platform.

### 2. Fleet Owner Portal
- Secure email authentication with 6-digit OTP delivery.
- KPI summary: Total fleet vehicles, active on-shift buses, authorized conductors, and scheduled trips.
- Fleet management table: Real-time status, secret conductor PINs, vehicle editing, and route schedules.
- 4-Step Bus Registration Wizard: Basic specifications, route stops, timetable schedules, and confirmation.

### 3. Conductor Terminal
- Travel agency email OTP verification and conductor mobile authorization.
- One-tap shift activation linking mobile GPS coordinates to the live bus record.
- Real-time passenger occupancy counter (`+1`, `-1`, `+5`, `-5`) with capacity badges (`Seats Available`, `Standing Allowed`, `Overcrowded`).
- Stop progression timetable and delay/incident broadcaster.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS |
| **Maps & Telemetry** | Leaflet, React-Leaflet, Socket.IO Client |
| **Backend** | Node.js, Express 5, Socket.IO |
| **Database** | PostgreSQL (Primary) / SQLite (Fallback) |
| **Linting & Testing** | Oxlint, Node.js Native Test Runner (`node:test`) |

---

## 🏃 Running the Application

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL running locally on port 5432 with database `karavali_transit` (or SQLite fallback)

### Installation & Startup
```bash
# Install dependencies
npm install

# Start Express Backend (Port 5000)
node server.js

# Start Vite Frontend Dev Server (Port 5173)
npx vite --host
```

### Running Tests
```bash
# Run all test suites
npm test

# Run corridor integrity & passenger flow tests
node --test tests/passenger-portal-flow.test.js
node --test tests/desktop-responsiveness.test.js
```
