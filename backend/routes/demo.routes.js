/**
 * Demo Routes
 * Endpoints for seeding and clearing simulated threats for demonstrations.
 */

import express from 'express';
import { 
    readThreats, 
    writeThreats, 
    isPersistentThreat 
} from '../services/threatStorage.service.js';
import { logger } from '../utils/logger.util.js';

const router = express.Router();

// POST /api/demo/seed
router.post('/seed', (req, res) => {
    try {
        const allThreats = readThreats(true);
        
        // Keep only persistent threats
        const persistentThreats = allThreats.filter(t => isPersistentThreat(t));
        
        // Define demo threats
        const demoThreats = [
            {
                id: `demo_mandur_${Date.now()}`,
                name: "Waste Processing Plant Fire (Demo)",
                locationName: "Mandur, Bengaluru",
                location: { lat: 13.0716, lng: 77.6946 }, // Adjusted slightly for visibility
                details: "Demo scenario: waste processing plant fire releasing thick smoke.",
                yield: 15,
                incidentType: "fire",
                hazardCategory: "thermal",
                timestamp: new Date().toISOString(),
                expiresAt: null, 
                source: "demo",
            },
            {
                id: `demo_whitefield_${Date.now()}`,
                name: "Structural Collapse (Demo)",
                locationName: "Whitefield, Bengaluru",
                location: { lat: 12.9739, lng: 77.7499 },
                details: "Demo scenario: construction site structural collapse.",
                yield: 25,
                incidentType: "structural_collapse",
                hazardCategory: "structural",
                timestamp: new Date().toISOString(),
                expiresAt: null,
                source: "demo",
            },
            {
                id: `demo_ecity_${Date.now()}`,
                name: "Chemical Spill (Demo)",
                locationName: "Electronic City, Bengaluru",
                location: { lat: 12.8452, lng: 77.6602 },
                details: "Demo scenario: chemical tanker spill on highway.",
                yield: 10,
                incidentType: "chemical_leak",
                hazardCategory: "chemical",
                timestamp: new Date().toISOString(),
                expiresAt: null,
                source: "demo",
            }
        ];

        // Merge and save
        const newThreats = [...persistentThreats, ...demoThreats];
        writeThreats(newThreats);

        logger.info(`[DEMO] Seeded ${demoThreats.length} demo threats (persistent kept: ${persistentThreats.length})`);
        
        res.json({
            status: "ok",
            added: demoThreats.length,
            total: newThreats.length
        });

    } catch (err) {
        logger.error(`[DEMO] Seed failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/demo/clear
router.post('/clear', (req, res) => {
    try {
        const allThreats = readThreats(true);
        
        // Keep only persistent threats
        const persistentThreats = allThreats.filter(t => isPersistentThreat(t));
        const removedCount = allThreats.length - persistentThreats.length;

        writeThreats(persistentThreats);

        logger.info(`[DEMO] Cleared ${removedCount} ephemeral threats (remaining persistent: ${persistentThreats.length})`);
        
        res.json({
            status: "ok",
            removed: removedCount,
            remaining: persistentThreats.length
        });

    } catch (err) {
        logger.error(`[DEMO] Clear failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

export default router;
