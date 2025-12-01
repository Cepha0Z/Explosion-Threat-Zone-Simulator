import { useState } from 'react';
import axios from 'axios';
import { useThreats } from '../hooks/useThreats';
import ThreatManager from '../components/admin/ThreatManager';
import { Loader2, Play, Trash2 } from 'lucide-react';

export default function Admin() {
  const { threats, loading, error, refetch } = useThreats(5000);
  const [demoBusy, setDemoBusy] = useState(false);

  const handleSeedDemo = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      const res = await axios.post('/api/demo/seed');
      console.log('[DEMO] Seed response', res.data);
      await refetch();
      alert('Demo threats seeded. Check Live Alerts.');
    } catch (err) {
      console.error('[DEMO] Seed failed', err);
      alert('Failed to seed demo threats. Check console for details.');
    } finally {
      setDemoBusy(false);
    }
  };

  const handleClearDemo = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      const res = await axios.post('/api/demo/clear');
      console.log('[DEMO] Clear response', res.data);
      await refetch();
      alert('Simulated/demo threats cleared.');
    } catch (err) {
      console.error('[DEMO] Clear failed', err);
      alert('Failed to clear simulated threats. Check console for details.');
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      {/* Demo Controls Panel */}
      <div className="mb-6 p-4 rounded-lg bg-gray-900 border border-gray-700 shadow-md">
        <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Play className="w-4 h-4 text-indigo-400" />
          Demo Controls
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          Quickly seed or clear demo threats for presentations.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSeedDemo}
            disabled={demoBusy}
            className="px-4 py-1.5 rounded-full text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {demoBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Seed Demo Threats
          </button>
          <button
            type="button"
            onClick={handleClearDemo}
            disabled={demoBusy}
            className="px-4 py-1.5 rounded-full text-xs font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {demoBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Clear Simulated Threats
          </button>
        </div>
      </div>

      {loading && threats.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : error ? (
        <div className="text-red-500 text-center">Error loading threats: {error}</div>
      ) : (
        <ThreatManager 
          threats={threats} 
          onRefresh={refetch} 
        />
      )}
    </div>
  );
}
