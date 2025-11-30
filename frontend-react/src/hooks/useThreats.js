import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export function useThreats(intervalMs = 5000) {
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchThreats = useCallback(async () => {
    try {
      const response = await axios.get('/api/threats');
      setThreats(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching threats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchThreats();

    // Poll periodically
    const intervalId = setInterval(fetchThreats, intervalMs);

    return () => clearInterval(intervalId);
  }, [intervalMs, fetchThreats]);

  return { threats, loading, error, refetch: fetchThreats };
}
