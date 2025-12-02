/**
 * News Ingestion Service
 * Polls threat simulator and processes raw text through AI pipeline
 */

import axios from 'axios';
import { logger } from '../utils/logger.util.js';
import { extractThreatInfo, validateExtractedData } from './aiExtraction.service.js';
import { geocodeLocation, validateCoordinates } from './aiGeocoding.service.js';
import { addThreat, threatExists } from './threatStorage.service.js';
import { calculateExpiry } from '../utils/threatExpiry.util.js';
import { sendEmailAlert } from './emailAlert.service.js';

const SIMULATOR_URL = 'http://localhost:5050';
const POLL_INTERVAL = 15000; // 15 seconds

// **TESTING MODE: Set to true for random 5-15 second expiration**
const TESTING_MODE = false;

let pollingInterval = null;
let currentUserEmail = null;

/**
 * Set the user email for alerts
 * @param {string} email - User email
 */
export function setAlertEmail(email) {
    currentUserEmail = email;
    logger.pipeline(`Alert email set to: ${email}`);
}

let lastIngestionStatus = {
    lastArticleTitle: null,
    lastProcessedAt: null
};

/**
 * Get the last ingestion status
 * @returns {Object}
 */
export function getLastIngestionStatus() {
    return lastIngestionStatus;
}

/**
 * Process raw news text through AI pipeline
 * @param {Object} newsItem - {id, text, timestamp, sourceType}
 * @returns {Promise<Object|null>} - Processed threat or null if failed
 */
async function processNewsItem(newsItem) {
    try {
        // Check for duplicates
        if (threatExists(newsItem.id)) {
            return null;
        }
        
        logger.pipeline(`Processing news: "${newsItem.text.substring(0, 50)}..."`);
        
        // Step 1: Extract structured data from raw text
        const extracted = await extractThreatInfo(newsItem.text);
        if (!validateExtractedData(extracted)) {
            logger.error('Extracted data validation failed');
            return null;
        }
        
        // Step 2: Geocode the location
        const coords = await geocodeLocation(extracted.locationName);
        if (!validateCoordinates(coords)) {
            logger.error('Coordinate validation failed');
            return null;
        }
        
        // Step 3: Calculate expiration
        const durationMinutes = extracted.durationMinutes || 60;
        let expiresAt;
        
        if (TESTING_MODE) {
            // Random 5-15 seconds for testing fade animations
            const randomSeconds = Math.floor(Math.random() * 11) + 5;
            expiresAt = new Date(Date.now() + randomSeconds * 1000).toISOString();
            logger.pipeline(`[TESTING] Threat will expire in ${randomSeconds} seconds`);
        } else {
            expiresAt = calculateExpiry(durationMinutes);
        }
        
        // Step 4: Assemble final threat object
        const finalThreat = {
            id: newsItem.id,
            timestamp: new Date().toISOString(),
            expiresAt: expiresAt,
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
        
        // Step 5: Save to storage
        addThreat(finalThreat);
        
        // Update status
        lastIngestionStatus = {
            lastArticleTitle: finalThreat.name,
            lastProcessedAt: new Date().toISOString()
        };
        
        logger.pipeline(`✓ Successfully processed threat: ${finalThreat.name}`);
        
        // Step 6: Trigger global email alert
        try {
            logger.pipeline(`[EMAIL] Triggering alert for new threat`, { id: finalThreat.id, name: finalThreat.name });
            await sendEmailAlert(null, finalThreat);
            logger.pipeline(`[EMAIL] Alert successfully sent for threat`, { id: finalThreat.id });
        } catch (err) {
            logger.error(`[EMAIL] Failed to send alert for threat`, {
                id: finalThreat.id,
                error: err.message
            });
        }
        
        return finalThreat;
        
    } catch (error) {
        logger.error(`Failed to process news item: ${error.message}`);
        return null;
    }
}

/**
 * Poll the threat simulator for new news
 */
async function pollSimulator() {
    try {
        const response = await axios.get(`${SIMULATOR_URL}/api/fake-news-threat`);
        const newsItem = response.data;
        
        await processNewsItem(newsItem);
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            logger.error('Threat simulator not reachable (is threat_simulator.js running?)');
        } else {
            logger.error(`Polling error: ${error.message}`);
        }
    }
}

/**
 * Start polling the threat simulator
 */
export function startNewsIngestion() {
    if (pollingInterval) {
        logger.pipeline('News ingestion already running');
        return;
    }
    
    logger.pipeline(`Starting news ingestion (polling every ${POLL_INTERVAL/1000}s)`);
    pollingInterval = setInterval(pollSimulator, POLL_INTERVAL);
}

/**
 * Stop polling the threat simulator
 */
export function stopNewsIngestion() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        logger.pipeline('Stopped news ingestion');
    }
}
