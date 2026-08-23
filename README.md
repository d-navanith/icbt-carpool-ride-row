# ICBT UniRide — Campus Carpooling & Fuel Quota Transit System

[![CI Pipeline](https://img.shields.io/badge/CI%20Pipeline-Passing-emerald)](https://github.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://docker.com)
[![Tests](https://img.shields.io/badge/Automated%20Tests-8%2F8%20Passed-brightgreen)](https://github.com)
[![Module](https://img.shields.io/badge/SEN5002-Agile%20%26%20DevOps-navy)](https://cardiffmet.ac.uk)

A full-stack, client-server university carpooling web application developed in response to fuel shortages and odd-even number plate quota restrictions in Sri Lanka. It connects students and staff travelling to and from ICBT campus while enforcing role separation, **strict admin verification for drivers**, odd-even fuel compatibility matching, and **real-time chat coordination**.

---

## Key Features & Concept Implementation

### 1. Dual User Modes (Passenger vs Driver)
- **Role Mode Switcher**: Users can dynamically switch between **Passenger Dashboard** and **Driver (Rider) Dashboard** in one unified session.
- **Strict Driver Verification Gating**: 
  - When a user selects **Driver Option**, they **cannot offer or publish a ride** without verified approval from the Campus Administrator.
  - Drivers submit their **Driving License Number**, **Vehicle Plate Number**, **Vehicle Make/Model**, and **Seat Capacity**.
  - Unverified/pending drivers see real-time status banners and are blocked with informative guidance until approved.
- **Passenger Mode**: 
  - Students and staff can search available rides, filter by pickup town, date, max fare, and odd-even fuel quota tags.
  - Interactive Leaflet campus map with real-time waypoint routing.
  - Instant seat reservation with unique boarding security codes.

### 2. Dedicated Campus Admin Dashboard
- **Verification Management Queue**: Review pending driver applications, verify driver licenses and vehicle plates, and Approve or Reject with audit notes.
- **Live System Analytics**: Tracks active rides, verified drivers, passenger bookings, and estimated **fuel saved (in Litres and LKR)**.
- **Ride & User Moderation**: Inspect, monitor, and remove flagged or cancelled listings.

### 3. Sri Lanka National Fuel Quota (Odd-Even) Matching
- Calculates odd/even category automatically from the vehicle number plate's last digit.
- Displays daily fuel status indicators to help students match with rides permitted to refuel on corresponding calendar days.

### 4. Real-time In-App Coordination Chat
- Real-time WebSocket (Socket.io) messaging enabling passengers and drivers to coordinate exact pickup spots along the route.

---

## Demo Credentials (1-Click Switcher Available in UI)

For instant testing, pre-configured demo accounts are accessible directly on the Login page and via the top-right user menu:

| Role | Email | Password | Status & Capabilities |
| :--- | :--- | :--- | :--- |
| **🛡️ Campus Admin** | `admin@icbt.edu.lk` | `admin123` | Approves/rejects driver applications & manages system |
| **🚗 Approved Driver** | `kamal.driver@icbt.edu.lk` | `driver123` | Verified driver who can publish rides and manage bookings |
| **🎓 Student Passenger** | `nimal.student@icbt.edu.lk` | `student123` | Searches rides, reserves seats, and chats with drivers |
| **⏳ Unverified User** | `sanduni.user@icbt.edu.lk` | `user123` | Needs Admin approval before driver options are unlocked |

---

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, Lucide Icons, Leaflet / OpenStreetMap, Socket.io Client.
- **Backend Server**: Node.js, Express, Socket.io, JWT Authentication, Bcrypt encryption.
- **Database**: Zero-configuration, persisted relational storage with transaction support.
- **DevOps**: Docker, Docker Compose, GitHub Actions CI Pipeline, Node Test Runner with Supertest.

---

## Getting Started

### 1. Run with Docker (Recommended)
```bash
docker compose up --build
```
Open **http://localhost:5000** in your browser.

### 2. Run Locally for Development

#### Start Backend:
```bash
cd server
npm install
npm start
```
Server runs on **http://localhost:5000**.

#### Start Frontend:
```bash
cd client
npm install
npm run dev
```
Client runs on **http://localhost:3000** (with automatic API proxy to port 5000).

---

## Running Automated Tests
```bash
cd server
npm test
```
All 8 automated tests verify:
- Health check endpoints
- Admin & Driver JWT authentication
- Verification gating blocking unverified users from offering rides
- Seat deduction upon booking
- Admin verification approval workflow
