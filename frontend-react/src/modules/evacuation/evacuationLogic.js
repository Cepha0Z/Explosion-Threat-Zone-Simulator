/**
 * React Evacuation Logic
 * Wrapper around shared EvacuationCore for the React application.
 * Handles UI interactions (alerts, window.open) and geolocation.
 */

import { EvacuationCore } from '../../../../public/shared/evacuationCore.js';
import { calculateBlastZones } from '../../utils/blastMath.js';

/**
 * Start the evacuation process.
 * 
 * @param {Object} params
 * @param {Array} params.threats - List of active threats
 * @param {google.maps.Map} params.map - Google Maps instance
 */
export const startEvacuation = async ({ threats, map }) => {
    console.log('[React Evacuation] startEvacuation called');

    // 1. Validate Inputs
    console.log('[React Evacuation] STEP 1: validating inputs');
    if (!threats || threats.length === 0) {
        alert('No active threats to evacuate from.');
        return;
    }

    if (!map) {
        console.error('[React Evacuation] Map instance is missing');
        return;
    }

    // 2. Get User Location
    console.log('[React Evacuation] STEP 2: getting user location');
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by this browser.');
        return;
    }

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                (err) => {
                    console.error('[React Evacuation] Geolocation error object:', err);
                    reject(err);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });

        console.log('[React Evacuation] User location acquired');

        const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        const userLatLng = new window.google.maps.LatLng(userLocation.lat, userLocation.lng);

        // 3. Find Relevant Threat
        console.log('[React Evacuation] STEP 3: finding relevant threat');
        // We pass our React-side blastMath utility which matches the legacy one's signature
        const threatData = EvacuationCore.findRelevantThreat(
            userLatLng,
            threats,
            calculateBlastZones
        );

        if (!threatData) {
            alert('Could not determine active threat context.');
            return;
        }

        // 4. Calculate Safe Exit
        console.log('[React Evacuation] STEP 4: computing safe exit point');
        const safeDestination = EvacuationCore.calculateSafeExitPoint(userLatLng, threatData);

        // 5. Find Hospitals
        console.log('[React Evacuation] STEP 5: searching hospitals');
        let facilities = [];
        try {
            // Pass userLatLng as fallback location
            facilities = await EvacuationCore.searchHospitals(map, safeDestination, userLatLng);
        } catch (err) {
            console.error('[React Evacuation] Hospital search failed:', err);
        }
        console.log('[React Evacuation] Facilities found (combined):', facilities.length);

        // 6. Filter Facilities
        console.log('[React Evacuation] STEP 6: filtering safe facilities');
        const safeHospitals = EvacuationCore.filterSafeFacilities(
            facilities,
            threatData.threatLatLng,
            threatData.largestRadius
        );

        let finalDestination = safeDestination;
        let tag = 'no-hospital-safe-only';
        let waypoint = null;

        // 7. Select Best Facility (Hierarchy)
        console.log('[React Evacuation] STEP 7: selecting best facility');
        
        if (safeHospitals.length > 0) {
            // A. Strict Hospitals Found -> AI Selection
            const selection = await EvacuationCore.selectBestFacility(safeHospitals, safeDestination);
            
            if (selection && selection.destination) {
                finalDestination = selection.destination;
                tag = selection.tag;
                console.log(`[React Evacuation] Selected: ${selection.name} (${selection.reason})`);
            } else {
                // Fallback if AI returns null/invalid but we have candidates
                finalDestination = safeHospitals[0].geometry.location;
                tag = 'hospital-fallback-no-selection';
                console.warn('[React Evacuation] AI selection failed, using first strict candidate.');
            }
        } else {
            // B. No Strict Hospitals -> Relaxed Filter
            console.warn('[React Evacuation] No strict hospitals found. Relaxing filters...');
            
            const relaxedCandidates = facilities.filter(place => {
                if (!place.geometry || !place.geometry.location) return false;
                const distToThreat = window.google.maps.geometry.spherical.computeDistanceBetween(
                    place.geometry.location,
                    threatData.threatLatLng
                );
                return distToThreat > threatData.largestRadius * 1.05;
            });

            if (relaxedCandidates.length > 0) {
                // Sort by distance to safe destination
                relaxedCandidates.sort((a, b) => {
                    const distA = window.google.maps.geometry.spherical.computeDistanceBetween(a.geometry.location, safeDestination);
                    const distB = window.google.maps.geometry.spherical.computeDistanceBetween(b.geometry.location, safeDestination);
                    return distA - distB;
                });
                finalDestination = relaxedCandidates[0].geometry.location;
                tag = 'hospital-relaxed';
            } else {
                // C. No Hospitals at all -> Safe Exit Only
                console.warn('[React Evacuation] No safe facilities found. Routing to safe exit point only.');
                alert('No nearby medical facilities were found. Routing you to the safest exit point only.');
                tag = 'safe-only-no-hospitals';
                // finalDestination remains safeDestination
            }
        }
        
        console.log(`[React Evacuation] Final destination tag: ${tag}`);

        // 8. Construct URL
        console.log('[React Evacuation] STEP 8: generating navigation URL');
        if (threatData.isInside) {
            waypoint = safeDestination;
            console.log(`[React Evacuation] Added waypoint (safe exit): ${safeDestination.lat()}, ${safeDestination.lng()}`);
        }

        const navUrl = EvacuationCore.generateNavigationUrl(userLocation, finalDestination, waypoint);

        console.log(`[React Evacuation] Decision: ${tag}`);
        console.log(`[React Evacuation] Navigation URL ready: ${navUrl}`);

        // 9. Open Navigation
        console.log('[React Evacuation] STEP 9: opening Google Maps');
        window.open(navUrl, '_blank');

    } catch (error) {
        console.error('[React Evacuation] FATAL ERROR in startEvacuation:', {
            raw: error,
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
            type: typeof error,
        });

        try {
            const serialized = JSON.stringify(error);
            console.error('[React Evacuation] Serialized error:', serialized);
        } catch (e) {
            console.error('[React Evacuation] Error is not JSON-serializable');
        }

        alert(
            'Evacuation error: ' +
            (error?.message || 'Unknown error') +
            (error?.name ? ` (type: ${error.name})` : '')
        );
    }
};
