import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = 5050;

/**
 * Text-only news incidents (no structured data)
 * These simulate raw news/tweets that need AI processing
 */
const newsIncidents = [
  "A massive chemical leak has been reported at an industrial facility in Lingarajapuram, Bengaluru, prompting officials to evacuate nearby residents.",
  "Firefighters are battling a large blaze at a fireworks warehouse in Attibele, Bengaluru, with reports of multiple explosions.",
  "A gas pipeline rupture near Electronic City Phase 1, Bengaluru, has caused a major fire and traffic gridlock.",
  "An explosion at a paint factory in Peenya Industrial Area, Bengaluru, has released toxic fumes into the surrounding neighborhoods.",
  "Structural collapse reported at a construction site in Whitefield, Bengaluru, trapping several workers and causing panic.",
  "A fuel tanker overturned and caught fire on the Outer Ring Road near Marathahalli, Bengaluru, creating a massive fireball.",
  "Ammonia gas leak detected at a cold storage unit in Yeshwanthpur, Bengaluru, leading to breathing difficulties for local residents.",
  "A transformer explosion in Koramangala, Bengaluru, has triggered a local blackout and minor fires in nearby shops.",
  "Industrial boiler blast reported at a textile unit on Hosur Road, Bengaluru, causing significant structural damage.",
  "A waste processing plant in Mandur, Bengaluru, has caught fire, sending thick black smoke over the northern suburbs."
];

/**
 * GET /api/fake-news-threat
 * Returns raw text-only news (no structured threat data)
 */
app.get("/api/fake-news-threat", (req, res) => {
  const selectedText = newsIncidents[Math.floor(Math.random() * newsIncidents.length)];

  const packaged = {
    id: "news_sim_" + Date.now(),
    timestamp: new Date().toISOString(),
    text: selectedText,
    sourceType: "news_simulation"
  };

  res.json(packaged);
});

app.listen(PORT, () => {
  console.log(`🔥 Threat Simulator running at http://localhost:${PORT}`);
  console.log(`📰 Emitting text-only news for AI processing`);
});
