import { useState } from 'react';
import axios from 'axios';
import { useThreats } from '../hooks/useThreats';
import { Loader2, Play, Trash2, Plus, MapPin, AlertTriangle, Clock } from 'lucide-react';
import clsx from 'clsx';

export default function Admin() {
  const { threats, loading, error, refetch } = useThreats(5000);
  const [demoBusy, setDemoBusy] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    locationName: '',
    lat: '',
    lng: '',
    yield: '',
    durationMinutes: ''
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Demo Handlers
  const handleSeedDemo = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      await axios.post('/api/demo/seed');
      await refetch();
      alert('Demo threats seeded.');
    } catch (err) {
      console.error('[DEMO] Seed failed', err);
      alert('Failed to seed demo threats.');
    } finally {
      setDemoBusy(false);
    }
  };

  const handleClearDemo = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      await axios.post('/api/demo/clear');
      await refetch();
      alert('Simulated threats cleared.');
    } catch (err) {
      console.error('[DEMO] Clear failed', err);
      alert('Failed to clear threats.');
    } finally {
      setDemoBusy(false);
    }
  };

  // Threat Management Handlers
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const payload = {
        name: formData.name,
        locationName: formData.locationName,
        location: {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng)
        },
        yield: parseFloat(formData.yield),
        details: "Admin created threat",
        durationMinutes: formData.durationMinutes ? parseInt(formData.durationMinutes) : undefined
      };

      await axios.post('/api/threats', payload);
      setFormData({
        name: '',
        locationName: '',
        lat: '',
        lng: '',
        yield: '',
        durationMinutes: ''
      });
      await refetch();
    } catch (err) {
      console.error('Failed to create threat:', err);
      setCreateError(err.response?.data?.error || 'Failed to create threat');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this threat?')) return;
    try {
      await axios.delete(`/api/threats/${id}`);
      await refetch();
    } catch (err) {
      console.error('Failed to delete threat:', err);
      alert('Failed to delete threat');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar">
      
      {/* Top: Demo Controls */}
      <div className="mb-6 p-4 rounded-xl bg-gray-900/50 border border-gray-800 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-indigo-400" />
            Demo Controls
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">
            Quickly inject or clear simulation data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeedDemo}
            disabled={demoBusy}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-all shadow-lg shadow-indigo-900/20 flex items-center gap-2"
          >
            {demoBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Seed Demo Threats
          </button>
          <button
            type="button"
            onClick={handleClearDemo}
            disabled={demoBusy}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-gray-800 hover:bg-red-900/30 text-gray-300 hover:text-red-400 border border-gray-700 hover:border-red-500/50 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {demoBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Clear Simulated
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
        
        {/* Left: Create Threat Form */}
        <section className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex flex-col shadow-xl">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-500" />
            Create New Threat
          </h2>
          
          <form onSubmit={handleCreateSubmit} className="space-y-4 overflow-y-auto custom-scrollbar pr-2">
            {createError && (
              <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-xs text-red-400">
                {createError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-500">Threat Name</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition-all placeholder-gray-700"
                placeholder="e.g. Chemical Spill"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-500">Location Name</label>
              <input
                name="locationName"
                value={formData.locationName}
                onChange={handleChange}
                required
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none transition-all placeholder-gray-700"
                placeholder="e.g. Downtown Metro"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500">Latitude</label>
                <input
                  name="lat"
                  type="number"
                  step="any"
                  value={formData.lat}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none transition-all placeholder-gray-700 font-mono"
                  placeholder="12.9716"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500">Longitude</label>
                <input
                  name="lng"
                  type="number"
                  step="any"
                  value={formData.lng}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none transition-all placeholder-gray-700 font-mono"
                  placeholder="77.5946"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500">Yield (kg TNT)</label>
                <input
                  name="yield"
                  type="number"
                  value={formData.yield}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none transition-all placeholder-gray-700 font-mono"
                  placeholder="1000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500">Duration (Mins)</label>
                <input
                  name="durationMinutes"
                  type="number"
                  value={formData.durationMinutes}
                  onChange={handleChange}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none transition-all placeholder-gray-700 font-mono"
                  placeholder="∞"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={creating}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Deploy Threat
              </button>
            </div>
          </form>
        </section>

        {/* Right: Active Threats List */}
        <section className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex flex-col shadow-xl min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Active Threats
            </h2>
            <span className="text-[10px] font-mono bg-gray-900 text-gray-400 px-2 py-1 rounded border border-gray-800">
              COUNT: {threats.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {loading && threats.length === 0 ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
              </div>
            ) : threats.length === 0 ? (
              <div className="text-center py-12 text-gray-600 border border-dashed border-gray-800 rounded-lg">
                <p className="text-xs">No active threats deployed.</p>
              </div>
            ) : (
              threats.map((threat) => (
                <div 
                  key={threat.id} 
                  className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center justify-between hover:border-gray-700 transition-colors group"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-200 text-sm truncate">{threat.name}</h4>
                      <span className={clsx(
                        "text-[10px] px-1.5 py-0.5 rounded border uppercase font-mono shrink-0",
                        threat.source === 'simulation_news' 
                          ? "bg-blue-900/20 text-blue-400 border-blue-900/30"
                          : "bg-orange-900/20 text-orange-400 border-orange-900/30"
                      )}>
                        {threat.source === 'simulation_news' ? 'AI SIM' : 'ADMIN'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{threat.locationName}</span>
                      </div>
                      <div className="font-mono text-gray-600 shrink-0">
                        {threat.yield}kg
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(threat.id)}
                    className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-900/10 border border-transparent hover:border-red-900/30 rounded-md transition-all"
                    title="Delete Threat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
