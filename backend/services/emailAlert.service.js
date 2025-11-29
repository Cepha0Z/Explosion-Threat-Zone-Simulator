/**
 * Email Alert Service
 * Sends email alerts for new threats
 */

import axios from 'axios';
import { logger } from '../utils/logger.util.js';

const PYTHON_SERVICE_URL = 'http://localhost:5000';

/**
 * Send email alert for a threat
 * @param {string} email - Recipient email
 * @param {Object} threat - Threat object (optional, uses latest if not provided)
 * @returns {Promise<void>}
 */
export async function sendEmailAlert(email, threat = null) {
    try {
        const payload = { email };
        if (threat) {
            payload.location = threat.locationName || 'Global';
        }
        
        await axios.post(`${PYTHON_SERVICE_URL}/api/alert`, payload);
        logger.pipeline(`✉ Email alert sent to ${email}`);
        
    } catch (error) {
        logger.error(`Failed to send email alert: ${error.message}`);
    }
}
