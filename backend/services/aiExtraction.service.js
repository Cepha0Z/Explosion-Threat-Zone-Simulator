/**
 * AI Extraction Service
 * Extracts structured threat data from raw text using AI
 */

import axios from 'axios';
import { logger } from '../utils/logger.util.js';

const PYTHON_SERVICE_URL = 'http://localhost:5000';

/**
 * Extract structured threat information from raw text
 * @param {string} text - Raw news/tweet text
 * @returns {Promise<Object>} - Structured threat data
 * @throws {Error} - If extraction fails
 */
export async function extractThreatInfo(text) {
    try {
        logger.pipeline(`Extracting threat info from: "${text.substring(0, 50)}..."`);
        
        const response = await axios.post(`${PYTHON_SERVICE_URL}/api/extract-threat-info`, {
            text
        });
        
        const extracted = response.data;
        logger.pipeline(`Extracted: ${extracted.name} at ${extracted.locationName}`);
        
        return extracted;
    } catch (error) {
        logger.error(`AI extraction failed: ${error.message}`);
        throw new Error(`Failed to extract threat info: ${error.message}`);
    }
}

/**
 * Validate extracted threat data
 * @param {Object} extracted - Extracted threat data
 * @returns {boolean} - True if valid
 */
export function validateExtractedData(extracted) {
    const required = ['name', 'locationName', 'details'];
    const missing = required.filter(field => !extracted[field]);
    
    if (missing.length > 0) {
        logger.error(`Missing required fields: ${missing.join(', ')}`);
        return false;
    }
    
    return true;
}
