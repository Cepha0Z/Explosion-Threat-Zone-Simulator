/**
 * TMZ 2.0 - Threat Intelligence Platform
 * Main Server Entry Point
 * 
 * This file only handles:
 * - Express setup
 * - Middleware configuration
 * - Route registration
 * - Background service startup
 */

import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

// Import routes
import authRoutes from "./backend/routes/auth.routes.js";
import threatRoutes from "./backend/routes/threat.routes.js";
import configRoutes from "./backend/routes/config.routes.js";
import newsRoutes from "./backend/routes/news.routes.js";
import healthRoutes from "./backend/routes/health.routes.js";
import demoRoutes from "./backend/routes/demo.routes.js";

// Import services
import { initializeThreatsFile } from "./backend/services/threatStorage.service.js";
import { startPythonService } from "./backend/services/pythonService.service.js";
import { startNewsIngestion } from "./backend/services/newsIngestion.service.js";
import { logger } from "./backend/utils/logger.util.js";

// Configuration
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3001;

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Register API routes FIRST (before catch-all)
app.use("/api", authRoutes);
app.use("/api", threatRoutes);
app.use("/api", newsRoutes);
app.use("/api", healthRoutes);
app.use("/api/demo", demoRoutes);
app.use("/", configRoutes);
app.use("/api", configRoutes);

// Serve static files from /public (Primary UI)
app.use(express.static(path.join(__dirname, "public")));

// Catch-all route to serve index.html for any unmatched routes (SPA fallback)
// This MUST come AFTER API routes
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize data storage
initializeThreatsFile();

// Start background services
startPythonService();
startNewsIngestion();

// Start server
app.listen(PORT, () => {
    logger.server(`🚀 Server running on http://localhost:${PORT}`);
    logger.server(`📡 AI Pipeline: News → Extraction → Geocoding → Storage`);
});
