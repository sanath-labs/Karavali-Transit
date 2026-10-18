# 🚍 Karavali-Transit • 3-Step Passenger Journey Specification

This document details the staged UX state machine and screen transitions for passengers using the Karavali-Transit platform.

---

## 🗺️ State Machine Flow

```
[ STEP 1: Destination Selection ]
        │
        │ User selects destination & clicks "Search Incoming Buses"
        ▼
[ STEP 2: Filtered Bus List ]  ◄───────────────────────────┐
        │                                                  │
        │ User clicks "Select & Track This Bus"            │
        ▼                                                  │ User clicks
[ Location Permission Dialog ]                             │ "Switch Bus / Exit Map"
        │                                                  │
        │ User grants location (Live GPS or Stop Fallback) │
        ▼                                                  │
[ STEP 3: Live Tracking Map View ] ────────────────────────┘
```

---

## 📱 Detailed Screen Breakdown

### Step 1: Destination Selection Screen (Default Landing)
- **Design Intent**: Completely decluttered mobile-first interface. No map tiles or fleet bus lists are loaded at this stage to prevent cognitive overload.
- **Components**:
  - `Boarding Stop Indicator`: Displays the commuter's current station (`Mangaluru Statebank Central Terminal`).
  - `1-Tap Destination Filter Pills`:
    - `Surathkal / NITK` (10.5 km Corridor)
    - `Udupi` (Coastal Express Artery)
    - `Kuloor` (City Ordinary Corridor)
    - `Statebank` (Inbound Central Terminal)
    - `All Routes` (Full Coastal Fleet)
  - `Search Box`: Free-text search for route numbers (e.g. `15`) or bus names (e.g. `Vishal Express`).
  - `Service Category Switcher`: Quick toggle between `All`, `⚡ Express`, and `🚌 Ordinary`.
  - `Primary Action`: Large high-contrast button: **"Search Incoming Buses ➔"** that transitions the view to Step 2.

---

### Step 2: Filtered Bus List Screen
- **Design Intent**: Presents only the buses operating along the commuter's chosen destination corridor.
- **Components**:
  - `Header Bar`: Includes a **"← Change Destination"** button to return to Step 1, alongside the active destination name and count of operating buses.
  - `Bus Card Highlights`:
    - Bus Name & Vehicle Registration (e.g., `Vishal Express • KA-19-AB-4509`).
    - Service Badge (`⚡ Express Service` vs `🚌 City / Ordinary`).
    - Next Stop Arrival Countdown (e.g. `3 MINS`).
    - Expected Clock Time (e.g. `1:15 PM`).
    - Speed & Delay Metric (e.g., `+4m Delay` vs `On Time`).
    - Crowd Load Badge (`🟢 Seats Available`, `🟡 Standing Allowed`, `🔴 Full`).
    - Night Safety Badge: `🌙 LAST BUS OF THE NIGHT` alert when applicable.
  - `CTA Action`: Prominent **"Select & Track This Bus ➔"** button that initiates the location check.

---

### Location Permission Modal
- **Trigger**: Displayed when the passenger selects a specific bus card in Step 2.
- **Message**: *"Turn on your location to track this bus live"*.
- **Options**:
  1. `Turn On Location & Track Bus`: Requests HTML5 Geolocation (`navigator.geolocation.getCurrentPosition`).
  2. `Use Boarding Stop (Statebank Terminal)`: Uses the preconfigured coastal terminal coordinates.
  3. `Cancel`: Returns to the Step 2 bus list.

---

### Step 3: Live Tracking Map View
- **Design Intent**: Full-immersion navigation screen focused strictly on the chosen bus and the passenger.
- **Components**:
  - **Single-Bus Isolation**: All other fleet buses are hidden from the map (Zomato delivery-style focus).
  - **Passenger Marker (`🧍‍♂️ You`)**: Displays a glowing green-bordered pin with an animated radar pulse wave.
  - **Animated Blue Route Polyline**: Royal blue navigation path connecting the passenger pin to the approaching bus with directional dashes.
  - **Floating Telemetry HUD**: Displays distance to your stop (e.g., `2.4 km away`), speed (`38 km/h`), and stop ETA.
  - **"← Switch Bus / Exit Map" Button**: Pinned navigation button that returns the commuter back to Step 2 without page reload.
