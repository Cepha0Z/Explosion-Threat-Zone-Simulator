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
    timestamp: new Date().toISOString(),
    source: "admin"
  }
];

function cleanExpiredThreats() {
    if (fs.existsSync(threatsFile)) {
        let threats = JSON.parse(fs.readFileSync(threatsFile, "utf-8"));
        const now = new Date().getTime();
        const activeThreats = threats.filter(t => {
            if (!t.expiresAt) return true; // No expiry = active
            return new Date(t.expiresAt).getTime() > now;
        });

        if (activeThreats.length !== threats.length) {
            fs.writeFileSync(threatsFile, JSON.stringify(activeThreats, null, 2));
            console.log(` Cleaned up ${threats.length - activeThreats.length} expired threats on startup.`);
        }
    }
}

if (!fs.existsSync(threatsFile)) {
  fs.writeFileSync(threatsFile, JSON.stringify(hardcodedThreat, null, 2));
  console.log(" Created threats.json with default test threat");
} else {
  cleanExpiredThreats();
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
  if (!threat.source) threat.source = "admin"; // Default to admin

  const dataPath = path.join(__dirname, "data", "threats.json");
  let stored = [];
  if (fs.existsSync(dataPath)) {
    stored = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  }
  stored.push(threat);
  fs.writeFileSync(dataPath, JSON.stringify(stored, null, 2));
  
  console.log(` Admin added threat: ${threat.name} (Expires: ${threat.expiresAt || 'Never'})`);
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
      const now = new Date().getTime();
      
      // Filter expired threats on read
      const activeThreats = threats.filter(t => {
          if (!t.expiresAt) return true;
          return new Date(t.expiresAt).getTime() > now;
      });
      
      res.json(activeThreats);
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
      // 1. Fetch raw text from News Dummy Server
      const response = await axios.get("http://localhost:5050/api/fake-news-threat");
      const newsItem = response.data; // { id, timestamp, text, sourceType }
      
      console.log(`[Pipeline] Received news: "${newsItem.text.substring(0, 50)}..."`);

      const dataPath = path.join(__dirname, "data", "threats.json");
      let stored = [];
      if (fs.existsSync(dataPath)) {
        stored = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
      }

      // Check if we already processed this ID
      if (stored.some(t => t.id === newsItem.id)) {
        return; // Skip duplicates
      }

      // 2. Call AI to extract structured info
      console.log("[Pipeline] Extracting structured data...");
      let extracted;
      try {
        const extractRes = await axios.post("http://localhost:5000/api/extract-threat-info", {
          text: newsItem.text
        });
        extracted = extractRes.data;
      } catch (e) {
        console.error("[Pipeline Error] Extraction failed:", e.message);
        return; // Abort if extraction fails
      }

      // 3. Call AI to geocode the location
      console.log(`[Pipeline] Geocoding location: ${extracted.locationName}...`);
      let coords;
      try {
        const geoRes = await axios.post("http://localhost:5000/api/geocode", {
          locationName: extracted.locationName
        });
        coords = geoRes.data; // { lat, lng }
      } catch (e) {
        console.error("[Pipeline Error] Geocoding failed:", e.message);
        // Optional: Fallback to a default location or skip
        return; 
      }

      // 4. Assemble Final Threat Object
      const durationMinutes = extracted.durationMinutes || 60;
      const finalThreat = {
        id: newsItem.id,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
        name: extracted.name,
        locationName: extracted.locationName,
        location: { lat: coords.lat, lng: coords.lng },
        details: extracted.details,
        yield: extracted.yield || 1.0,
        incidentType: extracted.incidentType,
        hazardCategory: extracted.hazardCategory,
        source: "simulation_news",
        rawText: newsItem.text
      };

      // 5. Save to threats.json
      stored.push(finalThreat);
      
      // Clean up expired threats while we're here
      const now = Date.now();
      stored = stored.filter(t => {
        if (!t.expiresAt) return true;
        return new Date(t.expiresAt).getTime() > now;
      });

      fs.writeFileSync(dataPath, JSON.stringify(stored, null, 2));
      console.log(`[Pipeline] Success! Added threat: ${finalThreat.name}`);

      // 6. Email Alert (if user subscribed)
      if (currentUserEmail) {
        try {
          await axios.post("http://localhost:5000/api/alert", {
            email: currentUserEmail,
            location: finalThreat.locationName || "Global",
          });
          console.log(" Email alert sent to", currentUserEmail);
        } catch (e) {
          console.error(" Error sending email alert:", e.message);
        }
      }

    } catch (err) {
      console.error("[Pipeline Error] General failure:", err.message);
    }
  }, 15000); // Poll every 15 seconds
}

pollThreatSimulator();
