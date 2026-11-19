import React from 'react';
import { X, BookOpen, ExternalLink, Calendar, Layers, Hash, Bookmark, BookmarkCheck } from 'lucide-react';
import { MangaItem } from '../types';

interface DlRawDetailModalProps {
  item: MangaItem | null;
  onClose: () => void;
  onSetCheckpoint?: (item: MangaItem) => void;
}

export const DlRawDetailModal: React.FC<DlRawDetailModalProps> = ({ item, onClose, onSetCheckpoint }) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
                {item.category}
              </span>
              {item.author && (
                <span className="text-xs text-slate-500">作者: {item.author}</span>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 leading-snug">{item.title}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {item.normalizedTitle}</p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
              <span className="block text-[11px] font-medium text-indigo-700">最大検出巻数・号数</span>
              <span className="text-xl font-bold text-indigo-900">
                {item.category === '雑誌'
                  ? (item.displayVolume || `${item.maxVolume}号`)
                  : (item.displayVolume && (item.displayVolume.startsWith('全') || item.displayVolume.endsWith('編') || item.displayVolume.includes('上') || item.displayVolume.includes('下') || item.displayVolume.includes('中')))
                  ? item.displayVolume
                  : item.maxVolume > 0
                  ? `第 ${item.maxVolume} 巻`
                  : (item.displayVolume || '全１巻')}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="block text-[11px] font-medium text-slate-600">検出記事数</span>
              <span className="text-xl font-bold text-slate-800">{item.history.length} 記事</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl col-span-2 sm:col-span-1">
              <span className="block text-[11px] font-medium text-slate-600">最終更新日時</span>
              <span className="text-xs font-semibold text-slate-800 block mt-1">
                {new Date(item.lastUpdatedAt).toLocaleString('ja-JP')}
              </span>
            </div>
          </div>

          {/* Latest Post Record */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-indigo-600" />
              最新の投稿元記事
            </h4>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">{item.latestPostTitle}</p>
                <p className="text-[11px] text-slate-500 font-mono truncate max-w-md">
                  {item.latestUrl}
                </p>
              </div>
              <a
                href={item.latestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                記事を開く
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Volume History Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              巡回中に検出された巻数履歴 ({item.history.length} 件)
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">巻数表記</th>
                    <th className="py-2.5 px-3">元記事タイトル</th>
                    <th className="py-2.5 px-3 w-16 text-center">Page</th>
                    <th className="py-2.5 px-3 w-16 text-center">リンク</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {item.history.map((hist, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-indigo-700 whitespace-nowrap">
                        {hist.rawVolumeStr || `Vol.${hist.volume}`}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{hist.postTitle}</td>
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        P.{hist.page}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <a
                          href={hist.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-slate-400 hover:text-indigo-600 inline-block"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {onSetCheckpoint && (
            <button
              onClick={() => {
                onSetCheckpoint(item);
                onClose();
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
              title="この作品を巡回チェックポイントに設定"
            >
              <BookmarkCheck className="w-4 h-4" />
              この作品を巡回チェックポイントに設定
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors ml-auto"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
