/**
 * Map Module
 * Handles Google Maps initialization and configuration
 */

export const MapModule = {
    map: null,
    userMarker: null,
    userLocation: null,
    directionsService: null,
    directionsRenderer: null,

    /**
     * Initialize Google Maps
     * @param {string} elementId - Map container element ID
     * @returns {google.maps.Map}
     */
    async initialize(elementId = 'map') {
        const initialPos = { lat: 20.5937, lng: 78.9629 };
        
        this.map = new google.maps.Map(document.getElementById(elementId), {
            center: initialPos,
            zoom: 5,
            mapTypeId: 'roadmap',
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: this.getDarkThemeStyles()
        });

        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({
            map: this.map,
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: '#00ffff',
                strokeWeight: 5,
                strokeOpacity: 0.8
            }
        });

        // Add user location button
        this.addUserLocationButton();

        return this.map;
    },

    /**
     * Add custom button to recenter on user location
     */
    addUserLocationButton() {
        const locationButton = document.createElement('button');
        locationButton.className = 'custom-map-control-button';
        locationButton.title = 'Go to my location';
        locationButton.innerHTML = '<i data-lucide="crosshair" class="w-5 h-5"></i>';
        locationButton.style.cssText = `
            background-color: #fff;
            border: none;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,.3);
            cursor: pointer;
            margin-bottom: 22px;
            margin-right: 10px;
            text-align: center;
            height: 40px;
            width: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease-in-out;
        `;

        locationButton.addEventListener('click', () => {
            this.recenterOnUser();
        });

        locationButton.addEventListener('mouseenter', () => {
            locationButton.style.backgroundColor = '#f8f8f8';
        });

        locationButton.addEventListener('mouseleave', () => {
            locationButton.style.backgroundColor = '#fff';
        });

        this.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(locationButton);
        
        // Initialize lucide icons for the button
        setTimeout(() => {
            if (window.lucide) {
                lucide.createIcons();
            }
        }, 100);
    },

    /**
     * Recenter map on user's location
     */
    recenterOnUser() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userPos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    this.userLocation = userPos;
                    
                    // Smooth zoom to user location
                    if (window.ThreatsModule && window.ThreatsModule.smoothZoomTo) {
                        window.ThreatsModule.smoothZoomTo(this.map, userPos, 14);
                    } else {
                        this.map.panTo(userPos);
                        this.map.setZoom(14);
                    }
                    
                    // Update or create user marker
                    this.updateUserMarker(userPos);
                },
                (error) => {
                    alert('Could not get your location. Please enable location services.');
                    console.error('Geolocation error:', error);
                }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
        }
    },

    /**
     * Update user location marker on map
     * @param {Object} position - {lat, lng}
     */
    updateUserMarker(position) {
        if (this.userMarker) {
            this.userMarker.setPosition(position);
        } else {
            this.userMarker = new google.maps.Marker({
                position: position,
                map: this.map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#4285F4', // Google blue
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 3
                },
                title: 'Your Location',
                zIndex: 1000
            });
        }
    },

    /**
     * Get dark theme map styles
     * @returns {Array}
     */
    getDarkThemeStyles() {
        return [
            { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
            {
                featureType: 'administrative.locality',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#d59563' }]
            },
            {
                featureType: 'poi',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#d59563' }]
            },
            {
                featureType: 'poi.park',
                elementType: 'geometry',
                stylers: [{ color: '#263c3f' }]
            },
            {
                featureType: 'poi.park',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#6b9a76' }]
            },
            {
                featureType: 'road',
                elementType: 'geometry',
                stylers: [{ color: '#38414e' }]
            },
            {
                featureType: 'road',
                elementType: 'geometry.stroke',
                stylers: [{ color: '#212a37' }]
            },
            {
                featureType: 'road',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#9ca5b3' }]
            },
            {
                featureType: 'road.highway',
                elementType: 'geometry',
                stylers: [{ color: '#746855' }]
            },
            {
                featureType: 'road.highway',
                elementType: 'geometry.stroke',
                stylers: [{ color: '#1f2835' }]
            },
            {
                featureType: 'road.highway',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#f3d19c' }]
            },
            {
                featureType: 'transit',
                elementType: 'geometry',
                stylers: [{ color: '#2f3948' }]
            },
            {
                featureType: 'transit.station',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#d59563' }]
            },
            {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#17263c' }]
            },
            {
                featureType: 'water',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#515c6d' }]
            },
            {
                featureType: 'water',
                elementType: 'labels.text.stroke',
                stylers: [{ color: '#17263c' }]
            }
        ];
    },

    /**
     * Get map instance
     * @returns {google.maps.Map}
     */
    getMap() {
        return this.map;
    },

    /**
     * Get directions service
     * @returns {google.maps.DirectionsService}
     */
    getDirectionsService() {
        return this.directionsService;
    },

    /**
     * Get directions renderer
     * @returns {google.maps.DirectionsRenderer}
     */
    getDirectionsRenderer() {
        return this.directionsRenderer;
    }
};
