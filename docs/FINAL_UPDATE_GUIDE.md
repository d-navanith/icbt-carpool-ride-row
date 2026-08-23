# Ride Row — Final Engineering Audit & Update Guide

## 1. Audit scope

Reviewed the uploaded carpool application package at source-file level, including:
- root project configuration
- backend Express/API layer
- authentication and authorization
- JSON-backed data layer
- ride and booking workflows
- real-time Socket.io chat and SOS flow
- frontend React dashboards/components
- automated API tests
- Docker and Docker Compose
- GitHub Actions configuration
- existing API documentation
- assignment requirements in the SEN5002 assessment brief

## 2. Current technical snapshot

### Verified in the uploaded snapshot
- Backend automated test suite: **19/19 tests passed** during audit.
- The test suite covers health check, admin/driver login, ride search, driver verification gating, ride publishing, booking state changes, overbooking prevention, cancellation, admin verification, reviews, profile update, analytics, chat authorization and CSV export.
- The project already contains React/Vite frontend, Node/Express backend, Socket.io, JWT, bcrypt, Helmet, rate limiting, API validation dependencies, Docker and GitHub Actions.

### Important limitation found
The archived frontend `node_modules/.bin/vite` was not executable in the extracted package, so `npm --prefix frontend run build` failed with `vite: Permission denied`. This is a packaging/environment problem in the uploaded archive rather than proof that the React source itself cannot build. The final clean package therefore removes `node_modules/`; dependencies should be reinstalled from the lock file.

## 3. Biggest architecture issue — the “database”

The project contains `better-sqlite3` in `backend/package.json`, but the application does **not** use SQLite.

`backend/src/db.js` implements a custom database-like abstraction over:
- JavaScript in-memory objects
- `carpool_data.json`
- regex-based SQL parsing

This is the single biggest technical weakness before the final submission.

### Why this matters
- It is not a real relational database.
- `db.exec()` and `db.pragma()` are effectively no-ops.
- SQL statements are manually interpreted with regex patterns.
- Concurrent writes are unsafe.
- There is no actual schema, foreign-key enforcement, indexes or database constraints.
- `nextId()` derives IDs from current array contents.
- The whole application state is serialized back to JSON.
- A Docker restart/volume mistake can easily expose or hide application state.

### Recommended final architecture
Use the already-declared `better-sqlite3` dependency properly:

```text
backend/
  src/
    db.js
  data/
    carpool.db
```

Create real tables for:
`users`, `driver_verifications`, `passenger_verifications`, `rides`, `bookings`, `messages`, `reviews`.

Create:
```text
backend/src/schema.sql
backend/src/seed.js
```

Then make `db.js` open the SQLite database and expose the actual `prepare`, `exec` and transaction methods from `better-sqlite3`.

Do this as the next implementation sprint rather than mixing it into the cleanup step.

## 4. Admin login — recommended professional separation

### Current situation
The application has:
- one normal authentication page
- user roles such as student/staff
- an internal `system_role = 'admin'`
- admin dashboard authorization on the backend
- an admin mode visible to an authenticated admin account

This is **functionally protected**, because the backend uses `requireAdmin`, but it is not a clean separate admin portal.

### Recommended final design

```text
USER APP
  /login
  -> Student/Staff account
  -> Passenger / Driver mode

ADMIN PORTAL
  /admin/login
  -> Admin credentials only
  -> Admin dashboard
```

Keep the same backend user table if desired, but use a separate admin authentication endpoint such as:

```text
POST /api/admin/auth/login
```

The backend must:
1. validate the credentials;
2. confirm `system_role === 'admin'`;
3. issue an admin JWT/session;
4. reject non-admin accounts;
5. apply a stricter admin login rate limit.

Frontend:
- remove the Admin toggle from the normal user dashboard;
- remove the quick-fill admin credentials from the public UI;
- add a dedicated Admin Login screen;
- allow `/admin/*` routes only after an admin-authenticated session.

This is the cleanest model for your assignment and much closer to a real-world administration portal.

## 5. Critical security issues to fix

### A. Secrets are present in the uploaded package
The uploaded archive contains `.env` files with a real JWT secret value.

Do not commit these files to GitHub.

Only keep:
```text
.env.example
backend/.env.example
```

### B. Demo admin credentials are exposed
The frontend and seed logic contain demo credentials such as `admin123`.

For the final professional version:
- move demo credentials to controlled seed/test configuration;
- never display admin credentials in the production login UI;
- use stronger test passwords.

### C. JWT expiry configuration is partially ignored
`JWT_EXPIRES_IN` exists in environment configuration, but token creation currently hard-codes `7d`.

Use the environment value consistently.

### D. CORS is too open
Socket.io is configured with:

```text
origin: '*'
```

and the Express CORS middleware is open.

For deployment, restrict this to the configured client origin.

### E. JWT stored in localStorage
The frontend stores authentication tokens in localStorage.

For a production-grade system, an HttpOnly, Secure, SameSite cookie is safer against token theft through XSS.

For the undergraduate prototype, localStorage can be retained temporarily, but the security trade-off should be documented.

### F. Content Security Policy is disabled
Helmet is enabled, but CSP is explicitly disabled.

This should be revisited before deployment.

## 6. Features that are already present

| Requirement / Feature | Current status |
|---|---|
| Passenger dashboard | Present |
| Driver dashboard | Present |
| Admin dashboard | Present |
| Driver verification | Present |
| Driver approval gating | Present |
| Ride posting | Present |
| Ride search/filtering | Present |
| Booking | Present |
| Multi-seat booking | Present |
| Booking status workflow | Present |
| Real-time chat | Present |
| Chat authorization | Present |
| Rating/review | Present |
| SOS event flow | Present |
| Odd/even classification | Present |
| Route/map UI | Present |
| Fuel savings UI | Present |
| Analytics endpoints | Present |
| CSV admin export | Present |
| JWT auth | Present |
| Password hashing | Present |
| API rate limiting | Present |
| Automated tests | Present |
| Dockerfile | Present |
| Docker Compose | Present |
| GitHub Actions CI | Present |

## 7. Features/functionality that still need attention

### A. Admin analytics are not fully real
`AdminDashboard.jsx` contains hard-coded trend datasets and a hard-coded top-driver leaderboard.

These should come from server analytics APIs.

Otherwise the dashboard can display numbers that are not based on the actual database.

### B. README is outdated
The README says:
- 8/8 automated tests
- `server` and `client` folders
- port 3000

The actual project uses:
- `backend`
- `frontend`
- 19 tests in the uploaded snapshot
- Vite defaults/dev configuration and a backend production port of 5000

The README should be rewritten to match the actual repository.

### C. API configuration is inconsistent
`frontend/.env` defines `VITE_API_BASE_URL` and `VITE_WS_URL`, but several frontend components use relative `/api` calls directly.

Choose one approach:
- same-origin production architecture, with relative API paths, or
- explicit configurable API base URL for development/deployment.

Do not keep unused environment variables.

### D. Development Socket.io connection needs a deliberate setup
The Socket.io client uses the browser origin, while development can run the frontend and backend on different ports.

For developer mode, add a Vite proxy or configure the Socket.io URL explicitly.

## 8. Location / geolocation requirement

The assessment does **not** ask for full route optimization.

The brief specifically asks for:
- basic geolocation
- route matching
- route/time-window matching
- not a full route optimization algorithm

The current map-based design is therefore appropriate.

### Recommended location flow

```text
Passenger enters:
Pickup location
Destination
Preferred date/time

        ↓

Frontend map/location selector

        ↓

API

        ↓

Server normalizes locations

        ↓

Match by:
- origin area
- destination area
- route waypoint overlap
- date
- time window
- odd/even tag
```

For your final demonstration, show a realistic ICBT commute, e.g.:

```text
Gampaha
  ↓
Kiribathgoda
  ↓
Kelaniya
  ↓
Orugodawatta
  ↓
ICBT Colombo Campus
```

This makes the route-matching requirement visible without over-engineering routing.

## 9. Odd/even fuel scenario

The odd/even feature is central to the assignment scenario.

Use:

```text
Vehicle plate last digit
        ↓
Odd digit → ODD
Even digit → EVEN
```

Then make the matching rule explicit in the documentation:

```text
Vehicle category
        +
travel date / quota day
        +
ride availability
        ↓
compatible ride
```

Do not claim that the system performs advanced fuel policy prediction. The assessment only expects the scenario-driven odd/even handling.

## 10. Real-world quality improvements

The core carpool workflow is already strong for the assignment. The best additional features are not random extras; they should improve trust, safety and coordination.

Recommended priority:
1. Real admin portal
2. Real database
3. Real analytics
4. Driver/passenger verification history
5. No-show / cancellation tracking
6. Emergency contact workflow
7. Trip start/end status
8. Driver/passenger ratings after completion
9. Search by time window
10. Better notification history
11. Audit log for admin actions
12. Basic reporting

Avoid adding a large number of unrelated features immediately. The highest grade gain comes from making the existing features reliable, testable and evidence-backed.

## 11. Testing plan

You already have 19 API tests, which is a good foundation.

Add coverage for:
- invalid email
- weak passwords
- duplicate registration
- wrong admin login
- user attempting admin endpoints
- unverified driver publishing a ride
- confirmed passenger chat authorization
- unauthorized passenger chat
- booking at zero capacity
- duplicate booking
- cancellation restoration
- ride completion
- review validation
- admin deletion/moderation
- malformed location data
- invalid odd/even values

Then separate testing into:

```text
Unit tests
Integration/API tests
Security tests
UI/manual acceptance tests
```

For the assessment, collect screenshots/evidence of the test runner and CI pipeline.

## 12. TDD position for your assignment

The assessment explicitly mentions Test-Driven Development.

For at least a few core features, document:

```text
1. Define expected behaviour
2. Write failing test
3. Implement feature
4. Run test
5. Refactor
6. Repeat
```

Do this for:
- booking capacity
- driver verification gating
- admin approval
- chat authorization

This gives you strong portfolio evidence rather than merely saying “we used TDD”.

## 13. Docker — correct order

You do **not** need Docker running continuously before every GitHub push.

Use this workflow:

```text
1. Code locally
        ↓
2. Run unit/API tests
        ↓
3. Run application locally
        ↓
4. Build Docker image
        ↓
5. Run Docker Compose locally
        ↓
6. Test the container
        ↓
7. Commit
        ↓
8. Push feature branch
        ↓
9. Pull request / merge
        ↓
10. CI runs tests + Docker build
```

The important point is:

**Docker is another validation stage, not a replacement for Git.**

GitHub stores:
- source code
- Dockerfile
- docker-compose.yml
- GitHub Actions workflow

GitHub does **not** need:
- `node_modules`
- `.env`
- runtime DB file
- `dist`
- `.venv`

## 14. Docker problem that must be fixed

The current Compose file contains:

```yaml
volumes:
  - app-data:/app/backend
```

This is dangerous because the entire `/app/backend` directory is the application directory.

The mounted volume can hide the code that was copied into the Docker image.

### Better approach

Use a dedicated data directory:

```text
/app/backend/data
```

and store the SQLite database there.

Then:

```yaml
volumes:
  - app-data:/app/backend/data
```

This is another reason to move from JSON storage to SQLite before final deployment.

## 15. Recommended project structure

```text
carpool-app/
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── auth.js
│   │   ├── db.js
│   │   ├── server.js
│   │   └── seed.js
│   ├── tests/
│   ├── data/
│   ├── schema.sql
│   ├── openapi.json
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── package-lock.json
├── docs/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

## 16. Sprint plan for the remaining work

### Sprint 1 — Stabilisation
Goal: clean architecture

- Replace JSON DB with SQLite
- Fix Docker data volume
- remove demo secrets
- remove hard-coded admin analytics
- update README
- verify frontend/backend local setup

### Sprint 2 — Admin & Security
Goal: professional authorization

- separate admin login
- admin route guard
- admin-specific rate limiting
- audit log
- CORS restriction
- JWT configuration cleanup
- security validation

### Sprint 3 — Testing & Evidence
Goal: assessment-ready testing

- expand API tests
- integration tests
- security tests
- TDD evidence
- CI test execution
- Docker build in CI

### Sprint 4 — Deployment & Portfolio
Goal: final submission quality

- build Docker image
- run Compose stack
- capture deployment evidence
- final Figma prototype
- final API documentation
- final portfolio report
- GitHub cleanup
- final Moodle ZIP

## 17. Task allocation example for a 4-person team

### Member 1 — Backend / Database
- SQLite migration
- schema
- seed
- API fixes

### Member 2 — Frontend / UX
- user dashboards
- admin login
- location/map UX
- Figma prototype

### Member 3 — Testing / Security
- automated tests
- security validation
- API testing
- evidence collection

### Member 4 — DevOps / Documentation
- GitHub
- branching/PRs
- Docker
- CI
- portfolio/report

Everyone should still contribute commits.

## 18. Git branching model

Use:

```text
main
└── develop
    ├── feature/admin-login
    ├── feature/sqlite-db
    ├── feature/security-hardening
    ├── feature/testing
    └── feature/docker-ci
```

Process:

```text
feature branch
   ↓
commit
   ↓
push
   ↓
Pull Request
   ↓
CI
   ↓
review
   ↓
merge
```

Do not do all final work directly on `main`.

## 19. Assignment alignment

The SEN5002 brief expects four assessment areas:

### Project Planning — 10%
Need:
- product vision
- software product management
- measurable goals
- task ownership
- timeline
- dependencies/milestones
- risk/contingency

### Requirements Engineering — 20%
Need:
- personas
- scenarios
- user stories
- prioritised features
- acceptance criteria
- prototype
- core flow coverage
- ideally peer/usability feedback

### Agile and DevOps — 40%
Need:
- Scrum plan
- backlog
- sprint planning
- feature branches
- pull requests
- Git/GitHub
- CI
- Docker
- retrospectives
- evidence of team contribution

### Testing, Security & Deployment — 30%
Need:
- automated tests
- test runner
- TDD evidence
- authentication
- authorization
- password hashing
- security validation
- Docker execution
- deployment evidence
- public URL is the stronger rubric target

## 20. Figma prototype strategy

Because the working application already exists, do not redesign everything from scratch.

Create a polished prototype that mirrors the final system:

```text
Public
 ├── Landing
 └── User Login / Register

User
 ├── Passenger Dashboard
 ├── Search Ride
 ├── Ride Details
 ├── Booking
 ├── Chat
 └── Profile

Driver
 ├── Driver Dashboard
 ├── Publish Ride
 ├── Booking Requests
 ├── Driver Verification
 └── Trip History

Admin
 ├── Admin Login
 ├── Dashboard
 ├── Driver Verification Queue
 ├── Users
 ├── Rides
 ├── Analytics
 └── Reports
```

The Figma screens should match the implemented UI so the prototype, screenshots and software tell the same story.

## 21. What should happen next

### Step 1 — DONE IN THIS PACKAGE
Source cleanup and removal of generated/local files.

### Step 2 — NEXT
Replace the JSON database with real SQLite while keeping the current API contracts stable.

### Step 3
Separate admin authentication.

### Step 4
Fix Docker Compose storage and production configuration.

### Step 5
Replace mock admin analytics with database-backed analytics.

### Step 6
Expand testing and security evidence.

### Step 7
Final Docker + CI verification.

### Step 8
Final Figma + report + submission packaging.

## 22. Final engineering verdict

The uploaded project is **not a bad application**. It already demonstrates a substantial client-server carpool workflow and has a surprisingly broad feature set.

The main problem is not “missing UI features”.

The main problem is **engineering credibility**:
- fake/custom database abstraction instead of real SQLite;
- generated build files mixed into source;
- secrets/demo credentials in the package;
- hard-coded admin analytics;
- incomplete separation of the admin portal;
- outdated README;
- Docker volume configuration that can mask application code;
- some environment configuration that is defined but not consistently used.

Fix those in order, and the project moves from “AI-generated working demo” toward a much more credible **undergraduate Agile + DevOps software engineering submission**.
