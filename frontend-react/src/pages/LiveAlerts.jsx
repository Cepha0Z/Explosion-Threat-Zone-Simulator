import { useState, useRef } from 'react';
import { useThreats } from '../hooks/useThreats';
import MapContainer from '../components/map/MapContainer';
import ThreatList from '../components/threats/ThreatList';
import { Loader2, Navigation } from 'lucide-react';
import { startEvacuation } from '../modules/evacuation/evacuationLogic';

export default function LiveAlerts() {
  const { threats, loading, error } = useThreats(5000);
  const [evacuating, setEvacuating] = useState(false);
  const mapInstanceRef = useRef(null);

  const handleMapLoad = (map) => {
    mapInstanceRef.current = map;
  };

  const handleEvacuate = async () => {
    if (!mapInstanceRef.current) {
      alert("Map not fully loaded yet.");
      return;
    }
    
    setEvacuating(true);
    try {
      await startEvacuation({ 
        threats, 
        map: mapInstanceRef.current 
      });
    } catch (err) {
      console.error("Evacuation error:", err);
      alert(`Evacuation failed: ${err.message}`);
    } finally {
      setEvacuating(false);
    }
  };

  if (loading && threats.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        <span className="ml-3 text-lg">Initializing Threat Detection...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-500">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
          <p>{error}</p>
          <p className="text-sm text-gray-400 mt-4">Is the backend server running?</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row relative">
      {/* Map Area */}
      <div className="flex-1 h-[50vh] md:h-full relative z-0">
        <MapContainer threats={threats} onMapLoad={handleMapLoad} />
        
        {/* Overlay Stats */}
        <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur border border-gray-700 p-3 rounded-lg shadow-xl z-10">
          <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Status</div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-green-400 font-mono text-sm">SYSTEM ACTIVE</span>
          </div>
        </div>

        {/* Evacuate Button */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-xs px-4">
          <button
            onClick={handleEvacuate}
            disabled={evacuating || threats.length === 0}
            className={`
              w-full flex items-center justify-center gap-3 py-4 px-6 rounded-full shadow-2xl 
              font-bold text-lg uppercase tracking-wider transition-all duration-300
              ${threats.length > 0 
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse hover:animate-none hover:scale-105 shadow-red-900/50' 
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'}
            `}
          >
            {evacuating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Calculating Route...
              </>
            ) : (
              <>
                <Navigation className="w-6 h-6" />
                Evacuate Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sidebar List */}
      <div className="w-full md:w-96 bg-gray-900 border-l border-gray-700 flex flex-col h-[50vh] md:h-full z-10 shadow-2xl">
        <div className="p-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur sticky top-0">
          <h2 className="text-xl font-bold text-white tracking-wide">Live Intelligence</h2>
          <p className="text-xs text-gray-500 mt-1">Real-time threat data stream</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <ThreatList threats={threats} />
        </div>
      </div>
    </div>
  );
}
