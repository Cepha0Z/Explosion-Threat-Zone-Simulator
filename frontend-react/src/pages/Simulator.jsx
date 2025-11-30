import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Radio, 
  MapPin, 
  Bomb, 
  Play,
  RotateCcw,
  Target,
  Layers,
  Search
} from 'lucide-react';
import MapContainer from '../components/map/MapContainer';

const SCENARIOS = {
  accidental: [
    { name: 'Small Propane Tank', yield: 0.0001, label: '100 kg TNT' }, // 0.1 tons = 100kg
    { name: 'Industrial Gas Leak', yield: 0.005, label: '5,000 kg TNT' }, // 5 tons
    { name: 'Gasoline Tanker', yield: 0.01, label: '10,000 kg TNT' } // 10 tons
  ],
  weaponized: [
    { name: 'Standard Car Bomb', yield: 0.0005, label: '500 kg TNT' }, // 0.5 tons
    { name: 'GBU-43/B (MOAB)', yield: 0.011, label: '11,000 kg TNT' }, // 11 tons
    { name: 'Little Boy (Hiroshima)', yield: 15.0, label: '15 kt TNT' },
    { name: 'Tsar Bomba', yield: 50000.0, label: '50 MT TNT' }
  ]
};

export default function Simulator() {
  const [detonationPoint, setDetonationPoint] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [fillZones, setFillZones] = useState(true);
  const [simThreats, setSimThreats] = useState([]); // Used for MapContainer rendering
  
  const mapInstanceRef = useRef(null);
  const autocompleteRef = useRef(null);
  const searchInputRef = useRef(null);

  const handleMapLoad = (map) => {
    mapInstanceRef.current = map;

    // Map Click Listener for Detonation Point
    map.addListener('click', (e) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setDetonationPoint({ lat, lng });
      
      // If we have a scenario selected, we could auto-run, but legacy behavior usually waits for "Run"
    });

    // Initialize Autocomplete
    if (window.google && searchInputRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(searchInputRef.current);
      autocompleteRef.current.bindTo('bounds', map);
      
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (!place.geometry || !place.geometry.location) return;

        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };

        map.setCenter(location);
        map.setZoom(14);
        setDetonationPoint(location);
      });
    }
  };

  const handleRunSimulation = () => {
    if (!detonationPoint) {
      alert('Please select a detonation point on the map.');
      return;
    }
    if (!selectedScenario) {
      alert('Please select a threat scenario.');
      return;
    }

    const newSimThreat = {
      id: `sim-${Date.now()}`,
      name: `SIM: ${selectedScenario.name}`,
      locationName: 'Simulated Location',
      location: detonationPoint,
      yield: selectedScenario.yield,
      details: 'Simulated Blast',
      timestamp: new Date().toISOString(),
      source: 'simulator',
      // Pass fill preference if MapContainer supported it, but it currently hardcodes opacity
    };

    setSimThreats([newSimThreat]); // Replace existing simulation
  };

  const handleReset = () => {
    setSimThreats([]);
    setDetonationPoint(null);
    setSelectedScenario(null);
    if (searchInputRef.current) searchInputRef.current.value = '';
  };

  return (
    <div className="h-full flex flex-col md:flex-row relative">
      {/* Left: Map Area */}
      <div className="flex-1 h-[50vh] md:h-full relative z-0 bg-black md:rounded-l-xl overflow-hidden">
        <MapContainer threats={simThreats} onMapLoad={handleMapLoad} />
        
        {/* Overlay Stats */}
        <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur border border-gray-700 px-3 py-2 rounded-lg shadow-lg z-10">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Mode</div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-yellow-500 animate-pulse" />
            <span className="text-yellow-400 font-mono text-xs">SIMULATOR</span>
          </div>
        </div>
      </div>

      {/* Right: Control Panel */}
      <div className="w-full md:w-96 bg-gray-950 border-l border-gray-800 flex flex-col h-[50vh] md:h-full z-10">
        <div className="p-4 border-b border-gray-800 bg-gray-900/90 backdrop-blur sticky top-0">
          <h2 className="text-sm md:text-base font-semibold text-white tracking-wide flex items-center gap-2">
            <Target className="w-4 h-4 text-yellow-500" />
            Threat Simulator
          </h2>
          <p className="text-[11px] text-gray-500 mt-1">Analyze blast impact radius</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
          
          {/* 1. Detonation Point */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-3 h-3" /> Detonation Point
            </h3>
            
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-yellow-500 focus:outline-none placeholder-gray-600"
                placeholder="Search for a location..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                <label className="block text-[10px] text-gray-500 uppercase">Latitude</label>
                <div className="font-mono text-sm text-gray-300">
                  {detonationPoint ? detonationPoint.lat.toFixed(6) : '---'}
                </div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                <label className="block text-[10px] text-gray-500 uppercase">Longitude</label>
                <div className="font-mono text-sm text-gray-300">
                  {detonationPoint ? detonationPoint.lng.toFixed(6) : '---'}
                </div>
              </div>
            </div>
            
            {!detonationPoint && (
              <p className="text-xs text-yellow-500/80 italic text-center py-1">
                -- or click on the map to set point --
              </p>
            )}
          </div>

          {/* 2. Threat Scenarios */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Bomb className="w-3 h-3" /> Threat Scenarios
            </h3>

            {/* Accidental */}
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1">Accidental Threats</div>
              <div className="grid grid-cols-1 gap-2">
                {SCENARIOS.accidental.map((scenario, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedScenario(scenario)}
                    className={`
                      flex items-center justify-between p-2 rounded-lg border transition-all
                      ${selectedScenario?.name === scenario.name 
                        ? 'bg-yellow-900/30 border-yellow-500/50 text-white' 
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}
                    `}
                  >
                    <span className="text-sm font-medium">{scenario.name}</span>
                    <span className="text-xs bg-gray-900 px-2 py-0.5 rounded text-gray-400 border border-gray-700">
                      {scenario.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Weaponized */}
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1">Weaponized Threats</div>
              <div className="grid grid-cols-1 gap-2">
                {SCENARIOS.weaponized.map((scenario, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedScenario(scenario)}
                    className={`
                      flex items-center justify-between p-2 rounded-lg border transition-all
                      ${selectedScenario?.name === scenario.name 
                        ? 'bg-red-900/30 border-red-500/50 text-white' 
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}
                    `}
                  >
                    <span className="text-sm font-medium">{scenario.name}</span>
                    <span className="text-xs bg-gray-900 px-2 py-0.5 rounded text-gray-400 border border-gray-700">
                      {scenario.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Display Options */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3 h-3" /> Display Options
            </h3>
            
            <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-750">
              <span className="text-sm text-gray-300">Fill Danger Zones</span>
              <div 
                className={`w-10 h-5 rounded-full relative transition-colors ${fillZones ? 'bg-green-600' : 'bg-gray-600'}`}
                onClick={() => setFillZones(!fillZones)}
              >
                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${fillZones ? 'translate-x-5' : ''}`} />
              </div>
            </label>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/95 backdrop-blur space-y-2">
          <button
            onClick={handleRunSimulation}
            className="w-full flex items-center justify-center gap-2 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold uppercase tracking-wide transition-all shadow-lg shadow-yellow-900/20"
          >
            <Play className="w-5 h-5 fill-current" />
            Run Simulation
          </button>
          
          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
