/**
 * Alert Recipient Service
 * Manages the current recipient for global threat alerts.
 * Stores the email of the last successfully logged-in user.
 */

import { logger } from '../utils/logger.util.js';

let currentRecipientEmail = null;

/**
 * Set the current alert recipient
 * @param {string} email - Email address of the user
 */
export function setAlertRecipient(email) {
    currentRecipientEmail = email || null;
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
