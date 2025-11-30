import { AlertTriangle, Clock, MapPin } from 'lucide-react';
import clsx from 'clsx';

export default function ThreatList({ threats, onSelectThreat }) {
  if (!threats || threats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500 border border-dashed border-slate-300 rounded-lg bg-slate-50">
        <AlertTriangle className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm font-medium">No active threats</p>
        <p className="text-xs opacity-60 mt-1">Monitoring global feeds...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {threats.map((threat) => (
        <button
          key={threat.id}
          onClick={() => onSelectThreat && onSelectThreat(threat)}
          className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 hover:border-red-400 hover:shadow-md rounded-lg px-4 py-3 flex flex-col gap-2 transition-all group"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className="w-2 h-8 rounded-full bg-red-500 shrink-0" />
              <span className="text-sm font-bold text-slate-900 truncate group-hover:text-red-600 transition-colors">
                {threat.name}
              </span>
            </div>
            <span className={clsx(
              "text-xs font-mono uppercase shrink-0 px-2 py-1 rounded border font-semibold",
              threat.source === 'simulation_news' 
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-orange-50 text-orange-700 border-orange-200"
            )}>
              {threat.source === 'simulation_news' ? 'AI SIM' : 'ADMIN'}
            </span>
          </div>
          
          <div className="flex items-center justify-between gap-2 w-full pl-4">
            <div className="flex items-center gap-1.5 text-sm text-slate-600 truncate">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{threat.locationName}</span>
            </div>
            <span className="text-xs text-red-600 font-mono font-bold shrink-0">
              {Math.round(threat.yield)} kg
            </span>
          </div>

          {threat.expiresAt && (
             <div className="flex items-center gap-1.5 pl-4 mt-1 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>Expires {new Date(threat.expiresAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
             </div>
          )}
        </button>
      ))}
    </div>
  );
}
