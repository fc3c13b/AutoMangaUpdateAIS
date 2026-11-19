import React, { useState } from 'react';
import {
  BookmarkCheck,
  History,
  Trash2,
  Info,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  ArrowDown,
} from 'lucide-react';
import { Checkpoint } from '../types';

interface CheckpointCardProps {
  checkpoint: Checkpoint | null;
  previousCheckpoint?: Checkpoint | null;
  checkpointHistory?: Checkpoint[];
  activeCategory?: 'manga' | 'magazine';
  onClearCheckpoint: () => void;
  onRollbackCheckpoint?: () => void;
  onSyncFromLatestDb?: () => void;
}

export const CheckpointCard: React.FC<CheckpointCardProps> = ({
  checkpoint,
  previousCheckpoint,
  checkpointHistory = [],
  activeCategory = 'manga',
  onClearCheckpoint,
  onRollbackCheckpoint,
  onSyncFromLatestDb,
}) => {
  const [showHistory, setShowHistory] = useState(false);

  const prevCp = previousCheckpoint || checkpoint?.previous || null;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">
            巡回チェックポイント管理
          </h3>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            activeCategory === 'manga'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {activeCategory === 'manga' ? 'manga' : 'magazine'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onSyncFromLatestDb && (
            <button
              onClick={onSyncFromLatestDb}
              className="text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 inline-flex items-center gap-1 font-semibold transition-colors"
              title="データベース内の登録順1位の作品を最新チェックポイントに設定"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              DB最新作をCPに設定
            </button>
          )}
          {checkpoint && (
            <button
              onClick={onClearCheckpoint}
              className="text-xs text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1 transition-colors ml-1"
              title="チェックポイントを全消去"
            >
              <Trash2 className="w-3.5 h-3.5" />
              CP初期化
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Section Grid: Current vs Previous */}
      <div className="space-y-3.5 text-xs">
        {/* 1. Current Latest Checkpoint */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              現在保存中の最新タイトル (Current Latest)
            </span>
            {checkpoint && (
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(checkpoint.savedAt).toLocaleString('ja-JP')}
              </span>
            )}
          </div>

          {checkpoint ? (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/90 rounded-xl space-y-2 relative overflow-hidden">
              <div className="flex items-start justify-between gap-2">
                <div className="pr-2">
                  <p className="text-sm font-bold text-slate-900 leading-snug">
                    {checkpoint.title}
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono mt-0.5 break-all">
                    元記事: {checkpoint.rawTitle}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs shrink-0 shadow-2xs">
                  {checkpoint.displayVolume || (checkpoint.maxVolume > 0 ? `第${checkpoint.maxVolume}巻` : '全１巻')}
                </span>
              </div>

              <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-900 font-mono">
                <span>検出開始ページ: P.{checkpoint.page || 1}</span>
                {checkpoint.url && (
                  <a
                    href={checkpoint.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 underline font-sans"
                  >
                    元記事確認
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center">
              最新チェックポイントは未保存です（巡回開始時に自動保存されます）
            </div>
          )}
        </div>

        {/* Transition Arrow Indicator */}
        {checkpoint && prevCp && (
          <div className="flex items-center justify-center -my-1 text-indigo-400">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-600 font-medium">
              <ArrowDown className="w-3 h-3 text-indigo-500" />
              <span>更新前の前回データ（自動停止の判定対象）</span>
            </div>
          </div>
        )}

        {/* 2. Previous Checkpoint (一つ前の最新タイトル) */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
              <History className="w-3.5 h-3.5 text-indigo-600" />
              一つ前（前回）の保存済み最新タイトル (Previous Latest)
            </span>
            {prevCp && (
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(prevCp.savedAt).toLocaleString('ja-JP')}
              </span>
            )}
          </div>

          {prevCp ? (
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 relative">
              <div className="flex items-start justify-between gap-2">
                <div className="pr-2">
                  <p className="text-sm font-bold text-slate-900 leading-snug">
                    {prevCp.title}
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono mt-0.5 break-all">
                    元記事: {prevCp.rawTitle}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-indigo-600 text-white font-bold rounded-lg text-xs shrink-0 shadow-2xs">
                  {prevCp.displayVolume || (prevCp.maxVolume > 0 ? `第${prevCp.maxVolume}巻` : '全１巻')}
                </span>
              </div>

              <div className="pt-2 border-t border-indigo-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-indigo-950 font-mono">
                <span className="px-2 py-0.5 bg-indigo-100/80 rounded font-sans text-[10px] text-indigo-800 font-semibold">
                  次回巡回時の停止ターゲット
                </span>

                <div className="flex items-center gap-2 font-sans">
                  {prevCp.url && (
                    <a
                      href={prevCp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline text-[11px]"
                    >
                      元記事
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {onRollbackCheckpoint && (
                    <button
                      onClick={onRollbackCheckpoint}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95"
                      title="この一つ前のチェックポイントを最新として復元します"
                    >
                      <RotateCcw className="w-3 h-3 text-indigo-600" />
                      このCPに戻す
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
              <p className="font-medium text-slate-700">一つ前のチェックポイント履歴はまだありません</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                新着更新があり最新タイトルが上書き保存された際に、旧タイトルが自動的にここへ保持・表示されます。
              </p>
            </div>
          )}
        </div>

        {/* History Accordion (if extra history is available) */}
        {checkpointHistory.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                過去のチェックポイント履歴 ({checkpointHistory.length} 件)
              </span>
              {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showHistory && (
              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                {checkpointHistory.map((hist, idx) => (
                  <div key={idx} className="p-2.5 hover:bg-slate-50 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                        <span className="font-bold text-slate-800 truncate">{hist.title}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {hist.displayVolume || `${hist.maxVolume}巻`}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                        {new Date(hist.savedAt).toLocaleString('ja-JP')} | {hist.rawTitle}
                      </p>
                    </div>
                    {hist.url && (
                      <a
                        href={hist.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-indigo-600 p-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mechanism explanation */}
        <div className="flex items-start gap-2 p-2.5 bg-slate-50/80 rounded-lg text-[11px] text-slate-600 border border-slate-200/60">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed space-y-1">
            <p>
              <strong className="text-slate-800">既知作品による差分停止:</strong> 巡回時、先頭の新着が【最新タイトル】として更新され、【一つ前（前回）のチェックポイント】または【データベース取得済みの既知作品】に到達した瞬間に過去巡回済みと判定して自動停止します。
            </p>
            <p className="text-emerald-700 font-medium">
              💡 クロールを手動停止（Stop）した場合でも、その巡回で処理された最新作品が巡回チェックポイントとして確実に自動更新・保存されます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
