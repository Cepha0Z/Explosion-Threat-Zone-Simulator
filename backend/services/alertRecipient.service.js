/**
 * Alert Recipient Service
 * Manages the current recipient for global threat alerts.
 * Stores the email of the last successfully logged-in user.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ALERT_RECIPIENT_PATH = path.join(__dirname, '..', 'data', 'alert_recipient.json');

let currentRecipientEmail = null;

/**
 * Load alert recipient from disk on startup
 */
function loadAlertRecipientFromDisk() {
    try {
        if (!fs.existsSync(ALERT_RECIPIENT_PATH)) return null;
        const raw = fs.readFileSync(ALERT_RECIPIENT_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return typeof parsed?.email === 'string' ? parsed.email : null;
    } catch (err) {
        logger.error(`[ALERT RECIPIENT] Failed to load from disk: ${err.message}`);
        return null;
    }
}

/**
 * Save alert recipient to disk
 * @param {string|null} email 
 */
function saveAlertRecipientToDisk(email) {
    try {
        const payload = { email: email || null };
        fs.writeFileSync(ALERT_RECIPIENT_PATH, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
        logger.error(`[ALERT RECIPIENT] Failed to save to disk: ${err.message}`);
    }
}

// Initialize on load
currentRecipientEmail = loadAlertRecipientFromDisk();
if (currentRecipientEmail) {
    logger.info('[ALERT RECIPIENT] Loaded from disk', { email: currentRecipientEmail });
}

/**
 * Set the current alert recipient
 * @param {string} email - Email address of the user
 */
export function setAlertRecipient(email) {
    currentRecipientEmail = email || null;
    saveAlertRecipientToDisk(currentRecipientEmail);
    
    if (currentRecipientEmail) {
        logger.info('[ALERT RECIPIENT] Updated to last logged-in user', { email: currentRecipientEmail });
    } else {
        logger.info('[ALERT RECIPIENT] Cleared recipient');
    }
}

/**
 * Get the current alert recipient
 * @returns {string|null} - The current recipient email or null
 */
export function getAlertRecipient() {
    return currentRecipientEmail;
}
