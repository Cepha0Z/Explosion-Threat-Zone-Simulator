/**
 * Simulation Module
 * Handles threat simulation panel and manual threat placement
 */

export const SimulationModule = {
    simMarker: null,
    simulationCircles: [],
    selectedYield: null,
    selectedThreatName: '',

    threatScenarios: {
        accidents: [
            { name: 'Small Propane Tank', yield: 100 },
            { name: 'Industrial Gas Leak', yield: 5000 },
            { name: 'Gasoline Tanker', yield: 10000 }
        ],
        weapons: [
            { name: 'Standard Car Bomb', yield: 500 },
            { name: 'GBU-43/B (MOAB)', yield: 11000 },
            { name: 'Little Boy (Hiroshima)', yield: 15000 * 1000 },
            { name: 'Tsar Bomba (50MT)', yield: 50000000 * 1000 }
        ]
    },

    /**
     * Initialize simulation panel
     * @param {google.maps.Map} map
     */
    initialize(map) {
        const success = this.createThreatButtons();
        this.setupEventListeners(map);
        this.setupAutocomplete(map);
        
        // If buttons weren't created, retry after a short delay
        if (!success) {
            setTimeout(() => {
                console.log('🔄 Retrying simulation button creation...');
                this.createThreatButtons();
            }, 500);
        }
    },

    /**
     * Ensure buttons are created (can be called externally)
     */
    ensureButtonsCreated() {
        return this.createThreatButtons();
    },

    /**
     * Create threat scenario buttons
     */
    createThreatButtons() {
        const accidentsContainer = document.getElementById('accidents-container');
        const weaponsContainer = document.getElementById('weapons-container');

        if (!accidentsContainer || !weaponsContainer) {
            console.warn('⚠️ Simulation containers not found in DOM, will retry when tab is shown');
            return false;
        }

        // Clear existing buttons first
        accidentsContainer.innerHTML = '';
        weaponsContainer.innerHTML = '';

        if (accidentsContainer) {
            this.threatScenarios.accidents.forEach(threat => {
                accidentsContainer.appendChild(this.createButton(threat));
            });
        }

        if (weaponsContainer) {
            this.threatScenarios.weapons.forEach(threat => {
                weaponsContainer.appendChild(this.createButton(threat));
            });
        }

        // Refresh lucide icons after adding buttons
        if (window.lucide) {
            lucide.createIcons();
        }
        
        console.log('✅ Simulation buttons created:', {
            accidents: this.threatScenarios.accidents.length,
            weapons: this.threatScenarios.weapons.length
        });
        
        return true;
    },

    /**
     * Create a threat button
     * @param {Object} threat
     * @returns {HTMLElement}
     */
    createButton(threat) {
        const button = document.createElement('button');
        button.className = 'threat-btn w-full text-left p-3 bg-gray-800/50 border-2 border-transparent hover:border-blue-500/50 rounded-lg';
        
        const yieldText = threat.yield >= 1000000
            ? `${(threat.yield / 1000000).toLocaleString()} kT`
            : `${threat.yield.toLocaleString()} kg`;
        
        button.innerHTML = `<div class="flex justify-between items-center"><span class="font-semibold text-white">${threat.name}</span><span class="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded">${yieldText} TNT</span></div>`;
        button.dataset.yield = threat.yield;
        button.dataset.name = threat.name;
        
        button.addEventListener('click', () => {
            document.querySelectorAll('.threat-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            this.selectedYield = parseFloat(button.dataset.yield);
            this.selectedThreatName = button.dataset.name;
            
            const simulateBtn = document.getElementById('simulateBtn');
            if (simulateBtn) simulateBtn.disabled = false;
        });
        
        return button;
    },

    /**
     * Setup event listeners
     * @param {google.maps.Map} map
     */
    setupEventListeners(map) {
        const simulateBtn = document.getElementById('simulateBtn');
        const resetBtn = document.getElementById('resetBtn');
        const useLocationBtn = document.getElementById('use-location-btn');
        const fillToggle = document.getElementById('fillToggle');

        if (simulateBtn) {
            simulateBtn.addEventListener('click', () => this.runSimulation(map));
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSimulator(map));
        }

        if (useLocationBtn) {
            useLocationBtn.addEventListener('click', () => this.useCurrentLocation(map));
        }

        if (fillToggle) {
            fillToggle.addEventListener('change', (e) => {
                const newOpacity = e.target.checked ? 0.2 : 0;
                this.simulationCircles.forEach(circle => circle.setOptions({ fillOpacity: newOpacity }));
            });
        }

        // Map click handler
        map.addListener('click', (e) => {
            const simulatorPanel = document.getElementById('simulator-panel');
            if (simulatorPanel && !simulatorPanel.classList.contains('hidden')) {
                this.clearSimulation();
                const newPos = e.latLng.toJSON();
                this.updateCoords(newPos);
                this.setSimMarker(newPos, map);
            }
        });
    },

    /**
     * Setup autocomplete for location search
     * @param {google.maps.Map} map
     */
    setupAutocomplete(map) {
        const locationSearchInput = document.getElementById('location-search');
        if (locationSearchInput) {
            const autocomplete = new google.maps.places.Autocomplete(locationSearchInput);
            autocomplete.bindTo('bounds', map);

            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.geometry && place.geometry.location) {
                    const newPos = place.geometry.location.toJSON();
                    map.setCenter(newPos);
                    map.setZoom(14);
                    this.clearSimulation();
                    this.updateCoords(newPos);
                    this.setSimMarker(newPos, map);
                }
            });
        }
    },

    /**
     * Run simulation
     * @param {google.maps.Map} map
     */
    runSimulation(map) {
        const latInput = document.getElementById('lat');
        const lngInput = document.getElementById('lng');
        
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        
        if (isNaN(lat) || isNaN(lng) || this.selectedYield === null) {
            alert('Please select a threat scenario and set a location.');
            return;
        }

        this.clearSimulation();
        const center = { lat, lng };
        const zones = window.ThreatsModule.calculateBlastZones(this.selectedYield);
        
        map.panTo(center);
        this.setSimMarker(center, map);

        const resultsContent = document.getElementById('results-content');
        const resultsDiv = document.getElementById('results');
        const fillToggle = document.getElementById('fillToggle');
        
        if (resultsContent) resultsContent.innerHTML = '';
        
        const currentFillOpacity = fillToggle && fillToggle.checked ? 0.2 : 0;

        Object.values(zones).reverse().forEach(zone => {
            const circle = new google.maps.Circle({
                strokeColor: zone.color,
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: zone.color,
                fillOpacity: currentFillOpacity,
                map,
                center: center,
                radius: zone.radius
            });
            this.simulationCircles.push(circle);

            if (resultsContent) {
                const resultItem = document.createElement('div');
                resultItem.className = 'flex items-center text-sm';
                resultItem.innerHTML = `<div class="w-4 h-4 rounded-full mr-3" style="background-color: ${zone.color};"></div><div class="flex-grow"><span class="font-medium text-gray-300">${zone.name}:</span><span class="float-right font-mono text-white">${(zone.radius / 1000).toFixed(2)} km</span></div>`;
                resultsContent.appendChild(resultItem);
            }
        });

        if (resultsDiv) resultsDiv.classList.remove('hidden');
    },

    /**
     * Reset simulator
     * @param {google.maps.Map} map
     */
    resetSimulator(map) {
        this.clearSimulation();
        const initialPos = map.getCenter().toJSON();
        this.updateCoords(initialPos);
        this.setSimMarker(initialPos, map);
        
        const resultsDiv = document.getElementById('results');
        const locationSearchInput = document.getElementById('location-search');
        
        if (resultsDiv) resultsDiv.classList.add('hidden');
        if (locationSearchInput) locationSearchInput.value = '';
        
        this.selectedYield = null;
        this.selectedThreatName = '';
        
        document.querySelectorAll('.threat-btn').forEach(btn => btn.classList.remove('active'));
        
        const simulateBtn = document.getElementById('simulateBtn');
        if (simulateBtn) simulateBtn.disabled = true;
    },

    /**
     * Clear simulation overlays
     */
    clearSimulation() {
        this.simulationCircles.forEach(c => c.setMap(null));
        this.simulationCircles.length = 0;
        if (this.simMarker) this.simMarker.setMap(null);
    },

    /**
     * Update coordinate inputs
     * @param {Object} pos - {lat, lng}
     */
    updateCoords(pos) {
        const latInput = document.getElementById('lat');
        const lngInput = document.getElementById('lng');
        
        if (latInput) latInput.value = pos.lat.toFixed(6);
        if (lngInput) lngInput.value = pos.lng.toFixed(6);
    },

    /**
     * Set simulation marker
     * @param {Object} position
     * @param {google.maps.Map} map
     */
    setSimMarker(position, map) {
        if (this.simMarker) this.simMarker.setMap(null);
        
        this.simMarker = new google.maps.Marker({
            position: position,
            map: map,
            animation: google.maps.Animation.DROP,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: '#38b6ff',
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 2
            }
        });
    },

    /**
     * Use current location
     * @param {google.maps.Map} map
     */
    useCurrentLocation(map) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    map.setCenter(newPos);
                    map.setZoom(18);
                    this.updateCoords(newPos);
                    this.setSimMarker(newPos, map);
                },
                () => alert('Geolocation permission was denied. Could not find your location.')
            );
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    }
};
