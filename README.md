# TMZ 2.0 - Threat Intelligence Platform

## Frontend
- **Primary UI:** HTML/CSS/JS app in `public/`, served by `server.new.js`.
- React prototype in `frontend-react/` is **not used** anymore and kept only as an experiment.

## How to Run TMZ 2.0

1. **Install dependencies (backend)**:
   ```bash
   npm install
   ```

2. **Start the backend + frontend**:
   ```bash
   npm start   # runs server.new.js, serves /public UI
   ```

3. **(Optional) Start the threat simulator**:
   ```bash
   node threat_simulator.js
   ```

4. **Open the app**:
   http://localhost:3000

> **Note:** React dev server (`frontend-react`) is not used in this final setup.
