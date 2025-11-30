# TMZ 2.0 - Threat Intelligence Platform

## Frontend
- **Primary**: React app in `frontend-react` (Vite + React)
- **Legacy**: HTML/CSS/JS app in `public/` (kept for reference)

## How to Run (Primary Stack)

1. **Start backend** (modular server):
   ```bash
   npm install
   npm start      # uses server.new.js
   ```

2. **Start React frontend**:
   ```bash
   cd frontend-react
   npm install
   npm run dev
   ```

3. **(Optional) Start dummy simulator**:
   ```bash
   node threat_simulator.js
   ```

## Legacy (HTML) UI
If needed for reference:
```bash
npm run start:legacy   # uses server.js with old HTML UI
```
