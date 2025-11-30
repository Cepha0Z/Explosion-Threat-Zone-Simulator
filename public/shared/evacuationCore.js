/**
 * Evacuation Core Module
 * Pure logic for evacuation routing, independent of UI.
 */

export const EvacuationCore = {
    /**
     * Find the most relevant threat to the user.
     * Prioritizes threats the user is inside of.
     * 
     * @param {google.maps.LatLng} userLatLng 
     * @param {Array} threats 
     * @param {Function} calculateBlastZonesFn - Function taking yield -> zone objects
     * @returns {Object|null} { threat, distance, largestRadius, threatLatLng, isInside }
     */
    findRelevantThreat(userLatLng, threats, calculateBlastZonesFn) {
        let relevantThreat = null;
        let minDistance = Infinity;
        let insideThreats = [];

        threats.forEach(threat => {
            const threatLatLng = new google.maps.LatLng(threat.location.lat, threat.location.lng);
            const distance = google.maps.geometry.spherical.computeDistanceBetween(userLatLng, threatLatLng);
            const zones = calculateBlastZonesFn(threat.yield);
            
            // Validate zones structure before accessing
            // The legacy calculateBlastZones returns an object with { minor: { radius: ... } }
            // But the React blastMath might return an array or different structure.
            // We need to handle both or ensure consistency.
            // Based on previous analysis, React blastMath returns an ARRAY of zone objects.
            // Legacy blastMath returned an object with keys 'lethal', 'severe', 'moderate', 'minor'.
            // This mismatch is likely the cause.
            
            // Let's check what 'zones' is and extract radius safely.
            let largestRadius = 0;

            if (Array.isArray(zones)) {
                // React blastMath returns array of objects with { radius: number }
                // We assume the last one is the largest (Minor Damage) or find max radius
                const maxZone = zones.reduce((max, zone) => (zone.radius > max.radius ? zone : max), zones[0]);
                if (maxZone && typeof maxZone.radius === 'number') {
                    largestRadius = maxZone.radius;
                }
            } else if (zones && typeof zones === 'object' && zones.minor && typeof zones.minor.radius === 'number') {
                // Legacy structure
                largestRadius = zones.minor.radius;
            }

            if (!largestRadius || !Number.isFinite(largestRadius)) {
                console.warn('[EvacuationCore] Skipping threat due to invalid blast zones:', {
                    id: threat.id,
                    name: threat.name,
                    yield: threat.yield,
                    zones,
                });
                return;
            }

            const threatData = { threat, distance, largestRadius, threatLatLng };

            if (distance <= largestRadius) {
                insideThreats.push(threatData);
            }

            if (distance < minDistance) {
                minDistance = distance;
                relevantThreat = threatData;
            }
        });

        // Prioritize threats we are inside
        let selected = null;
        if (insideThreats.length > 0) {
            insideThreats.sort((a, b) => a.distance - b.distance);
            selected = { ...insideThreats[0], isInside: true };
        } else if (relevantThreat) {
            selected = { ...relevantThreat, isInside: false };
        }

        if (selected) {
            console.log('[EvacuationCore] Selected relevant threat:', {
                id: selected.threat.id,
                name: selected.threat.name,
                distance: selected.distance,
                largestRadius: selected.largestRadius,
            });
            return selected;
        }

        throw new Error('No valid threats with blast radius data were found. Check yield values or blast zone calculation.');
    },

    /**
     * Calculate the safe exit point.
     * 
     * @param {google.maps.LatLng} userLatLng 
     * @param {Object} threatData - Result from findRelevantThreat
     * @returns {google.maps.LatLng}
     */
    calculateSafeExitPoint(userLatLng, threatData) {
        const { distance, largestRadius, threatLatLng, isInside } = threatData;

        // Calculate heading
        let heading = google.maps.geometry.spherical.computeHeading(threatLatLng, userLatLng);
        if (distance < 5) heading = 0; // Default to North if at center

        // Calculate safe destination distance
        let targetDistance;
        if (isInside) {
            targetDistance = largestRadius * 1.1;
        } else {
            targetDistance = distance + 2000;
        }

        return google.maps.geometry.spherical.computeOffset(
            threatLatLng,
            targetDistance,
            heading
        );
    },

    /**
     * Search for hospitals near a location.
     * 
     * @param {google.maps.Map} map 
     * @param {google.maps.LatLng} location 
     * @returns {Promise<Array>} List of place results
     */
    /**
     * Search for hospitals near a location (with fallback).
     * 
     * @param {google.maps.Map} map 
     * @param {google.maps.LatLng} primaryLocation (usually safeDestination)
     * @param {google.maps.LatLng|null} fallbackLocation (usually userLatLng)
     * @returns {Promise<Array>} List of place results
     */
    async searchHospitals(map, primaryLocation, fallbackLocation = null) {
        console.log('[EvacuationCore] searchHospitals called');
        const service = new google.maps.places.PlacesService(map);

        const performSearch = (request) => {
            return new Promise((resolve) => {
                service.nearbySearch(request, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                        resolve(results);
                    } else {
                        if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                            console.error('[EvacuationCore] Places nearbySearch failed:', status);
                        }
                        resolve([]);
                    }
                });
            });
        };

        // 1. Primary Search (around safeDestination)
        // RankBy.DISTANCE, no radius
        const primaryRequest = {
            location: primaryLocation,
            rankBy: google.maps.places.RankBy.DISTANCE,
            type: 'hospital'
        };

        const primaryResults = await performSearch(primaryRequest);
        console.log(`[EvacuationCore] Hospital search (primary) results: ${primaryResults.length}`);

        if (primaryResults.length > 0) {
            return primaryResults;
        }

        // 2. Fallback Search (around userLatLng)
        // Radius-based search (5000m)
        if (fallbackLocation) {
            console.log('[EvacuationCore] Primary search empty. Trying fallback search around user location...');
            const fallbackRequest = {
                location: fallbackLocation,
                radius: 5000,
                type: 'hospital'
            };

            const fallbackResults = await performSearch(fallbackRequest);
            console.log(`[EvacuationCore] Hospital search (fallback from user) results: ${fallbackResults.length}`);
            
            if (fallbackResults.length > 0) {
                return fallbackResults;
            }
        }

        return [];
    },

    /**
     * Filter facilities based on safety and keywords.
     * 
     * @param {Array} facilities 
     * @param {google.maps.LatLng} threatLatLng 
     * @param {number} largestRadius 
     * @returns {Array} Safe facilities
     */
    filterSafeFacilities(facilities, threatLatLng, largestRadius) {
        const excludedKeywords = [
            'dentist', 'dental', 'orthodontist', 'optometry', 'veterinary', 'animal', 'pet',
            'eye', 'skin', 'plastic surgery', 'shop', 'store', 'food', 'restaurant', 'cafe',
            'bakery', 'roll', 'bar', 'pub', 'spa', 'salon',
            'church', 'temple', 'mosque', 'synagogue', 'chapel', 'cathedral', 'religious', 'worship'
        ];

        return facilities.filter(place => {
            if (!place.geometry || !place.geometry.location) return false;

            // Safety Check
            const distToThreat = google.maps.geometry.spherical.computeDistanceBetween(
                place.geometry.location,
                threatLatLng
            );
            if (distToThreat <= largestRadius * 1.05) return false;

            // Keyword Check
            const name = place.name.toLowerCase();
            const types = place.types ? place.types.join(' ') : '';
            const isExcluded = excludedKeywords.some(keyword => name.includes(keyword) || types.includes(keyword));
            if (isExcluded) return false;

            // Type Check
            if (!place.types || !place.types.includes('hospital')) return false;

            return true;
        });
    },

    /**
     * Select the best facility using AI or fallback.
     * 
     * @param {Array} safeHospitals 
     * @param {google.maps.LatLng} safeDestination 
     * @returns {Promise<Object>} { destination: google.maps.LatLng, tag: string, reason: string }
     */
    async selectBestFacility(safeHospitals, safeDestination) {
        if (!safeHospitals || safeHospitals.length === 0) {
            return null;
        }

        // Prepare candidates for AI
        const candidates = safeHospitals.slice(0, 10).map(place => ({
            name: place.name,
            types: place.types,
            distance: google.maps.geometry.spherical.computeDistanceBetween(
                place.geometry.location,
                safeDestination
            )
        }));

        try {
            const response = await fetch('/api/evaluate-facilities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ facilities: candidates })
            });
            const data = await response.json();
            
            const selectedIndex = data.selected_index;
            if (typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < safeHospitals.length) {
                return {
                    destination: safeHospitals[selectedIndex].geometry.location,
                    tag: 'ai-selected',
                    reason: data.reason,
                    name: safeHospitals[selectedIndex].name
                };
            } else {
                console.warn('[EvacuationCore] AI returned invalid index, falling back.');
                return {
                    destination: safeHospitals[0].geometry.location,
                    tag: 'ai-fallback',
                    reason: 'AI invalid index',
                    name: safeHospitals[0].name
                };
            }
        } catch (err) {
            console.error('[EvacuationCore] AI Evaluation failed:', err);
            return {
                destination: safeHospitals[0].geometry.location,
                tag: 'ai-fallback-error',
                reason: 'AI request failed',
                name: safeHospitals[0].name
            };
        }
    },

    /**
     * Generate the Google Maps navigation URL.
     * 
     * @param {Object} userLocation { lat, lng }
     * @param {google.maps.LatLng} destination 
     * @param {google.maps.LatLng|null} waypoint 
     * @returns {string}
     */
    generateNavigationUrl(userLocation, destination, waypoint) {
        let navUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${destination.lat()},${destination.lng()}&travelmode=driving`;

        // Only add waypoint if it exists AND is different from destination
        if (waypoint) {
            const isSamePoint = Math.abs(waypoint.lat() - destination.lat()) < 0.0001 && 
                                Math.abs(waypoint.lng() - destination.lng()) < 0.0001;
            
            if (!isSamePoint) {
                navUrl += `&waypoints=${waypoint.lat()},${waypoint.lng()}`;
            }
        }

        return navUrl;
    }
};
