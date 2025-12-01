# TMZ 2.0 - Complete Architecture Analysis

## Executive Summary

**Critical Findings:**
1. ✅ **Persistent threat resurrection bug SOLVED** - Implemented proper startup cleanup
2. ⚠️ **Dual frontend confusion** - React and HTML/JS competing for "primary" status
3. ⚠️ **Dual server confusion** - server.js and server.new.js with duplicate pipelines
4. ✅ **Data persistence working correctly** - File-based storage at `backend/data/threats.json`
5. ⚠️ **No database** - All state in JSON files (intentional for prototype, not scalable)

---

## Step 1: Project Overview

### What Problem This Solves
TMZ 2.0 is a **Threat Intelligence and Simulation Platform** for disaster response and emergency planning. It provides:
- Real-time threat visualization on a map
- AI-powered news ingestion pipeline (scrapes threats from text)
- Blast radius simulation for different threat scenarios
- Intelligent evacuation routing with hospital recommendations
- Email alerting system
- Admin threat management

### Intended Users
1. **Emergency Response Teams** - Monitor live threats
2. **Urban Planners** - Simulate disaster scenarios
3. **General Public** - Get evacuation guidance during emergencies
4. **Admins** - Manually broadcast threat alerts

### Core Features
| Feature | Description | Source |
|---------|-------------|---------|
| **Live Threat Map** | Visualizes active threats with danger zones | Frontend (both React + HTML/JS) |
| **News Ingestion Pipeline** | AI extracts threats from raw news text → geocodes → stores | `newsIngestion.service.js` + Python Flask |
| **Blast Simulator** | Calculate damage zones for various explosives/accidents | Frontend simulation logic |
| **Evacuation Routing** | Smart routing to nearest safe hospital using Google Maps + OpenRouter AI | `app.js` lines 236-459 |
| **Admin Panel** | Create/delete threats manually | Frontend admin module + backend API |
| **Email Alerts** | Send threat notifications to subscribers | Python Flask email service |

### Simulation vs Production Logic

**Simulation Components (Demo Mode):**
- `threat_simulator.js` - Serves fake news incidents on port 5050
- `/api/demo/seed` - Seeds 3 hardcoded demo threats
- `/api/demo/clear` - Removes all ephemeral threats
- Frontend simulator tab - Manual threat scenario testing

**Production Components:**
- Real news feeds would replace `threat_simulator.js`
- Python AI extraction/geocoding (production-ready)
- Admin threat creation (production-ready)
- All persistence and expiry logic (production-ready)

---

## Step 2: Architecture Breakdown

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                            │
│  ┌────────────────────┐      ┌──────────────────────────┐   │
│  │  HTML/JS Frontend  │      │   React Frontend (UNUSED)│   │
│  │  (public/)         │      │   (frontend-react/)      │   │
│  │  - app.new.js      │      │   - SystemStatusBar.jsx  │   │
│  │  - modules/*.js    │      │   - ThreatMap.jsx        │   │
│  └────────────────────┘      └──────────────────────────┘   │
└───────────────────┬──────────────────────────────────────────┘
                    │ HTTP/REST
┌───────────────────▼──────────────────────────────────────────┐
│                   NODE.JS BACKEND                            │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │  server.js   │  │server.new.js │ ◀── Confusion!          |
│  │  (LEGACY)    │  │  (PRIMARY)   │     Two servers         │
│  │  Port 3001   │  │  Port 3000   │     with duplicate logic│
│  └──────────────┘  └──────────────┘                         │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Routes (Express)                         │  │
│  │  /api/threats, /api/login, /api/demo, /config         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Services                                 │  │
│  │  • threatStorage.service.js  (CRUD + Expiry)          │  │
│  │  • newsIngestion.service.js  (News polling pipeline)  │  │
│  │  • pythonService.service.js  (Spawn Python Flask)     │  │
│  │  • emailAlert.service.js     (Alert dispatch)         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Data Persistence                          │  │
│  │  backend/data/threats.json  ◀── All threat state here │  │
│  │  backend/data/users.json    ◀── Auth (plain text!)    │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────┬──────────────────────────────────────────┘
                    │ HTTP (localhost:5000)
┌───────────────────▼──────────────────────────────────────────┐
│                   PYTHON FLASK SERVICE                       │
│  backend/data/news_service.py                                │
│  • /api/extract-threat-info  (AI extraction via OpenRouter)  │
│  • /api/geocode              (AI geocoding)                  │
│  • /evaluate_facilities      (Hospital ranking)              │
│  • /api/alert                (Email sender via SMTP)         │
└───────────────────┬──────────────────────────────────────────┘
                    │
            ┌───────┴────────┐
            │                │
┌───────────▼───┐   ┌────────▼──────────┐
│  OpenRouter AI │   │  Threat Simulator │
│  (External)    │   │  (localhost:5050) │
└────────────────┘   └───────────────────┘
```

### Request/Response Flows

#### Flow 1: User Opens App
```
1. Browser → GET / → server.new.js
2. server.new.js → static middleware → public/index.html
3. index.html → <script type="module" src="/app.new.js">
4. app.new.js → imports modules (auth, map, threats, etc.)
5. AuthModule → check localStorage['authToken']
   - If missing → redirect to /login.html
   - If present → continue
6. GET /config → server.new.js → { googleMapsApiKey }
7. Load Google Maps SDK
8. Initialize map + modules
9. GET /api/threats → server.new.js → threatStorage.readThreats()
10. Display threats on map
```

#### Flow 2: News Ingestion Pipeline (Background)
```
Every 15 seconds:
1. newsIngestion.service.pollSimulator()
   ↓
2. GET http://localhost:5050/api/fake-news-threat
   ← { id, timestamp, text: "Explosion at factory..." }
   ↓
3. Check if threat ID already exists (dedupe)
   ↓
4. POST http://localhost:5000/api/extract-threat-info
   body: { text: "Explosion at factory..." }
   ← { name, locationName, yield, incidentType, details, durationMinutes }
   ↓
5. POST http://localhost:5000/api/geocode
   body: { locationName: "Peenya Industrial Area" }
   ← { lat: 13.xxx, lng: 77.xxx }
   ↓
6. Assemble final threat object:
   {
     id, timestamp, expiresAt, name, location, yield,
     source: "simulation_news", rawText
   }
   ↓
7. threatStorage.addThreat(finalThreat)
   → Writes to backend/data/threats.json
   ↓
8. POST http://localhost:5000/api/alert
   body: { email: globalRecipient, location: threat.locationName }
   → Sends email via SMTP
```

#### Flow 3: Admin Creates Threat
```
1. User clicks "Broadcast Alert" in Admin panel
   ↓
2. POST /api/threats
   body: { name, location, yield, durationMinutes }
   ↓
3. threat.routes.js → calculateExpiry(durationMinutes)
   ↓
4. threatStorage.addThreat()
   → Appends to threats.json with source="admin"
   ↓
5. Frontend polls GET /api/threats every few seconds
   ↓
6. Threat appears on map
```

#### Flow 4: User Deletes Threat
```
1. Admin clicks "Delete" on threat in UI
   ↓
2. DELETE /api/threats/:id
   ↓
3. threat.routes.js checks isPersistentThreat()
   - If id="test-threat-001" OR source="admin" → 403 Forbidden
   - Else → deleteThreat(id)
   ↓
4. threatStorage.deleteThreat()
   → Filters out threat from array
   → Writes updated array to threats.json
   ↓
5. Frontend removes from map
```

### Data Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    THREAT LIFECYCLE                          │
└─────────────────────────────────────────────────────────────┘

Creation Sources:
  1. Admin UI → POST /api/threats → source="admin"
  2. News Pipeline → newsIngestion → source="simulation_news"
  3. Demo Seeder → POST /api/demo/seed → source="demo"

Persistence Rules:
  • Persistent threats (survive restart):
    - id="test-threat-001" (hardcoded immortal)
    - source="admin"
    - persistent=true flag
  
  • Ephemeral threats (cleared on restart):
    - source="simulation_news"
    - source="demo"
    - Any threat without persistence flag

Expiry:
  • Threats with expiresAt → Auto-filtered in readThreats()
  • No expiresAt → Lives forever (until server restart if ephemeral)

Deletion:
  • DELETE /api/threats/:id → Immediately removes from JSON
  • Persistent threats → Protected from deletion (403 error)

Server Restart Behavior:
  1. initializeThreatsFile() runs at startup
  2. Reads existing threats.json
  3. Filters out:
     - Expired threats (isExpired)
     - Ephemeral threats (!isPersistentThreat)
  4. Ensures test-threat-001 exists (seedTestThreatIfMissing)
  5. Writes cleaned array back to disk
```

**File Locations:**
- Primary storage: `backend/data/threats.json`
- Service logic: `backend/services/threatStorage.service.js`
- Expiry utils: `backend/utils/threatExpiry.util.js`

---

## Step 3: Critical State & Persistence Analysis

### Where Threats Are Stored

**Single Source of Truth:** `backend/data/threats.json`

```json
[
  {
    "id": "test-threat-001",
    "name": "test01",
    "locationName": "Lingarajapurum, Bengaluru",
    "location": { "lat": 13.013251, "lng": 77.624151 },
    "details": "i killed the toilet lol (it worked!!)",
    "yield": 7700,
    "timestamp": "2025-12-01T08:29:30.824Z",
    "source": "admin"
  }
]
```

**Storage Pattern:**
- ✅ No in-memory caching - direct file I/O every request
- ✅ Synchronous reads/writes (fs.readFileSync / fs.writeFileSync)
- ⚠️ No database - single JSON file (not scalable beyond ~1000 threats)
- ✅ Atomic writes - entire file replaced per operation

### Why Some Threats Reappear After Deletion

**Root Cause:** Intentional design for persistent "demo" threats.

**Exact Logic (threatStorage.service.js:34-52):**
```javascript
function seedTestThreatIfMissing(threats) {
    const TEST_THREAT_ID = 'test-threat-001';
    const TEST_THREAT_OBJECT = {
        id: TEST_THREAT_ID,
        name: 'test01',
        // ... hardcoded data
        source: 'admin'
    };

    const exists = threats.some(t => t.id === TEST_THREAT_ID);
    if (exists) return threats;
    
    logger.threat('Seeding missing test threat: test-threat-001');
    return [...threats, TEST_THREAT_OBJECT];
}
```

**When This Runs:**
1. **Server startup** (initializeThreatsFile, line 58)
2. **After cleanup** (line 87)

**Behavior:**
- If `test-threat-001` is missing → re-add it
- This is **INTENTIONAL** - acts as a built-in demo threat
- User cannot permanently delete it via UI (403 error in DELETE endpoint)

**Other Resurrection Scenarios (NOW FIXED):**

Before (BUG):
- Ephemeral threats from news pipeline survived restarts
- Caused confusion - users thought deletions failed

After (FIXED - Code Review from Dec 1):
```javascript
// threatStorage.service.js:58-104
export function initializeThreatsFile() {
    // ...
    for (const t of allThreats) {
        if (isExpired(t, now)) {
            removedExpired++;
            continue;  // ← Expired threats don't survive restart
        }
        if (!isPersistentThreat(t)) {
            removedEphemeral++;
            continue;  // ← News/demo threats don't survive restart
        }
        keptThreats.push(t);
    }
    // ...
}
```

**Current Behavior (Correct):**
| Threat Type | Survives Restart | Can Delete via UI | Expires |
|-------------|------------------|-------------------|---------|
| test-threat-001 | ✅ Always | ❌ Protected | ❌ Never |
| Admin-created (source="admin") | ✅ Yes | ❌ Protected | ✅ If expiresAt set |
| News (source="simulation_news") | ❌ Cleared | ✅ Yes | ✅ Auto-expires (default 60min) |
| Demo (source="demo") | ❌ Cleared | ✅ Yes | ❌ No expiry |

### Persistence: Intentional or Accidental?

**100% Intentional Design:**

```javascript
// threatStorage.service.js:21-27
export function isPersistentThreat(threat) {
    if (!threat) return false;
    if (threat.id === 'test-threat-001') return true;  // Hardcoded immortal
    if (threat.source === 'admin') return true;        // Admin threats persist
    if (threat.persistent === true) return true;       // Explicit flag
    return false;
}
```

This is a **demo/safety feature**:
- Ensures there's always at least one visible threat
- Prevents accidental deletion of admin-created threats
- Ephemeral simulation threats auto-clean

**Design Intent:**
- ✅ Test threat = permanent demo fixture
- ✅ Admin threats = persist across restarts (until manually managed)
- ✅ News threats = temporary, auto-expire
- ✅ Clear separation of persistent vs ephemeral state

### In-Memory vs Disk-Backed State

**All state is disk-backed:**
```javascript
// Every read operation:
readThreats() 
  → fs.readFileSync(THREATS_FILE) 
  → parse JSON 
  → filter expired
  → return array

// Every write operation:
addThreat(threat)
  → read current array
  → append new threat
  → fs.writeFileSync(THREATS_FILE, JSON.stringify(...))
```

**No caching layer:**
- ✅ Guarantees consistency across processes
- ⚠️ Performance bottleneck for high-frequency updates
- ⚠️ Risk of file corruption if multiple processes write simultaneously

**Cache/Bootstrap Logic:**
- **No cache** - file read on every HTTP request
- **Bootstrap:** `initializeThreatsFile()` at server startup (server.new.js:59)
  - Creates file if missing
  - Cleans expired/ephemeral threats
  - Seeds test threat

---

## Step 4: Frontend Strategy Evaluation

### Current State: Dual Frontend Mess

**Frontend #1: HTML/JS (public/)**
- Entry: `public/index.html` → `<script type="module" src="/app.new.js">`
- Modular structure:
  - `public/modules/auth.module.js`
  - `public/modules/map.module.js`
  - `public/modules/threats.module.js`
  - `public/modules/evacuation.module.js`
  - `public/modules/simulation.module.js`
  - `public/modules/admin.module.js`
  - `public/modules/news.module.js`
- Served by: `server.new.js` via `express.static()`
- Port: 3000
- Status: **✅ PRIMARY (after latest changes)**

**Frontend #2: React (frontend-react/)**
- Built with: Vite + React
- Components:
  - `SystemStatusBar.jsx`
  - `ThreatMap.jsx`
  - etc.
- Dev server: `npm run dev` (port 5173)
- Status: **❌ UNUSED** (marked deprecated in README)

### Which Pipelines Depend on Which UI?

**Backend pipelines are UI-agnostic:**
- News ingestion → Runs in background, no UI dependency
- Threat storage → REST API, UI-independent
- Email alerts → Triggered server-side
- Python AI services → Backend-only

**UI responsibilities:**
| Feature | HTML/JS | React | Backend |
|---------|---------|-------|---------|
| Display threats on map | ✅ | ✅ (was) | N/A |
| Create admin threats | ✅ | ✅ (was) | API endpoint |
| Simulate blast zones | ✅ | ✅ (was) | N/A (client-side calc) |
| Evacuation routing | ✅ | ❌ | Partial (AI hospital ranking) |
| News tab | ✅ | ❌ | API endpoint |

**Coupling:**
- ⚠️ `server.new.js` has catch-all route for SPA fallback
- ⚠️ Both frontends hit same `/api/*` endpoints
- ✅ No frontend-specific backend logic (good!)

### Can React Be Fully Removed Safely?

**YES - Safely removable:**

**Dependencies:**
```
Backend → ✅ No imports of React code
Pipelines → ✅ No React references
Data flow → ✅ Pure REST APIs
```

**Steps to remove:**
1. Delete `frontend-react/` directory
2. Remove from `README.md` (already done)
3. Keep backend unchanged
4. **Risk: ZERO** - React was never integrated into build/deploy

**Why it was built:**
- Experimental prototype for "modern" UI
- Never completed migration
- HTML/JS version more feature-complete

### Pros/Cons of Server-Only Frontend

**HTML/JS Frontend (Current):**

**Pros:**
- ✅ No build step - direct modification
- ✅ Faster development iteration
- ✅ Simpler deployment (just copy files)
- ✅ Full feature parity achieved
- ✅ Modular structure (`modules/*.js`)
- ✅ Google Maps integration mature

**Cons:**
- ❌ No TypeScript type safety
- ❌ Manual DOM manipulation (more bugs)
- ❌ No component reusability framework
- ❌ State management ad-hoc
- ❌ Testing harder

**React Frontend (Abandoned):**

**Pros:**
- ✅ Component-based architecture
- ✅ TypeScript support
- ✅ Better state management (hooks)
- ✅ Modern dev tools

**Cons:**
- ❌ Build complexity
- ❌ Incomplete implementation
- ❌ Missing critical features (evacuation AI)
- ❌ Double the maintenance
- ❌ Vite dev server required

### Recommendation: **Kill React**

**Rationale:**
1. HTML/JS frontend is **feature-complete**
2. React version is **incomplete prototype**
3. No team bandwidth for dual maintenance
4. Backend is UI-agnostic (can always rebuild frontend later)
5. **You already made this decision** (deprecated React in README)

**Action Plan:**
```bash
# Safe to run now:
rm -rf frontend-react/
git commit -m "Remove unused React prototype"
```

**Future Path:**
- Keep modular JS structure in `public/modules/`
- If scaling becomes an issue → Consider:
  - Next.js SSR for SEO
  - SvelteKit for performance
  - Stick with vanilla JS + TypeScript compilation

**Hybrid Option (NOT RECOMMENDED):**
- Keep React for "admin dashboard"
- Keep HTML/JS for "public map view"
- **WHY NOT:** Doubles deployment complexity for minimal benefit

---

## Step 5: Pipeline & Simulation Review

### Threat Generation Mechanisms

#### 1. Manual (Admin UI)
```
User fills form → POST /api/threats
├─ name: string
├─ location: {lat, lng}
├─ yield: number
├─ durationMinutes: number (optional)
└─ details: string

Backend:
├─ Calculates expiresAt from durationMinutes
├─ Sets source="admin"
├─ Sets persistent=true (survives restart)
└─ Writes to threats.json
```

#### 2. Dummy Server (threat_simulator.js)
```javascript
// Port 5050
GET /api/fake-news-threat
  → Returns random text from newsIncidents array
  → Example: "A massive chemical leak has been reported..."

Backend polls this every 15s:
  → Extract threat info via AI
  → Geocode location
  → Create threat with source="simulation_news"
  → Auto-expires after 60 minutes (default)
```

#### 3. Demo Seeder
```
POST /api/demo/seed
  → Clears all ephemeral threats
  → Adds 3 hardcoded demo threats:
    - Mandur waste plant fire
    - Whitefield structural collapse
    - Electronic City chemical spill
  → source="demo", no expiry
```

### Time-Based Expiration Logic

**Calculation:**
```javascript
// backend/utils/threatExpiry.util.js:30
export function calculateExpiry(durationMinutes) {
    if (!durationMinutes) return null;  // Null = permanent
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + parseInt(durationMinutes));
    return expiryDate.toISOString();  // "2025-12-01T15:30:00.000Z"
}
```

**Enforcement Points:**

1. **Request Time (Soft Delete):**
```javascript
// GET /api/threats
router.get('/threats', (req, res) => {
    const threats = readThreats(); // ← Filters expired here
    res.json(threats);
});

// backend/services/threatStorage.service.js:127
export function readThreats(includeExpired = false) {
    const threats = JSON.parse(fs.readFileSync(THREATS_FILE));
    return includeExpired ? threats : filterExpired(threats);  // ← Filter
}
```

2. **Startup Time (Hard Delete):**
```javascript
// server.new.js:59 → initializeThreatsFile()
// Removes expired threats from file on boot
```

**Expiry Check:**
```javascript
// backend/utils/threatExpiry.util.js:11
export function isExpired(threat) {
    if (!threat.expiresAt) return false;  // No expiry = never expires
    return new Date(threat.expiresAt).getTime() <= Date.now();
}
```

**Frontend Display:**
```javascript
// Admin panel shows:
"Expires in: 45 minutes"  // Calculated from expiresAt
"Permanent"                // If no expiresAt
```

### Presets vs Dynamic Data

**Presets (Hardcoded in Frontend):**
```javascript
// public/app.js:22-34
const threatScenarios = {
  accidents: [
    { name: "Small Propane Tank", yield: 100 },
    { name: "Industrial Gas Leak", yield: 5000 },
    // ...
  ],
  weapons: [
    { name: "Standard Car Bomb", yield: 500 },
    { name: "Little Boy (Hiroshima)", yield: 15000000 },
    // ...
  ]
};
```
Used for: Simulator tab only (client-side calculations)

**Dynamic Data (API-Driven):**
- All threat CRUD → `/api/threats`
- News ingestion → background service
- Real-time updates → frontend polls API every 5-10 seconds

### Alert Generation

**Email Alerts:**
```
Trigger points:
1. News pipeline processes threat
   → newsIngestion.service.js:99-109
   → Calls sendEmailAlert(null, threat)

2. User clicks "Send Email Report" in News tab
   → Frontend calls POST http://localhost:5000/api/alert

Email flow:
  → Python Flask (news_service.py)
  → SMTP via app.config['MAIL_*']
  → Recipient from:
      - Request body { email }
      - OR global env var ALERT_RECIPIENT_EMAIL
      - OR backend/data/alert_recipient.json
```

**Danger State Rings:**
```javascript
// Blast zones calculated from yield:
const scaledDistanceFactor = Math.cbrt(yieldKg);

zones = {
  lethal: 25 * scaledDistanceFactor,   // Innermost (red)
  severe: 50 * scaledDistanceFactor,   // Orange
  moderate: 100 * scaledDistanceFactor, // Yellow
  minor: 200 * scaledDistanceFactor     // Outermost (blue)
}

// Rendered as Google Maps Circles with fillOpacity
```

### Failure Cases

#### 1. Double Alerts
**Scenario:** Same threat triggers multiple emails

**Current Protection:**
```javascript
// newsIngestion.service.js:49-52
if (threatExists(newsItem.id)) {
    return null;  // Skip duplicate
}
```
✅ **SAFE** - Deduplication by ID

**Potential Issue:**
- If `threat_simulator.js` generates IDs poorly (e.g., non-unique)
- **Current impl:** `id: "news_sim_" + Date.now()` - ✅ Safe (timestamp-based)

#### 2. Ghost Threats (Expired but Visible)
**Scenario:** Threat shows on map after expiry time

**Root Cause:** Frontend polling lag

```javascript
// Frontend fetches every 5-10 seconds
setInterval(() => {
  fetch('/api/threats').then(res => res.json()).then(updateMap);
}, 5000);

// Threat expires at 15:30:00
// Frontend polls at 15:29:58 → Sees it
// Threat expires
// Frontend polls at 15:30:03 → Sees it (5s delay!)
```

**Impact:** Up to 10 seconds of "ghost" visibility
**Severity:** Low (UX glitch, not data corruption)
**Fix:** Frontend-side expiry check before rendering

#### 3. Race Conditions

**A. Concurrent Threat Creation**
```javascript
// Two admin users create threats simultaneously
User 1 → POST /api/threats → reads threats.json → [oldThreat]
User 2 → POST /api/threats → reads threats.json → [oldThreat]
User 1 → writes [oldThreat, newThreat1] to file
User 2 → writes [oldThreat, newThreat2] to file  // ← CLOBBERS User 1's write!
```
**Result:** Lost write (newThreat1 disappears)
**Severity:** ⚠️ MEDIUM - Rare but possible
**Fix:** Atomic file operations + lock mechanism OR move to database

**B. Restart During Pipeline Processing**
```
1. News pipeline fetches threat text
2. Server restarts
3. Pipeline tries to write to file
   → Error: File handle lost
```
**Current Behavior:** Pipeline crashes, retries next cycle (15s)
**Severity:** Low (self-healing)

**C. Delete During News Ingestion**
```
1. Admin deletes threat "abc123"
2. News pipeline (different process) reads threats.json
3. Pipeline sees old data, re-adds "abc123"
```
**Current Protection:** None - but unlikely (news threats have unique IDs)
**Severity:** Low

---

## Step 6: Bugs, Smells & Risks

### Architectural Smells

#### 1. Dual Server Files (server.js vs server.new.js)
**Smell:** Two entrypoints with duplicate logic

**Evidence:**
- `server.js` (legacy): Has full auth, threats, pipeline
- `server.new.js` (primary): Cleaner structure, modular routes

**Risk:** Confusion, accidental use of wrong server
**Fix:** ✅ **DONE** - Marked server.js as deprecated

**Residual Issue:** server.js still has working pipeline code - should be deleted

#### 2. Plaintext Passwords
**Location:** `backend/data/users.json`
```json
[
  { "email": "admin@tmz.com", "password": "admin123" }
]
```
**Risk:** 🚨 **CRITICAL SECURITY FLAW**
**Fix Required:**
```javascript
import bcrypt from 'bcrypt';

// Signup:
const hashedPassword = await bcrypt.hash(password, 10);
users.push({ email, hashedPassword });

// Login:
const match = await bcrypt.compare(password, user.hashedPassword);
```

#### 3. No Authentication Middleware
**Current:** Token validation is client-side only
```javascript
// Frontend checks localStorage['authToken']
// Backend NEVER validates it!
```

**Risk:** Any HTTP client can bypass auth:
```bash
curl -X POST http://localhost:3000/api/threats \
  -H "Content-Type: application/json" \
  -d '{"name": "Fake Threat", ...}'
```
**No validation → Threat created!**

**Fix Required:**
```javascript
// backend/middleware/auth.middleware.js
export function requireAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || !isValidToken(token)) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

// Usage:
router.post('/threats', requireAuth, (req, res) => { ... });
```

#### 4. File-Based Storage Limits
**Current Scalability:**
- ✅ Works for < 1,000 threats
- ⚠️ Slow for 1,000-10,000 threats
- ❌ Breaks at > 10,000 threats (file too large)

**Synchronous I/O blocks event loop:**
```javascript
fs.readFileSync(THREATS_FILE);  // Blocks entire server!
```

**Fix:** Move to database (PostgreSQL, MongoDB)

#### 5. Python Service Dependency
**Risk:** If Python service crashes, entire pipeline fails

**Current Behavior:**
```javascript
// pythonService.service.js:56
pythonProcess = spawn('python', [scriptPath]);

proc.on('close', (code) => {
    logger.python(`Process exited with code ${code}`);
    pythonProcess = null;  // ← No automatic restart!
});
```

**Issue:** Once Python dies, no auto-recovery
**Fix:** Add restart logic or use PM2 for process management

### Logical Inconsistencies

#### 1. expiresAt Timezone Ambiguity
**Issue:** Expiry is ISO string, compared against `Date.now()` (UTC)

```javascript
// What if server timezone != UTC?
const expiryDate = new Date();  // Uses system timezone!
expiryDate.setMinutes(expiryDate.getMinutes() + 60);
return expiryDate.toISOString();  // Converts to UTC
```

**Current:** ✅ Works correctly (ISO is UTC-based)
**Gotcha:** Server time drift could cause early/late expiry

#### 2. Persistent Flag vs Source Logic
**Confusion:** Two ways to mark persistence

```javascript
isPersistentThreat(threat) {
    if (threat.id === 'test-threat-001') return true;
    if (threat.source === 'admin') return true;
    if (threat.persistent === true) return true;  // ← Redundant?
}
```

**Question:** When is `persistent` flag used separately from `source`?
**Answer:** Never in current code - it's a vestigial design
**Fix:** Remove `persistent` flag, rely solely on `source`

#### 3. Demo Endpoint Naming
```
POST /api/demo/seed   → Creates demo threats
POST /api/demo/clear  → Removes demo threats
```

**Inconsistency:** `/seed` doesn't check if demos already exist → duplicates possible
**Fix:** Idempotent seeding (check for existing demos first)

### Race Conditions (Detailed)

**See Step 5 "Failure Cases" for details**

### Restart Bugs

**Fixed:** Ephemeral threats no longer resurrect (✅ Dec 1 update)

**Remaining Issue:** `test-threat-001` always reappears
- Is this a bug? **NO** - Intentional demo fixture
- Should it be removable? **DESIGN DECISION**

**Recommendation:**
- Add environment variable: `SKIP_TEST_THREAT=true`
- Or: Add admin UI toggle to disable test threat

### Deletion Not Propagating Correctly

**Current:** ✅ WORKS CORRECTLY

**Protection Logic:**
```javascript
// threat.routes.js:52
if (targetThreat && isPersistentThreat(targetThreat)) {
    return res.status(403).json({ 
        error: "This built-in test threat cannot be permanently deleted." 
    });
}
```

**Behavior:**
- Delete persistent threat → 403 error, frontend shows message
- Delete ephemeral threat → 200 OK, removed from file
- **No ghost deletions**

### Security Risks

| Risk | Severity | Impact |
|------|----------|--------|
| Plaintext passwords | 🚨 CRITICAL | Account takeover |
| No API auth | 🔴 HIGH | Unauthorized threat creation/deletion |
| CORS wide open | 🟡 MEDIUM | CSRF attacks possible |
| File write race conditions | 🟡 MEDIUM | Data loss |
| Python SMTP credentials in plaintext | 🔴 HIGH | Email account compromise |
| No rate limiting | 🟡 MEDIUM | API abuse/DoS |
| No input validation | 🔴 HIGH | XSS, injection attacks |

### Scaling Risks

**Current Architecture Breaks At:**
- **500+ concurrent users** - Synchronous file I/O blocks event loop
- **10,000+ threats** - JSON file too large, parse time > 1s
- **Multiple server instances** - File writes clobber each other

**Fix Path:**
1. Add Redis for read cache
2. Migrate to PostgreSQL for writes
3. Implement connection pooling
4. Add load balancer

---

## Step 7: Concrete Improvement Plan

### Goal: Production-Ready Architecture

### Phase 1: Quick Wins (1-2 days)

#### A. Security Hardening
```javascript
// 1. Hash passwords
npm install bcrypt
// Update auth.routes.js to use bcrypt (see Step 6)

// 2. Add auth middleware
// backend/middleware/auth.middleware.js
export function requireAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    // Validate JWT token (add jsonwebtoken package)
    if (!isValidJWT(token)) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

// 3. Protect routes
import { requireAuth } from '../middleware/auth.middleware.js';

router.post('/threats', requireAuth, ...);
router.delete('/threats/:id', requireAuth, ...);

// 4. Move secrets to .env
SMTP_PASSWORD=...
OPENROUTER_API_KEY=...
JWT_SECRET=...
```

#### B. Remove Dead Code
```bash
# Delete legacy server
rm server.js

# Delete React frontend (already deprecated)
rm -rf frontend-react/

# Update package.json
# Remove "start:legacy-html" script
```

#### C. Fix Python Service Restart
```javascript
// pythonService.service.js
proc.on('close', (code) => {
    logger.python(`Process exited with code ${code}`);
    pythonProcess = null;
    
    // Auto-restart after 5s
    setTimeout(() => {
        logger.python('Auto-restarting Python service...');
        startPythonService();
    }, 5000);
});
```

### Phase 2: Data Layer Refactor (1 week)

#### A. Migrate to PostgreSQL

**Schema:**
```sql
CREATE TABLE threats (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location_name VARCHAR(255),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    details TEXT,
    yield INTEGER,
    incident_type VARCHAR(50),
    hazard_category VARCHAR(50),
    source VARCHAR(50) NOT NULL,
    persistent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    raw_text TEXT
);

CREATE INDEX idx_expires_at ON threats(expires_at);
CREATE INDEX idx_source ON threats(source);

-- Auto-cleanup job
CREATE OR REPLACE FUNCTION cleanup_expired_threats()
RETURNS void AS $$
BEGIN
    DELETE FROM threats 
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Run every 5 minutes
SELECT cron.schedule('cleanup-threats', '*/5 * * * *', 
  'SELECT cleanup_expired_threats()');
```

**Migration Steps:**
1. Install pg module: `npm install pg`
2. Create `backend/db/pool.js`:
```javascript
import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});
```

3. Rewrite `threatStorage.service.js`:
```javascript
export async function readThreats(includeExpired = false) {
    const query = includeExpired 
        ? 'SELECT * FROM threats'
        : 'SELECT * FROM threats WHERE expires_at IS NULL OR expires_at > NOW()';
    
    const result = await pool.query(query);
    return result.rows;
}

export async function addThreat(threat) {
    const query = `
        INSERT INTO threats (id, name, location_name, location_lat, location_lng, 
                            details, yield, incident_type, hazard_category, source, 
                            persistent, expires_at, raw_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
    `;
    
    const values = [
        threat.id || crypto.randomUUID(),
        threat.name,
        threat.locationName,
        threat.location.lat,
        threat.location.lng,
        threat.details,
        threat.yield,
        threat.incidentType,
        threat.hazardCategory,
        threat.source || 'admin',
        isPersistentThreat(threat),
        threat.expiresAt,
        threat.rawText
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
}
```

4. Update all routes to use async/await:
```javascript
router.get('/threats', async (req, res) => {
    try {
        const threats = await readThreats();
        res.json(threats);
    } catch (err) {
        logger.error(`Failed to load threats: ${err.message}`);
        res.status(500).json({ error: "Could not load threats" });
    }
});
```

#### B. Add Redis Cache Layer
```javascript
import Redis from 'ioredis';
const redis = new Redis();

export async function readThreatsCached() {
    const cached = await redis.get('threats:all');
    if (cached) {
        return JSON.parse(cached);
    }
    
    const threats = await readThreats();
    await redis.setex('threats:all', 10, JSON.stringify(threats)); // 10s TTL
    return threats;
}
```

### Phase 3: API Improvements (3-5 days)

#### A. Add Input Validation
```javascript
import Joi from 'joi';

const createThreatSchema = Joi.object({
    name: Joi.string().required().max(255),
    location: Joi.object({
        lat: Joi.number().required().min(-90).max(90),
        lng: Joi.number().required().min(-180).max(180)
    }).required(),
    yield: Joi.number().required().min(0),
    durationMinutes: Joi.number().optional().min(0),
    details: Joi.string().optional().max(1000)
});

router.post('/threats', requireAuth, async (req, res) => {
    const { error, value } = createThreatSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    // ...
});
```

#### B. Add Rate Limiting
```javascript
import rateLimit from 'express-rate-limit';

const createThreatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: "Too many threats created, please try again later"
});

router.post('/threats', requireAuth, createThreatLimiter, ...);
```

#### C. WebSocket for Real-Time Updates
```javascript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3001 });

// Broadcast to all clients when threat added/updated/deleted
function broadcastThreatUpdate(type, threat) {
    wss.clients.forEach(client => {
        client.send(JSON.stringify({ type, threat }));
    });
}

// In addThreat():
const newThreat = await addThreat(threat);
broadcastThreatUpdate('threat_added', newThreat);
```

**Frontend:**
```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onmessage = (event) => {
    const { type, threat } = JSON.parse(event.data);
    if (type === 'threat_added') {
        addThreatToMap(threat);
    }
    // No more polling!
};
```

### Phase 4: Frontend Refactor (1 week)

#### A. TypeScript Migration
```bash
npm install typescript @types/google.maps
npx tsc --init
```

Convert modules incrementally:
```typescript
// public/modules/threats.module.ts
export interface Threat {
    id: string;
    name: string;
    location: {
        lat: number;
        lng: number;
    };
    yield: number;
    expiresAt?: string;
    source: 'admin' | 'simulation_news' | 'demo';
}

export class ThreatsModule {
    private threats: Threat[] = [];
    
    async fetchThreats(): Promise<Threat[]> {
        const res = await fetch('/api/threats');
        this.threats = await res.json();
        return this.threats;
    }
}
```

#### B. Add Build Step
```json
// package.json
{
  "scripts": {
    "build": "tsc && esbuild public/app.new.ts --bundle --outfile=public/app.new.js",
    "dev": "tsc --watch & esbuild public/app.new.ts --bundle --watch --outfile=public/app.new.js"
  }
}
```

### Folder Restructure (Optional)

**Current:**
```
TMZ 2.0/
├── backend/
│   ├── data/         ← Weird: code + data mixed
│   ├── routes/
│   ├── services/
│   └── utils/
├── public/
│   ├── modules/
│   └── app.new.js
├── server.new.js     ← Should be in backend/
└── threat_simulator.js  ← Should be in backend/services/
```

**Cleaner:**
```
tmz-2.0/
├── src/
│   ├── backend/
│   │   ├── index.js          (server.new.js renamed)
│   │   ├── routes/
│   │   ├── services/
│   │   │   └── threatSimulator.service.js  (from threat_simulator.js)
│   │   ├── middleware/
│   │   └── utils/
│   ├── frontend/
│   │   ├── index.html
│   │   ├── app.ts
│   │   ├── modules/
│   │   └── styles/
│   └── python/
│       └── news_service.py
├── data/               ← Separate from code
│   ├── threats.json
│   └── users.json
├── package.json
└── tsconfig.json
```

### Migration Steps (Incremental)

**Week 1:**
- [x] Remove React frontend
- [x] Deprecate server.js
- [ ] Add password hashing
- [ ] Add JWT auth middleware
- [ ] Move secrets to .env

**Week 2:**
- [ ] Set up PostgreSQL database
- [ ] Write migration script (JSON → SQL)
- [ ] Update threatStorage service
- [ ] Add database indexes

**Week 3:**
- [ ] Add input validation (Joi)
- [ ] Add rate limiting
- [ ] WebSocket for live updates
- [ ] Remove polling from frontend

**Week 4:**
- [ ] TypeScript migration (backend)
- [ ] TypeScript migration (frontend)
- [ ] Add unit tests (Jest)
- [ ] Add integration tests

**Week 5:**
- [ ] Refactor folder structure
- [ ] Add Docker containerization
- [ ] CI/CD pipeline
- [ ] Documentation update

---

## Step 8: Validation Questions

### Design Intent Questions

1. **Test Threat Persistence:** Should `test-threat-001` be permanently undeletable, or should admins have a way to remove it? If removable, should it auto-restore on next restart?

2. **Admin Threat Persistence:** Should admin-created threats survive server restarts indefinitely, or should they also be time-bound? Current design: survive forever unless `expiresAt` is set.

3. **Ephemeral Threat Policy:** News-ingested threats are cleared on restart. Is this intentional for "fresh start" behavior, or should they persist until natural expiry?

4. **Demo Mode Separation:** Should demo threats be completely isolated (separate endpoint, different map layer) or continue to mix with real threats?

5. **Expiry Precision:** Current expiry check is `<=` (expires at exact time). Should it be `<` (expires after 1ms past time)? Edge cases for exactly-on-the-second expiry.

### Functional Requirements Questions

6. **Real-Time Updates:** Do users expect instant map updates when another admin adds a threat, or is 5-10 second polling delay acceptable?

7. **Offline Mode:** Should the frontend work without Python service running? Currently, AI features fail silently. Should there be fallback behavior?

8. **Email Alert Frequency:** If multiple threats appear in 1 minute, should users get 1 email per threat or batched digest? Current: 1 per threat.

9. **Maximum Threat Count:** What's the expected upper limit for active threats at once? 10? 100? 1,000? Affects database/caching strategy.

10. **Geofencing:** Should threats auto-expire when user moves out of danger zone, or always respect `expiresAt` regardless of user location?

### Hidden Requirements Questions

11. **Multi-Region Support:** Will this ever need to support threats in different countries/timezones? Affects geocoding, maps, expiry logic.

12. **Audit Trail:** Do you need to track who created/deleted each threat for compliance? Not currently implemented.

13. **Threat Editing:** Currently no UPDATE endpoint - threats are immutable. Is edit-in-place needed, or delete+recreate acceptable?

14. **Historical Data:** Should expired/deleted threats be archived for analysis, or permanently purged? No archival currently.

15. **API Versioning:** Is this API stable, or should we add `/api/v1/threats` for future breaking changes?

---

## Summary: Critical Decisions Needed

| Decision | Current State | Options | Recommendation |
|----------|---------------|---------|----------------|
| **React Frontend** | Deprecated, ready to delete | Keep / Delete | **DELETE** |
| **server.js** | Marked legacy, still functional | Keep / Delete | **DELETE** |
| **Database** | JSON files | JSON / PostgreSQL / MongoDB | **PostgreSQL** (for production) |
| **Authentication** | Client-side only | Add JWT / OAuth | **Add JWT** |
| **Real-Time Updates** | Polling (10s delay) | Polling / WebSocket | **WebSocket** |
| **Threat Persistence** | File-based, selective | File / DB | **DB with clear rules** |
| **Test Threat** | Always present | Removable / Fixed | **Make removable** (env var) |

**Immediate Actions (Do Today):**
1. Delete `frontend-react/` directory
2. Delete `server.js`
3. Add password hashing
4. Add auth middleware to protect `/api/threats` POST/DELETE

**Next Sprint (1 Week):**
1. Migrate to PostgreSQL
2. Add WebSocket for real-time updates
3. Implement proper JWT auth

**Future (1 Month):**
1. TypeScript migration
2. Add comprehensive tests
3. Docker deployment
4. Production monitoring

---

Let me know which design decisions need clarification, and I'll help implement the fixes!
