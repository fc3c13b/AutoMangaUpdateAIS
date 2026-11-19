import React, { useState, useEffect, useRef } from 'react';
import { Terminal, CheckCircle2, AlertTriangle, AlertCircle, BookmarkCheck, ArrowDown, Trash2, Filter } from 'lucide-react';
import { CrawlLog, ScraperState } from '../types';

interface LiveLogViewerProps {
  logs: CrawlLog[];
  state: ScraperState | null;
  onClearLogs?: () => void;
}

export const LiveLogViewer: React.FC<LiveLogViewerProps> = ({ logs, state, onClearLogs }) => {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === 'all') return true;
    if (filterLevel === 'checkpoint') return log.level === 'checkpoint';
    if (filterLevel === 'error') return log.level === 'error' || log.level === 'warning';
    if (filterLevel === 'success') return log.level === 'success';
    return true;
  });

  const getLogIcon = (level: CrawlLog['level']) => {
    switch (level) {
      case 'checkpoint':
        return <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />;
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />;
      default:
        return <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0 mt-1.5" />;
    }
  };

  const getLogTextColor = (level: CrawlLog['level']) => {
    switch (level) {
      case 'checkpoint':
        return 'text-emerald-300 font-semibold bg-emerald-950/40 px-1 py-0.5 rounded';
      case 'success':
        return 'text-emerald-300';
      case 'warning':
        return 'text-amber-300';
      case 'error':
        return 'text-rose-300 font-bold';
      default:
        return 'text-slate-300';
    }
  };

  const progressPercent = state && state.maxPages > 0
    ? Math.min(100, Math.round(((state.currentPage - 1) / state.maxPages) * 100))
    : 0;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-md flex flex-col h-[380px] overflow-hidden">
      {/* Terminal Header */}
      <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200">リアルタイム巡回ログ / ターミナル</span>
          {state?.status === 'running' && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center bg-slate-900 rounded-md p-0.5 border border-slate-800">
            <button
              onClick={() => setFilterLevel('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                filterLevel === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              すべて ({logs.length})
            </button>
            <button
              onClick={() => setFilterLevel('checkpoint')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                filterLevel === 'checkpoint' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CP判定
            </button>
            <button
              onClick={() => setFilterLevel('error')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                filterLevel === 'error' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              警告/エラー
            </button>
          </div>

          <label className="inline-flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3 h-3 text-indigo-500 rounded border-slate-700 bg-slate-900"
            />
            <span>自動スクロール</span>
          </label>
        </div>
      </div>

      {/* Progress Bar Header */}
      {state && (
        <div className="bg-slate-950/40 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <div>
              <span>進行状況: </span>
              <span className="font-semibold text-slate-200">
                ページ {state.currentPage} / {state.maxPages}
              </span>
            </div>
            <div>
              <span>解析完了: </span>
              <span className="font-semibold text-indigo-300">{state.itemsFoundInCurrentRun} 件</span>
            </div>
            <div>
              <span>新規登録: </span>
              <span className="font-semibold text-emerald-300">+{state.newTitlesInCurrentRun}</span>
            </div>
            <div>
              <span>巻数更新: </span>
              <span className="font-semibold text-amber-300">+{state.updatedTitlesInCurrentRun}</span>
            </div>
          </div>

          <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Log Output Body */}
      <div
        ref={logContainerRef}
        className="flex-1 p-3.5 overflow-y-auto font-mono text-xs space-y-1.5 select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 italic">
            「クロール開始」をクリックすると、巡回ログがここにリアルタイム表示されます...
          </div>
        ) : (
          filteredLogs.slice().reverse().map((log) => (
            <div key={log.id} className="flex items-start gap-2 leading-relaxed hover:bg-slate-800/40 px-1 py-0.5 rounded">
              <span className="text-[10px] text-slate-500 shrink-0 font-sans">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {getLogIcon(log.level)}
              {log.page && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 border border-slate-700 shrink-0 font-sans">
                  P.{log.page}
                </span>
              )}
              <span className={`break-all ${getLogTextColor(log.level)}`}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
