import React from 'react';
import { RapidgatorQueueItem } from '../types';
import {
  Clock,
  ExternalLink,
  XCircle,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  ListChecks,
} from 'lucide-react';

interface RapidgatorQueuePanelProps {
  queue: RapidgatorQueueItem[];
  waitSeconds: number;
  isPaused: boolean;
  hasDebridKey: boolean;
  onChangeWaitSeconds: (seconds: number) => void;
  onTogglePause: () => void;
  onCancelItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onCompleteManualCaptcha: (id: string) => void;
  onClearFinished: () => void;
  onClearAll: () => void;
}

export const RapidgatorQueuePanel: React.FC<RapidgatorQueuePanelProps> = ({
  queue,
  waitSeconds,
  isPaused,
  hasDebridKey,
  onChangeWaitSeconds,
  onTogglePause,
  onCancelItem,
  onRemoveItem,
  onCompleteManualCaptcha,
  onClearFinished,
  onClearAll,
}) => {
  if (queue.length === 0) return null;

  const activeCount = queue.filter(
    (q) =>
      q.status === 'queued' ||
      q.status === 'waiting' ||
      q.status === 'downloading' ||
      q.status === 'captcha_required'
  ).length;
  const finishedCount = queue.filter(
    (q) => q.status === 'completed' || q.status === 'cancelled' || q.status === 'failed'
  ).length;

  const renderStatusBadge = (q: RapidgatorQueueItem) => {
    switch (q.status) {
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-semibold">
            <Clock className="w-3 h-3 text-slate-400" />
            順番待ち
          </span>
        );
      case 'waiting':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
            <Clock className="w-3 h-3 animate-pulse" />
            WAIT中 (残り {q.waitRemainingSec}秒)
          </span>
        );
      case 'downloading':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[11px] font-bold">
            <Loader2 className="w-3 h-3 animate-spin" />
            DL中 {q.progressPercent !== undefined ? `${q.progressPercent}%` : ''}
          </span>
        );
      case 'captcha_required':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold">
            <ShieldAlert className="w-3 h-3" />
            CAPTCHA認証待ち
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3" />
            完了
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-medium">
            <XCircle className="w-3 h-3" />
            キャンセル済み
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold">
            <AlertTriangle className="w-3 h-3" />
            失敗
          </span>
        );
    }
  };

  return (
    <section className="bg-slate-900 border border-amber-500/30 rounded-2xl overflow-hidden shadow-xl">
      {/* ヘッダー */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white">
                Rapidgator バックグラウンド待機キュー
              </h2>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                全 {queue.length}件 (待機・処理中 {activeCount}件)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {hasDebridKey
                ? 'Real-Debrid連携ON: WAIT後にバックグラウンドで自動DL・保存します'
                : 'Real-Debrid未設定 (Rapidgator無料): 30秒WAIT後のGoogle reCAPTCHAはブラウザ側で認証が必要です。WAIT終了後にリンクボタンが表示されます。'}
            </p>
          </div>
        </div>

        {/* コントロール */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-400 text-[11px]">WAIT間隔:</span>
            <select
              value={waitSeconds}
              onChange={(e) => onChangeWaitSeconds(Number(e.target.value))}
              className="bg-transparent text-amber-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value={5} className="bg-slate-900">5秒 (Debrid向け)</option>
              <option value={35} className="bg-slate-900">35秒 (標準WAIT)</option>
              <option value={60} className="bg-slate-900">60秒</option>
              <option value={180} className="bg-slate-900">3分 (180秒)</option>
              <option value={600} className="bg-slate-900">10分 (600秒)</option>
              <option value={1800} className="bg-slate-900">30分 (1800秒)</option>
            </select>
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={onTogglePause}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                isPaused
                  ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? '再開' : '一時停止'}</span>
            </button>
          )}

          {finishedCount > 0 && (
            <button
              type="button"
              onClick={onClearFinished}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>完了/キャンセル済みを消す</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 text-xs font-medium border border-rose-500/40 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>表示を全て消す</span>
          </button>
        </div>
      </div>

      {/* キューリスト */}
      <div className="divide-y divide-slate-800/80 max-h-96 overflow-y-auto">
        {queue.map((q) => {
          const isActive =
            q.status === 'queued' ||
            q.status === 'waiting' ||
            q.status === 'downloading' ||
            q.status === 'captcha_required';
          const waitPercent =
            q.waitTotalSec > 0
              ? Math.min(100, Math.round(((q.waitTotalSec - q.waitRemainingSec) / q.waitTotalSec) * 100))
              : 100;

          return (
            <div key={q.id} className="p-3.5 sm:p-4 hover:bg-slate-850/40 transition">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* 左側情報 */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderStatusBadge(q)}
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono font-bold">
                      第{String(q.volume).padStart(2, '0')}巻
                    </span>
                    <span className="text-sm font-bold text-white truncate">
                      {q.dlRawTitle}
                    </span>
                    {q.rapidgatorFileSize && (
                      <span className="text-[11px] font-mono text-slate-400">
                        ({q.rapidgatorFileSize})
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap font-mono">
                    <span className="text-cyan-300 truncate max-w-md" title={q.targetFileName}>
                      保存予定名: {q.targetFileName}
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-rose-300/80 truncate max-w-sm" title={q.originalError}>
                      元エラー: {q.originalError}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300">
                    {q.statusMessage}
                  </div>

                  {q.status === 'waiting' && (
                    <div className="w-full max-w-md bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800 mt-1">
                      <div
                        className="bg-amber-400 h-full transition-all duration-500"
                        style={{ width: `${waitPercent}%` }}
                      />
                    </div>
                  )}
                  {q.status === 'downloading' && q.progressPercent !== undefined && (
                    <div className="w-full max-w-md bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800 mt-1">
                      <div
                        className="bg-indigo-500 h-full transition-all duration-300"
                        style={{ width: `${q.progressPercent}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* 右側ボタン: Rapidgator開く / 完了 / キャンセル / 表示を消す */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {q.status === 'captcha_required' && (
                    <>
                      <a
                        href={q.rapidgatorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Rapidgatorを開く</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => onCompleteManualCaptcha(q.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>DL完了して次へ</span>
                      </button>
                    </>
                  )}

                  {isActive && (
                    <button
                      type="button"
                      onClick={() => onCancelItem(q.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border border-amber-500/40 text-xs font-semibold transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>キャンセル</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveItem(q.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
                    title="この項目をキューリストから消す"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>表示を消す</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
