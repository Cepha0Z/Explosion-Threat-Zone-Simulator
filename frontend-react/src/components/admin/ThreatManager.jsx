import { useState } from 'react';
import axios from 'axios';
import { Trash2, Plus, AlertTriangle, MapPin, Clock, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';

export default function ThreatManager({ threats, onRefresh }) {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    locationName: '',
    lat: '',
    lng: '',
    yield: '',
    durationMinutes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this threat?')) return;
    
    try {
      await axios.delete(`/api/threats/${id}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete threat:', err);
      alert('Failed to delete threat');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name,
        locationName: formData.locationName,
        location: {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng)
        },
        yield: parseFloat(formData.yield),
        details: "Admin created threat", // Default detail
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
      setIsCreating(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to create threat:', err);
      setError(err.response?.data?.error || 'Failed to create threat');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Header & Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-8 h-8 text-red-500" />
          Threat Management
        </h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2 transition"
        >
          {isCreating ? 'Cancel' : <><Plus className="w-4 h-4" /> Create Threat</>}
        </button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-xl animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-white mb-4">New Threat Definition</h3>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Threat Name</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                  placeholder="e.g. Chemical Spill"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Location Name</label>
                <input
                  name="locationName"
                  value={formData.locationName}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                  placeholder="e.g. Downtown"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Latitude</label>
                <input
                  name="lat"
                  type="number"
                  step="any"
                  value={formData.lat}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                  placeholder="12.9716"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Longitude</label>
                <input
                  name="lng"
                  type="number"
                  step="any"
                  value={formData.lng}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                  placeholder="77.5946"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Yield (kg TNT)</label>
                <input
                  name="yield"
                  type="number"
                  value={formData.yield}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                  placeholder="1000"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Duration (Minutes)</label>
                <input
                  name="durationMinutes"
                  type="number"
                  value={formData.durationMinutes}
                  onChange={handleChange}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                  placeholder="Optional (Permanent if empty)"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-bold transition disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Deploy Threat'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Threat List */}
      <div className="space-y-4">
        {threats.map((threat) => (
          <div 
            key={threat.id} 
            className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between hover:border-gray-600 transition"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h4 className="font-bold text-white text-lg">{threat.name}</h4>
                <span className={clsx(
                  "text-xs px-2 py-0.5 rounded border uppercase font-mono",
                  threat.source === 'simulation_news' 
                    ? "bg-blue-900/30 text-blue-400 border-blue-800"
                    : "bg-orange-900/30 text-orange-400 border-orange-800"
                )}>
                  {threat.source === 'simulation_news' ? 'AI SIM' : 'ADMIN'}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {threat.locationName}
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Yield: {threat.yield}kg
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {threat.expiresAt 
                    ? `Expires: ${new Date(threat.expiresAt).toLocaleTimeString()}` 
                    : 'No Expiry'}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDelete(threat.id)}
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition"
              title="Delete Threat"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}

        {threats.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-800/50 rounded-lg border border-gray-700 border-dashed">
            No active threats in the system.
          </div>
        )}
      </div>
    </div>
  );
}
