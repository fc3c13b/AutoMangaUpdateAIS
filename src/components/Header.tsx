import React from 'react';
import { BookOpen, FolderSync, Settings, Terminal, RefreshCw, HardDrive } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenScriptModal: () => void;
  onOpenImportModal: () => void;
  isScanning: boolean;
  onRefreshAll: () => void;
  hasItems: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenScriptModal,
  onOpenImportModal,
  isScanning,
  onRefreshAll,
  hasItems,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                AutoMangaUpdate2
              </h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v0.2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              M:\MangaS\Manga 自動スキャン & 最大巻数判定 ➜ DL-RAW新刊一括取得
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {hasItems && (
            <button
              onClick={onRefreshAll}
              disabled={isScanning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition disabled:opacity-50"
              title="全タイトル新刊一括チェック"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-indigo-400' : ''}`} />
              <span className="hidden md:inline">全件新刊チェック</span>
            </button>
          )}

          <button
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-medium transition"
            title="別PJ取得URLや外部リンクの一括取り込み"
          >
            <FolderSync className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">DLリンク貼付け</span>
          </button>

          <button
            onClick={onOpenScriptModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            title="Windows常駐スクリプト (M:\MangaS\Manga用)"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Windows常駐スクリプト</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            title="設定 (別PJ URL, DL-RAW設定)"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">設定</span>
          </button>
        </div>
      </div>
    </header>
  );
};
