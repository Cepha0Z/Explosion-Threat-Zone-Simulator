# Threat Intelligence Dashboard

A live threat-visualization and hazard-simulation platform built using **Google Maps**, **Node.js**, and **TailwindCSS**.

This project dynamically displays nearby threats, renders real-time danger zones, and provides evacuation route guidance.  
It also includes a powerful simulator for calculating blast radii using physics-based formulas.

---

## 🚀 Features

### 🔴 Live Threat Monitoring
- Loads threat data from backend (`/api/threats`)
- Displays threat markers on Google Maps
- Renders color-coded blast zones:
  - Lethal
  - Severe
  - Moderate
  - Minor
- Expandable threat details panel
- One-click “Evacuate from My Location” navigation

---

### 🧨 Hazard Simulation Mode
- Select from multiple threat types (accidental + weaponized)
- Set detonation point via:
  - Search box
  - Map click
  - GPS location
- Calculates:
  - Blast radii (physics-based cubic-root scaling)
  - Color-coded impact areas
- Click inside any danger zone to generate evacuation route

---

### 🗺️ Google Maps Features
- Custom dark mode map style
- Autocomplete search
- Droppable markers
- Driving route generation
- Custom map control buttons

---

### 🖥️ Full-Stack Architecture
- **Backend:** Node.js + Express  
- **Frontend:** HTML + TailwindCSS + Vanilla JavaScript  
- **Data:** JSON (threats.json)  
- **Config:** dotenv for API keys  

---

## 📁 Project Structure

```text
TZS/
│
├── data/
│   └── threats.json
│
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css (optional)
│
├── server.js
├── package.json
├── .env
└── README.md
```


---

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/yourrepo.git
cd yourrepo


## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/yourrepo.git
cd yourrepo
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create a `.env` file
```env
GOOGLE_MAPS_API_KEY=YOUR_API_KEY
PORT=3000
```

### 4. Start the server
```bash
npm start
```

#### For auto-reload during development:
```bash
npm run dev
```

### 5. Open the app
```
http://localhost:3000
```

---

## 🧠 Technical Details

### Blast Radius Formula
```text
radius ∝ cubic_root(yield)
```

Each zone uses a scaled distance multiplier to simulate real-world explosive behavior.

### Evacuation Route Logic
1. Determine user coordinates  
2. Detect if they are inside any blast zone  
3. Compute safe exit point using spherical offset  
4. Open Google Maps navigation to destination  

---

## 🛡️ Use Cases
- Emergency response dashboards  
- Smart-city threat monitoring  
- Homeland security simulations  
- Military blast-effect research  
- Disaster management tools  
- Academic / physics-based explosion modeling  

---

## 🖼️ Screenshots
(Add images such as UI previews, map view, simulator mode screenshots)

---

## 🤝 Contributing
Pull requests and feature suggestions are yet to be implemented!

---

## 📜 License
MIT License.

---

## ⭐ Acknowledgements
- Google Maps JavaScript API  
- TailwindCSS  
- Node.js  
- Presidency University (Capstone Project)
