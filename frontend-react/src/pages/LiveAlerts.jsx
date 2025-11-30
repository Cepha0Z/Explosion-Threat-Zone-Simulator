import { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useThreats } from '../hooks/useThreats';
import MapContainer from '../components/map/MapContainer';
import ThreatList from '../components/threats/ThreatList';
import { Loader2, Navigation, Radio } from 'lucide-react';
import { startEvacuation } from '../modules/evacuation/evacuationLogic';
import clsx from 'clsx';

export default function LiveAlerts() {
  const { threats, loading, error } = useThreats(5000);
  const [evacuating, setEvacuating] = useState(false);
  const mapInstanceRef = useRef(null);
  const context = useOutletContext();
  const renderLocation = context?.renderLocation || 'leftPanel';

  const handleMapLoad = (map) => {
    mapInstanceRef.current = map;
  };

  const handleEvacuate = async () => {
    if (!mapInstanceRef.current) {
      alert("Map not fully loaded yet. Please wait a moment and try again.");
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

  const handleThreatSelect = (threat) => {
    if (mapInstanceRef.current && threat.location) {
      const pos = { lat: threat.location.lat, lng: threat.location.lng };
      mapInstanceRef.current.panTo(pos);
      mapInstanceRef.current.setZoom(14);
      console.log(`[LiveAlerts] Focused on threat: ${threat.name}`);
    }
  };

  // Debug Hook
  if (typeof window !== 'undefined') {
    window.__debugEvacuate = async () => {
      console.log('[__debugEvacuate] called with', {
        threatsCount: threats?.length ?? 0,
        hasMap: !!mapInstanceRef.current,
      });
      await startEvacuation({
        threats,
        map: mapInstanceRef.current,
      });
    };
  }

  // LOADING STATE
  if (loading && threats.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        <span className="ml-3 text-sm">Initializing Threat Detection...</span>
      </div>
    );
  }

  // ERROR STATE
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-500">
        <div className="text-center">
          <h2 className="text-lg font-bold mb-2">Connection Error</h2>
          <p className="text-sm">{error}</p>
          <p className="text-xs text-slate-400 mt-4">Is the backend server running?</p>
        </div>
      </div>
    );
  }

  // RENDER LEFT PANEL CONTENT
  if (renderLocation === 'leftPanel') {
    return (
      <div className="h-full flex flex-col bg-white">
        
        {/* Section Header */}
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Active Threats</h2>
            <span className="text-sm text-slate-500 font-medium">
              {threats.length} Active
            </span>
          </div>
        </div>

        {/* Evacuate Button - BRIGHT RED, PROMINENT */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={handleEvacuate}
            disabled={evacuating || threats.length === 0}
            className={clsx(
              "w-full flex items-center justify-center gap-2.5 py-4 rounded-xl",
              "font-bold text-base uppercase tracking-wide",
              "shadow-lg transition-all duration-150",
              evacuating || threats.length === 0
                ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                : "bg-red-600 hover:bg-red-700 text-white hover:scale-[1.02] active:scale-[0.98] shadow-red-200"
            )}
          >
            {evacuating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Calculating Route...
              </>
            ) : (
              <>
                <Navigation className="w-6 h-6" />
                Evacuate From My Location
              </>
            )}
          </button>
        </div>

        {/* Threat List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <ThreatList threats={threats} onSelectThreat={handleThreatSelect} />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Radio className="w-4 h-4" />
            <span className="font-medium">Verified Reports Near You</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Scanning local frequencies…
          </div>
        </div>

      </div>
    );
  }

  // RENDER RIGHT PANEL (MAP)
  if (renderLocation === 'rightPanel') {
    return (
      <div className="w-full h-full">
        <MapContainer threats={threats} onMapLoad={handleMapLoad} />
      </div>
    );
  }

  return null;
}
