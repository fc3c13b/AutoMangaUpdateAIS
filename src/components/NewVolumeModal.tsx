import React, { useState } from 'react';
import { LocalMangaItem, NewVolumeInfo, DownloadLink } from '../types';
import { getFileSystemAccessStatus } from '../utils/fileSystem';
import { 
  X, 
  DownloadCloud, 
  CheckCircle2, 
  ExternalLink,
  Loader2,
  Copy,
  Check,
  Filter
} from 'lucide-react';

interface NewVolumeModalProps {
  item: LocalMangaItem | null;
  rootDisplayPath?: string;
  hasDirectoryHandle?: boolean;
  onClose: () => void;
  onDownloadAndSave: (item: LocalMangaItem, selectedVolumes: NewVolumeInfo[]) => Promise<void>;
  onBrowserDownloadOnly: (item: LocalMangaItem, selectedVolumes: NewVolumeInfo[]) => Promise<void>;
}

export const NewVolumeModal: React.FC<NewVolumeModalProps> = ({
  item,
  rootDisplayPath,
  hasDirectoryHandle = false,
  onClose,
  onDownloadAndSave,
  onBrowserDownloadOnly,
}) => {
  if (!item) return null;

  const [selectedVols, setSelectedVols] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    item.availableNewVolumes.forEach((v) => {
      initial[v.volume] = true;
    });
    return initial;
  });

  const [activeHostFilter, setActiveHostFilter] = useState<string>('all');
  const [selectedHostPerVolume, setSelectedHostPerVolume] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedLinks, setCopiedLinks] = useState(false);

  const toggleVolume = (vol: number) => {
    setSelectedVols((prev) => ({
      ...prev,
      [vol]: !prev[vol],
    }));
  };

  const handleSelectAll = (select: boolean) => {
    const next: Record<number, boolean> = {};
    item.availableNewVolumes.forEach((v) => {
      next[v.volume] = select;
    });
    setSelectedVols(next);
  };

  const selectedList = item.availableNewVolumes.filter((v) => selectedVols[v.volume]);

  // 全URLの一括コピー
  const handleCopyAllLinks = () => {
    const lines: string[] = [];
    selectedList.forEach((v) => {
      if (v.downloadLinks && v.downloadLinks.length > 0) {
        const preferred = activeHostFilter !== 'all' 
          ? v.downloadLinks.find(l => l.host === activeHostFilter) || v.downloadLinks[0]
          : v.downloadLinks[0];
        lines.push(preferred.url);
      } else if (v.downloadUrl) {
        lines.push(v.downloadUrl);
      }
    });

    if (lines.length > 0) {
      navigator.clipboard.writeText(lines.join('\n'));
      setCopiedLinks(true);
      setTimeout(() => setCopiedLinks(false), 2000);
    }
  };

  // 全URLを一括でブラウザの別タブで開く
  const handleOpenAllTabs = () => {
    selectedList.forEach((v) => {
      const targetUrl = v.downloadUrl || (v.downloadLinks?.[0]?.url);
      if (targetUrl) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    });
  };

  // 2パスDL実行 (Webアプリ内取得 → 最適フォルダ直接保存 or ブラウザDL保存)
  const handleExecute = async (browserOnly = false) => {
    if (selectedList.length === 0) return;
    setIsProcessing(true);
    try {
      const preparedList = selectedList.map((v) => {
        if (activeHostFilter !== 'all' && v.downloadLinks && v.downloadLinks.length > 0) {
          const preferred = v.downloadLinks.find((l) => l.host === activeHostFilter);
          if (preferred) {
            return { ...v, downloadUrl: preferred.url };
          }
        }
        return v;
      });
      if (browserOnly) {
        await onBrowserDownloadOnly(item, preparedList);
      } else {
        await onDownloadAndSave(item, preparedList);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const normalizedRoot = (rootDisplayPath || '').replace(/[\\/]+$/, '');
  const normalizedSub = (item.subFolderPath || '').replace(/^[\\/]+|[\\/]+$/g, '').replace(/\//g, '\\');
  const resolvedDestDisplay = [normalizedRoot, normalizedSub].filter(Boolean).join('\\') || item.subFolderPath;
  const fsStatus = getFileSystemAccessStatus();
  const inIframe = fsStatus.inIframe;
  const isSupported = fsStatus.supported;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
                新刊フィルター & 一括DLマネージャー
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                DL-RAW.SI 連携済
              </span>
            </div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {item.mangaTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* 現在の状況カード */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">所持最大巻数:</span>
              <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                第 {item.maxVolume} 巻
              </span>
            </div>
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-slate-400 shrink-0">保存先 (最適フォルダ):</span>
              <span className="font-mono text-cyan-300 truncate max-w-[360px]" title={resolvedDestDisplay}>
                {resolvedDestDisplay}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${hasDirectoryHandle ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span>
                  {hasDirectoryHandle
                    ? 'Webアプリ内で原本を取得した後、記憶している最適フォルダ以下に直接書き込み保存します'
                    : !isSupported
                      ? fsStatus.reason || `${fsStatus.browserHint}は直接フォルダ書き込み非対応のためブラウザのDL先へ保存されます`
                      : inIframe
                        ? 'プレビュー(iframe)制限中のためブラウザの標準ダウンロード先へ保存されます'
                        : 'フォルダ直接書き込み権限が未接続のためブラウザのダウンロード先へ保存されます（「PCフォルダ同期・直接保存」で直接保存可能）'}
                </span>
              </div>
              {!hasDirectoryHandle && isSupported && inIframe && (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold hover:bg-amber-500/30 transition"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>別タブで直接保存を有効化</span>
                </a>
              )}
            </div>
          </div>

          {/* ホストフィルター＆一括操作バー */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                優先ホスト:
              </span>
              {['all', 'leechtop', 'katfile', 'rapidgator', 'rosefile'].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setActiveHostFilter(h)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold uppercase transition ${
                    activeHostFilter === h
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyAllLinks}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
                title="全URLをクリップボードにコピー"
              >
                {copiedLinks ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                <span>{copiedLinks ? 'コピー完了' : 'URLコピー'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAllTabs}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
                title="ブラウザタブで全リンクを開く"
              >
                <ExternalLink className="w-3 h-3 text-amber-400" />
                <span>全開く</span>
              </button>
            </div>
          </div>

          {/* 新刊リスト選択 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                新刊巻数一覧 ({item.availableNewVolumes.length}冊)
              </span>
              <div className="text-xs space-x-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-indigo-400 hover:underline"
                >
                  すべて選択
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-slate-400 hover:underline"
                >
                  解除
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {item.availableNewVolumes.map((vol) => {
                const isChecked = !!selectedVols[vol.volume];
                const links = vol.downloadLinks && vol.downloadLinks.length > 0 ? vol.downloadLinks : [];

                return (
                  <div
                    key={vol.volume}
                    className={`p-3 rounded-xl border transition ${
                      isChecked
                        ? 'bg-indigo-950/30 border-indigo-500/50 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <label className="flex items-center gap-3 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleVolume(vol.volume)}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-900"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold flex items-center gap-2">
                            <span>第 {vol.volume} 巻</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                              .rar (DL-RAW正規形式)
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 truncate max-w-xs font-mono">
                            {vol.title || `${item.mangaTitle} 第${vol.volume}巻`}
                          </div>
                        </div>
                      </label>

                      {vol.articleUrl && (
                        <a
                          href={vol.articleUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 shrink-0"
                        >
                          <span>記事元</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* 抽出されたアップローダーリンク群 */}
                    {links.length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-semibold">DLリンク:</span>
                        {links.map((linkObj, lIdx) => (
                          <a
                            key={lIdx}
                            href={linkObj.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 text-[10px] font-mono transition"
                            title={linkObj.url}
                          >
                            <span>{linkObj.label || linkObj.host.toUpperCase()}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        ))}
                      </div>
                    ) : vol.downloadUrl ? (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 truncate">
                        <span className="text-slate-500">URL: </span>
                        <a href={vol.downloadUrl} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline">
                          {vol.downloadUrl}
                        </a>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* フッターアクション */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            選択中: <strong className="text-white font-bold">{selectedList.length}冊</strong>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              閉じる
            </button>

            {hasDirectoryHandle && (
              <button
                type="button"
                onClick={() => handleExecute(true)}
                disabled={isProcessing || selectedList.length === 0}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition disabled:opacity-40"
              >
                ブラウザDLのみ
              </button>
            )}

            <button
              type="button"
              onClick={() => handleExecute(false)}
              disabled={isProcessing || selectedList.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-40"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>2パスDL実行中...</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="w-4 h-4" />
                  <span>
                    {hasDirectoryHandle
                      ? `選択した ${selectedList.length} 冊を最適フォルダへ直接保存`
                      : `選択した ${selectedList.length} 冊をWebアプリでDL → ブラウザ保存`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
