import React, { useState } from 'react';
import { AppSettings } from '../types';
import { X, Save, Globe, HardDrive, Cpu, Sliders, Check, HelpCircle } from 'lucide-react';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* ヘッダー */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              連携・動作設定
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* AI Studio 別PJ "MangaDLfromDL-RAW.SI" URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-cyan-400" />
                別PJ "MangaDLfromDL-RAW.SI" のURL
              </span>
              <span className="text-[10px] text-slate-500 font-normal">任意 / 省略時は内部DL-RAW検索</span>
            </label>
            <input
              type="url"
              placeholder="https://ais-dev-xxxx.run.app"
              value={formData.customProjectUrl}
              onChange={(e) => setFormData({ ...formData, customProjectUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              AI Studioの別プロジェクトで作成されたダウンロードツールのURLを指定すると、そのアプリの検索APIへ「hogehoge」を連携します。
            </p>
          </div>

          {/* 検索ソース */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 block">
              新刊検索ソースの動作モード
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, searchSource: 'both' })}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition ${
                  formData.searchSource === 'both'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                自動優先 (両方)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, searchSource: 'custom_project' })}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition ${
                  formData.searchSource === 'custom_project'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                別PJのみ
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, searchSource: 'dl_raw_direct' })}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition ${
                  formData.searchSource === 'dl_raw_direct'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                DL-RAW直接
              </button>
            </div>
          </div>

          {/* 保存フォーマット */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 block">
              保存ファイル形式 (拡張子)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, downloadFormat: 'rar' })}
                className={`p-2 rounded-xl border text-xs font-semibold transition ${
                  formData.downloadFormat === 'rar'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                .rar (DL-RAW標準)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, downloadFormat: 'cbz' })}
                className={`p-2 rounded-xl border text-xs font-semibold transition ${
                  formData.downloadFormat === 'cbz'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                .cbz (ビューア用)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, downloadFormat: 'zip' })}
                className={`p-2 rounded-xl border text-xs font-semibold transition ${
                  formData.downloadFormat === 'zip'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                .zip (汎用)
              </button>
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              ※ DL-RAW.SIの元配布ファイルは <strong>.rar</strong> です。Honeyviewなどの電子書籍ビューアで読む場合は <strong>.cbz</strong> が便利です（既存フォルダにファイルがある場合は自動追従）。
            </p>
          </div>

          {/* 対象パスプレフィックス表示 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              対象ルートパス (Windows)
            </label>
            <input
              type="text"
              value={formData.expectedPathPrefix}
              onChange={(e) => setFormData({ ...formData, expectedPathPrefix: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-400">
              スクリプト生成やパス解析の基準パスとして使用されます。
            </p>
          </div>

          {/* Real-Debrid API連携 (原本RARの高速直接DL用) */}
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-indigo-500/20">
            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-indigo-300">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Real-Debrid API キー (任意 / 原本RAR直接DL)
              </span>
              <span className="text-[10px] text-slate-500 font-normal">未設定時はLeechtop等を自動解決</span>
            </label>
            <input
              type="password"
              placeholder="APIキーを入力（例: rdt_xxxxxxxxxxxx）"
              value={formData.debridApiKey || ''}
              onChange={(e) => setFormData({ ...formData, debridApiKey: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              設定すると、Rapidgator/Katfile等のリンクを自動で直接高速ダウンロードリンクへ変換し、Webアプリ内キャッシュ経由でブラウザから保存できます。
            </p>
          </div>

          {/* オプションチェックボックス */}
          <div className="pt-2 space-y-2 border-t border-slate-800">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoSaveToFolder}
                onChange={(e) => setFormData({ ...formData, autoSaveToFolder: e.target.checked })}
                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
              />
              <span>新刊ダウンロード時に1冊ずつ2パス方式（Web内取得→ブラウザ個別保存）で処理する</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.mockSimulationFallback}
                onChange={(e) => setFormData({ ...formData, mockSimulationFallback: e.target.checked })}
                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
              />
              <span>外部API不通時に新刊シミュレーション（テストモード）を許可する</span>
            </label>
          </div>

          {/* ボタン */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              閉じる
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>保存しました</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>設定を保存</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
