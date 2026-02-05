// fe/src/WorkSummary.tsx
import React, { useState, useEffect, useCallback } from 'react';

interface WorkSummaryProps {
  userId: string | null;
  // apiRequest 関数を App.tsx から受け取る
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<Response>;
  refreshTrigger: number;
}

interface DailySummary {
  date: string;
  totalMs: number;
}

interface WeeklySummary {
  weekStart: string;
  totalMs: number;
}

interface MonthlySummary {
  month: string;
  totalMs: number;
}

interface SummaryResponse {
  daily: DailySummary[];
  weekly: WeeklySummary[];
  monthly: MonthlySummary[];
  total: number;
}

const formatDuration = (ms: number) => {
  if (ms < 0) return "00:00:00"; // マイナスの値は0として扱うか、エラーハンドリング
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const WorkSummary: React.FC<WorkSummaryProps> = ({ userId, apiRequest, refreshTrigger }) => {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/summary');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data: SummaryResponse = await res.json();
      setSummary(data);
    } catch (e: any) { // eの型をanyに指定
      setError('Failed to fetch work summary.');
      console.error('Failed to fetch summary:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, apiRequest, refreshTrigger]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading) {
    return <div className="text-center text-gray-400 my-4">集計データを読み込み中...</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 my-4">{error}</div>;
  }

  if (!summary || (summary.daily.length === 0 && summary.weekly.length === 0 && summary.monthly.length === 0)) {
    return <div className="text-center text-gray-500 my-4">まだ作業時間の記録がありません</div>;
  }

  return (
    <section className="bg-gray-800 rounded-xl overflow-hidden shadow-xl my-8">
      <div className="px-6 py-4 border-b border-gray-700 font-bold bg-gray-750">
        作業時間サマリー
      </div>
      <div className="p-6">
        {summary.weekly.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-300 mb-2">週別</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              {summary.weekly.map((data) => (
                <li key={data.weekStart}>
                  {data.weekStart} からの週: <span className="font-mono text-indigo-300">{formatDuration(data.totalMs)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {summary.monthly.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-300 mb-2">月別</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              {summary.monthly.map((data) => (
                <li key={data.month}>
                  {data.month}: <span className="font-mono text-indigo-300">{formatDuration(data.totalMs)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </section>
  );
};

export default WorkSummary;
