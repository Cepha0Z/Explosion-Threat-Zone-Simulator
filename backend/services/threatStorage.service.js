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
 * Check if a threat is persistent (survives restart)
 * @param {Object} threat 
 * @returns {boolean}
 */
export function isPersistentThreat(threat) {
    if (!threat) return false;
    if (threat.id === 'test-threat-001') return true;
    if (threat.source === 'admin') return true;
    if (threat.persistent === true) return true;
    return false;
}

/**
 * Ensure the test threat exists in the list
 * @param {Array} threats 
 * @returns {Array}
 */
function seedTestThreatIfMissing(threats) {
    const TEST_THREAT_ID = 'test-threat-001';
    const TEST_THREAT_OBJECT = {
        id: TEST_THREAT_ID,
        name: 'test01',
        locationName: 'Lingarajapurum, Bengaluru',
        location: { lat: 13.013251, lng: 77.624151 },
        details: 'i killed the toilet lol (it worked!!)',
        yield: 7700,
        timestamp: new Date().toISOString(),
        source: 'admin'
    };

    const exists = threats.some(t => t.id === TEST_THREAT_ID);
    if (exists) return threats;
    
    logger.threat('Seeding missing test threat: test-threat-001');
    return [...threats, TEST_THREAT_OBJECT];
}

/**
 * Initialize threats file with default threat if it doesn't exist
 * Also performs startup cleanup of ephemeral/expired threats
 */
export function initializeThreatsFile() {
    if (!fs.existsSync(THREATS_FILE)) {
        // Create new file with seeded threat
        const initialThreats = seedTestThreatIfMissing([]);
        fs.writeFileSync(THREATS_FILE, JSON.stringify(initialThreats, null, 2));
        logger.threat('Created threats.json with default test threat');
    } else {
        // Startup Cleanup: Remove expired AND ephemeral threats
        let allThreats = readThreats(true); // Read raw
        const now = Date.now();
        const initialCount = allThreats.length;
        
        const keptThreats = [];
        let removedExpired = 0;
        let removedEphemeral = 0;

        for (const t of allThreats) {
            if (isExpired(t, now)) {
                removedExpired++;
                continue;
            }
            if (!isPersistentThreat(t)) {
                removedEphemeral++;
                continue;
            }
            keptThreats.push(t);
        }

        // Ensure immortal threat exists
        const finalThreats = seedTestThreatIfMissing(keptThreats);
        const wasSeeded = finalThreats.length > keptThreats.length;

        // Save if we changed anything (removed threats OR added seed)
        if (removedExpired > 0 || removedEphemeral > 0 || wasSeeded) {
            writeThreats(finalThreats);
            logger.info('[Startup] Threat cleanup & seeding complete', {
                totalBefore: initialCount,
                kept: keptThreats.length,
                final: finalThreats.length,
                removedExpired,
                removedEphemeral,
                seeded: wasSeeded
            });
        } else {
            logger.threat('Loaded existing threats (no cleanup or seeding needed)');
        }
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
