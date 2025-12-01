/**
 * Threats Module
 * Handles threat fetching, rendering, and display
 */

export const ThreatsModule = {
    liveThreats: [],
    liveThreatOverlays: [],
    lastThreatHash: '',

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
            
            // Draw circles
            Object.values(zones).reverse().forEach(zone => {
                const isLethal = zone.name === 'Lethal Zone';
                
                // Add glow for lethal zone of critical threats
                if (isCritical && isLethal) {
                    const glowCircle = new google.maps.Circle({
                        strokeColor: zone.color,
                        strokeOpacity: 0,
                        strokeWeight: 0,
                        fillColor: zone.color,
                        fillOpacity: 0.3,
                        map,
                        center: threat.location,
                        radius: zone.radius * 1.05, // Slightly larger for subtle glow
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
                data: threat
            });
        });
    },

    /**
     * Animate pulse effect for a circle
     * @param {google.maps.Circle} circle 
     */
    animatePulse(circle) {
        let direction = 1;
        let opacity = 0;
        
        const interval = setInterval(() => {
            if (!circle.getMap()) {
                clearInterval(interval);
                return;
            }
            
            // Increment/Decrement
            opacity += 0.015 * direction; // Slightly slower for smoothness
            
            // Clamp and reverse direction
            if (opacity >= 0.6) {
                opacity = 0.6;
                direction = -1;
            } else if (opacity <= 0) {
                opacity = 0;
                direction = 1;
            }
            
            // Ensure valid value for Google Maps
            const safeOpacity = Math.max(0, Math.min(0.6, opacity));
            circle.setOptions({ fillOpacity: safeOpacity });
        }, 50);
        
        // Store interval to clear it later if needed
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
            map.panTo(threat.location);
            map.setZoom(16);
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
     * Start auto-update loop
     * @param {google.maps.Map} map
     * @param {number} interval - Update interval in ms (default: 5000)
     */
    startAutoUpdate(map, interval = 5000) {
        this.autoUpdate(map); // Initial load
        setInterval(() => this.autoUpdate(map), interval);
    }
};
