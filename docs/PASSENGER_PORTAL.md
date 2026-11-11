# Karavali-Transit — Complete Passenger Portal Architecture & Implementation

## 1. Overview & Core Objectives

The **Karavali-Transit Passenger Portal** provides a modern, fast, and accessible real-time bus tracking and passenger information platform designed specifically for the coastal Karnataka region along the **Mangaluru–Surathkal–Mulki–Kaup–Udupi–Kundapura (NH-66)** corridor.

### Core Architecture Principles:
- **No Passenger Registration or Login Required**: Completely open and public access for all commuters.
- **Strict Zero-Fare Policy**: In compliance with regional passenger information system standards, absolutely no ticket fares, ticket prices, stage fares, fees, or payment collection components are present.
- **Strict Passenger Privacy**: Passenger location is 100% optional. Coordinates are never saved in the database, never continuously polled, never shared with fleet owners or conductors, and **never rendered on the live bus tracking map**.
- **Real-Time Conductor Telemetry Integration**: Live bus positions are broadcast by authenticated conductors via WebSocket/Socket.IO and reflected instantly without page reloads.
- **Bilingual Interface**: Native support for **English** and **Kannada (ಕನ್ನಡ)** with instant one-tap toggle.

---

## 2. PostgreSQL & SQLite Database Integration

The portal integrates directly with the existing dual-engine (`pgPool` / `sqliteDb`) database layer in `db.js`:

### New Tables:
```sql
CREATE TABLE IF NOT EXISTS bus_stops (
  stop_id SERIAL PRIMARY KEY,
  stop_name TEXT NOT NULL UNIQUE,
  stop_name_kn TEXT NOT NULL,
  alternative_names TEXT NOT NULL,
  nearby_landmarks TEXT NOT NULL,
  locality TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS passenger_feedback (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT,
  category TEXT DEFAULT 'General',
  rating INTEGER DEFAULT 5,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Verified Coastal Bus Stops (`VERIFIED_COASTAL_STOPS`):
Seeded automatically with 23 verified coastal stations:
1. **Mangaluru (Statebank)** (`ಮಂಗಳೂರು (ಸ್ಟೇಟ್‌ಬ್ಯಾಂಕ್)`) — Central Railway Station, DC Office, Town Hall, Hampankatta.
2. **Hampankatta** (`ಹಂಪನಕಟ್ಟೆ`) — City Centre Mall, University College, Milagres Church.
3. **Pumpwell** (`ಪಂಪ್‌ವೆಲ್`) — Father Muller Hospital, KMC Hospital Ambedkar Circle, Indiana Hospital.
4. **Lalbagh** (`ಲಾಲ್‌ಬಾಗ್`) — Mangalore City Corporation, Kudroli Temple, Bharath Mall.
5. **Kuntikana** (`ಕುಂತಿಕಾನ`) — AJ Hospital & Research Centre, AJ Dental College, Derebail Cross.
6. **Kottara Chowki** (`ಕೊಟ್ಟಾರ ಚೌಕಿ`) — Infosys Kottara, Highway Flyover, Urwa Stores.
7. **Kuloor** (`ಕೂಳೂರು`) — Kuloor Bridge, Gurupura River, Tannirbhavi Cross.
8. **Panambur** (`ಪಣಂಬೂರು`) — New Mangalore Port Authority (NMPT), Panambur Beach.
9. **Baikampady** (`ಬೈಕಂಪಾಡಿ`) — Industrial Estate, APMC Yard, Meenakaliya.
10. **Kulai** (`ಕುಳಾಯಿ`) — Kulai Temple, Honnakatte, Chitrapura Beach.
11. **Surathkal** (`ಸುರತ್ಕಲ್`) — NITK Surathkal Engineering College, Surathkal Lighthouse, Govinda Dasa College.
12. **Mukka** (`ಮುಕ್ಕ`) — Srinivas Hospital & Medical College, Mukka Beach.
13. **Mulki** (`ಮುಲ್ಕಿ`) — Kateel Cross, Bappanadu Durgaparameshwari Temple, Shambhavi River.
14. **Padubidri** (`ಪಡುಬಿದ್ರಿ`) — Blue Flag Beach, Mahalingeshwara Temple, Suzlon.
15. **Uchila** (`ಉಚ್ಚಿಲ`) — Shri Mahalakshmi Temple Uchila, Mogaveera Sabha Bhavana.
16. **Kaup** (`ಕಾಪು`) — Kaup Lighthouse & Beach, Sri Hosa Marigudi Temple, Hale Marigudi.
17. **Katapadi** (`ಕಟಪಾಡಿ`) — Mattu Beach Cross, Shirva Cross, Venkataramana Temple.
18. **Udupi** (`ಉಡುಪಿ`) — Sri Krishna Matha / Temple, City Bus Stand, Manipal MIT Cross.
19. **Santhekatte** (`ಸಂತೆಕಟ್ಟೆ`) — Robosoft Technologies Campus, Milagres College Kallianpur.
20. **Brahmavara** (`ಬ್ರಹ್ಮಾವರ`) — SMS College, Barkur Cross, Agricultural Research Station.
21. **Saligrama** (`ಸಾಲಿಗ್ರಾಮ`) — Guru Narasimha Temple, Kota Shivarama Karantha Theme Park.
22. **Kota** (`ಕೋಟ`) — Dr. Kota Shivarama Karantha Smrithi Bhavana, Amrutheshwari Temple.
23. **Kundapura** (`ಕುಂದಾಪುರ`) — Shastri Circle, KSRTC & Private Bus Terminal, Kodi Sea Walk.

---

## 3. Public API Endpoints (`server.js`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/public/stops/search?q=:query` | Search stops by official name, Kannada name, alternative names, or landmark |
| `GET` | `/api/public/stops/nearby?lat=:lat&lng=:lng&radius=:km` | Optional on-demand closest stops using Haversine formula |
| `GET` | `/api/public/stops/all` | Get all verified coastal stops |
| `GET` | `/api/public/buses/search?from=:from&to=:to` | Search buses matching journey with intermediate stop-order logic |
| `GET` | `/api/public/buses/:id` | Get public bus telemetry and details |
| `GET` | `/api/public/buses/:id/route` | Get full route stops timeline enriched with verified landmarks |
| `GET` | `/api/public/buses/:id/location` | Get live bus GPS coordinates, speed, and freshness status |
| `POST` | `/api/public/feedback` | Submit passenger feedback with category and star rating |
| `GET` | `/api/public/feedback` | Retrieve recent passenger reviews and testimonials |

---

## 4. Journey Matching & Stop Order Logic

When a passenger searches FROM and TO:
1. Queries all registered buses and their stops from `bus_route_stops`.
2. Locates the boarding stop index (`fromIdx`) and destination stop index (`toIdx`).
3. Enforces that:
   $$\text{fromIdx} \neq -1 \quad \land \quad \text{toIdx} \neq -1 \quad \land \quad \text{fromIdx} < \text{toIdx}$$
4. Rejects buses travelling in the opposite direction.
5. Calculates planned arrival at destination stop and live GPS ETA if bus status is `LIVE`.

### Tracking Status Rules:
- **`LIVE`**: Active shift, recent telemetry received within 120 seconds (`Date.now() - timestamp < 120000`).
- **`LOCATION STALE`**: Active shift, but telemetry is older than 120 seconds.
- **`SCHEDULED`**: Bus departure time is planned, but shift has not yet started.
- **`NOT TRACKING` / `OFFLINE`**: No active conductor shift or bus has completed service.

---

## 5. Security & Privacy Guarantees

- `toPublicBus()` sanitizer automatically strips sensitive properties: `conductor_pin`, `owner_email`, `driver_phone`, `fare`, `ticket_fare`, `ticket_price`, `price`, `est_fare`.
- Geolocation permission is never requested on initial load.
- Browser location coordinates are only transmitted on explicit click of "Find Stops Near Me" to calculate distance and are never stored in PostgreSQL or SQLite.
