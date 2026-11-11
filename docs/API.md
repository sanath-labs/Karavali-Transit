# Karavali-Transit API & WebSocket Specification

This document details the REST endpoints, SQL database schemas, and Socket.IO real-time event interfaces for the Karavali-Transit platform.

---

## 1. REST Endpoints

### 1.1 Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Returns operational status of the Karavali-Transit backend engine.
- **Response**:
  ```json
  {
    "status": "online",
    "service": "Karavali-Transit Central Fleet API",
    "database": "SQLite (transit.db)",
    "timestamp": "2026-10-16T16:30:00.000Z"
  }
  ```

### 1.2 Registered Fleet Buses
- **Endpoint**: `GET /api/buses`
- **Description**: Retrieves all registered coastal express and ordinary buses.
- **Response**:
  ```json
  [
    {
      "bus_id": 1,
      "bus_name": "Vishal Express",
      "vehicle_number": "KA-20-AB-4509",
      "route_name": "Mangaluru Statebank ➔ Surathkal",
      "is_express": 1,
      "total_seats": 42
    }
  ]
  ```

### 1.3 Active Conductor Shifts
- **Endpoint**: `GET /api/shifts`
- **Description**: Lists active driver and conductor operational duty records.
- **Response**:
  ```json
  [
    {
      "id": 1,
      "bus_id": 1,
      "driver_name": "Ramesh Poojary",
      "conductor_phone": "9845123456",
      "status": "active",
      "started_at": "2026-10-16 08:30:00"
    }
  ]
  ```

### 1.4 Live Telemetry Snapshot
- **Endpoint**: `GET /api/telemetry`
- **Description**: Returns the latest telemetry coordinates and crowd density records for all active vehicles.
- **Response**:
  ```json
  [
    {
      "bus_id": 1,
      "latitude": 12.8997,
      "longitude": 74.8530,
      "speed": 38,
      "crowd_status": "Seats Available",
      "is_last_bus": 0,
      "updated_at": "2026-10-16 16:30:05"
    }
  ]
  ```

  ### 1.5 Fleet Owner Endpoints
  - `POST /api/owner/send-otp` and `POST /api/owner/verify-otp` authenticate registered owners.
  - Successful verification returns a short-lived bearer token. Send it as `Authorization: Bearer <token>` for all `/api/owner/buses` requests.
  - Owners can only view or change buses belonging to their authenticated account.
  - Development mode returns the generated OTP for local testing. Production OTP delivery is unavailable until an email provider is configured.
  - Public bus and telemetry responses omit owner email and conductor PIN fields.

  ### 1.6 Conductor Portal REST Endpoints
  - `POST /api/conductor/send-otp`: Sends 6-digit verification code to the travel agency's registered Gmail address.
  - `POST /api/conductor/verify-otp`: Validates OTP code, resets attempt counter, and grants short-lived verified agency token.
  - `POST /api/conductor/lookup`: Fast mobile lookup (+91 10-digit) querying PostgreSQL conductors table under the verified agency. Returns exists: true/false, conductor profile, and agency fleet buses.
  - `POST /api/conductor/register`: Fast self-registration for new crew members, recording the assignment and logging an activity audit trail.
  - `POST /api/conductor/start-duty`: Initializes shift record in driver_shifts and marks bus as active on fleet radar.
  - `GET /api/conductor/buses/:busId/stops`: Fetches ordered route stops and planned arrival times from bus_route_stops.

---

## 2. WebSocket Events (Socket.IO)

### 2.1 Conductor to Server
- **Event**: `update_location`
- **Payload**:
  ```json
  {
    "bus_id": 1,
    "bus_name": "Vishal Express",
    "vehicle_number": "KA-20-AB-4509",
    "route_name": "Mangaluru Statebank ➔ Surathkal",
    "latitude": 12.8997,
    "longitude": 74.8530,
    "speed": 38,
    "crowd_status": "Seats Available",
    "is_last_bus": false
  }
  ```

### 2.2 Server Broadcast to Passengers
- **Event**: `live_location_broadcast`
- **Broadcast Target**: All connected clients (`io.emit`)
- **Payload**: Contains sanitized and synchronized live GPS telemetry with millisecond timestamp.
