/**
 * Threat Routes
 * Handles threat CRUD operations
 */

import express from 'express';
import { readThreats, addThreat, deleteThreat } from '../services/threatStorage.service.js';
import { calculateExpiry } from '../utils/threatExpiry.util.js';
import { logger } from '../utils/logger.util.js';

const router = express.Router();

// GET /api/threats
router.get('/threats', (req, res) => {
    try {
        const threats = readThreats(); // Automatically filters expired
        res.json(threats);
    } catch (err) {
        logger.error(`Failed to load threats: ${err.message}`);
        res.status(500).json({ error: "Could not load threats" });
    }
});

// POST /api/threats
router.post('/threats', (req, res) => {
    try {
        const threat = req.body;
        
        // Calculate expiry if duration provided
        if (req.body.durationMinutes) {
            threat.expiresAt = calculateExpiry(req.body.durationMinutes);
        }
        
        const savedThreat = addThreat(threat);
        res.json({ status: "ok", threat: savedThreat });
        
    } catch (err) {
        logger.error(`Failed to create threat: ${err.message}`);
        res.status(500).json({ error: "Could not create threat" });
    }
});

// DELETE /api/threats/:id
router.delete('/threats/:id', (req, res) => {
    try {
        const { id } = req.params;
        const deleted = deleteThreat(id);
        
        if (deleted) {
            return res.json({ status: "ok" });
        }
        
        res.status(404).json({ error: "Threat not found" });
        
    } catch (err) {
        logger.error(`Failed to delete threat: ${err.message}`);
        res.status(500).json({ error: "Could not delete threat" });
    }
});

export default router;
