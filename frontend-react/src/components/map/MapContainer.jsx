import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { calculateBlastZones } from '../../utils/blastMath';

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

export default function MapContainer({ threats, onMapLoad }) {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const circlesRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    const loadMap = async () => {
      if (window.google?.maps) {
        setMapLoaded(true);
        return;
      }

      try {
        const res = await axios.get('/api/config');
        const apiKey = res.data.googleMapsApiKey;

        if (!apiKey) {
          console.error('Google Maps API Key not found');
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => setMapLoaded(true);
        document.head.appendChild(script);
      } catch (error) {
        console.error('Failed to load map config:', error);
      }
    };

    loadMap();
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || googleMapRef.current) return;
    
    // Safety check: ensure Google Maps API is fully loaded
    if (!window.google || !window.google.maps || !window.google.maps.Map) {
      console.warn('[MapContainer] Google Maps API not fully loaded yet, retrying...');
      // Retry after a short delay
      const retryTimer = setTimeout(() => setMapLoaded(true), 500);
      return () => clearTimeout(retryTimer);
    }

    try {
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20.5937, lng: 78.9629 }, // India center
        zoom: 5,
        styles: DARK_MAP_STYLE,
        streetViewControl: false,
        mapTypeControl: false,
      });
      
      if (onMapLoad) {
        onMapLoad(googleMapRef.current);
      }

      // Auto-zoom to user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userPos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            if (googleMapRef.current) {
              googleMapRef.current.setCenter(userPos);
              googleMapRef.current.setZoom(12);
              
              // Optional: Add "You are here" marker
              new window.google.maps.Marker({
                position: userPos,
                map: googleMapRef.current,
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 7,
                  fillColor: '#4285F4',
                  fillOpacity: 1,
                  strokeColor: 'white',
                  strokeWeight: 2,
                },
                title: "Your Location"
              });
            }
          },
          (error) => {
            console.warn("Map auto-zoom failed (geolocation):", error.message);
          }
        );
      }
    } catch (error) {
      console.error('[MapContainer] Failed to initialize map:', error);
    }
  }, [mapLoaded, onMapLoad]);

  // Handle Focus Location
  useEffect(() => {
    if (googleMapRef.current && threats) {
       // This effect handles threats updates, but we need a way to focus externally.
       // The parent component can call map.panTo directly if it has the instance.
       // Alternatively, we could accept a 'focusedLocation' prop.
       // For now, we'll rely on the parent using the map instance via onMapLoad.
    }
  }, [threats]);

  // Render Threats
  useEffect(() => {
    if (!window.google || !googleMapRef.current || !threats) return;

    // Safety check: ensure it's actually a Map instance, not a DOM element
    if (!(googleMapRef.current instanceof window.google.maps.Map)) {
      console.warn('MapContainer: googleMapRef.current is not a Map instance', googleMapRef.current);
      return;
    }

    // Clear existing
    markersRef.current.forEach(m => m.setMap(null));
    circlesRef.current.forEach(c => c.setMap(null));
    markersRef.current = [];
    circlesRef.current = [];

    threats.forEach(threat => {
      const position = { lat: threat.location.lat, lng: threat.location.lng };

      // Add Marker
      const marker = new window.google.maps.Marker({
        position,
        map: googleMapRef.current,
        title: threat.name,
        animation: window.google.maps.Animation.DROP,
      });
      markersRef.current.push(marker);

      // Add Blast Zones
      const zones = calculateBlastZones(threat.yield || 1.0);
      zones.forEach(zone => {
        const circle = new window.google.maps.Circle({
          strokeColor: zone.color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: zone.color,
          fillOpacity: zone.opacity,
          map: googleMapRef.current,
          center: position,
          radius: zone.radius,
        });
        circlesRef.current.push(circle);
      });
    });
  }, [mapLoaded, threats]);

  return <div ref={mapRef} className="w-full h-full min-h-[500px] rounded-lg shadow-xl" />;
}
