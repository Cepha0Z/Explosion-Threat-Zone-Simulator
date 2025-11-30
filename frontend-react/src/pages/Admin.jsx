import { useThreats } from '../hooks/useThreats';
import ThreatManager from '../components/admin/ThreatManager';
import { Loader2 } from 'lucide-react';

export default function Admin() {
  const { threats, loading, error, refetch } = useThreats(5000);

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
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
