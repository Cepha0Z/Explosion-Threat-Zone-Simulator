import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = 5050;

// --- FLAT ARRAY (NOT NESTED!) ---
const threatPool = [
  {
    name: "Restaurant Cylinder Blast",
    locationName: "Indiranagar, Bengaluru",
    location: { lat: 12.971, lng: 77.641 },
    details: "Multiple commercial LPG cylinders exploded in a kitchen.",
    yield: 3.5,
  },
  {
    name: "Nitrogen Tank Rupture",
    locationName: "Electronic City Phase 1, Bengaluru",
    location: { lat: 12.845, lng: 77.66 },
    details: "Cryogenic tank failure in manufacturing unit.",
    yield: 6.0,
  },
  {
    name: "Petrol Pump Fireball",
    locationName: "Richmond Circle, Bengaluru",
    location: { lat: 12.966, lng: 77.597 },
    details: "Massive thermal release from underground tank ignition.",
    yield: 14.0,
  },
  {
    name: "Fireworks Warehouse Detonation",
    locationName: "Attibele, Bengaluru Outskirts",
    location: { lat: 12.78, lng: 77.77 },
    details: "Illegal pyrotechnics chain reaction.",
    yield: 25.0,
  },
  {
    name: "Sewer Line Methane Ignition",
    locationName: "Majestic Bus Stand, Bengaluru",
    location: { lat: 12.976, lng: 77.573 },
    details: "Methane pocket explosion under tarmac.",
    yield: 1.2,
  },
  {
    name: "Laboratory Chemical Spill",
    locationName: "IISc Campus, Bengaluru",
    location: { lat: 13.013, lng: 77.564 },
    details: "Corrosive fumes released in lab.",
    yield: 0.8,
  },
];

app.get("/api/fake-threat", (req, res) => {
  const selected = threatPool[Math.floor(Math.random() * threatPool.length)];

  const packaged = {
    id: "sim_" + Date.now(),
    timestamp: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    ...selected,
  };

  res.json(packaged);
});

app.listen(PORT, () => {
  console.log(` Threat Simulator running at http://localhost:${PORT}`);
});
