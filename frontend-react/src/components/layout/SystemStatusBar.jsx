import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Server, Database, Radio, AlertTriangle } from 'lucide-react';

function StatusPill({ label, status, icon: Icon }) {
  const color =
    status === 'ok' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' :
    status === 'down' ? 'bg-red-900/30 text-red-400 border-red-800' :
    'bg-gray-800 text-gray-400 border-gray-700';

  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] font-mono flex items-center gap-1.5 ${color}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}: {status?.toUpperCase() || 'UNKNOWN'}
    </span>
  );
}

export default function SystemStatusBar() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await axios.get('/api/health');
        setHealth(res.data);
      } catch (err) {
        setHealth({
          backend: { status: 'down' },
          python: { status: 'unknown' },
          simulator: { status: 'unknown' },
          threats: { activeCount: '?' },
          newsIngestion: {}
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) return null;

  const lastNews = health?.newsIngestion?.lastArticleTitle;
  const lastNewsTime = health?.newsIngestion?.lastProcessedAt 
    ? new Date(health.newsIngestion.lastProcessedAt).toLocaleTimeString() 
    : null;

  return (
    <div className="w-full bg-white border-b border-slate-200 text-xs text-slate-700 px-4 py-2 flex items-center gap-4 overflow-x-auto z-50 shadow-sm">
      <span className="font-mono text-xs text-slate-500 font-bold tracking-wider shrink-0">TMZ 2.0</span>
      
      <div className="flex items-center gap-2.5 shrink-0">
        <StatusPill label="BACKEND" status={health?.backend?.status} icon={Server} />
        <StatusPill label="AI ENGINE" status={health?.python?.status} icon={Database} />
        <StatusPill label="SIMULATOR" status={health?.simulator?.status} icon={Radio} />
      </div>
      
      <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />
      
      <span className="flex items-center gap-2 text-xs font-mono text-slate-600 shrink-0">
        <AlertTriangle className="w-4 h-4 text-yellow-600" />
        ACTIVE: <span className="text-slate-900 font-bold">{health?.threats?.activeCount ?? 0}</span>
      </span>

      {lastNews && (
        <span className="ml-auto text-xs text-slate-500 truncate max-w-[250px] hidden md:flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="text-slate-700 font-medium">{lastNews}</span> 
          <span className="opacity-60">({lastNewsTime})</span>
        </span>
      )}
    </div>
  );
}
