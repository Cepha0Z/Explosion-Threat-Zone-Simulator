/**
 * AI Geocoding Service
 * Converts location names to coordinates using AI
 */

import axios from 'axios';
import { logger } from '../utils/logger.util.js';

const PYTHON_SERVICE_URL = 'http://localhost:5000';

/**
 * Geocode a location name to coordinates
 * @param {string} locationName - Location name to geocode
 * @returns {Promise<Object>} - {lat, lng}
 * @throws {Error} - If geocoding fails
 */
export async function geocodeLocation(locationName) {
    try {
        logger.pipeline(`Geocoding location: ${locationName}`);
        
        const response = await axios.post(`${PYTHON_SERVICE_URL}/api/geocode`, {
            locationName
        });
        
        const coords = response.data;
        logger.pipeline(`Geocoded to: ${coords.lat}, ${coords.lng}`);
        
        return coords;
    } catch (error) {
        logger.error(`Geocoding failed: ${error.message}`);
        throw new Error(`Failed to geocode location: ${error.message}`);
    }
}

/**
 * Validate coordinates
 * @param {Object} coords - {lat, lng}
 * @returns {boolean} - True if valid
 */
export function validateCoordinates(coords) {
    if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
        logger.error('Invalid coordinates format');
        return false;
    }
    
    if (coords.lat < -90 || coords.lat > 90 || coords.lng < -180 || coords.lng > 180) {
        logger.error('Coordinates out of range');
        return false;
    }
    
    return true;
}
