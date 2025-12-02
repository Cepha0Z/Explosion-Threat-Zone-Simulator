# TMZ 2.0 - Complete System Analysis

**Analysis Date:** 2025-11-30  
**Mode:** Documentation Only - NO Code Modifications

---

## 1. PROJECT STRUCTURE

### File Organization
```
Root/
├── backend/
│   ├── data/ (threats.json, users.json, news_service.py)
│   ├── routes/ (auth, threat, config)
│   ├── services/ (AI, storage, email, ingestion)
│   └── utils/ (logger, expiry)
├── public/
│   ├── modules/ (7 ES6 modules - NEW)
│   ├── app.js (1064 lines - LEGACY)
│   └── app.new.js (modular - NEW)
├── server.js (LEGACY monolith)
├── server.new.js (NEW modular)
└── threat_simulator.js (port 5050)
```

**CRITICAL: Dual Architecture**
- TWO complete server implementations coexist
- TWO complete frontend implementations coexist  
- Active version determined by what index.html loads

---

## 2. BACKEND REQUEST FLOWS

### Authentication (auth.routes.js)
```
POST /api/login {email, password}
→ Read users.json (plaintext!)
→ Match email+password
→ Role = "admin" if email=admin@tmz.com
→ Return fake token + role
```

**Issues:** No encryption, no JWT, file-based storage

### Threat Creation - Admin
```
POST /api/threats {name, location, yield, durationMinutes}
→ threat.routes.js
→ calculateExpiry(durationMinutes) → expiresAt
→ threatStorage.addThreat()
→ Write to threats.json
```

### Threat Creation - Simulator Pipeline
```
Every 15s:
  threat_simulator.js (5050) → Raw text news
    ↓
  newsIngestion.service.js
    → aiExtraction (Python 5000)  [name, location, yield, duration]
    → aiGeocoding (Python 5000)   [lat, lng]
    → calculateExpiry()            [expiresAt]
    → threatStorage.addThreat()
    → emailAlert.sendAlert()
```

**Key:** Expiry decided by MAIN SERVER, not simulator

### Threat Fetching
```
GET /api/threats
→ threatStorage.readThreats()
→ Automatic filterExpired()
→ Return active threats only
```

### AI Facility Evaluation (Evacuation)
```
POST /api/evaluate-facilities {facilities[]}
→ Proxy to Python:5000/evaluate_facilities
→ LLM ranks by tier (Hospital > Clinic)
→ Return {selected_index, reason}
Fallback: index=0 if AI fails
```

---

## 3. AI PIPELINE (Python Flask Service)

**Port:** 5000  
**File:** backend/data/news_service.py  
**Model:** OpenRouter (configurable)

### Endpoints

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `/api/extract-threat-info` | Extract structured data from text | name, location, details, yield, durationMinutes, type |
| `/api/geocode` | Convert location → lat/lng | {lat, lng} |
| `/evaluate_facilities` | Rank hospitals by tier+distance | {selected_index, reason} |
| `/api/alert` | Send AI-generated email alert | {status} |
| `/api/news` | Fetch news from NewsAPI | articles[] |

### AI-Inferred Fields
- **yield:** Estimated from keywords ("massive"=40, "minor"=5)
- **durationMinutes:** Inferred from incident type (chemical=120, fire=60)
- **coordinates:** LLM geographic knowledge
- **incidentType:** Classified from text

**No External Geocoding API:** Uses LLM internal knowledge only

---

## 4. FRONTEND BEHAVIOR

### Map Initialization (modules/map.module.js)
```javascript
initialize('map')
  → Center: India (20.5937, 78.9629)
  → Zoom: 5
  → Dark theme applied
  → DirectionsService + Renderer created
```

### Threat Rendering (modules/threats.module.js)
```javascript
displayThreats(map)
  → Clear previous overlays
  → For each threat:
      - Calculate 4 blast zones (lethal, severe, moderate, minor)
      - Draw concentric circles
      - Add marker
      - Create list item
  → Add "Evacuate From My Location" button
```

**Auto-update:** Every 5 seconds, poll `/api/threats`, compare hash, re-render if changed

### Evacuation Logic (modules/evacuation.module.js)
```
1. Get user location (geolocation API)
2. Find nearest threat
3. Calculate safe exit point (opposite direction from threat)
4. Google Places: search "hospital" near safe point
5. Filter: Remove churches, shops, non-medical
6. AI evaluation: Rank by tier
7. Open Google Maps navigation to selected hospital
```

**Fallback:** If no hospital found → navigate to safe exit only

### Admin Panel (modules/admin.module.js)
- Shown only if `localStorage.userRole === "admin"`
- Create threat form with duration field
- Threat list with delete buttons
- Real-time sync with threats.json

---

## 5. DATA MODELS

### Threat Object Schema

```typescript
{
  id: string,              // Required, auto-gen from Date.now()
  name: string,            // Required, AI-extracted or admin input
  locationName: string,    // Required
  location: {              // Required
    lat: number,
    lng: number
  },
  details: string,         // Required
  yield: number,           // Optional, default 1.0 (kg TNT)
  timestamp: string,       // ISO8601, auto-gen
  expiresAt?: string,      // ISO8601, optional (null = permanent)
  source: string,          // "admin" | "simulation_news"
  incidentType?: string,   // "chemical_leak" | "fire" | "explosion"
  hazardCategory?: string, // "chemical" | "thermal" | "structural"
  rawText?: string,        // Original news text (simulator only)
  durationMinutes?: number // Not stored, used to calculate expiresAt
}
```

### User Object Schema
```typescript
{
  email: string,    // Unique
  password: string  // PLAINTEXT WARNING!
}
```

**Role Determination:**
- Hardcoded: `admin@tmz.com` → "admin"
- All others → "user"

### Source Field Distinction

| Source | Created By | Has expiresAt? | Has rawText? |
|--------|------------|----------------|--------------|
| `admin` | Admin UI | Optional | No |
| `simulation_news` | AI pipeline | Yes (always) | Yes |

---

## 6. EDGE CASES & RISKS

### Race Conditions
**Scenario:** Multiple polling loops write to threats.json simultaneously  
**Risk:** File corruption, lost data  
**Mitigation:** None currently

### Restart Behavior
**On server restart:**
1. threats.json loaded
2. Expired threats cleaned
3. Hardcoded test threat added if file missing
4. Python service auto-started
5. News polling resumes from scratch (no state persistence)

**Issue:** `last_seen.txt` not actually used to prevent duplicates - ID-based check only

### Partial AI Failures

| Failure Point | Behavior | User Impact |
|---------------|----------|-------------|
| Extraction fails | Threat not created, logged | News silently ignored |
| Geocoding fails | Threat not created, logged | News silently ignored |
| Email fails | Logged only | No user notification |
| Facility ranking fails | Fallback to index 0 | Gets nearest (possibly wrong type) |

**No retries, no dead letter queue**

### Missing/Malformed Data
- Invalid coordinates: Rejected by validation
- Missing required fields: Threat not created
- Duplicate IDs: Skipped silently
- Negative yield: Accepted (no validation)

### Frontend/Backend Mismatches
- Frontend expects expiry, backend may not provide
- Display logic assumes fields exist
- No schema validation layer

### Timing Issues
- **Server timezone:** Uses system time (`new Date()`)
- **No UTC enforcement:** Could cause issues across timezones
- **Expiry check:** `<=` comparison (inclusive, could expire 1ms early)

---

## 7. ARCHITECTURAL EVALUATION

### Overloaded Files

**server.js (347 lines)**
- Authentication
- Threat CRUD
- Python service management
- News polling
- AI proxying
- Email session
- File I/O

**Recommendation:** Already being refactored to server.new.js

**app.js (1064 lines)**
- Map init
- Auth enforcement
- Threat rendering
- Evacuation logic
- Simulator UI
- Admin panel
- News display

**Recommendation:** Already being refactored to modules/

### Tight Coupling

**Issues:**
1. **Python service dependency:** Node requires Python to be running - no graceful degradation
2. **File path assumptions:** Hardcoded relative paths break if CWD changes
3. **Port hardcoding:** 5050, 5000, 3001 - no config abstraction
4. **localStorage for auth:** Breaks if user clears data mid-session

### Missing Abstractions

**No Database Layer:** Direct fs.readFileSync/writeFileSync everywhere  
**No Validation Library:** Manual checks scattered across files  
**No Error Boundaries:** Frontend crashes propagate  
**No Request Retry Logic:** Single-attempt network calls  
**No Rate Limiting:** Unlimited API calls, no DOS protection

### Complex Reasoning Areas

**Evacuation Math (evacuation.module.js)**
- Trigonometry for safe point calculation
- Distance-based filtering
- Multi-criteria facility ranking
- Edge case: User inside multiple threat zones

**Blast Zone Calculation (threats.module.js)**
- Cubic root scaling: `scaledDistanceFactor = ∛(yield)`
- 4-tier concentric zones
- No physics validation

---

## 8. CRITICAL FINDINGS

### Security (🔴 HIGH PRIORITY)

1. **Plaintext Passwords:** users.json stores passwords unencrypted
2. **No Authentication:** Fake tokens, no verification middleware
3. **No Input Sanitization:** SQL injection N/A but XSS possible
4. **CORS Open:** No origin restrictions
5. **Environment Variables:** .env in repo history (if committed)

### Reliability (🟠 MEDIUM PRIORITY)

1. **No Persistence Layer:** File-based storage, no transactions
2. **No Process Manager:** Python crashes = no more AI
3. **No Health Checks:** Services can fail silently
4. **No Logging Rotation:** Console logs only
5. **Single Point of Failure:** threats.json corruption = total data loss

### Data Integrity (🟡 LOW PRIORITY)

1. **No Backups:** threats.json has no backup strategy
2. **Race Conditions:** Concurrent writes possible
3. **No Schema Validation:** Malformed data can be saved
4. **Orphaned Data:** Deleted threats not tracked

---

## 9. IMPLICIT ASSUMPTIONS

1. **Python Always Available:** No fallback if spawn fails
2. **Filesystem Writable:** No read-only mode handling
3. **Google Maps API:** Assumes key is valid and has quota
4. **OpenRouter Credits:** Assumes API key has credits
5. **Single User Session:** No multi-device support
6. **English News Only:** AI prompts assume English text
7. **Bengaluru-Centric:** Hardcoded test threat, India-focused coordinates
8. **Browser Geolocation:** Evacuation requires permission grant

---

## 10. RECOMMENDATIONS (Analysis Only)

### Deduplication Strategy
**Current:** Two servers, two frontends coexist  
**Decision Needed:** 
- Migrate fully to modular (server.new.js + app.new.js)?
- Remove legacy files?
- Coordinate with deployment strategy

### Single Points of Failure
1. threats.json → Add database migration path
2. Python service → Add restart logic or Node.js AI alternative
3. OpenRouter API → Add fallback model or local option

### Future-Proofing
- Add API versioning (/api/v1/threats)
- Add request/response DTOs
- Add comprehensive error codes
- Add audit logging

---

## APPENDIX: Dependency Graph

```
server.new.js
  ├─→ auth.routes.js → users.json
  ├─→ threat.routes.js → threatStorage.service.js → threats.json
  ├─→ config.routes.js → newsIngestion.service.js
  ├─→ pythonService.service.js → news_service.py (Flask)
  └─→ newsIngestion.service.js
       ├─→ aiExtraction.service.js → Python:5000
       ├─→ aiGeocoding.service.js → Python:5000
       ├─→ emailAlert.service.js → Python:5000
       └─→ threatStorage.service.js

threat_simulator.js (independent, port 5050)
  → Polled by newsIngestion.service.js

app.new.js
  ├─→ auth.module.js → localStorage
  ├─→ map.module.js → Google Maps API
  ├─→ threats.module.js → /api/threats
  ├─→ evacuation.module.js → Google Places API + /api/evaluate-facilities
  ├─→ admin.module.js → /api/threats (POST/DELETE)
  ├─→ simulation.module.js → (local simulation, no backend)
  └─→ news.module.js → Python:5000/api/news
```

---

**End of Analysis**  
**Total Files Analyzed:** 29  
**Total Lines of Code:** ~3500  
**Architecture:** Dual (legacy + modular in parallel)  
**Tech Stack:** Node.js + Python Flask + Google APIs + OpenRouter LLM
