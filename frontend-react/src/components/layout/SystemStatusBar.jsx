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
    <div className="w-full bg-gray-950 border-b border-gray-800 text-xs text-gray-300 px-4 py-1.5 flex items-center gap-4 overflow-x-auto">
      <span className="font-mono text-[10px] text-gray-500 font-bold tracking-wider">SYSTEM STATUS</span>
      
      <StatusPill label="BACKEND" status={health?.backend?.status} icon={Server} />
      <StatusPill label="AI ENGINE" status={health?.python?.status} icon={Database} />
      <StatusPill label="SIMULATOR" status={health?.simulator?.status} icon={Radio} />
      
      <div className="h-4 w-px bg-gray-800 mx-2" />
      
      <span className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400">
        <AlertTriangle className="w-3 h-3 text-yellow-500" />
        ACTIVE THREATS: <span className="text-white font-bold">{health?.threats?.activeCount ?? 0}</span>
      </span>

      {lastNews && (
        <span className="ml-auto text-[10px] text-gray-500 truncate max-w-[300px] hidden md:block">
          Latest Intel: <span className="text-gray-300">{lastNews}</span> ({lastNewsTime})
        </span>
      )}
    </div>
  );
}
