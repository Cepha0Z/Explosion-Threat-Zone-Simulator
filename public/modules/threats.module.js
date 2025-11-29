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
     * Display threats on map
     * @param {google.maps.Map} map
     */
    displayThreats(map) {
        this.clearThreats();
        
        const liveThreatsList = document.getElementById('live-threats-list');
        const threatCount = document.getElementById('threat-count');
        const evacuationContainer = document.getElementById('evacuation-container');
        
        if (liveThreatsList) liveThreatsList.innerHTML = '';
        if (evacuationContainer) evacuationContainer.innerHTML = '';
        if (threatCount) threatCount.textContent = `${this.liveThreats.length} Active`;

        // Add evacuation button if threats exist
        if (this.liveThreats.length > 0 && evacuationContainer) {
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
        }

        // Render each threat
        this.liveThreats.forEach(threat => {
            const zones = this.calculateBlastZones(threat.yield);
            
            // Draw circles
            Object.values(zones).reverse().forEach(zone => {
                const circle = new google.maps.Circle({
                    strokeColor: zone.color,
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: zone.color,
                    fillOpacity: 0.2,
                    map,
                    center: threat.location,
                    radius: zone.radius
                });
                this.liveThreatOverlays.push(circle);
            });

            // Draw marker
            const marker = new google.maps.Marker({
                position: threat.location,
                map: map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#ff3838',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2
                }
            });
            this.liveThreatOverlays.push(marker);

            // Add to list
            if (liveThreatsList) {
                const threatEl = this.createThreatListItem(threat, map);
                liveThreatsList.appendChild(threatEl);
            }
        });
    },

    /**
     * Create threat list item element
     * @param {Object} threat
     * @param {google.maps.Map} map
     * @returns {HTMLElement}
     */
    createThreatListItem(threat, map) {
        const threatEl = document.createElement('div');
        threatEl.className = 'bg-gray-800/50 p-3 rounded-lg border border-gray-700 hover:bg-gray-700/50 cursor-pointer transition';
        
        const eventTime = new Date(threat.timestamp);
        const timeString = eventTime.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        threatEl.innerHTML = `
            <div class="flex items-center justify-between">
                <h3 class="font-bold text-red-400">${threat.name}</h3>
                <span class="text-xs font-mono text-gray-400">${timeString}</span>
            </div>
            <p class="text-sm text-gray-300 mt-1">${threat.locationName}</p>
            <div class="threat-details text-xs text-gray-400 border-t border-gray-700">
                <p><strong>Details:</strong> ${threat.details}</p>
            </div>
        `;

        threatEl.addEventListener('click', () => {
            map.panTo(threat.location);
            map.setZoom(18);
            const currentDetailsPanel = threatEl.querySelector('.threat-details');
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
