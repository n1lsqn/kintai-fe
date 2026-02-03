import { useState, useEffect } from 'react';

type UserStatus = 'unregistered' | 'working' | 'on_break';
type AttendanceRecordType = 'work_start' | 'work_end' | 'break_start' | 'break_end';

interface LogEntry {
  type: AttendanceRecordType;
  timestamp: string;
}

interface StatusResponse {
  currentStatus: UserStatus;
  attendanceLog: LogEntry[];
}

const API_BASE = "https://api.n1l.dev";

function App() {
  const [status, setStatus] = useState<UserStatus>('unregistered');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data: StatusResponse = await res.json();
      setStatus(data.currentStatus);
      setLogs(data.attendanceLog);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleStamp = async () => {
    try {
      const res = await fetch(`${API_BASE}/stamp`, { method: 'POST' });
      if (res.ok) {
        fetchStatus();
      }
    } catch (err) {
      console.error('Stamp failed:', err);
    }
  };

  const handleClockOut = async () => {
    try {
      const res = await fetch(`${API_BASE}/clock_out`, { method: 'POST' });
      if (res.ok) {
        fetchStatus();
      } else {
        const data = await res.json();
        alert(data.message);
      }
    } catch (err) {
      console.error('Clock out failed:', err);
    }
  };

  const getStatusLabel = (s: UserStatus) => {
    switch (s) {
      case 'unregistered': return 'オフライン';
      case 'working': return '集中タイム';
      case 'on_break': return 'リラックス';
      default: return '???';
    }
  };

  const getLogTypeLabel = (t: AttendanceRecordType) => {
    switch (t) {
      case 'work_start': return 'ログイン';
      case 'work_end': return 'ログアウト';
      case 'break_start': return 'AFK';
      case 'break_end': return '復帰';
      default: return t;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-white">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8 w-full max-w-2xl mx-auto">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-4">作業管理</h1>
        <div className="inline-block px-4 py-2 rounded-full bg-gray-800 border border-gray-700">
          現在の状態: <span className={`font-bold ${status === 'working' ? 'text-green-400' : status === 'on_break' ? 'text-yellow-400' : 'text-gray-400'}`}>
            {getStatusLabel(status)}
          </span>
        </div>
      </header>

      <main>
        <div className="grid grid-cols-2 gap-4 mb-12">
          <button
            onClick={handleStamp}
            className="h-24 text-xl font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg active:scale-95"
          >
            {status === 'unregistered' ? '開始' : status === 'working' ? '休憩開始' : '休憩終了'}
          </button>
          <button
            onClick={handleClockOut}
            disabled={status === 'unregistered'}
            className="h-24 text-xl font-bold rounded-xl bg-rose-700 hover:bg-rose-600 transition-colors shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            終了
          </button>
        </div>

        <section className="bg-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-gray-700 font-bold bg-gray-750">
            最近のログ
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase text-gray-400 bg-gray-900/50">
                  <th className="px-6 py-3 font-medium">日時</th>
                  <th className="px-6 py-3 font-medium">種別</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {[...logs].reverse().map((log, i) => (
                  <tr key={i} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono">
                      {new Date(log.timestamp).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        log.type.includes('work') ? 'bg-indigo-900/40 text-indigo-300' : 'bg-yellow-900/40 text-yellow-300'
                      }`}>
                        {getLogTypeLabel(log.type)}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-10 text-center text-gray-500">
                      ログがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;