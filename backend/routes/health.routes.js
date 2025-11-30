/**
 * Health Check Routes
 * Exposes system status for monitoring
 */

import express from 'express';
import axios from 'axios';
import { readThreats } from '../services/threatStorage.service.js';
import { getLastIngestionStatus } from '../services/newsIngestion.service.js';
import { logger } from '../utils/logger.util.js';

const router = express.Router();

// Helper to check service liveness
async function checkService(url) {
    try {
        await axios.get(url, { timeout: 2000 });
        return { status: 'ok', lastCheck: new Date().toISOString() };
    } catch (e) {
        return { status: 'down', lastCheck: new Date().toISOString() };
    }
}

// GET /api/health
router.get('/health', async (req, res) => {
    try {
        const threats = readThreats();
        const ingestionStatus = getLastIngestionStatus();
        
        // Check external services in parallel
        const [pythonHealth, simulatorHealth] = await Promise.all([
            checkService('http://localhost:5000/'),
            checkService('http://localhost:5050/api/fake-threat') // Lightweight check
        ]);

        const healthData = {
            status: "ok",
            backend: {
                status: "ok",
                uptimeSeconds: process.uptime()
            },
            python: pythonHealth,
            simulator: simulatorHealth,
            threats: {
                activeCount: threats.length
            },
            newsIngestion: ingestionStatus
        };

        res.json(healthData);
    } catch (err) {
        logger.error(`Health check failed: ${err.message}`);
        res.status(500).json({ status: "error", message: err.message });
    }
});

export default router;
