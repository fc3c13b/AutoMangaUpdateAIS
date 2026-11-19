import React, { useRef, useState, useEffect } from 'react';
import { 
  FolderOpen, 
  FolderCheck, 
  Sparkles, 
  AlertCircle, 
  Layers, 
  FileArchive, 
  DownloadCloud, 
  CheckCircle2,
  HardDrive,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { getFileSystemAccessStatus } from '../utils/fileSystem';

interface FolderScannerProps {
  currentPath: string;
  rememberedRootName?: string;
  rememberedFolderCount?: number;
  hasDirectoryHandle?: boolean;
  totalTitles: number;
  totalFiles: number;
  newReleasesCount: number;
  isScanning: boolean;
  onPickDirectory: () => void;
  onRescanRemembered?: () => void;
  onClearFolderMemory?: () => void;
  onLoadSampleData: () => void;
  onManualFilesUpload: (files: FileList) => void;
  onImportDownloadedRarFiles?: (files: FileList) => void;
  onCheckAllNewReleases: () => void;
  onDownloadAllNewReleases: () => void;
  isCheckingNewReleases: boolean;
  onManualPathChange?: (newPath: string) => void;
}

export const FolderScanner: React.FC<FolderScannerProps> = ({
  currentPath,
  rememberedRootName,
  rememberedFolderCount = 0,
  hasDirectoryHandle = false,
  totalTitles,
  totalFiles,
  newReleasesCount,
  isScanning,
  onPickDirectory,
  onRescanRemembered,
  onClearFolderMemory,
  onLoadSampleData,
  onManualFilesUpload,
  onImportDownloadedRarFiles,
  onCheckAllNewReleases,
  onDownloadAllNewReleases,
  isCheckingNewReleases,
  onManualPathChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rarFileInputRef = useRef<HTMLInputElement>(null);
  const fsStatus = getFileSystemAccessStatus();
  const isSupported = fsStatus.supported;
  const inIframe = fsStatus.inIframe;
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [tempPath, setTempPath] = useState(currentPath);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);

  useEffect(() => {
    setTempPath(currentPath);
  }, [currentPath]);

  const handleFallbackClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onManualFilesUpload(e.target.files);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRarFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onImportDownloadedRarFiles) {
      onImportDownloadedRarFiles(e.target.files);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      {/* フォルダ選択バナー */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <HardDrive className="w-4 h-4" />
            </span>
            <span className="text-sm font-semibold text-slate-300">
              対象ディレクトリ:
            </span>
            {isEditingPath ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (onManualPathChange && tempPath.trim()) {
                    onManualPathChange(tempPath.trim());
                  }
                  setIsEditingPath(false);
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={tempPath}
                  onChange={(e) => setTempPath(e.target.value)}
                  className="text-xs bg-slate-950 px-2.5 py-1 rounded-md text-cyan-300 font-mono border border-indigo-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2 py-1 rounded bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-500 transition"
                >
                  決定
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingPath(false)}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[11px] hover:bg-slate-700 transition"
                >
                  取消
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                <code className="text-xs bg-slate-950 px-2.5 py-1 rounded-md text-cyan-300 font-mono border border-slate-800">
                  {currentPath || 'M:\\MangaS\\Manga\\manga 1st\\'}
                </code>
                {onManualPathChange && (
                  <button
                    type="button"
                    onClick={() => {
                      setTempPath(currentPath || 'M:\\MangaS\\Manga\\manga 1st\\');
                      setIsEditingPath(true);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 text-[10px] transition"
                    title="パスを手動編集"
                  >
                    ✏️ 編集
                  </button>
                )}
                {hasDirectoryHandle && onRescanRemembered && (
                  <button
                    type="button"
                    onClick={onRescanRemembered}
                    disabled={isScanning}
                    className="px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium transition disabled:opacity-50"
                    title="記憶しているフォルダをそのまま再スキャンします"
                  >
                    {isScanning ? '再スキャン中...' : '記憶フォルダを再スキャン'}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {rememberedRootName && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                <span className="text-slate-500">記憶フォルダ:</span>
                <strong className="text-cyan-300 font-mono">{rememberedRootName}</strong>
                {rememberedFolderCount > 0 && (
                  <span className="text-slate-400 font-mono">({rememberedFolderCount}サブフォルダ)</span>
                )}
              </span>
            )}
            <span className={`text-[11px] px-2 py-0.5 rounded border ${
              hasDirectoryHandle
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : !isSupported
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800/70 text-slate-400 border-slate-700'
            }`}>
              {hasDirectoryHandle
                ? '直接保存: ON (ダウンロードを最適サブフォルダへ自動配置)'
                : !isSupported
                  ? `直接保存: 非対応/無効 (${fsStatus.browserHint})`
                  : inIframe
                    ? '直接保存: プレビュー(iframe)制限中 — 新しいタブで開くと直接保存できます'
                    : '直接保存: 未接続 (「PCフォルダ同期・直接保存」で最適フォルダへ直接保存)'}
            </span>
            {!hasDirectoryHandle && inIframe && (
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition"
              >
                <ExternalLink className="w-3 h-3" />
                <span>新しいタブで開いて直接保存を有効化</span>
              </a>
            )}
            {rememberedRootName && onClearFolderMemory && (
              <button
                type="button"
                onClick={onClearFolderMemory}
                className="text-[11px] text-slate-500 hover:text-rose-300 underline transition"
              >
                記憶をリセット
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            形式: <code className="text-slate-300">manga 1st\"MangaTitle"\"hogehoge 第xx巻.cbz"</code> を自動検出・巻数解析します
          </p>
        </div>

        {/* コントロールボタン */}
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory="true"
            directory="true"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />

          <button
            onClick={onPickDirectory}
            disabled={isScanning}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
              isSupported && !inIframe
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 active:scale-[0.98]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/80'
            }`}
            title={
              isSupported
                ? 'File System Access APIでフォルダを選択し、直接書き込み保存を有効化 (M:\\MangaS\\Manga)'
                : fsStatus.reason || 'File System Access API非対応のブラウザです'
            }
          >
            <HardDrive className={`w-4 h-4 ${isSupported && !inIframe ? 'text-cyan-200' : 'text-amber-400'}`} />
            <span>
              {isScanning
                ? '同期中...'
                : isSupported
                  ? 'PCフォルダ同期・直接保存 (M:\\)'
                  : `PCフォルダ同期・直接保存 (${fsStatus.browserHint}非対応)`}
            </span>
          </button>

          <button
            onClick={handleFallbackClick}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
              inIframe || !isSupported
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 active:scale-[0.98]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80'
            }`}
            title="読取専用でフォルダを読み込み（保存先はブラウザ標準のダウンロード先になります）"
          >
            <FolderOpen className="w-4 h-4" />
            <span>フォルダ読み込み (読取専用)</span>
          </button>

          <input
            type="file"
            ref={rarFileInputRef}
            onChange={handleRarFilesChange}
            multiple
            accept=".rar,.cbz,.zip,.cbr"
            className="hidden"
          />

          <button
            onClick={() => {
              if (rarFileInputRef.current) {
                rarFileInputRef.current.value = '';
                rarFileInputRef.current.click();
              }
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-medium border border-indigo-500/40 transition"
            title="PCにダウンロード済みの原本RARファイル（複数可）を選択し、各タイトルフォルダへ自動振り分け保存"
          >
            <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>DL済みRARを自動仕分け</span>
          </button>

          <button
            onClick={onLoadSampleData}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/80 transition"
            title="サンプルマンガ（呪術廻戦、SPY×FAMILY等）で動作を試す"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>サンプルデータで確認</span>
          </button>
        </div>
      </div>

      {/* 直接保存モード案内バナー（未接続時のみ表示） */}
      {!hasDirectoryHandle && (
        <div className={`mt-4 rounded-xl px-4 py-3 border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          !isSupported || inIframe
            ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
            : 'bg-indigo-950/30 border-indigo-500/30 text-slate-300'
        }`}>
          <div className="flex items-start gap-2.5">
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${!isSupported || inIframe ? 'text-amber-400' : 'text-indigo-400'}`} />
            <div className="space-y-0.5 leading-relaxed">
              {!isSupported ? (
                <>
                  <div className="font-semibold text-amber-300">
                    現在の環境（{fsStatus.browserHint}）では直接フォルダ書き込みAPIが無効/非対応のため、ブラウザの標準DL先へ保存されます
                  </div>
                  <div className="text-[11px] text-amber-200/85">
                    {fsStatus.reason}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ※ そのままこのブラウザを使う場合は、ブラウザ設定の「ダウンロード前に各ファイルの保存先を確認する」をONにするか、上部の「同期スクリプト」をご利用ください。
                  </div>
                </>
              ) : inIframe ? (
                <>
                  <div className="font-semibold text-amber-300">
                    プレビュー画面（iframe内）ではブラウザ仕様により直接フォルダ書き込みがブロックされます
                  </div>
                  <div className="text-[11px] text-amber-200/80">
                    このままDLするとブラウザの標準ダウンロード先へ保存されます。「新しいタブで開く」後に「PCフォルダ同期・直接保存」を実行すると最適サブフォルダ配下へ直接保存できます。
                  </div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-slate-200">
                    直接フォルダ保存は未接続です（現在はブラウザのダウンロード先へ保存されます）
                  </div>
                  <div className="text-[11px] text-slate-400">
                    「PCフォルダ同期・直接保存 (M:\)」から保存先ルートフォルダを許可すると、以降のダウンロードはブラウザDLを使わず記憶した最適サブフォルダ配下へ直接書き込まれます。
                  </div>
                </>
              )}
            </div>
          </div>
          {!isSupported ? (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  setCopiedAppUrl(true);
                  setTimeout(() => setCopiedAppUrl(false), 2000);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition"
            >
              {copiedAppUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAppUrl ? 'URLをコピー済' : 'Chrome/Edge用にURLをコピー'}</span>
            </button>
          ) : inIframe ? (
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>新しいタブで開く</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={onPickDirectory}
              disabled={isScanning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shrink-0 transition disabled:opacity-50"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>直接保存を有効化</span>
            </button>
          )}
        </div>
      )}

      {/* 統計＆一括アクション */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{totalTitles}</div>
            <div className="text-[11px] font-medium text-slate-400">マンガタイトル数</div>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <FileArchive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{totalFiles}</div>
            <div className="text-[11px] font-medium text-slate-400">所持ファイル数 (.rar / .zip)</div>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${newReleasesCount > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'} flex items-center justify-center shrink-0`}>
            {newReleasesCount > 0 ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div>
            <div className={`text-xl font-bold ${newReleasesCount > 0 ? 'text-amber-400' : 'text-slate-200'} tracking-tight`}>
              {newReleasesCount}
            </div>
            <div className="text-[11px] font-medium text-slate-400">未所持の新刊巻数</div>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
          {newReleasesCount > 0 ? (
            <div className="w-full flex flex-col gap-1.5">
              <button
                onClick={onDownloadAllNewReleases}
                className="w-full py-2 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 transition active:scale-[0.98]"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>
                  新刊 {newReleasesCount}冊を一括DL ({hasDirectoryHandle ? '最適フォルダへ保存' : 'ブラウザ保存'})
                </span>
              </button>
              <button
                onClick={onCheckAllNewReleases}
                disabled={isCheckingNewReleases}
                className="w-full py-1 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 flex items-center justify-center gap-1 transition disabled:opacity-40"
                title="DL-RAWの新刊情報を再検索して更新"
              >
                <FolderCheck className={`w-3 h-3 ${isCheckingNewReleases ? 'animate-spin text-indigo-400' : ''}`} />
                <span>{isCheckingNewReleases ? '再検索中...' : 'DL-RAW再検索'}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onCheckAllNewReleases}
              disabled={isCheckingNewReleases || totalTitles === 0}
              className="w-full h-full py-2 px-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 font-semibold text-xs flex flex-col items-center justify-center gap-1 transition disabled:opacity-40"
            >
              <FolderCheck className={`w-4 h-4 ${isCheckingNewReleases ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{isCheckingNewReleases ? '新刊検索中...' : 'DL-RAW一括検索'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
