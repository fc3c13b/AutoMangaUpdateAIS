import React, { useState } from 'react';
import { 
  LocalMangaItem, 
  NewVolumeInfo 
} from '../types';
import { 
  Book, 
  Search, 
  Download, 
  Check, 
  Folder, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  Sparkles,
  ArrowRight,
  HardDriveDownload,
  AlertTriangle,
  RotateCw
} from 'lucide-react';

interface MangaTableProps {
  items: LocalMangaItem[];
  onCheckSingle: (item: LocalMangaItem) => void;
  onDownloadNewVolume: (item: LocalMangaItem, volumeInfo: NewVolumeInfo) => void;
  onOpenVolumeModal: (item: LocalMangaItem) => void;
}

export const MangaTable: React.FC<MangaTableProps> = ({
  items,
  onCheckSingle,
  onDownloadNewVolume,
  onOpenVolumeModal,
}) => {
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has_updates' | 'up_to_date' | 'error'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const errorItemsCount = items.filter((i) => i.status === 'error').length;

  // フィルタリング
  const filteredItems = items.filter((item) => {
    const matchesSearch = 
      item.mangaTitle.toLowerCase().includes(filterText.toLowerCase()) ||
      item.folderName.toLowerCase().includes(filterText.toLowerCase()) ||
      item.categoryFolder.toLowerCase().includes(filterText.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'has_updates') {
      return item.availableNewVolumes.length > 0;
    }
    if (statusFilter === 'up_to_date') {
      return item.status === 'up_to_date';
    }
    if (statusFilter === 'error') {
      return item.status === 'error';
    }
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* 検索・絞り込みバー */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="マンガタイトルやフォルダ名で検索..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            すべて ({items.length})
          </button>
          <button
            onClick={() => setStatusFilter('has_updates')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
              statusFilter === 'has_updates'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>新刊あり ({items.filter(i => i.availableNewVolumes.length > 0).length})</span>
          </button>
          <button
            onClick={() => setStatusFilter('up_to_date')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === 'up_to_date'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            最新 ({items.filter(i => i.status === 'up_to_date').length})
          </button>
          {errorItemsCount > 0 && (
            <button
              onClick={() => setStatusFilter('error')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                statusFilter === 'error'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'bg-rose-950/60 text-rose-300 border border-rose-500/40 hover:bg-rose-900/60'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>検索エラー ({errorItemsCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* マンガ一覧 */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <Book className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-300">表示できるマンガがありません</p>
          <p className="text-xs text-slate-500 mt-1">
            上部の「PCフォルダを選択」からマンガフォルダを読み込むか、「サンプルデータで確認」を押してください。
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80">
          {filteredItems.map((item) => {
            const hasNewVolumes = item.availableNewVolumes.length > 0;
            const isChecking = item.status === 'checking';
            const isExpanded = expandedId === item.id;
            const ownedSet = new Set(item.ownedVolumes);
            const missingVolumes: number[] = [];
            if (item.ownedVolumes.length > 0 && item.maxVolume > 1) {
              for (let v = 1; v < Math.floor(item.maxVolume); v++) {
                if (!ownedSet.has(v)) missingVolumes.push(v);
              }
            }
            const hasGap = missingVolumes.length > 0;

            return (
              <div key={item.id} className="p-4 sm:p-5 hover:bg-slate-850/50 transition">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* タイトル & パス情報 */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-900/60 to-slate-900 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0 shadow-inner">
                      <span className="text-lg">巻</span>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white tracking-tight truncate">
                          {item.mangaTitle}
                        </h3>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {item.subFolderPath}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                        <span>所持巻数:</span>
                        <span className="font-semibold text-slate-200">
                          {item.ownedVolumes.length > 0
                            ? `${item.ownedVolumes[0]}巻 〜 ${item.maxVolume}巻`
                            : 'なし'}
                        </span>
                        <span className="text-slate-600">|</span>
                        <span>合計: <strong className="text-slate-300">{item.files.length}冊</strong></span>
                        <span className="text-slate-600">|</span>
                        <span className="text-emerald-400 font-medium">
                          現在の最大: <span className="text-sm font-bold text-emerald-300">第{item.maxVolume}巻</span>
                        </span>
                        {hasGap && (
                          <>
                            <span className="text-slate-600">|</span>
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                              欠巻: {missingVolumes.join(', ')}巻
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 新刊ステータス & アクション */}
                  <div className="flex flex-wrap items-center gap-2.5 sm:self-end lg:self-center">
                    {/* 新刊ありバッジ */}
                    {hasNewVolumes ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold animate-pulse">
                          <Sparkles className="w-3.5 h-3.5" />
                          {item.availableNewVolumes.some((nv) => nv.volume < item.maxVolume)
                            ? `未所持 ${item.availableNewVolumes.length}冊 検出`
                            : `新刊 ${item.availableNewVolumes.length}冊 検出`}
                        </span>
                        <button
                          onClick={() => onOpenVolumeModal(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition"
                        >
                          <HardDriveDownload className="w-3.5 h-3.5" />
                          <span>
                            {item.availableNewVolumes.some((nv) => nv.volume < item.maxVolume)
                              ? '未所持巻をダウンロード'
                              : '新刊をダウンロード'}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {item.status === 'error' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            検索エラー
                          </span>
                        )}
                        {item.status === 'up_to_date' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                            <Check className="w-3.5 h-3.5" />
                            最新巻まで所持
                          </span>
                        )}
                        <button
                          onClick={() => onCheckSingle(item)}
                          disabled={isChecking}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-50 ${
                            item.status === 'error'
                              ? 'bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border-rose-500/40'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${item.status === 'error' ? 'text-rose-400' : 'text-indigo-400'} ${isChecking ? 'animate-spin' : ''}`} />
                          <span>{isChecking ? 'DL-RAW検索中...' : item.status === 'error' ? '再検索' : '新刊を検索'}</span>
                        </button>
                      </>
                    )}

                    {/* 詳細展開ボタン */}
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                      title="所持ファイル一覧を開く"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 検索エラー表示バー */}
                {item.status === 'error' && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-rose-200 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="font-semibold shrink-0">DL-RAW検索失敗:</span>
                      <span className="text-rose-300 break-all">
                        {item.errorMessage || '検索処理中にエラーが発生しました'}
                      </span>
                    </div>
                    {item.lastChecked && (
                      <span className="text-[11px] font-mono text-rose-400/80 shrink-0">
                        確認時刻: {item.lastChecked}
                      </span>
                    )}
                  </div>
                )}

                {/* 新刊検出プレビューバー (新刊がある場合) */}
                {hasNewVolumes && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-950/30 border border-amber-600/30 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-amber-300">
                        {item.availableNewVolumes.some((nv) => nv.volume < item.maxVolume) ? '検出巻候補:' : '新刊候補:'}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {item.availableNewVolumes.map((nv) => (
                          <span
                            key={nv.volume}
                            className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 text-xs font-mono font-bold"
                          >
                            第{nv.volume}巻{nv.volume < item.maxVolume ? ' (欠巻)' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenVolumeModal(item)}
                      className="text-xs text-amber-300 hover:text-white underline font-medium flex items-center gap-1"
                    >
                      詳細・個別選択 <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* 展開された所持CBZファイル一覧 */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        ローカル所持ファイル一覧 ({item.files.length}件)
                      </span>
                      <span className="font-mono text-slate-500">
                        {item.subFolderPath}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                      {item.files.map((file, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950 border border-slate-800/80 rounded-lg p-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="truncate text-slate-300 font-mono" title={file.name}>
                            {file.name}
                          </div>
                          <div className="shrink-0 text-[10px] text-slate-500 font-mono">
                            {file.size > 0 ? `${(file.size / (1024 * 1024)).toFixed(1)}MB` : 'CBZ'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
