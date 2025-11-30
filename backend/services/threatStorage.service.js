/**
 * Threat Storage Service
 * Handles CRUD operations and expiry management for threats
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { filterExpired, isExpired } from '../utils/threatExpiry.util.js';
import { logger } from '../utils/logger.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const THREATS_FILE = path.join(__dirname, '..', 'data', 'threats.json');

/**
 * Initialize threats file with default threat if it doesn't exist
 */
export function initializeThreatsFile() {
    const hardcodedThreat = [{
        id: "test-threat-001",
        name: "test01",
        locationName: "Lingarajapurum, Bengaluru",
        location: { lat: 13.016003, lng: 77.625933 },
        details: "i killed the toilet",
        yield: 5000,
        timestamp: new Date().toISOString(),
        source: "admin"
    }];

    if (!fs.existsSync(THREATS_FILE)) {
        fs.writeFileSync(THREATS_FILE, JSON.stringify(hardcodedThreat, null, 2));
        logger.threat('Created threats.json with default test threat');
    } else {
        cleanExpiredThreats();
        
        // Immortal Threat Logic: Ensure test-threat-001 exists
        const currentThreats = readThreats(true);
        if (!currentThreats.some(t => t.id === 'test-threat-001')) {
            currentThreats.push(hardcodedThreat[0]);
            writeThreats(currentThreats);
            logger.threat('Respawned immortal test threat: test-threat-001');
        }

        logger.threat('Loaded existing threats from threats.json');
    }
}

/**
 * Clean expired threats from storage
 */
export function cleanExpiredThreats() {
    if (!fs.existsSync(THREATS_FILE)) return;
    
    const threats = readThreats();
    const activeThreats = filterExpired(threats);
    
    if (activeThreats.length !== threats.length) {
        writeThreats(activeThreats);
        logger.threat(`Cleaned up ${threats.length - activeThreats.length} expired threats`);
    }
}

/**
 * Read all threats from storage
 * @param {boolean} includeExpired - Include expired threats (default: false)
 * @returns {Array} - Array of threat objects
 */
export function readThreats(includeExpired = false) {
    try {
        if (!fs.existsSync(THREATS_FILE)) {
            return [];
        }
        
        const data = fs.readFileSync(THREATS_FILE, 'utf-8');
        const threats = JSON.parse(data);
        
        return includeExpired ? threats : filterExpired(threats);
    } catch (error) {
        logger.error(`Failed to read threats: ${error.message}`);
        return [];
    }
}

/**
 * Write threats to storage
 * @param {Array} threats - Array of threat objects
 */
export function writeThreats(threats) {
    try {
        fs.writeFileSync(THREATS_FILE, JSON.stringify(threats, null, 2));
    } catch (error) {
        logger.error(`Failed to write threats: ${error.message}`);
        throw error;
    }
}

/**
 * Add a new threat to storage
 * @param {Object} threat - Threat object
 * @returns {Object} - The added threat
 */
export function addThreat(threat) {
    const threats = readThreats(true); // Include expired for raw storage
    
    // Ensure required fields
    if (!threat.id) threat.id = Date.now().toString();
    if (!threat.timestamp) threat.timestamp = new Date().toISOString();
    if (!threat.source) threat.source = "admin";
    
    threats.push(threat);
    writeThreats(threats);
    
    const expiryInfo = threat.expiresAt ? `Expires: ${threat.expiresAt}` : 'Permanent';
    logger.threat(`Added threat: ${threat.name} (${expiryInfo})`);
    
    return threat;
}

/**
 * Delete a threat by ID
 * @param {string} id - Threat ID
 * @returns {boolean} - True if deleted, false if not found
 */
export function deleteThreat(id) {
    const threats = readThreats(true);
    const initialLength = threats.length;
    const filtered = threats.filter(t => t.id !== id);
    
    if (filtered.length < initialLength) {
        writeThreats(filtered);
        logger.threat(`Deleted threat: ${id}`);
        return true;
    }
    
    return false;
}

/**
 * Check if a threat ID already exists
 * @param {string} id - Threat ID
 * @returns {boolean} - True if exists
 */
export function threatExists(id) {
    const threats = readThreats(true);
    return threats.some(t => t.id === id);
}
