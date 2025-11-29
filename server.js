import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import cors from "cors";
import axios from "axios";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Clear threats.json on startup
// Clear threats.json on startup but add the hardcoded test threat
const threatsFile = path.join(__dirname, "data", "threats.json");
const hardcodedThreat = [
  {
    id: "test-threat-001",
    name: "test01",
    locationName: "Lingarajapurum, Bengaluru",
    location: { lat: 13.016003, lng: 77.625933 },
    details: "i killed the toilet",
    yield: 5000,
    timestamp: new Date().toISOString()
  }
];
if (!fs.existsSync(threatsFile)) {
  fs.writeFileSync(threatsFile, JSON.stringify(hardcodedThreat, null, 2));
  console.log(" Created threats.json with default test threat");
} else {
  console.log(" Loaded existing threats from threats.json");
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

//email
let currentUserEmail = null;
app.post("/api/session/email", (req, res) => {
  const { email } = req.body || {};

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email" });
  }

  currentUserEmail = email;
  console.log(" Alert email set to:", currentUserEmail);
  res.json({ status: "ok" });
});

// --- USER MANAGEMENT ---
const usersFile = path.join(__dirname, "data", "users.json");

// Ensure users.json exists with default admin
if (!fs.existsSync(usersFile)) {
  const defaultUsers = [
    { email: "admin@tmz.com", password: "admin123" } // In real app, hash this!
  ];
  fs.writeFileSync(usersFile, JSON.stringify(defaultUsers, null, 2));
  console.log(" Created users.json with default admin.");
}

// Helper to get users
function getUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersFile, "utf-8"));
  } catch (e) {
    return [];
  }
}

// Helper to save users
function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// --- LOGIN ENDPOINT ---
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const users = getUsers();
  
  const user = users.find(u => u.email === email && u.password === password);

  if (user) {
    // Determine role
    const role = email === "admin@tmz.com" ? "admin" : "user";
    return res.json({ 
      token: `authorized_token_${Date.now()}`,
      role: role 
    });
  }
  
  return res.status(401).json({ error: "Invalid credentials" });
});

// --- SIGNUP ENDPOINT ---
app.post("/api/signup", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const users = getUsers();

  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: "User already exists" });
  }

  users.push({ email, password });
  saveUsers(users);

  console.log(" New user registered:", email);
  res.json({ status: "ok", message: "User created successfully" });
});

// --- ADMIN THREAT MANAGEMENT ---
app.post("/api/threats", (req, res) => {
  // In a real app, verify the token/role here!
  const threat = req.body;
  if (!threat.id) threat.id = Date.now().toString();
  if (!threat.timestamp) threat.timestamp = new Date().toISOString();

  const dataPath = path.join(__dirname, "data", "threats.json");
  let stored = [];
  if (fs.existsSync(dataPath)) {
    stored = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  }
  stored.push(threat);
  fs.writeFileSync(dataPath, JSON.stringify(stored, null, 2));
  
  console.log(" Admin added threat:", threat.name);
  res.json({ status: "ok", threat });
});

app.delete("/api/threats/:id", (req, res) => {
  const { id } = req.params;
  const dataPath = path.join(__dirname, "data", "threats.json");
  
  if (fs.existsSync(dataPath)) {
    let stored = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    const initialLength = stored.length;
    stored = stored.filter(t => t.id !== id);
    
    if (stored.length < initialLength) {
      fs.writeFileSync(dataPath, JSON.stringify(stored, null, 2));
      console.log(" Admin deleted threat:", id);
      return res.json({ status: "ok" });
    }
  }
  res.status(404).json({ error: "Threat not found" });
});

// --- START PYTHON AUTOMATICALLY ---
function startPythonService() {
  console.log(" Node is starting the Python News Service...");

  // Point to the correct location: data/news_service.py
  const scriptPath = path.join(__dirname, "data", "news_service.py");

  // Try 'python' first
  let pythonProcess = spawn("python", [scriptPath]);

  pythonProcess.on("error", (err) => {
    console.log(" 'python' command failed. Trying 'python3'...");
    pythonProcess = spawn("python3", [scriptPath]);
    setupProcessListeners(pythonProcess);
  });

  setupProcessListeners(pythonProcess);
}

function setupProcessListeners(proc) {
  proc.stdout.on("data", (data) => console.log(`[Python]: ${data}`));
  proc.stderr.on("data", (data) => console.error(`[Python Error]: ${data}`));

  // Kill Python when Node shuts down
  process.on("exit", () => proc.kill());
}

startPythonService();
// -----------------------------

app.get("/config", (req, res) => {
  res.json({ googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "" });
});

app.get("/api/threats", (req, res) => {
  const dataPath = path.join(__dirname, "data", "threats.json");
  try {
    if (fs.existsSync(dataPath)) {
      const threats = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
      res.json(threats);
    } else {
      res.json([]);
    }
  } catch (err) {
    res.status(500).json({ error: "Could not load threats" });
  }
});

// --- AI FACILITY EVALUATION PROXY ---
app.post("/api/evaluate-facilities", async (req, res) => {
  try {
    const response = await axios.post("http://localhost:5000/evaluate_facilities", req.body);
    res.json(response.data);
  } catch (error) {
    console.error("Error calling Python AI service:", error.message);
    // Fallback: If AI fails, tell frontend to just pick the first one (index 0)
    res.json({ selected_index: 0, reason: "AI service unavailable, using nearest." });
  }
});

app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});

function pollThreatSimulator() {
  setInterval(async () => {
    try {
      const response = await axios.get("http://localhost:5050/api/fake-threat");
      const threat = response.data;

      const dataPath = path.join(__dirname, "data", "threats.json");
      let stored = [];

      if (fs.existsSync(dataPath)) {
        stored = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
      }

      // --- 1️⃣ REMOVE EXPIRED THREATS ---
      const now = Date.now();
      stored = stored.filter((t) => {
        if (!t.expiresAt) return true; // keep threats that don't expire
        return new Date(t.expiresAt).getTime() > now; // keep only active
      });

      // --- 2️⃣ CHECK IF THREAT ALREADY EXISTS ---
      const exists = stored.some((t) => t.id === threat.id);
      if (!exists) {
        stored.push(threat);
        console.log(" New simulated threat added:", threat.name);

        // --- 3️⃣ EMAIL ALERT USING LOGGED-IN USER EMAIL ---
        if (currentUserEmail) {
          try {
            await axios.post("http://localhost:5000/api/alert", {
              email: currentUserEmail,
              location: threat.locationName || "Global",
            });
            console.log(" Email alert sent to", currentUserEmail);
          } catch (e) {
            console.error(" Error sending email alert:", e.message);
          }
        } else {
          console.log(" No user email set; skipping email alert.");
        }
      }

      // --- 4️⃣ WRITE UPDATED THREAT LIST BACK TO FILE ---
      fs.writeFileSync(dataPath, JSON.stringify(stored, null, 2));
    } catch (err) {
      console.error("Error fetching from simulator:", err.message);
    }
  }, 10000); // every 10 seconds
}

pollThreatSimulator();
