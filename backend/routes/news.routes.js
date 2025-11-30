/**
 * News Routes
 * Proxies requests to the Python simulator and handles manual simulation
 */

import express from 'express';
import axios from 'axios';
import { logger } from '../utils/logger.util.js';
import { extractThreatInfo, validateExtractedData } from '../services/aiExtraction.service.js';
import { geocodeLocation, validateCoordinates } from '../services/aiGeocoding.service.js';
import { addThreat } from '../services/threatStorage.service.js';
import { calculateExpiry } from '../utils/threatExpiry.util.js';

const router = express.Router();
const PYTHON_SERVICE_URL = 'http://localhost:5000';

// GET /api/news - Fetch news from Python service (matches legacy behavior)
// Proxies to: GET http://localhost:5000/api/news
// Returns: Array of articles
router.get('/news', async (req, res) => {
    try {
        // Pass through query params like location if needed, defaulting to 'Global' or 'India'
        const location = req.query.location || 'Global';
        
        const response = await axios.get(`${PYTHON_SERVICE_URL}/api/news`, {
            params: { location }
        });
        
        res.json(response.data);
    } catch (err) {
        logger.error(`Failed to fetch news from Python service: ${err.message}`);
        // Fallback to empty array if service is down, to avoid crashing frontend
        res.json([]); 
    }
});

// POST /api/news/simulate - Manually simulate a threat from a news article
router.post('/news/simulate', async (req, res) => {
    try {
        const newsItem = req.body; // { id, text, ... }
        
        logger.pipeline(`Manual simulation requested for: "${newsItem.text.substring(0, 50)}..."`);

        // 1. Extract
        const extracted = await extractThreatInfo(newsItem.text);
        if (!validateExtractedData(extracted)) {
            throw new Error('AI extraction failed validation');
        }

        // 2. Geocode
        const coords = await geocodeLocation(extracted.locationName);
        if (!validateCoordinates(coords)) {
            throw new Error('AI geocoding failed validation');
        }

        // 3. Create Threat
        const finalThreat = {
            id: newsItem.id || `sim-${Date.now()}`,
            timestamp: new Date().toISOString(),
            expiresAt: calculateExpiry(extracted.durationMinutes || 60),
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

        addThreat(finalThreat);
        logger.pipeline(`✓ Manual simulation success: ${finalThreat.name}`);
        
        res.json({ status: 'ok', threat: finalThreat });

    } catch (err) {
        logger.error(`Manual simulation failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

export default router;
