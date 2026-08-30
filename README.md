# 🚗 Ride Row – ICBT Campus Carpooling Platform

Ride Row is a campus-focused carpooling platform developed for students and staff to discover, publish and manage shared rides while supporting safer participation through driver verification, role-based access control and real-time communication.

The system was developed using an Agile and DevOps-oriented workflow and includes a React frontend, Node.js/Express REST API, Socket.IO real-time communication, SQLite persistent storage, Docker containerisation and Railway cloud deployment.

---

## 🌐 Live System

**Production Application:**  
https://icbt-carpool-ride-row-production.up.railway.app/

**Production API Health Check:**  
https://icbt-carpool-ride-row-production.up.railway.app/api/health

**Production API Documentation:**  
https://icbt-carpool-ride-row-production.up.railway.app/api/docs

---

## 🎯 Project Overview

Ride Row was developed to support campus commuters who travel along similar routes and time periods.

The platform allows:

- Passengers to search and book available carpool rides.
- Drivers to publish rides and manage passenger booking requests.
- Administrators to verify drivers and oversee platform activities.
- Authorised users to communicate through ride-based real-time messaging.
- Users to view vehicle plate and odd/even fuel-quota information.
- The platform to provide emergency SOS functionality.
- The application to run in a containerised and publicly deployed environment.

---

## 👥 User Roles

### Passenger

Passengers can:

- Register and log in.
- Search available rides.
- Filter rides by journey and date.
- View ride and driver information.
- Select seats and submit booking requests.
- Track booking status.
- View receipts and boarding information.
- Chat with the driver.
- Use emergency SOS functionality.
- Rate completed rides.

### Driver

Drivers can:

- Register and log in.
- Submit driver verification information.
- View verification status.
- Publish carpool rides.
- Define route, date, time and available seats.
- View passenger booking requests.
- Accept or reject booking requests.
- Manage published rides and trip information.
- Communicate with passengers.
- View trip and earning information.
- Monitor applicable odd/even vehicle restrictions.

### Administrator

Administrators can:

- Access a dedicated administrator portal.
- Review driver verification requests.
- Inspect submitted verification information.
- Approve or reject driver applications.
- Manage registered users.
- Monitor rides and bookings.
- View operational analytics.
- Monitor emergency SOS alerts.
- Support platform-level security and operational oversight.

---

## 🏗️ System Architecture

```text
Passenger / Driver / Administrator
              │
              ▼
       React Frontend
              │
              ▼
     REST API + Socket.IO
              │
              ▼
       Node.js / Express
              │
              ▼
          SQLite DB
