import { Newspaper } from 'lucide-react';

export default function News() {
  return (
    <div className="p-8 flex flex-col items-center justify-center h-full text-center">
      <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <Newspaper className="w-10 h-10 text-gray-500" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">News Feed</h2>
      <p className="text-gray-400 max-w-md">
        This is a placeholder for the News Feed.
        In future phases, the AI-driven news ingestion and display will be migrated here.
      </p>
    </div>
  );
}
