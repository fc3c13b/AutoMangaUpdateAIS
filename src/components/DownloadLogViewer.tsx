import React, { useState } from 'react';
import { DownloadLogEntry } from '../types';
import { 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Trash2, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  HardDrive, 
  Globe,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface DownloadLogViewerProps {
  logs: DownloadLogEntry[];
  onClearLogs: () => void;
}

export const DownloadLogViewer: React.FC<DownloadLogViewerProps> = ({ logs, onClearLogs }) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [isExpanded, setIsExpanded] = useState(true);

  const total = logs.length;
  const successes = logs.filter((l) => l.status === 'success').length;
  const failures = logs.filter((l) => l.status === 'failed').length;
  const inProgress = logs.filter((l) => l.status === 'downloading').length;

  const filteredLogs = logs.filter((l) => {
    if (filter === 'success') return l.status === 'success';
    if (filter === 'failed') return l.status === 'failed';
    return true;
  });

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.status.toUpperCase()}] ${l.title} 第${l.volume}巻 - ${l.fileName} (${l.destination}) -> ${l.message}${l.error ? ` [エラー原因: ${l.error}]` : ''}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* ヘッダー */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">ダウンロード実行ログ</h3>
              <span className="text-xs font-mono text-slate-400">({total} 件)</span>
              {failures > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold border border-rose-500/30">
                  {failures}件 失敗
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              各巻の分割ストリーミング保存・PC書き込みの実行成否とエラー原因
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          {/* フィルター */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              すべて ({total})
            </button>
            <button
              onClick={() => setFilter('success')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                filter === 'success' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-white'
              }`}
            >
              成功 ({successes})
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                filter === 'failed' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-white'
              }`}
            >
              失敗 ({failures})
            </button>
          </div>

          <button
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition disabled:opacity-40 text-xs flex items-center gap-1.5"
            title="ログテキストをクリップボードにコピー"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">コピー</span>
          </button>

          <button
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition disabled:opacity-40 text-xs flex items-center gap-1.5"
            title="ログ履歴をクリア"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">クリア</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ログ一覧 */}
      {isExpanded && (
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              まだダウンロード実行ログがありません。新刊ダウンロードを実行するとここに詳細な成否が記録されます。
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition ${
                  log.status === 'success'
                    ? 'bg-slate-950/80 border-emerald-500/20'
                    : log.status === 'failed'
                    ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                    : 'bg-slate-950/80 border-indigo-500/30'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {log.timestamp}
                    </span>

                    {log.status === 'success' && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        成功
                      </span>
                    )}

                    {log.status === 'failed' && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px] flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        失敗
                      </span>
                    )}

                    {log.status === 'downloading' && (
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px] flex items-center gap-1 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        保存中...
                      </span>
                    )}

                    <span className="font-bold text-white text-xs truncate">
                      {log.title} 第{log.volume}巻
                    </span>

                    <span className="text-[11px] text-slate-400 truncate">
                      ({log.fileName})
                    </span>
                  </div>

                  {/* エラー理由 または メッセージ */}
                  <div className="text-xs flex items-center gap-2">
                    <span className={log.status === 'failed' ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                      {log.message}
                    </span>
                    {log.size && log.size > 0 && (
                      <span className="text-emerald-400 font-mono text-[11px]">
                        [{(log.size / (1024 * 1024)).toFixed(1)} MB]
                      </span>
                    )}
                  </div>

                  {log.error && (
                    <div className="text-[11px] text-rose-300 bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                      <strong>エラー詳細:</strong> {log.error}
                    </div>
                  )}
                </div>

                {/* 保存先＆URL */}
                <div className="shrink-0 flex items-center gap-2 self-end sm:self-center text-[11px] text-slate-400">
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800">
                    {log.savedToPcFolder ? (
                      <>
                        <HardDrive className="w-3 h-3 text-cyan-400" />
                        <span className="text-cyan-300">PCフォルダ</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3 h-3 text-indigo-400" />
                        <span className="text-indigo-300">ブラウザ</span>
                      </>
                    )}
                  </div>

                  {log.downloadUrl && (
                    <a
                      href={log.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
                      title="対象URLを直接開く"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
