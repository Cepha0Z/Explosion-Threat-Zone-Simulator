/**
 * Evacuation Module
 * Handles evacuation routing and hospital finding logic
 * Refactored to use shared EvacuationCore
 */

import { EvacuationCore } from '../shared/evacuationCore.js';

export const EvacuationModule = {
    // Track last evacuation result for feedback display
    lastEvacuationResult: null,
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
        // Clear any previous evacuation feedback
        this.clearEvacuationFeedback();
        
        const userLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
        };
        const userLatLng = new google.maps.LatLng(userLocation.lat, userLocation.lng);

        try {
            // 1. Find Relevant Threat
            const threatData = EvacuationCore.findRelevantThreat(
                userLatLng, 
                threats, 
                window.ThreatsModule.calculateBlastZones
            );

            if (!threatData) {
                this.showEvacuationError('Could not determine active threat context.');
                return;
            }

            // Check if user is OUTSIDE the danger zone
            if (!threatData.isInside) {
                const userConfirmed = confirm(
                    '✅ You are outside the danger zone.\n\n' +
                    'Would you like to navigate to the nearest hospital?'
                );
                
                if (!userConfirmed) {
                    console.log('[Evacuation] User declined hospital navigation.');
                    return;
                }
                
                // Find nearest hospital avoiding the threat zone
                await this.navigateToNearestHospital(userLocation, userLatLng, threatData, map);
                return;
            }

            // User is INSIDE danger zone - evacuate to safety first
            // 2. Calculate Safe Exit
            const safeDestination = EvacuationCore.calculateSafeExitPoint(userLatLng, threatData);

            // 3. Find Hospitals
            let facilities = [];
            try {
                facilities = await EvacuationCore.searchHospitals(map, safeDestination);
            } catch (err) {
                console.error('[Evacuation] Hospital search failed:', err);
                facilities = [];
            }

            // 4. Filter Facilities
            const safeHospitals = EvacuationCore.filterSafeFacilities(
                facilities, 
                threatData.threatLatLng, 
                threatData.largestRadius
            );

            // Track the actual selected facility for accurate feedback
            let finalDestination = safeDestination;
            let selectedFacility = null;
            let tag = 'no-hospital-safe-only';
            let waypoint = null;

            if (safeHospitals.length > 0) {
                // 5. Select Best Facility (AI)
                const selection = await EvacuationCore.selectBestFacility(safeHospitals, safeDestination);
                if (selection) {
                    finalDestination = selection.destination;
                    tag = selection.tag;
                    // Find the actual facility object that matches this destination
                    selectedFacility = safeHospitals.find(f => 
                        f.geometry.location.lat() === selection.destination.lat() &&
                        f.geometry.location.lng() === selection.destination.lng()
                    );
                    console.log(`[Evacuation] Selected: ${selection.name} (${selection.reason})`);
                }
            } else {
                // Relaxed Filter Fallback (if strict failed)
                console.warn('[Evacuation] No strict hospitals found. Relaxing filters...');
                
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
                    selectedFacility = relaxedCandidates[0];
                    finalDestination = selectedFacility.geometry.location;
                    tag = 'filter-relaxed';
                } else {
                    console.warn('[Evacuation] No safe facilities found. Routing to safe exit point only.');
                }
            }

            // 6. Construct waypoint if inside
            if (threatData.isInside) {
                waypoint = safeDestination;
                console.log(`[Evacuation] Added waypoint (safe exit): ${safeDestination.lat()}, ${safeDestination.lng()}`);
            }

            // 7. Build complete evacuation result (SINGLE SOURCE OF TRUTH)
            const exitDistance = google.maps.geometry.spherical.computeDistanceBetween(
                userLatLng,
                safeDestination
            ) / 1000; // Convert to km
            
            const hospitalName = selectedFacility?.name || 'Safe Exit Point';
            const hospitalDistance = selectedFacility 
                ? google.maps.geometry.spherical.computeDistanceBetween(userLatLng, selectedFacility.geometry.location) / 1000
                : exitDistance;
            
            const reasonText = this.buildEvacuationReason({
                tag,
                safeHospitalsCount: safeHospitals.length,
                facilitiesCount: facilities.length,
                isInside: threatData.isInside,
                hasHospital: selectedFacility !== null
            });
            
            const navUrl = EvacuationCore.generateNavigationUrl(userLocation, finalDestination, waypoint);
            
            // Store complete result
            this.lastEvacuationResult = {
                isSafeRoute: true,
                exitDistanceKm: exitDistance,
                selectedHospital: {
                    name: hospitalName,
                    location: finalDestination,
                    distance: hospitalDistance
                },
                reasonText: reasonText,
                navUrl: navUrl,
                timestamp: new Date()
            };
            
            console.log(`[Evacuation] Decision: ${tag}`);
            console.log(`[Evacuation] Result:`, this.lastEvacuationResult);
            
            // 8. Render feedback card FIRST
            this.renderEvacuationFeedback();
            
            // 9. Then open navigation (using navUrl from result)
            window.open(this.lastEvacuationResult.navUrl, '_blank');
            
        } catch (error) {
            console.error('[Evacuation] Error during evacuation:', error);
            this.showEvacuationError('Evacuation failed. Please try again.');
        }
    },

    /**
     * Navigate to nearest hospital (for users OUTSIDE danger zone)
     * @param {Object} userLocation - {lat, lng}
     * @param {google.maps.LatLng} userLatLng
     * @param {Object} threatData - Threat information
     * @param {google.maps.Map} map
     */
    async navigateToNearestHospital(userLocation, userLatLng, threatData, map) {
        console.log('[Evacuation] User is safe. Finding nearest hospital...');

        try {
            // Search for hospitals near user's location
            let facilities = [];
            try {
                facilities = await EvacuationCore.searchHospitals(map, userLatLng);
            } catch (err) {
                console.error('[Evacuation] Hospital search failed:', err);
                this.showEvacuationError('Could not find nearby hospitals. Please try again.');
                return;
            }

            if (facilities.length === 0) {
                this.showEvacuationError('No hospitals found nearby.');
                return;
            }

            // Filter out hospitals that are inside the threat zone
            const safeHospitals = facilities.filter(place => {
                if (!place.geometry || !place.geometry.location) return false;
                const distToThreat = google.maps.geometry.spherical.computeDistanceBetween(
                    place.geometry.location,
                    threatData.threatLatLng
                );
                return distToThreat > threatData.largestRadius;
            });

            if (safeHospitals.length === 0) {
                this.showEvacuationError('No safe hospitals found outside the threat zone.');
                return;
            }

            // Sort by distance to user
            safeHospitals.sort((a, b) => {
                const distA = google.maps.geometry.spherical.computeDistanceBetween(a.geometry.location, userLatLng);
                const distB = google.maps.geometry.spherical.computeDistanceBetween(b.geometry.location, userLatLng);
                return distA - distB;
            });

            // Check if route to nearest hospital goes through threat zone
            let selectedHospital = null;
            for (const hospital of safeHospitals) {
                const routeAvoidsThreat = this.checkRouteAvoidsThreat(
                    userLatLng,
                    hospital.geometry.location,
                    threatData.threatLatLng,
                    threatData.largestRadius
                );

                if (routeAvoidsThreat) {
                    selectedHospital = hospital;
                    break;
                }
            }

            // If no hospital with safe route found, use the nearest one anyway
            if (!selectedHospital) {
                console.warn('[Evacuation] No hospital with guaranteed safe route. Using nearest.');
                selectedHospital = safeHospitals[0];
            }

            const hospitalLocation = selectedHospital.geometry.location;
            const hospitalName = selectedHospital.name || 'Nearest Hospital';
            const hospitalDistance = google.maps.geometry.spherical.computeDistanceBetween(
                userLatLng,
                hospitalLocation
            ) / 1000; // Convert to km

            console.log(`[Evacuation] Selected hospital: ${hospitalName}`);
            console.log(`[Evacuation] Distance: ${hospitalDistance.toFixed(2)} km`);

            // Generate direct navigation URL
            const navUrl = EvacuationCore.generateNavigationUrl(
                userLocation,
                hospitalLocation,
                null // No waypoint needed - direct route
            );
            
            // Build evacuation result (SINGLE SOURCE OF TRUTH)
            this.lastEvacuationResult = {
                isSafeRoute: true,
                exitDistanceKm: 0, // User is already safe
                selectedHospital: {
                    name: hospitalName,
                    location: hospitalLocation,
                    distance: hospitalDistance
                },
                reasonText: 'nearest safe hospital (you are outside the danger zone)',
                navUrl: navUrl,
                timestamp: new Date()
            };
            
            // Render feedback card FIRST
            this.renderEvacuationFeedback();

            // Then open navigation
            window.open(this.lastEvacuationResult.navUrl, '_blank');
            
        } catch (error) {
            console.error('[Evacuation] Error during hospital navigation:', error);
            this.showEvacuationError('Failed to find safe hospital. Please try again.');
        }
    },

    /**
     * Check if a straight line route avoids the threat zone
     * @param {google.maps.LatLng} start
     * @param {google.maps.LatLng} end
     * @param {google.maps.LatLng} threatCenter
     * @param {number} threatRadius
     * @returns {boolean}
     */
    checkRouteAvoidsThreat(start, end, threatCenter, threatRadius) {
        // Simple check: calculate closest point on line to threat center
        // If closest distance > threatRadius, route likely avoids threat
        
        const startToEnd = google.maps.geometry.spherical.computeDistanceBetween(start, end);
        const startToThreat = google.maps.geometry.spherical.computeDistanceBetween(start, threatCenter);
        const endToThreat = google.maps.geometry.spherical.computeDistanceBetween(end, threatCenter);

        // If both endpoints are outside threat, and threat is not between them
        if (startToThreat > threatRadius && endToThreat > threatRadius) {
            // Use heading to check if threat is roughly perpendicular to route
            const headingToEnd = google.maps.geometry.spherical.computeHeading(start, end);
            const headingToThreat = google.maps.geometry.spherical.computeHeading(start, threatCenter);
            const angleDiff = Math.abs(headingToEnd - headingToThreat);
            
            // If angle difference is > 45 degrees, threat is not directly in path
            if (angleDiff > 45 && angleDiff < 315) {
                return true;
            }
        }
        
        return false;
    },
    
    /**
     * Build human-readable evacuation reason
     * @param {Object} context - Evaluation context
     * @returns {string}
     */
    buildEvacuationReason(context) {
        const { tag, safeHospitalsCount, facilitiesCount, isInside, hasHospital } = context;
        
        if (!hasHospital) {
            return 'routing to safe exit point (no hospitals found outside blast radius)';
        }
        
        if (tag === 'ai-selected') {
            return 'best tradeoff between distance and facility quality';
        }
        
        if (tag === 'filter-relaxed') {
            return 'nearest facility among safe options';
        }
        
        if (safeHospitalsCount > 1) {
            return `closest safe facility (${safeHospitalsCount} options evaluated)`;
        }
        
        return 'closest safe facility outside blast radius';
    },
    
    /**
     * Render evacuation feedback card in the UI
     * Shows explanation of route decision
     */
    renderEvacuationFeedback() {
        if (!this.lastEvacuationResult) return;
        
        const result = this.lastEvacuationResult;
        
        // Find or create feedback container
        let feedbackContainer = document.getElementById('evacuation-feedback-container');
        if (!feedbackContainer) {
            // Create container after evacuation button
            const evacuationContainer = document.getElementById('evacuation-container');
            if (!evacuationContainer) {
                console.warn('[Evacuation] Feedback container not found');
                return;
            }
            
            feedbackContainer = document.createElement('div');
            feedbackContainer.id = 'evacuation-feedback-container';
            evacuationContainer.appendChild(feedbackContainer);
        }
        
        // Determine state
        const isSuccess = result.isSafeRoute;
        const stateClass = isSuccess ? 'evac-result-safe' : 'evac-result-warning';
        const statusIcon = isSuccess ? '✅' : '⚠️';
        const statusText = isSuccess ? 'Safe Route Calculated' : 'No Safe Route Found';
        
        // Capitalize first letter of reason text for polish
        const reasonText = result.reasonText.charAt(0).toUpperCase() + result.reasonText.slice(1);
        
        // Build card using threat-item structure (matches threat cards exactly)
        const cardHTML = `
            <div class="threat-item ${stateClass}">
                <div class="threat-severity-bar"></div>
                <div class="threat-content">
                    <div class="threat-title">
                        ${statusIcon} ${statusText}
                    </div>
                    <div class="threat-meta">
                        ${result.exitDistanceKm > 0 ? `
                        <span><i data-lucide="navigation" class="w-3 h-3 mr-1"></i>Exit: ${result.exitDistanceKm.toFixed(1)} km</span>
                        ` : ''}
                        <span><i data-lucide="hospital" class="w-3 h-3 mr-1"></i>${result.selectedHospital.name}</span>
                        ${result.selectedHospital.distance > 0 ? `
                        <span><i data-lucide="map-pin" class="w-3 h-3 mr-1"></i>${result.selectedHospital.distance.toFixed(1)} km away</span>
                        ` : ''}
                    </div>
                    <div class="evac-reason">
                        <i data-lucide="info" class="w-3 h-3 mr-1"></i>${reasonText}
                    </div>
                    <button class="evac-dismiss" onclick="window.EvacuationModule.clearEvacuationFeedback()" title="Dismiss">
                        ×
                    </button>
                </div>
            </div>
        `;
        
        feedbackContainer.innerHTML = cardHTML;
        
        // Re-render lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }
        
        // Add fade-in animation
        setTimeout(() => {
            const card = feedbackContainer.querySelector('.threat-item');
            if (card) {
                card.classList.add('evac-visible');
            }
        }, 10);
        
        console.log('[Evacuation] Feedback rendered:', result);
    },
    
    /**
     * Show evacuation error feedback
     * @param {string} errorMessage - Error message to display
     */
    showEvacuationError(errorMessage) {
        this.lastEvacuationResult = {
            isSafeRoute: false,
            exitDistanceKm: 0,
            selectedHospital: {
                name: 'N/A',
                location: null,
                distance: 0
            },
            reasonText: errorMessage,
            navUrl: null,
            timestamp: new Date()
        };
        
        this.renderEvacuationFeedback();
    },
    
    /**
     * Clear evacuation feedback
     */
    clearEvacuationFeedback() {
        this.lastEvacuationResult = null;
        const feedbackContainer = document.getElementById('evacuation-feedback-container');
        if (feedbackContainer) {
            feedbackContainer.innerHTML = '';
        }
    }
};
