/**
 * Evacuation Module
 * Handles evacuation routing and hospital finding logic
 * Refactored to use shared EvacuationCore
 */

import { EvacuationCore } from '../shared/evacuationCore.js';

export const EvacuationModule = {
    /**
     * Generate evacuation navigation from user's location
     * @param {Array} threats - Array of active threats
     * @param {google.maps.Map} map
     */
    generateEvacuationNavigation(threats, map) {
        if (threats.length === 0) {
            alert('No active threats to evacuate from.');
            return;
        }

        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => this.processEvacuation(pos, threats, map),
            () => alert('Could not get your location. Please enable location services.'),
            { enableHighAccuracy: true }
        );
    },

    /**
     * Process evacuation logic
     * @param {Position} pos - Geolocation position
     * @param {Array} threats - Active threats
     * @param {google.maps.Map} map
     */
    async processEvacuation(pos, threats, map) {
        const userLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
        };
        const userLatLng = new google.maps.LatLng(userLocation.lat, userLocation.lng);

        // 1. Find Relevant Threat
        const threatData = EvacuationCore.findRelevantThreat(
            userLatLng, 
            threats, 
            window.ThreatsModule.calculateBlastZones
        );

        if (!threatData) {
            alert('Could not determine active threat context.');
            return;
        }

        // 2. Calculate Safe Exit
        const safeDestination = EvacuationCore.calculateSafeExitPoint(userLatLng, threatData);

        // 3. Find Hospitals
        let facilities = [];
        try {
            facilities = await EvacuationCore.searchHospitals(map, safeDestination);
        } catch (err) {
            console.error('[Evacuation] Hospital search failed:', err);
        }

        // 4. Filter Facilities
        const safeHospitals = EvacuationCore.filterSafeFacilities(
            facilities, 
            threatData.threatLatLng, 
            threatData.largestRadius
        );

        let finalDestination = safeDestination;
        let tag = 'no-hospital-safe-only';
        let waypoint = null;

        if (safeHospitals.length > 0) {
            // 5. Select Best Facility (AI)
            const selection = await EvacuationCore.selectBestFacility(safeHospitals, safeDestination);
            if (selection) {
                finalDestination = selection.destination;
                tag = selection.tag;
                console.log(`[Evacuation] Selected: ${selection.name} (${selection.reason})`);
            }
        } else {
            // Relaxed Filter Fallback (if strict failed)
            console.warn('[Evacuation] No strict hospitals found. Relaxing filters...');
            // Note: EvacuationCore.filterSafeFacilities is strict. 
            // If we want relaxed, we might need another method or just filter manually here using a simpler check.
            // Re-using the "isSafe" logic from Core would be ideal if exposed, but for now let's implement the relaxed check here 
            // or add it to Core. The legacy code had a relaxed check.
            // Let's stick to the Core's strict filter for now to keep it clean, 
            // or if we want to match legacy exactly, we should add `filterSafeFacilitiesRelaxed` to Core.
            // For this iteration, if no safe hospitals found, we go to safe exit.
            // Legacy code did: "Filter relaxation... const relaxedCandidates = results.filter(place => isSafe(place));"
            // Let's replicate that behavior by manually filtering for safety only if strict failed.
            
            const relaxedCandidates = facilities.filter(place => {
                if (!place.geometry || !place.geometry.location) return false;
                const distToThreat = google.maps.geometry.spherical.computeDistanceBetween(
                    place.geometry.location,
                    threatData.threatLatLng
                );
                return distToThreat > threatData.largestRadius * 1.05;
            });

            if (relaxedCandidates.length > 0) {
                // Sort by distance to safe destination
                relaxedCandidates.sort((a, b) => {
                    const distA = google.maps.geometry.spherical.computeDistanceBetween(a.geometry.location, safeDestination);
                    const distB = google.maps.geometry.spherical.computeDistanceBetween(b.geometry.location, safeDestination);
                    return distA - distB;
                });
                finalDestination = relaxedCandidates[0].geometry.location;
                tag = 'filter-relaxed';
            } else {
                console.warn('[Evacuation] No safe facilities found. Routing to safe exit point only.');
            }
        }

        // 6. Construct URL
        // If we are inside, we set the safe exit point as a waypoint
        if (threatData.isInside) {
            waypoint = safeDestination;
            console.log(`[Evacuation] Added waypoint (safe exit): ${safeDestination.lat()}, ${safeDestination.lng()}`);
        }

        const navUrl = EvacuationCore.generateNavigationUrl(userLocation, finalDestination, waypoint);

        console.log(`[Evacuation] Decision: ${tag}`);
        console.log(`[Evacuation] Opening URL: ${navUrl}`);
        
        window.open(navUrl, '_blank');
    }
};
