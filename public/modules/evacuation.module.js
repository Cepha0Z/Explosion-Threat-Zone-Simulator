/**
 * Evacuation Module
 * Handles evacuation routing and hospital finding logic
 * CRITICAL: Preserves exact evacuation math and hospital routing behavior
 */

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
    processEvacuation(pos, threats, map) {
        const userLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
        };
        const userLatLng = new google.maps.LatLng(userLocation.lat, userLocation.lng);

        let relevantThreat = null;
        let minDistance = Infinity;
        let insideThreats = [];

        // Find all threats and check if user is inside
        threats.forEach(threat => {
            const threatLatLng = new google.maps.LatLng(threat.location.lat, threat.location.lng);
            const distance = google.maps.geometry.spherical.computeDistanceBetween(userLatLng, threatLatLng);
            const zones = window.ThreatsModule.calculateBlastZones(threat.yield);
            const largestRadius = zones.minor.radius;

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
        if (insideThreats.length > 0) {
            insideThreats.sort((a, b) => a.distance - b.distance);
            relevantThreat = insideThreats[0];
        }

        if (relevantThreat) {
            this.calculateSafeRoute(userLocation, userLatLng, relevantThreat, map);
        } else {
            alert('Could not determine active threat context.');
        }
    },

    /**
     * Calculate safe route and find hospital
     * @param {Object} userLocation - {lat, lng}
     * @param {google.maps.LatLng} userLatLng
     * @param {Object} relevantThreat - Threat data
     * @param {google.maps.Map} map
     */
    calculateSafeRoute(userLocation, userLatLng, relevantThreat, map) {
        const { threat, distance, largestRadius, threatLatLng } = relevantThreat;

        // Calculate heading
        let heading = google.maps.geometry.spherical.computeHeading(threatLatLng, userLatLng);
        if (distance < 5) heading = 0; // Default to North if at center

        // Calculate safe destination
        let targetDistance;
        let isInside = false;
        if (distance <= largestRadius) {
            targetDistance = largestRadius * 1.1;
            isInside = true;
        } else {
            targetDistance = distance + 2000;
        }

        const safeDestination = google.maps.geometry.spherical.computeOffset(
            threatLatLng,
            targetDistance,
            heading
        );

        // Find nearest safe hospital
        this.findSafeHospital(userLocation, safeDestination, threatLatLng, largestRadius, isInside, map);
    },

    /**
     * Find safe hospital and open navigation
     * @param {Object} userLocation
     * @param {google.maps.LatLng} safeDestination
     * @param {google.maps.LatLng} threatLatLng
     * @param {number} largestRadius
     * @param {boolean} isInside
     * @param {google.maps.Map} map
     */
    findSafeHospital(userLocation, safeDestination, threatLatLng, largestRadius, isInside, map) {
        const service = new google.maps.places.PlacesService(map);
        const request = {
            location: safeDestination,
            rankBy: google.maps.places.RankBy.DISTANCE,
            type: 'hospital'
        };

        service.nearbySearch(request, (results, status) => {
            this.processFacilities(results, status, userLocation, safeDestination, threatLatLng, largestRadius, isInside);
        });
    },

    /**
     * Process facility search results
     */
    processFacilities(results, status, userLocation, safeDestination, threatLatLng, largestRadius, isInside) {
        const isSafe = (place) => {
            if (!place.geometry || !place.geometry.location) return false;
            const distToThreat = google.maps.geometry.spherical.computeDistanceBetween(
                place.geometry.location,
                threatLatLng
            );
            return distToThreat > largestRadius * 1.05;
        };

        const openNavigation = (destination, tag) => {
            console.log(`[Evacuation] Decision: ${tag}`);
            console.log(`[Evacuation] Destination: ${destination.lat()}, ${destination.lng()}`);

            let navUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${destination.lat()},${destination.lng()}&travelmode=driving`;

            if (isInside) {
                navUrl += `&waypoints=${safeDestination.lat()},${safeDestination.lng()}`;
                console.log(`[Evacuation] Added waypoint (safe exit): ${safeDestination.lat()}, ${safeDestination.lng()}`);
            }

            console.log(`[Evacuation] Opening URL: ${navUrl}`);
            window.open(navUrl, '_blank');
        };

        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            // Strict filtering
            const excludedKeywords = [
                'dentist', 'dental', 'orthodontist', 'optometry', 'veterinary', 'animal', 'pet',
                'eye', 'skin', 'plastic surgery', 'shop', 'store', 'food', 'restaurant', 'cafe',
                'bakery', 'roll', 'bar', 'pub', 'spa', 'salon',
                'church', 'temple', 'mosque', 'synagogue', 'chapel', 'cathedral', 'religious', 'worship'
            ];

            const safeHospitals = results.filter(place => {
                if (!isSafe(place)) return false;

                const name = place.name.toLowerCase();
                const types = place.types ? place.types.join(' ') : '';
                const isExcluded = excludedKeywords.some(keyword => name.includes(keyword) || types.includes(keyword));
                if (isExcluded) return false;

                if (!place.types || !place.types.includes('hospital')) return false;

                return true;
            });

            if (safeHospitals.length > 0) {
                // AI Selection
                const candidates = safeHospitals.slice(0, 10).map(place => ({
                    name: place.name,
                    types: place.types,
                    distance: google.maps.geometry.spherical.computeDistanceBetween(
                        place.geometry.location,
                        safeDestination
                    )
                }));

                fetch('/api/evaluate-facilities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ facilities: candidates })
                })
                    .then(res => res.json())
                    .then(data => {
                        const selectedIndex = data.selected_index;
                        if (typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < safeHospitals.length) {
                            const bestHospital = safeHospitals[selectedIndex];
                            console.log(`[Evacuation] AI Selected: ${bestHospital.name} (${data.reason})`);
                            openNavigation(bestHospital.geometry.location, 'ai-selected');
                        } else {
                            console.warn('[Evacuation] AI returned invalid index, falling back to nearest safe hospital.');
                            openNavigation(safeHospitals[0].geometry.location, 'ai-fallback');
                        }
                    })
                    .catch(err => {
                        console.error('[Evacuation] AI Evaluation failed:', err);
                        openNavigation(safeHospitals[0].geometry.location, 'ai-fallback');
                    });
                return;
            }

            // Filter relaxation
            console.warn('[Evacuation] No strict hospitals found. Relaxing filters...');
            const relaxedCandidates = results.filter(place => isSafe(place));

            if (relaxedCandidates.length > 0) {
                relaxedCandidates.sort((a, b) => {
                    const distA = google.maps.geometry.spherical.computeDistanceBetween(a.geometry.location, safeDestination);
                    const distB = google.maps.geometry.spherical.computeDistanceBetween(b.geometry.location, safeDestination);
                    return distA - distB;
                });

                openNavigation(relaxedCandidates[0].geometry.location, 'filter-relaxed');
                return;
            }
        }

        // No hospitals found
        console.warn('[Evacuation] No safe facilities found. Routing to safe exit point only.');
        openNavigation(safeDestination, 'no-hospital-safe-only');
    }
};
