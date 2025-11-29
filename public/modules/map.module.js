/**
 * Map Module
 * Handles Google Maps initialization and configuration
 */

export const MapModule = {
    map: null,
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

        return this.map;
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
