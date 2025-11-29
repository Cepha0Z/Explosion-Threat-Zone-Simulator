window.addEventListener("DOMContentLoaded", async () => {
  // --- AUTH CHECK ---
  const token = localStorage.getItem("authToken");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  const res = await fetch("/config");
  const cfg = await res.json();

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
    cfg.googleMapsApiKey
  )}&libraries=places,geometry&callback=initMap`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
});

// --- DATA ---
const threatScenarios = {
  accidents: [
    { name: "Small Propane Tank", yield: 100 },
    { name: "Industrial Gas Leak", yield: 5000 },
    { name: "Gasoline Tanker", yield: 10000 },
  ],
  weapons: [
    { name: "Standard Car Bomb", yield: 500 },
    { name: "GBU-43/B (MOAB)", yield: 11000 },
    { name: "Little Boy (Hiroshima)", yield: 15000 * 1000 },
    { name: "Tsar Bomba (50MT)", yield: 50000000 * 1000 },
  ],
};
let liveThreats = [];

async function loadLiveThreats() {
  const res = await fetch("/api/threats");
  liveThreats = await res.json();
}

// --- GLOBAL VARIABLES ---
let map;
let autocomplete;
let directionsService, directionsRenderer;

let simMarker;
let userLocationMarker;
const simulationCircles = [];
let selectedYield = null;
let selectedThreatName = "";

const liveThreatOverlays = [];

// --- DOM ELEMENTS ---
const liveModeBtn = document.getElementById("live-mode-btn");
const simModeBtn = document.getElementById("sim-mode-btn");
const liveAlertsPanel = document.getElementById("live-alerts-panel");
const simulatorPanel = document.getElementById("simulator-panel");
const simulatorActions = document.getElementById("simulator-actions");
const liveThreatsList = document.getElementById("live-threats-list");
const threatCount = document.getElementById("threat-count");
const latInput = document.getElementById("lat");
const lngInput = document.getElementById("lng");
const simulateBtn = document.getElementById("simulateBtn");
const resetBtn = document.getElementById("resetBtn");
const resultsDiv = document.getElementById("results");
const resultsContent = document.getElementById("results-content");
const accidentsContainer = document.getElementById("accidents-container");
const weaponsContainer = document.getElementById("weapons-container");
const fillToggle = document.getElementById("fillToggle");
const mapStyleButtons = document.querySelectorAll(".map-style-btn");
const locationSearchInput = document.getElementById("location-search");
const useLocationBtn = document.getElementById("use-location-btn");
const evacuationPrompt = document.getElementById("evacuation-prompt");
const panelToggleBtn = document.getElementById("panel-toggle");
const controlPanel = document.querySelector(".control-panel");



// --- MAP INITIALIZATION ---
function initMap() {
  const initialPos = { lat: 20.5937, lng: 78.9629 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: initialPos,
    zoom: 5,
    mapTypeId: "roadmap",
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
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
    ],
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: "#00ffff",
      strokeWeight: 5,
      strokeOpacity: 0.8,
    },
  });
  autocomplete = new google.maps.places.Autocomplete(locationSearchInput);
  autocomplete.bindTo("bounds", map);

  createThreatButtons();
  setupEventListeners();

  switchToLiveMode();
  onUseLocation();

  const centerControlDiv = createCenterControl(map);
  map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(centerControlDiv);
  lucide.createIcons();
}

// --- MODE SWITCHING LOGIC ---
function switchToLiveMode() {
  clearSimulation();
  if (userLocationMarker) userLocationMarker.setMap(map);
  liveAlertsPanel.classList.remove("hidden");
  simulatorPanel.classList.add("hidden");
  simulatorActions.classList.add("hidden");
  liveModeBtn.classList.add("border-blue-500", "text-white", "bg-gray-800/50");
  liveModeBtn.classList.remove("border-transparent", "text-gray-400");
  simModeBtn.classList.add("border-transparent", "text-gray-400");
  simModeBtn.classList.remove(
    "border-blue-500",
    "text-white",
    "bg-gray-800/50"
  );
  displayLiveThreats();
}

function switchToSimulatorMode() {
  clearLiveThreats();
  if (userLocationMarker) userLocationMarker.setMap(null);
  liveAlertsPanel.classList.add("hidden");
  simulatorPanel.classList.remove("hidden");
  simulatorActions.classList.remove("hidden");
  simModeBtn.classList.add("border-blue-500", "text-white", "bg-gray-800/50");
  simModeBtn.classList.remove("border-transparent", "text-gray-400");
  liveModeBtn.classList.add("border-transparent", "text-gray-400");
  liveModeBtn.classList.remove(
    "border-blue-500",
    "text-white",
    "bg-gray-800/50"
  );
  resetSimulator();
}

// --- NAVIGATION LOGIC ---
// --- AFTER (Correct URL) ---
function generateEvacuationNavigation() {
  if (liveThreats.length === 0) {
    alert("No active threats to evacuate from.");
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const userLatLng = new google.maps.LatLng(
          userLocation.lat,
          userLocation.lng
        );

        let relevantThreat = null;
        let minDistance = Infinity;
        let insideThreats = [];

        // 1. Find all threats and check if user is inside
        liveThreats.forEach((threat) => {
          const threatLatLng = new google.maps.LatLng(
            threat.location.lat,
            threat.location.lng
          );
          const distance = google.maps.geometry.spherical.computeDistanceBetween(
            userLatLng,
            threatLatLng
          );
          const zones = calculateBlastZones(threat.yield);
          const largestRadius = zones.minor.radius;

          const threatData = {
            threat,
            distance,
            largestRadius,
            threatLatLng
          };

          if (distance <= largestRadius) {
            insideThreats.push(threatData);
          }
          
          // Keep track of absolute closest just in case we aren't in any
          if (distance < minDistance) {
            minDistance = distance;
            relevantThreat = threatData;
          }
        });

        // 2. Prioritize threats we are inside
        if (insideThreats.length > 0) {
            // Sort by distance ascending (closest threat center)
            insideThreats.sort((a, b) => a.distance - b.distance);
            relevantThreat = insideThreats[0];
        }

        if (relevantThreat) {
            const { threat, distance, largestRadius, threatLatLng } = relevantThreat;
            
            // 3. Calculate Heading
            // computeHeading returns -180 to 180.
            let heading = google.maps.geometry.spherical.computeHeading(threatLatLng, userLatLng);
            
            // Handle being exactly at center (or very close)
            if (distance < 5) { // 5 meters tolerance
                heading = 0; // Default to North
            }

            // 4. Calculate Safe Destination (Exit Point)
            let targetDistance;
            let isInside = false;
            if (distance <= largestRadius) {
                // Inside danger zone: move to outer ring + buffer
                targetDistance = largestRadius * 1.1; 
                isInside = true;
            } else {
                // Outside danger zone: move further away
                targetDistance = distance + 2000; // +2km
            }

            const safeDestination = google.maps.geometry.spherical.computeOffset(
                threatLatLng,
                targetDistance,
                heading
            );

            // 5. Find Nearest Safe Hospital
            const service = new google.maps.places.PlacesService(map);
            const request = {
                location: safeDestination,
                // radius: 5000, // REMOVED: Cannot be used with rankBy: DISTANCE
                rankBy: google.maps.places.RankBy.DISTANCE,
                type: 'hospital'
            };

            service.nearbySearch(request, (results, status) => {
                let finalDestination = safeDestination;
                let waypoint = null;
                let decisionTag = "no-hospital-safe-only";

                // Helper to check if a place is safe (outside danger zone)
                const isSafe = (place) => {
                    if (!place.geometry || !place.geometry.location) return false;
                    const distToThreat = google.maps.geometry.spherical.computeDistanceBetween(
                        place.geometry.location, 
                        threatLatLng
                    );
                    return distToThreat > largestRadius * 1.05; // 5% safety buffer
                };

                // Helper to open navigation
                const openNavigation = (destination, tag) => {
                    console.log(`[Evacuation] Decision: ${tag}`);
                    console.log(`[Evacuation] Destination: ${destination.lat()}, ${destination.lng()}`);
                    
                    let navUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${destination.lat()},${destination.lng()}&travelmode=driving`;
                    
                    if (isInside) {
                        waypoint = safeDestination;
                        navUrl += `&waypoints=${waypoint.lat()},${waypoint.lng()}`;
                        console.log(`[Evacuation] Added waypoint (safe exit): ${waypoint.lat()}, ${waypoint.lng()}`);
                    }
                    
                    console.log(`[Evacuation] Opening URL: ${navUrl}`);
                    window.open(navUrl, "_blank");
                };

                if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                    // 1. Strict Filtering
                    const excludedKeywords = [
                        "dentist", "dental", "orthodontist", "optometry", "veterinary", "animal", "pet", 
                        "eye", "skin", "plastic surgery", "shop", "store", "food", "restaurant", "cafe", 
                        "bakery", "roll", "bar", "pub", "spa", "salon",
                        "church", "temple", "mosque", "synagogue", "chapel", "cathedral", "religious", "worship"
                    ];
                    
                    const safeHospitals = results.filter(place => {
                        if (!isSafe(place)) return false;
                        
                        const name = place.name.toLowerCase();
                        const types = place.types ? place.types.join(" ") : "";
                        const isExcluded = excludedKeywords.some(keyword => name.includes(keyword) || types.includes(keyword));
                        if (isExcluded) return false;

                        if (!place.types || !place.types.includes("hospital")) return false;
                        
                        return true;
                    });

                    if (safeHospitals.length > 0) {
                        // PRIORITY 1: AI Selection
                        const candidates = safeHospitals.slice(0, 10).map(place => ({
                            name: place.name,
                            types: place.types,
                            distance: google.maps.geometry.spherical.computeDistanceBetween(place.geometry.location, safeDestination)
                        }));

                        fetch('/api/evaluate-facilities', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ facilities: candidates })
                        })
                        .then(res => res.json())
                        .then(data => {
                            const selectedIndex = data.selected_index;
                            
                            // Validate AI response
                            if (typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < safeHospitals.length) {
                                const bestHospital = safeHospitals[selectedIndex];
                                console.log(`[Evacuation] AI Selected: ${bestHospital.name} (${data.reason})`);
                                openNavigation(bestHospital.geometry.location, "ai-selected");
                            } else {
                                // PRIORITY 2: AI Failed -> Nearest Safe Hospital
                                console.warn("[Evacuation] AI returned invalid index, falling back to nearest safe hospital.");
                                openNavigation(safeHospitals[0].geometry.location, "ai-fallback");
                            }
                        })
                        .catch(err => {
                            // PRIORITY 2: AI Error -> Nearest Safe Hospital
                            console.error("[Evacuation] AI Evaluation failed:", err);
                            openNavigation(safeHospitals[0].geometry.location, "ai-fallback");
                        });
                        return; // Async flow takes over
                    } 
                    
                    // PRIORITY 3: Filter Relaxation (No strict hospitals found, but results exist)
                    console.warn("[Evacuation] No strict hospitals found. Relaxing filters...");
                    const relaxedCandidates = results.filter(place => isSafe(place));
                    
                    if (relaxedCandidates.length > 0) {
                        // Use the nearest safe place (even if it's a "clinic" or has filtered keywords)
                        // Sort by distance to safe destination just to be sure
                        relaxedCandidates.sort((a, b) => {
                            const distA = google.maps.geometry.spherical.computeDistanceBetween(a.geometry.location, safeDestination);
                            const distB = google.maps.geometry.spherical.computeDistanceBetween(b.geometry.location, safeDestination);
                            return distA - distB;
                        });
                        
                        openNavigation(relaxedCandidates[0].geometry.location, "filter-relaxed");
                        return;
                    }
                }

                // PRIORITY 4: No Hospitals/Safe Places Found -> Safe Exit Point Only
                console.warn("[Evacuation] No safe facilities found. Routing to safe exit point only.");
                openNavigation(safeDestination, "no-hospital-safe-only");
            });

        } else {
             alert("Could not determine active threat context.");
        }
      },
      () =>
        alert("Could not get your location. Please enable location services."),
      { enableHighAccuracy: true }
    );
  } else {
    alert("Geolocation is not supported by this browser.");
  }
}

// --- LIVE ALERTS LOGIC ---
function displayLiveThreats() {
  clearLiveThreats();
  liveThreatsList.innerHTML = "";

  const evacuationContainer = document.getElementById("evacuation-container");
  evacuationContainer.innerHTML = "";

  threatCount.textContent = `${liveThreats.length} Active`;

  if (liveThreats.length > 0) {
    const evacBtn = document.createElement("button");
    evacBtn.innerHTML =
      '<i data-lucide="siren" class="w-4 h-4 mr-2"></i> Evacuate From My Location';
    evacBtn.className =
      "w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-md transition duration-300 transform hover:scale-105 shadow-lg shadow-red-600/20 mb-4";
    evacBtn.onclick = generateEvacuationNavigation;
    evacuationContainer.appendChild(evacBtn);
    lucide.createIcons();
  }

  liveThreats.forEach((threat) => {
    const zones = calculateBlastZones(threat.yield);
    Object.values(zones)
      .reverse()
      .forEach((zone) => {
        const circle = new google.maps.Circle({
          strokeColor: zone.color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: zone.color,
          fillOpacity: 0.2,
          map,
          center: threat.location,
          radius: zone.radius,
        });
        liveThreatOverlays.push(circle);
      });
    const marker = new google.maps.Marker({
      position: threat.location,
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#ff3838",
        fillOpacity: 1,
        strokeColor: "white",
        strokeWeight: 2,
      },
    });
    liveThreatOverlays.push(marker);

    const threatEl = document.createElement("div");
    threatEl.className =
      "bg-gray-800/50 p-3 rounded-lg border border-gray-700 hover:bg-gray-700/50 cursor-pointer transition";
    const eventTime = new Date(threat.timestamp);
    const timeString = eventTime.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
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

    threatEl.addEventListener("click", () => {
      map.panTo(threat.location);
      map.setZoom(18);
      const currentDetailsPanel = threatEl.querySelector(".threat-details");
      document.querySelectorAll(".threat-details").forEach((panel) => {
        if (panel !== currentDetailsPanel) {
          panel.classList.remove("active");
        }
      });
      currentDetailsPanel.classList.toggle("active");
    });

    liveThreatsList.appendChild(threatEl);
  });
}

function clearLiveThreats() {
  liveThreatOverlays.forEach((overlay) => overlay.setMap(null));
  liveThreatOverlays.length = 0;
}

// --- SIMULATOR LOGIC ---
function createThreatButtons() {
  threatScenarios.accidents.forEach((threat) =>
    accidentsContainer.appendChild(createButton(threat))
  );
  threatScenarios.weapons.forEach((threat) =>
    weaponsContainer.appendChild(createButton(threat))
  );
}

function createButton(threat) {
  const button = document.createElement("button");
  button.className =
    "threat-btn w-full text-left p-3 bg-gray-800/50 border-2 border-transparent hover:border-blue-500/50 rounded-lg";
  const yieldText =
    threat.yield >= 1000000
      ? `${(threat.yield / 1000000).toLocaleString()} kT`
      : `${threat.yield.toLocaleString()} kg`;
  button.innerHTML = `<div class="flex justify-between items-center"><span class="font-semibold text-white">${threat.name}</span><span class="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded">${yieldText} TNT</span></div>`;
  button.dataset.yield = threat.yield;
  button.dataset.name = threat.name;
  return button;
}

function calculateBlastZones(yieldKg) {
  const scaledDistanceFactor = Math.cbrt(yieldKg);
  return {
    lethal: {
      radius: 25 * scaledDistanceFactor,
      color: "#ff3838",
      name: "Lethal Zone",
    },
    severe: {
      radius: 50 * scaledDistanceFactor,
      color: "#ff8c38",
      name: "Severe Damage",
    },
    moderate: {
      radius: 100 * scaledDistanceFactor,
      color: "#fdd835",
      name: "Moderate Damage",
    },
    minor: {
      radius: 200 * scaledDistanceFactor,
      color: "#38b6ff",
      name: "Minor Damage",
    },
  };
}

function runSimulation() {
  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);
  if (isNaN(lat) || isNaN(lng) || selectedYield === null) {
    alert("Please select a threat scenario and set a location.");
    return;
  }
  clearSimulation();
  const center = { lat, lng };
  const zones = calculateBlastZones(selectedYield);
  map.panTo(center);
  setSimMarker(center);
  resultsContent.innerHTML = "";
  const currentFillOpacity = fillToggle.checked ? 0.2 : 0;
  Object.values(zones)
    .reverse()
    .forEach((zone) => {
      const circle = new google.maps.Circle({
        strokeColor: zone.color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: zone.color,
        fillOpacity: currentFillOpacity,
        map,
        center: center,
        radius: zone.radius,
      });
      circle.addListener("click", (e) =>
        findEvacuationRoute(e.latLng, zone.radius)
      );
      simulationCircles.push(circle);
      const resultItem = document.createElement("div");
      resultItem.className = "flex items-center text-sm";
      resultItem.innerHTML = `<div class="w-4 h-4 rounded-full mr-3" style="background-color: ${
        zone.color
      };"></div><div class="flex-grow"><span class="font-medium text-gray-300">${
        zone.name
      }:</span><span class="float-right font-mono text-white">${(
        zone.radius / 1000
      ).toFixed(2)} km</span></div>`;
      resultsContent.appendChild(resultItem);
    });
  resultsDiv.classList.remove("hidden");
  evacuationPrompt.classList.remove("hidden");
}

function resetSimulator() {
  clearSimulation();
  const initialPos = map.getCenter().toJSON();
  updateCoords(initialPos);
  setSimMarker(initialPos);
  resultsDiv.classList.add("hidden");
  evacuationPrompt.classList.add("hidden");
  locationSearchInput.value = "";
  selectedYield = null;
  selectedThreatName = "";
  document
    .querySelectorAll(".threat-btn")
    .forEach((btn) => btn.classList.remove("active"));
  simulateBtn.disabled = true;
}

function clearSimulation() {
  simulationCircles.forEach((c) => c.setMap(null));
  simulationCircles.length = 0;
  if (simMarker) simMarker.setMap(null);
  directionsRenderer.setDirections({ routes: [] });
  resultsDiv.classList.add("hidden");
}

function findEvacuationRoute(origin, radius) {
  const destination = google.maps.geometry.spherical.computeOffset(
    origin,
    radius * 1.5,
    Math.random() * 360
  );
  directionsService.route(
    { origin: origin, destination: destination, travelMode: "DRIVING" },
    (result, status) => {
      if (status == "OK") directionsRenderer.setDirections(result);
      else alert("Could not calculate an evacuation route from this point.");
    }
  );
}

// --- EVENT HANDLERS & HELPERS ---
function setupEventListeners() {
  liveModeBtn.addEventListener("click", switchToLiveMode);
  simModeBtn.addEventListener("click", switchToSimulatorMode);

  map.addListener("click", (e) => {
    if (simulatorPanel.classList.contains("hidden")) return;
    clearSimulation();
    const newPos = e.latLng.toJSON();
    updateCoords(newPos);
    setSimMarker(newPos);
  });

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (place.geometry && place.geometry.location) {
      const newPos = place.geometry.location.toJSON();
      map.setCenter(newPos);
      map.setZoom(14);
      clearSimulation();
      updateCoords(newPos);
      setSimMarker(newPos);
    }
  });

  useLocationBtn.addEventListener("click", onUseLocation);
  fillToggle.addEventListener("change", (e) => {
    const newOpacity = e.target.checked ? 0.2 : 0;
    simulationCircles.forEach((circle) =>
      circle.setOptions({ fillOpacity: newOpacity })
    );
  });
  simulateBtn.addEventListener("click", runSimulation);
  resetBtn.addEventListener("click", resetSimulator);
  mapStyleButtons.forEach((button) => {
    button.addEventListener("click", () =>
      switchMapStyle(button.dataset.style)
    );
  });
  document.querySelectorAll(".threat-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll(".threat-btn")
        .forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      selectedYield = parseFloat(button.dataset.yield);
      selectedThreatName = button.dataset.name;
      simulateBtn.disabled = false;
    });
  });

  // PANEL SHOW/HIDE TOGGLE
  if (panelToggleBtn && controlPanel) {
    let panelOpen = true;

    panelToggleBtn.addEventListener("click", () => {
      panelOpen = !panelOpen;

      if (panelOpen) {
        controlPanel.classList.remove("hidden");
        panelToggleBtn.setAttribute("title", "Hide panel");
        panelToggleBtn.innerHTML =
        google.maps.event.trigger(map, "resize");
      }
    });
  }
}

//email thing
// --- AUTO SYNC EMAIL FOR ALERTS ---
async function syncUserEmail() {
  const email = localStorage.getItem("userEmail");
  if (!email) return;

  try {
    await fetch("/api/session/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    console.log(`Synced alert email: ${email}`);
  } catch (e) {
    console.error("Failed to sync email for alerts", e);
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  await loadLiveThreats();
  syncUserEmail();
  
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
          localStorage.removeItem("authToken");
          window.location.href = "/login.html";
      });
  }
});

function createCenterControl(map) {
  const controlButton = document.createElement("button");
  controlButton.className = "custom-map-control-button";
  controlButton.title = "Click to recenter the map on your location";
  controlButton.innerHTML =
    '<i data-lucide="crosshair" class="w-5 h-5 text-gray-800"></i>';

  controlButton.addEventListener("click", () => {
    onUseLocation();
  });

  return controlButton;
}

function onUseLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.setCenter(newPos);
        map.setZoom(18);

        if (userLocationMarker) userLocationMarker.setMap(null);
        userLocationMarker = new google.maps.Marker({
          position: newPos,
          map: map,
          title: "Your Location",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#1e90ff",
            fillOpacity: 1,
            strokeColor: "white",
            strokeWeight: 2,
          },
        });

        if (!simulatorPanel.classList.contains("hidden")) {
          updateCoords(newPos);
          setSimMarker(newPos);
        }
      },
      () => {
        alert(
          "Geolocation permission was denied. Could not find your location."
        );
      }
    );
  } else {
    alert("Geolocation is not supported by this browser.");
  }
}

function updateCoords({ lat, lng }) {
  latInput.value = lat.toFixed(6);
  lngInput.value = lng.toFixed(6);
}

function setSimMarker(position) {
  if (simMarker) simMarker.setMap(null);
  simMarker = new google.maps.Marker({
    position: position,
    map: map,
    animation: google.maps.Animation.DROP,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: "#38b6ff",
      fillOpacity: 1,
      strokeColor: "white",
      strokeWeight: 2,
    },
  });
}

function switchMapStyle(styleType) {
  map.setMapTypeId(styleType === "street" ? "roadmap" : "satellite");
  mapStyleButtons.forEach((button) => {
    const isActive = button.dataset.style === styleType;
    button.classList.toggle("active-map-style", isActive);
    button.classList.toggle("bg-blue-600", isActive);
    button.classList.toggle("bg-gray-800", !isActive);
  });
}

lucide.createIcons();
document.addEventListener("DOMContentLoaded", async () => {
  await loadLiveThreats();
});

// --- AUTO UPDATE LIVE THREATS (NO RELOAD NEEDED) ---
let lastThreatHash = "";

async function autoUpdateThreats() {
  try {
    const res = await fetch("/api/threats");
    const data = await res.json();

    // Create a hash to detect changes
    const newHash = JSON.stringify(data);

    // Update ONLY if something changed
    if (newHash !== lastThreatHash) {
      liveThreats = data;
      displayLiveThreats();
      if (isAdmin()) updateAdminThreatList(); // Update admin list too
      lastThreatHash = newHash;
    }
    checkDangerStatus();
  } catch (err) {
    console.error("Auto-update error:", err);
  }
}

// Start the loop after map loads
function startThreatPolling() {
  autoUpdateThreats(); // initial load
  setInterval(autoUpdateThreats, 5000); // update every 5 seconds
}

// Attach to Google Maps callback
// Modify initMap so it calls startThreatPolling():

const oldInitMap = initMap;
initMap = function () {
  oldInitMap(); // run your original initMap
  startThreatPolling(); // start auto updates
  startLocationTracking();
};

// --- ADMIN LOGIC ---
function isAdmin() {
    return localStorage.getItem('userRole') === 'admin';
}

function setupAdminUI() {
    if (isAdmin()) {
        const adminBtn = document.getElementById('admin-mode-btn');
        if (adminBtn) adminBtn.classList.remove('hidden');
        
        // Setup form
        const form = document.getElementById('admin-threat-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('admin-threat-name').value;
                const lat = parseFloat(document.getElementById('admin-threat-lat').value);
                const lng = parseFloat(document.getElementById('admin-threat-lng').value);
                const yieldVal = parseFloat(document.getElementById('admin-threat-yield').value);
                const details = document.getElementById('admin-threat-details').value;

                const threat = {
                    name,
                    location: { lat, lng },
                    locationName: "Custom Location", // Could reverse geocode here
                    yield: yieldVal,
                    details,
                    timestamp: new Date().toISOString()
                };

                try {
                    const res = await fetch('/api/threats', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(threat)
                    });
                    if (res.ok) {
                        alert('Threat Broadcasted Successfully');
                        form.reset();
                        autoUpdateThreats();
                    } else {
                        alert('Failed to broadcast threat');
                    }
                } catch (err) {
                    console.error(err);
                    alert('Error broadcasting threat');
                }
            });
        }

        // Get Location Button
        const getLocBtn = document.getElementById('admin-get-loc-btn');
        if (getLocBtn) {
            getLocBtn.addEventListener('click', () => {
                const center = map.getCenter().toJSON();
                document.getElementById('admin-threat-lat').value = center.lat.toFixed(6);
                document.getElementById('admin-threat-lng').value = center.lng.toFixed(6);
            });
        }
    }
}
document.addEventListener("DOMContentLoaded", async () => {
  setupAdminUI();
});


function updateAdminThreatList() {
    const list = document.getElementById('admin-threats-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (liveThreats.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-500 text-center">No active threats</p>';
        return;
    }

    liveThreats.forEach(threat => {
        const item = document.createElement('div');
        item.className = "flex justify-between items-center bg-gray-900 p-2 rounded border border-gray-700";
        
        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = `
            <div class="font-bold text-sm text-red-400">${threat.name}</div>
            <div class="text-xs text-gray-500">${new Date(threat.timestamp).toLocaleTimeString()}</div>
        `;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = "text-red-500 hover:text-red-400 p-1 transition";
        deleteBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
        deleteBtn.onclick = () => deleteThreat(threat.id);
        
        item.appendChild(infoDiv);
        item.appendChild(deleteBtn);
        list.appendChild(item);
    });
    lucide.createIcons();
}

async function deleteThreat(id) {
    if(!confirm("Are you sure you want to delete this threat?")) return;
    
    try {
        const res = await fetch(`/api/threats/${id}`, { method: 'DELETE' });
        if (res.ok) {
            // Force update immediately
            const res2 = await fetch("/api/threats");
            liveThreats = await res2.json();
            displayLiveThreats();
            updateAdminThreatList();
        } else {
            alert("Failed to delete threat");
        }
    } catch (e) {
        console.error(e);
        alert("Error deleting threat");
    }
}
