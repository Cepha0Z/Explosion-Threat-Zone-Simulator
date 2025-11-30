// NOTE: Vite proxy: /api -> http://localhost:3000
// React News currently calls: /api/news (proxied to Node backend)
// Legacy News currently calls: http://localhost:5000/api/news (Python service directly)

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Newspaper, RefreshCw, ExternalLink, Zap, Loader2, AlertTriangle } from 'lucide-react';

export default function NewsFeed() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulatingId, setSimulatingId] = useState(null);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/news');
      
      // DEBUG LOGS
      console.log('[React News] Raw response from /api/news:', res.data);
      console.log('[React News] Article count BEFORE any filtering:', Array.isArray(res.data) ? res.data.length : 'no array');
      
      setArticles(res.data);
      
      console.log('[React News] Articles state AFTER mapping/filtering:', res.data);
      
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
    setSimulatingId(article.id || article.title); // Use title as fallback ID
    try {
      // Map Python article fields to what the simulation endpoint expects
      // The endpoint expects { text: ... } usually, or we can send the whole object
      // Let's construct a text representation if needed, or send the object if the backend handles it.
      // Backend /api/news/simulate expects { text: ... } in our implementation.
      
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

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-800 bg-gray-900/50 backdrop-blur flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Newspaper className="w-6 h-6 text-blue-400" />
            News Intelligence
          </h1>
          <p className="text-sm text-gray-400 mt-1">Global incident feed (AI-parsed)</p>
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors disabled:opacity-50"
          title="Refresh Feed"
        >
          <RefreshCw className={`w-5 h-5 text-gray-300 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {loading && articles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
            <p>Scanning global feeds...</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-red-400">
            <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
            <p>{error}</p>
            <button 
              onClick={fetchNews}
              className="mt-4 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-white text-sm"
            >
              Retry Connection
            </button>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <p>No relevant incidents found at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {articles.map((article, idx) => (
              <div 
                key={article.id || idx} 
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg hover:border-blue-500/30 transition-all flex flex-col group"
              >
                {article.image && (
                  <div className="h-40 w-full bg-cover bg-center rounded-lg mb-4" style={{ backgroundImage: `url('${article.image}')` }} />
                )}

                <div className="flex justify-between items-start mb-3">
                  <div className="text-xs text-blue-400 font-mono px-2 py-1 bg-blue-900/20 rounded border border-blue-900/50">
                    {article.source || 'GLOBAL_FEED'}
                  </div>
                  <span className="text-xs text-gray-500">
                    {article.publishedAt ? new Date(article.publishedAt).toLocaleTimeString() : 'Just now'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 leading-tight group-hover:text-blue-400 transition-colors">
                  {article.title}
                </h3>

                <p className="text-gray-400 text-sm leading-relaxed mb-4 flex-1 line-clamp-3">
                  {article.description}
                </p>

                <div className="pt-4 border-t border-gray-800 flex items-center justify-between gap-3">
                  {article.url && (
                    <a 
                      href={article.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Read Article
                    </a>
                  )}

                  <button
                    onClick={() => handleSimulate(article)}
                    disabled={simulatingId === (article.id || idx)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ml-auto
                      ${simulatingId === (article.id || idx)
                        ? 'bg-gray-700 text-gray-400 cursor-wait' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20'}
                    `}
                  >
                    {simulatingId === (article.id || idx) ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3" />
                        Simulate Threat
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
