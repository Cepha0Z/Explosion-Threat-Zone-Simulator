import { AlertTriangle, Clock, MapPin } from 'lucide-react';
import clsx from 'clsx';

export default function ThreatList({ threats, onSelectThreat }) {
  if (!threats || threats.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400 border border-gray-700">
        <div className="flex justify-center mb-3">
          <AlertTriangle className="w-8 h-8 text-gray-600" />
        </div>
        <p>No active threats detected.</p>
        <p className="text-xs mt-2 text-gray-500">System is monitoring...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        Active Threats ({threats.length})
      </h3>
      
      <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {threats.map((threat) => (
          <div 
            key={threat.id} 
            onClick={() => onSelectThreat && onSelectThreat(threat)}
            className="bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-lg hover:border-red-500/50 transition-colors cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-red-400 text-lg leading-tight group-hover:text-red-300 transition-colors">{threat.name}</h4>
              <span className={clsx(
                "text-xs px-2 py-0.5 rounded border uppercase font-mono",
                threat.source === 'simulation_news' 
                  ? "bg-blue-900/30 text-blue-400 border-blue-800"
                  : "bg-orange-900/30 text-orange-400 border-orange-800"
              )}>
                {threat.source === 'simulation_news' ? 'AI SIM' : 'ADMIN'}
              </span>
            </div>

            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                <span>{threat.locationName}</span>
              </div>

              {threat.expiresAt && (
                <div className="flex items-center gap-2 text-yellow-500/80">
                  <Clock className="w-4 h-4" />
                  <span className="font-mono text-xs">
                    Expires: {new Date(threat.expiresAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
              
              {threat.yield && (
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-700/50">
                  Yield: {threat.yield}kg TNT eq.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
