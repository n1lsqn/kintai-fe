import { useState, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { MdLogout } from 'react-icons/md';

type UserStatus = 'unregistered' | 'working' | 'on_break';
type AttendanceRecordType = 'work_start' | 'work_end' | 'break_start' | 'break_end';

interface LogEntry {
  type: AttendanceRecordType;
  timestamp: string;
}

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

interface StatusResponse {
  currentStatus: UserStatus;
  attendanceLog: LogEntry[];
  discordUser?: DiscordUser;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:9393";
const RESET_HOUR = 5;

// Helper to calculate work time
const calculateTodayWorkTime = (logs: LogEntry[], currentStatus: UserStatus): number => {
  const now = new Date();
  
  // Calculate logical start of today
  const startOfToday = new Date(now);
  if (now.getHours() < RESET_HOUR) {
    startOfToday.setDate(startOfToday.getDate() - 1);
  }
  startOfToday.setHours(RESET_HOUR, 0, 0, 0);
  const startOfTodayTime = startOfToday.getTime();

  let totalTime = 0;
  let lastStartTime: number | null = null;

  // Process ALL logs to correctly track state, but only add time if it falls within today
  for (const log of logs) {
    const time = new Date(log.timestamp).getTime();
    
    if (log.type === 'work_start' || log.type === 'break_end') {
        lastStartTime = time;
    } else if (log.type === 'work_end' || log.type === 'break_start') {
      if (lastStartTime !== null) {
        // Calculate duration, clipping to start of today
        const effectiveStart = Math.max(lastStartTime, startOfTodayTime);
        const effectiveEnd = time;

        if (effectiveEnd > effectiveStart) {
            totalTime += effectiveEnd - effectiveStart;
        }
        lastStartTime = null;
      }
    }
  }

  // If currently working, add time since last start (or start of today)
  if ((currentStatus === 'working') && lastStartTime !== null) {
    const effectiveStart = Math.max(lastStartTime, startOfTodayTime);
    const effectiveEnd = now.getTime();
    
    if (effectiveEnd > effectiveStart) {
        totalTime += effectiveEnd - effectiveStart;
    }
  }

  return totalTime;
};

// Format milliseconds to HH:MM:SS
const formatDuration = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

function App() {
  const [status, setStatus] = useState<UserStatus>('unregistered');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [discordUser, setDiscordUser] = useState<DiscordUser | undefined>(undefined);
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('kintai_user_id'));
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [todayWorkTime, setTodayWorkTime] = useState(0);

  // ... (rest of the code)

  // Helper to make authenticated requests
  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      if (userId) {
          headers.set('x-user-id', userId);
      }
      const res = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers
      });
      return res;
  }, [userId]);

  const handleLogout = useCallback(() => {
      setUserId(null);
      setDiscordUser(undefined);
      localStorage.removeItem('kintai_user_id');
      setStatus('unregistered');
      setLogs([]);
  }, []);

  const fetchStatus = useCallback(async () => {
    // ユーザーIDがない場合はステータスを取得できない（未ログイン）
    if (!userId) {
        setLoading(false);
        return null;
    }

    try {
      const res = await apiRequest('/status');
      if (res.status === 404) {
          // IDはあるがサーバーにユーザーがいない（DBリセットされた等） -> ログアウト扱い
          handleLogout();
          return null;
      }
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }
      const data: StatusResponse = await res.json();
      setStatus(data.currentStatus);
      setLogs(data.attendanceLog);
      setDiscordUser(data.discordUser);
      setLoading(false);
      return data;
    } catch (err) {
      console.error('Failed to fetch status:', err);
      return null;
    }
  }, [userId, apiRequest, handleLogout]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]); 

  // Timer for updating work time
  useEffect(() => {
    const timer = setInterval(() => {
      if (logs.length > 0) {
        setTodayWorkTime(calculateTodayWorkTime(logs, status));
      } else {
        setTodayWorkTime(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [logs, status]);

  // Polling effect when logging in
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isLoggingIn) {
      intervalId = setInterval(async () => {
        // ログイン中は "/auth/me/latest" をポーリングして、自分がログインできたか確認する
        try {
            const res = await fetch(`${API_BASE}/auth/me/latest`);
            if (res.ok) {
                const user = await res.json();
                // 簡易チェック
                if (user && user.id) {
                    setUserId(user.id);
                    localStorage.setItem('kintai_user_id', user.id);
                    setIsLoggingIn(false);
                }
            }
        } catch (e) {
            console.error('Polling error:', e);
        }
      }, 2000);
    }
    return () => clearInterval(intervalId);
  }, [isLoggingIn]);

  const handleLogin = async () => {
    try {
        const res = await fetch(`${API_BASE}/auth/discord`);
        if (!res.ok) throw new Error('Failed to start login');
        const data = await res.json();
        if (data.url) {
            await open(data.url);
            setIsLoggingIn(true);
        }
    } catch (e) {
        console.error(e);
        alert('ログイン開始に失敗しました');
    }
  };

  const handleStamp = async () => {
    try {
      const res = await apiRequest('/stamp', { method: 'POST' });
      if (res.ok) {
        fetchStatus();
      }
    } catch (err) {
      console.error('Stamp failed:', err);
    }
  };

  const handleClockOut = async () => {
    try {
      const res = await apiRequest('/clock_out', { method: 'POST' });
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
      case 'on_break': return 'チルモード';
      default: return '???';
    }
  };

  const getLogTypeLabel = (t: AttendanceRecordType) => {
    switch (t) {
      case 'work_start': return '集中タイム';
      case 'work_end': return 'オフライン';
      case 'break_start': return 'チルモード';
      case 'break_end': return '集中タイム';
      default: return t;
    }
  };

  const getLogTypeColor = (t: AttendanceRecordType) => {
    switch (t) {
      case 'work_start': return 'bg-emerald-900/40 text-emerald-300';
      case 'work_end': return 'bg-rose-900/40 text-rose-300';
      case 'break_start': return 'bg-amber-900/40 text-amber-300';
      case 'break_end': return 'bg-sky-900/40 text-sky-300';
      default: return 'bg-gray-900/40 text-gray-300';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">読み込み中...</div>;
  }

  // Not Logged In View
  if (!userId || !discordUser) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-gray-100 p-8">
            <h1 className="text-4xl font-bold mb-8">Login</h1>
            <p className="mb-8 text-gray-400">開始するにはDiscordでログインしてください</p>
            <button 
                onClick={handleLogin}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-xl shadow-lg transition-all active:scale-95 flex items-center gap-3"
            >
                {isLoggingIn ? '確認中...' : 'Login with Discord'}
            </button>
            {isLoggingIn && (
                <p className="mt-4 text-sm text-gray-500 animate-pulse">ブラウザで認証を完了してください...</p>
            )}
        </div>
      );
  }

  // Logged In View
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8 w-full max-w-2xl mx-auto">
      <header className="mb-10 text-center relative">
        <div className="absolute top-0 left-0 flex items-center gap-2">
            {discordUser.avatar && (
                <img 
                    src={`https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`} 
                    alt="avatar" 
                    className="w-8 h-8 rounded-full border border-gray-600"
                />
            )}
        </div>
        <div className="absolute top-0 right-0">
          <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300">
              <MdLogout className='w-8 h-8'/>
          </button>
        </div>
        <h1 className="text-4xl font-bold mb-4">My Flow</h1>
        <div className="flex flex-col items-center gap-2">
          <div className="text-6xl font-mono font-bold text-indigo-400 tabular-nums my-4 drop-shadow-lg">
            {formatDuration(todayWorkTime)}
          </div>
          <div className="inline-block px-4 py-2 rounded-full bg-gray-800 border border-gray-700">
            ステータス: <span className={`font-bold ${status === 'working' ? 'text-green-400' : status === 'on_break' ? 'text-yellow-400' : 'text-gray-400'}`}>
              {getStatusLabel(status)}
            </span>
          </div>
        </div>
      </header>

      <main>
        <div className="grid grid-cols-2 gap-4 mb-12">
          <button
            onClick={handleStamp}
            className="h-24 text-xl font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg active:scale-95"
          >
            {status === 'unregistered' ? '▶ はじめる' : status === 'working' ? '☕ ひと休み' : '▶ 戻る'}
          </button>
          <button
            onClick={handleClockOut}
            disabled={status === 'unregistered'}
            className="h-24 text-xl font-bold rounded-xl bg-rose-700 hover:bg-rose-600 transition-colors shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🛑 おわる
          </button>
        </div>

        <section className="bg-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-gray-700 font-bold bg-gray-750">
            タイムライン
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
                      <span className={`px-2 py-1 rounded text-xs font-bold ${getLogTypeColor(log.type)}`}>
                        {getLogTypeLabel(log.type)}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-10 text-center text-gray-500">
                      記録はありません
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