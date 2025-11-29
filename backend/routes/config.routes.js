/**
 * Config Routes
 * Handles configuration endpoints
 */

import express from 'express';
import axios from 'axios';
import { setAlertEmail } from '../services/newsIngestion.service.js';
import { logger } from '../utils/logger.util.js';

const router = express.Router();

// GET /config
router.get('/config', (req, res) => {
    res.json({ 
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "" 
    });
});

// POST /api/session/email
router.post('/session/email', (req, res) => {
    const { email } = req.body || {};
    
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email" });
    }
    
    setAlertEmail(email);
    res.json({ status: "ok" });
});

// POST /api/evaluate-facilities (proxy to Python)
router.post('/evaluate-facilities', async (req, res) => {
    try {
        const response = await axios.post('http://localhost:5000/evaluate_facilities', req.body);
        res.json(response.data);
    } catch (error) {
        logger.error(`AI facility evaluation failed: ${error.message}`);
        // Fallback: pick first one
        res.json({ selected_index: 0, reason: "AI service unavailable, using nearest." });
    }
});

export default router;
