/**
 * Threats Module
 * Handles threat fetching, rendering, and display
 */

export const ThreatsModule = {
    liveThreats: [],
    liveThreatOverlays: [],
    lastThreatHash: '',
    userLocation: null, // Store user's location for proximity checks
    
    // Threat Timeline (session-scoped)
    threatTimeline: [], // Array of {id, name, created, ended, source, status}
    activeThreatsMap: new Map(), // Track currently active threats by ID

    /**
     * Update user location for proximity-based features
     */
    updateUserLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    console.log('📍 User location updated for glow proximity:', this.userLocation);
                },
                (error) => {
                    console.warn('⚠️ Could not get user location for glow proximity:', error.message);
                    // Keep userLocation as null, will default to showing all glows
                }
            );
        }
    },

    /**
     * Load threats from API
     * @returns {Promise<Array>}
     */
    async loadThreats() {
        try {
            const res = await fetch('/api/threats');
            this.liveThreats = await res.json();
            return this.liveThreats;
        } catch (err) {
            console.error('Failed to load threats:', err);
            return [];
        }
    },

    /**
     * Calculate blast zones for a given yield
     * @param {number} yieldKg - Yield in kg TNT
     * @returns {Object} - Zone definitions
     */
    calculateBlastZones(yieldKg) {
        const scaledDistanceFactor = Math.cbrt(yieldKg);
        return {
            lethal: {
                radius: 25 * scaledDistanceFactor,
                color: '#ff3838',
                name: 'Lethal Zone'
            },
            severe: {
                radius: 50 * scaledDistanceFactor,
                color: '#ff8c38',
                name: 'Severe Damage'
            },
            moderate: {
                radius: 100 * scaledDistanceFactor,
                color: '#fdd835',
                name: 'Moderate Damage'
            },
            minor: {
                radius: 200 * scaledDistanceFactor,
                color: '#38b6ff',
                name: 'Minor Damage'
            }
        };
    },

    /**
     * Update threats on map and sidebar (handles animations)
     * @param {google.maps.Map} map
     */
    displayThreats(map) {
        const liveThreatsList = document.getElementById('live-threats-list');
        const threatCount = document.getElementById('threat-count');
        const evacuationContainer = document.getElementById('evacuation-container');
        
        if (threatCount) threatCount.textContent = `${this.liveThreats.length} Active`;

        // Update Evacuation Button
        if (evacuationContainer) {
            if (this.liveThreats.length > 0 && evacuationContainer.innerHTML === '') {
                const evacBtn = document.createElement('button');
                evacBtn.innerHTML = '<i data-lucide="siren" class="w-4 h-4 mr-2"></i> Evacuate From My Location';
                evacBtn.className = 'w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-md transition duration-300 transform hover:scale-105 shadow-lg shadow-red-600/20 mb-4';
                evacBtn.onclick = () => {
                    if (window.EvacuationModule) {
                        window.EvacuationModule.generateEvacuationNavigation(this.liveThreats, map);
                    }
                };
                evacuationContainer.appendChild(evacBtn);
                lucide.createIcons();
            } else if (this.liveThreats.length === 0) {
                evacuationContainer.innerHTML = '';
            }
        }

        // Initialize tracking map if needed
        if (!this.activeThreatsMap) {
            this.activeThreatsMap = new Map();
        }

        const currentThreatIds = new Set(this.liveThreats.map(t => t.id));
        
        // 1. Handle Removed Threats (Fade Out)
        for (const [id, data] of this.activeThreatsMap) {
            if (!currentThreatIds.has(id)) {
                // Add to timeline before removing
                this.addToTimeline(id, data.threat, 'removed');
                
                // Remove from sidebar with animation
                if (data.element) {
                    data.element.classList.add('threat-exiting');
                    setTimeout(() => data.element.remove(), 400); // Match CSS transition
                }

                // Fade out map overlays
                data.overlays.forEach(overlay => {
                    // Stop pulse if active
                    if (overlay.pulseInterval) clearInterval(overlay.pulseInterval);
                    
                    // Animate opacity to 0
                    let opacity = overlay.get('fillOpacity') || 1;
                    const fadeInterval = setInterval(() => {
                        opacity -= 0.1;
                        if (opacity <= 0) {
                            clearInterval(fadeInterval);
                            overlay.setMap(null);
                        } else {
                            if (overlay.setOpacity) overlay.setOpacity(opacity); // Marker
                            else overlay.setOptions({ fillOpacity: opacity, strokeOpacity: opacity }); // Circle
                        }
                    }, 50);
                });

                this.activeThreatsMap.delete(id);
            }
        }

        // 2. Handle New & Existing Threats
        this.liveThreats.forEach(threat => {
            if (this.activeThreatsMap.has(threat.id)) {
                return; // Already rendered
            }

            const threatOverlays = [];
            const zones = this.calculateBlastZones(threat.yield);
            const severity = this.getThreatSeverity(threat);
            const isCritical = severity === 'critical';
            
            // Check if threat is near user (within 50km)
            const isNearUser = this.isThreatNearUser(threat.location);
            
            // Draw circles
            Object.values(zones).reverse().forEach(zone => {
                const isLethal = zone.name === 'Lethal Zone';
                const isSevere = zone.name === 'Severe Damage';
                const isModerate = zone.name === 'Moderate Damage';
                
                // Add glow for lethal (red), severe (orange), and moderate (yellow) zones near user
                if (isNearUser && (isLethal || isSevere || isModerate)) {
                    const glowCircle = new google.maps.Circle({
                        strokeColor: zone.color,
                        strokeOpacity: 0,
                        strokeWeight: 0,
                        fillColor: zone.color,
                        fillOpacity: 0.3,
                        map,
                        center: threat.location,
                        radius: zone.radius, // EXACT same size as zone
                        zIndex: 1
                    });
                    threatOverlays.push(glowCircle);
                    this.animatePulse(glowCircle);
                }

                const circle = new google.maps.Circle({
                    strokeColor: zone.color,
                    strokeOpacity: 0.8,
                    strokeWeight: isLethal && isCritical ? 3 : 2,
                    fillColor: zone.color,
                    fillOpacity: 0.2,
                    map,
                    center: threat.location,
                    radius: zone.radius,
                    zIndex: 2
                });
                threatOverlays.push(circle);
            });

            // Draw marker
            const marker = new google.maps.Marker({
                position: threat.location,
                map: map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: isCritical ? 10 : 8,
                    fillColor: isCritical ? '#ef4444' : '#ff3838',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2
                },
                zIndex: 3
            });
            threatOverlays.push(marker);

            // Add to sidebar
            let threatEl = null;
            if (liveThreatsList) {
                threatEl = this.createThreatListItem(threat, map);
                liveThreatsList.appendChild(threatEl);
                lucide.createIcons(); // Refresh icons for new item
            }

            // Track state
            this.activeThreatsMap.set(threat.id, {
                element: threatEl,
                overlays: threatOverlays,
                threat: threat
            });
            
            // Add to timeline as active
            this.addToTimeline(threat.id, threat, 'active');
        });
    },

    /**
     * Check if threat is near user's location
     * @param {Object} threatLocation - {lat, lng}
     * @returns {boolean}
     */
    isThreatNearUser(threatLocation) {
        // Try to get user's current location
        if (!this.userLocation) {
            // Attempt to get it from browser geolocation (cached)
            return true; // Default to true if we don't have user location yet
        }
        
        // Calculate distance using Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = (threatLocation.lat - this.userLocation.lat) * Math.PI / 180;
        const dLng = (threatLocation.lng - this.userLocation.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.userLocation.lat * Math.PI / 180) * 
                  Math.cos(threatLocation.lat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return distance <= 50; // Within 50km
    },

    /**
     * Animate pulse effect for a circle (SLOWER, SMOOTHER)
     * @param {google.maps.Circle} circle 
     */
    animatePulse(circle) {
        let direction = 1;
        let opacity = 0.25;
        
        const interval = setInterval(() => {
            if (!circle.getMap()) {
                clearInterval(interval);
                return;
            }
            
            // Slower, smoother: smaller steps, longer interval
            opacity += 0.015 * direction;
            if (opacity >= 0.5) direction = -1;
            if (opacity <= 0.15) direction = 1;
            
            circle.setOptions({ fillOpacity: opacity });
        }, 60); // Slower: 60ms per frame
        
        // Store interval to clear it later if needed (though getMap check handles most cases)
        circle.pulseInterval = interval;
    },

    /**
     * Get threat severity level
     * @param {Object} threat
     * @returns {string} 'critical' | 'high' | 'moderate' | 'low'
     */
    getThreatSeverity(threat) {
        // Heuristic based on yield and keywords
        const yieldKg = threat.yield || 0;
        const details = (threat.details || '').toLowerCase();
        const name = (threat.name || '').toLowerCase();
        
        // Critical: High yield or specific keywords
        if (yieldKg >= 1000 || details.includes('nuclear') || name.includes('nuclear') || details.includes('massive')) {
            return 'critical';
        }
        
        // High: Medium yield
        if (yieldKg >= 500 || details.includes('fire') || details.includes('explosion')) {
            return 'high';
        }
        
        // Moderate: Low yield
        if (yieldKg > 0) {
            return 'moderate';
        }
        
        return 'low';
    },

    /**
     * Create threat list item element
     * @param {Object} threat
     * @param {google.maps.Map} map
     * @returns {HTMLElement}
     */
    createThreatListItem(threat, map) {
        const severity = this.getThreatSeverity(threat);
        const threatEl = document.createElement('div');
        threatEl.className = `threat-item threat-severity-${severity}`;
        threatEl.id = `threat-item-${threat.id}`; // Add ID for tracking
        
        const eventTime = new Date(threat.timestamp);
        const timeString = eventTime.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Format source for display
        const sourceDisplay = threat.source === 'simulation_news' ? 'News Feed' : 
                            threat.source === 'admin' ? 'Admin Broadcast' : 
                            threat.source === 'demo' ? 'Simulation' : 'Unknown Source';

        threatEl.innerHTML = `
            <div class="threat-severity-bar"></div>
            <div class="threat-content">
                <div class="threat-title">${threat.name}</div>
                <div class="threat-meta">
                    <span><i data-lucide="map-pin" class="w-3 h-3 mr-1"></i>${threat.locationName}</span>
                    <span><i data-lucide="clock" class="w-3 h-3 mr-1"></i>${timeString}</span>
                    <span><i data-lucide="radio" class="w-3 h-3 mr-1"></i>${sourceDisplay}</span>
                </div>
                <div class="threat-details text-xs text-gray-400 border-t border-gray-700 mt-2 pt-2">
                    <p><strong>Details:</strong> ${threat.details}</p>
                    <p class="mt-1"><strong>Yield:</strong> ${threat.yield} kg TNT</p>
                </div>
            </div>
        `;

        threatEl.addEventListener('click', () => {
            // Smooth zoom to threat location
            this.smoothZoomTo(map, threat.location, 16);
            const currentDetailsPanel = threatEl.querySelector('.threat-details');
            
            // Close others
            document.querySelectorAll('.threat-details').forEach(panel => {
                if (panel !== currentDetailsPanel) {
                    panel.classList.remove('active');
                }
            });
            
            currentDetailsPanel.classList.toggle('active');
        });

        return threatEl;
    },

    /**
     * Clear all threat overlays from map
     */
    clearThreats() {
        this.liveThreatOverlays.forEach(overlay => overlay.setMap(null));
        this.liveThreatOverlays.length = 0;
    },

    /**
     * Auto-update threats (call periodically)
     * @param {google.maps.Map} map
     */
    async autoUpdate(map) {
        const data = await this.loadThreats();
        const newHash = JSON.stringify(data);
        
        if (newHash !== this.lastThreatHash) {
            this.displayThreats(map);
            this.lastThreatHash = newHash;
            
            // Update admin list if available
            if (window.AdminModule && window.AdminModule.isAdmin()) {
                window.AdminModule.updateThreatList(this.liveThreats);
            }
        }
    },

    /**
     * Smooth zoom to a location
     * @param {google.maps.Map} map
     * @param {Object} location - {lat, lng}
     * @param {number} targetZoom
     */
    smoothZoomTo(map, location, targetZoom) {
        map.panTo(location);
        
        const currentZoom = map.getZoom();
        if (currentZoom === targetZoom) return;
        
        // Smooth zoom animation
        const step = currentZoom < targetZoom ? 1 : -1;
        const zoomInterval = setInterval(() => {
            const zoom = map.getZoom();
            if ((step > 0 && zoom >= targetZoom) || (step < 0 && zoom <= targetZoom)) {
                map.setZoom(targetZoom);
                clearInterval(zoomInterval);
            } else {
                map.setZoom(zoom + step);
            }
        }, 100); // Zoom step every 100ms
    },

    /**
     * Start auto-update loop
     * @param {google.maps.Map} map
     * @param {number} interval - Update interval in ms (default: 5000)
     */
    startAutoUpdate(map, interval = 5000) {
        // Get user location for proximity-based glow and zoom
        this.updateUserLocation();
        
        // Smooth zoom to user location on startup
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userPos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    console.log('🎯 Zooming to user location:', userPos);
                    this.smoothZoomTo(map, userPos, 12);
                    
                    // Update user marker on map module
                    if (window.MapModule && window.MapModule.updateUserMarker) {
                        window.MapModule.updateUserMarker(userPos);
                    }
                },
                (error) => {
                    console.warn('⚠️ Could not zoom to user location:', error.message);
                }
            );
        }
        
        this.autoUpdate(map); // Initial load
        setInterval(() => this.autoUpdate(map), interval);
    },
    
    /**
     * Add or update threat in timeline
     * @param {string} id - Threat ID
     * @param {object} threat - Threat object
     * @param {string} status - 'active', 'expired', or 'removed'
     */
    addToTimeline(id, threat, status = 'active') {
        const existingIndex = this.threatTimeline.findIndex(entry => entry.id === id);
        
        if (existingIndex >= 0) {
            // Update existing entry
            if (status !== 'active') {
                this.threatTimeline[existingIndex].ended = new Date().toISOString();
                this.threatTimeline[existingIndex].status = status;
            }
        } else {
            // Add new entry
            this.threatTimeline.push({
                id: id,
                name: threat.name,
                created: threat.timestamp,
                ended: status !== 'active' ? new Date().toISOString() : null,
                source: threat.source || 'unknown',
                status: status
            });
        }
        
        // Render timeline
        this.renderTimeline();
    },
    
    /**
     * Render threat timeline UI
     */
    renderTimeline() {
        const timelineContainer = document.getElementById('threat-timeline-list');
        if (!timelineContainer) return;
        
        // Sort by created time (most recent first)
        const sortedTimeline = [...this.threatTimeline].sort((a, b) => 
            new Date(b.created) - new Date(a.created)
        );
        
        if (sortedTimeline.length === 0) {
            timelineContainer.innerHTML = '<div class="text-sm text-gray-500 italic p-4">No threat history this session</div>';
            return;
        }
        
        timelineContainer.innerHTML = sortedTimeline.map(entry => {
            const createdDate = new Date(entry.created);
            const createdTime = createdDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            
            let endedTime = '';
            if (entry.ended) {
                const endedDate = new Date(entry.ended);
                endedTime = endedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            }
            
            // Status class for left border color
            const statusClass = entry.status === 'active' ? 'timeline-active' : 
                               entry.status === 'expired' ? 'timeline-expired' : 'timeline-removed';
            
            const sourceDisplay = entry.source === 'simulation_news' ? 'News Feed' : 
                                 entry.source === 'admin' ? 'Admin' : 
                                 entry.source === 'demo' ? 'Demo' : 'Unknown';
            
            // Status badge
            const statusBadge = entry.status === 'active' ? 
                '<span class="timeline-status-badge timeline-badge-active">Active</span>' :
                entry.status === 'expired' ?
                '<span class="timeline-status-badge timeline-badge-expired">Expired</span>' :
                '<span class="timeline-status-badge timeline-badge-removed">Removed</span>';
            
            return `
                <div class="threat-item ${statusClass}">
                    <div class="threat-severity-bar"></div>
                    <div class="threat-content">
                        <div class="threat-title">${entry.name}</div>
                        <div class="threat-meta">
                            <span><i data-lucide="clock" class="w-3 h-3 mr-1"></i>${createdTime}</span>
                            ${endedTime ? `<span><i data-lucide="x-circle" class="w-3 h-3 mr-1"></i>${endedTime}</span>` : ''}
                            <span><i data-lucide="radio" class="w-3 h-3 mr-1"></i>${sourceDisplay}</span>
                        </div>
                        ${statusBadge}
                    </div>
                </div>
            `;
        }).join('');
        
        // Update timeline count
        const timelineCount = document.getElementById('timeline-count');
        if (timelineCount) {
            timelineCount.textContent = `${sortedTimeline.length} ${sortedTimeline.length === 1 ? 'Entry' : 'Entries'}`;
        }
        
        // Re-render lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }
    }
};
