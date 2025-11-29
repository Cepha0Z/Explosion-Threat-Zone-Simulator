/**
 * Threat Expiry Utility
 * Handles threat expiration calculations and filtering
 */

/**
 * Check if a threat has expired
 * @param {Object} threat - Threat object with optional expiresAt field
 * @returns {boolean} - True if expired, false otherwise
 */
export function isExpired(threat) {
    if (!threat.expiresAt) return false;
    return new Date(threat.expiresAt).getTime() <= Date.now();
}

/**
 * Filter out expired threats from an array
 * @param {Array} threats - Array of threat objects
 * @returns {Array} - Array of active (non-expired) threats
 */
export function filterExpired(threats) {
    return threats.filter(t => !isExpired(t));
}

/**
 * Calculate expiry timestamp from duration in minutes
 * @param {number} durationMinutes - Duration in minutes
 * @returns {string|null} - ISO timestamp or null if no duration
 */
export function calculateExpiry(durationMinutes) {
    if (!durationMinutes) return null;
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + parseInt(durationMinutes));
    return expiryDate.toISOString();
}

/**
 * Get time remaining until expiry
 * @param {Object} threat - Threat object with expiresAt field
 * @returns {Object} - {minutes, seconds, expired}
 */
export function getTimeRemaining(threat) {
    if (!threat.expiresAt) {
        return { minutes: Infinity, seconds: 0, expired: false };
    }
    
    const now = Date.now();
    const expiryTime = new Date(threat.expiresAt).getTime();
    const diffMs = expiryTime - now;
    
    if (diffMs <= 0) {
        return { minutes: 0, seconds: 0, expired: true };
    }
    
    return {
        minutes: Math.floor(diffMs / 60000),
        seconds: Math.floor((diffMs % 60000) / 1000),
        expired: false
    };
}
