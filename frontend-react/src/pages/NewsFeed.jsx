// NOTE: Vite proxy: /api -> http://localhost:3000
// React News currently calls: /api/news (proxied to Node backend)
// Legacy News currently calls: http://localhost:5000/api/news (Python service directly)

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { RefreshCw, ExternalLink, Zap, Loader2, AlertTriangle } from 'lucide-react';

export default function NewsFeed() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulatingId, setSimulatingId] = useState(null);
  const context = useOutletContext();
  const renderLocation = context?.renderLocation || 'leftPanel';

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/news');
      console.log('[React News] Raw response from /api/news:', res.data);
      setArticles(res.data);
    } catch (err) {
      console.error('Failed to fetch news:', err);
      setError('Unable to load news feed. Is the backend service running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleSimulate = async (article) => {
    setSimulatingId(article.id || article.title);
    try {
      const payload = {
        id: article.id,
        text: `${article.title}\n\n${article.description || ''}`,
        ...article
      };

      await axios.post('/api/news/simulate', payload);
      alert(`Successfully simulated threat: "${article.title.substring(0, 30)}..."\nCheck Live Alerts map.`);
    } catch (err) {
      console.error('Simulation failed:', err);
      alert('Failed to simulate threat. See console for details.');
    } finally {
      setSimulatingId(null);
    }
  };

  // Only render in left panel
  if (renderLocation !== 'leftPanel') {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-white">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Global Incident Feed</h2>
          <p className="text-xs text-slate-500 mt-0.5">Explosion / hazard news curated by AI</p>
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          className="p-2 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors disabled:opacity-50"
          title="Refresh Feed"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {loading && articles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin mb-3 text-blue-600" />
            <p className="text-sm">Scanning global feeds...</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-red-500">
            <AlertTriangle className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-base">{error}</p>
            <button 
              onClick={fetchNews}
              className="mt-4 px-4 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200 text-slate-900 font-medium"
            >
              Retry
            </button>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center text-slate-500 mt-20 text-base">
            <p>No relevant incidents found at this time.</p>
          </div>
        ) : (
          articles.map((article, idx) => (
            <div 
              key={article.id || idx} 
              className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-blue-600 uppercase font-semibold">
                  {article.source || 'GLOBAL'}
                </span>
                <span className="text-xs text-slate-500">
                  {article.publishedAt ? new Date(article.publishedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug">
                {article.title}
              </h3>

              {article.description && (
                <p className="mt-2 text-sm text-slate-600 line-clamp-2 leading-relaxed">
                  {article.description}
                </p>
              )}

              <div className="mt-3 flex justify-between items-center gap-2">
                {article.url && (
                  <button 
                    onClick={() => window.open(article.url, '_blank')}
                    className="text-sm text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline flex items-center gap-1.5 font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Read Source
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSimulate(article)}
                  disabled={simulatingId === (article.id || idx)}
                  className={`
                    px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 font-semibold
                    ${simulatingId === (article.id || idx)
                      ? 'bg-slate-200 text-slate-500 cursor-wait' 
                      : 'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md'}
                  `}
                >
                  {simulatingId === (article.id || idx) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Simulate as Threat
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
