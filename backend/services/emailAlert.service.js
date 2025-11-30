/**
 * Email Alert Service
 * Sends email alerts for new threats
 */

import axios from 'axios';
import { logger } from '../utils/logger.util.js';

import { getAlertRecipient } from './alertRecipient.service.js';

const PYTHON_SERVICE_URL = 'http://localhost:5000';

/**
 * Send email alert for a threat
 * @param {string|null} email - Recipient email (optional, defaults to last logged-in user)
 * @param {Object} threat - Threat object (optional, uses latest if not provided)
 * @returns {Promise<void>}
 */
export async function sendEmailAlert(email = null, threat = null) {
    try {
        // Determine recipient: explicit argument > last logged-in user > env var > default
        const recipient = email || getAlertRecipient() || process.env.ALERT_EMAIL || 'admin@tmz.com';

        if (!recipient) {
            logger.pipeline('[EMAIL] No alert recipient is set (no user has logged in yet); skipping email send.');
            return;
        }

        const payload = { email: recipient };
        if (threat) {
            payload.location = threat.locationName || 'Global';
        }
        
        await axios.post(`${PYTHON_SERVICE_URL}/api/alert`, payload);
        logger.pipeline(`✉ Email alert sent to ${recipient}`);
        
    } catch (error) {
        logger.error(`Failed to send email alert: ${error.message}`);
        throw error; // Re-throw to let caller handle logging if needed
    }
}
