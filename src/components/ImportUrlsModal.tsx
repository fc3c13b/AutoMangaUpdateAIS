import React, { useState, useRef } from 'react';
import { LocalMangaItem } from '../types';
import { X, Link2, Download, Check, AlertCircle, FileText, HardDrive, Upload, Layers } from 'lucide-react';
import { copyLocalFileChunked } from '../utils/fileSystem';

interface ImportUrlsModalProps {
  items: LocalMangaItem[];
  onClose: () => void;
  onImportAndSave: (targetItem: LocalMangaItem, volumes: Array<{ volume: number; url: string; host: string }>) => Promise<void>;
}

export const ImportUrlsModal: React.FC<ImportUrlsModalProps> = ({
  items,
  onClose,
  onImportAndSave,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'local_file'>('url');
  const [selectedMangaId, setSelectedMangaId] = useState<string>(items[0]?.id || '');
  const [rawText, setRawText] = useState('');
  const [parsedList, setParsedList] = useState<Array<{ url: string; host: string; volume: number }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [localFileProgress, setLocalFileProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedManga = items.find((i) => i.id === selectedMangaId) || items[0];

  const handleParse = async () => {
    if (!rawText.trim()) return;

    try {
      const res = await fetch('/api/parse-pasted-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          defaultTitle: selectedManga?.mangaTitle || '',
        }),
      });

      const data = await res.json();
      if (data.links) {
        setParsedList(data.links);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteUrls = async () => {
    if (!selectedManga || parsedList.length === 0) return;
    setIsProcessing(true);
    try {
      await onImportAndSave(selectedManga, parsedList);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setLocalFiles(Array.from(e.target.files));
    }
  };

  const handleExecuteLocalFiles = async () => {
    if (!selectedManga || localFiles.length === 0) return;
    if (!selectedManga.directoryHandle) {
      alert('対象マンガのフォルダハンドルが存在しません。先に上部の「PCフォルダを選択」を行ってください。');
      return;
    }

    setIsProcessing(true);
    try {
      for (let i = 0; i < localFiles.length; i++) {
        const file = localFiles[i];
        // ファイル名から巻数を推定
        const volMatch = file.name.match(/(?:第\s*(\d+)\s*巻|v(?:ol)?\.?\s*(\d+)|_(\d+)[\._])/i);
        const volNum = volMatch ? parseInt(volMatch[1] || volMatch[2] || volMatch[3], 10) : selectedManga.maxVolume + 1;
        
        const ext = file.name.split('.').pop() || 'rar';
        const targetName = `${selectedManga.mangaTitle} 第${String(volNum).padStart(2, '0')}巻.${ext}`;

        setLocalFileProgress(`${file.name} を分割書き込み中 (${i + 1}/${localFiles.length})...`);
        
        await copyLocalFileChunked(selectedManga.directoryHandle, file, targetName, (received, total) => {
          setLocalFileProgress(`${targetName}: ${(received / (1024 * 1024)).toFixed(1)}MB / ${(total / (1024 * 1024)).toFixed(1)}MB 書込中...`);
        });
      }
      onClose();
    } catch (err: any) {
      alert(`保存エラー: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setLocalFileProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-white">
                実データ(数十MB)・DLリンク取り込み
              </h2>
              <p className="text-xs text-slate-400">
                DL用リンクの貼り付け、またはダウンロード済み実ファイル(.rar/.zip)の分割取り込み
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* タブ切り替え */}
        <div className="px-5 pt-4 flex gap-2 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'url'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            DL用URLリンク貼り付け
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('local_file')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'local_file'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>DL済み実ファイル (.rar/.zip) を直接取り込み</span>
          </button>
        </div>

        {/* 本文 */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* マンガ選択 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              対象のマンガを選択:
            </label>
            <select
              value={selectedMangaId}
              onChange={(e) => setSelectedMangaId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-semibold focus:outline-none focus:border-indigo-500"
            >
              {items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.mangaTitle} (現在最大: 第{m.maxVolume}巻) - {m.subFolderPath}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'url' ? (
            <>
              {/* テキストエリア */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    DL用リンクURLを貼り付け (複数行対応):
                  </span>
                  <button
                    type="button"
                    onClick={handleParse}
                    className="text-indigo-400 hover:underline font-semibold"
                  >
                    URLと巻数を解析
                  </button>
                </div>
                <textarea
                  rows={5}
                  placeholder="https://katfile.com/xxxx/呪術廻戦_第28巻.rar&#10;https://rapidgator.net/file/xxxx/SPY_FAMILY_第14巻.zip"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 解析結果一覧 */}
              {parsedList.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>解析されたURL ({parsedList.length}件):</span>
                    <span className="text-[11px] text-slate-500">
                      現在の最大巻数: 第{selectedManga?.maxVolume || 0}巻
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {parsedList.map((item, idx) => {
                      const isNew = item.volume > (selectedManga?.maxVolume || 0);
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                            isNew
                              ? 'bg-amber-950/20 border-amber-500/30 text-slate-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px]">
                              {item.host.toUpperCase()}
                            </span>
                            <span className="font-bold text-white">
                              第{item.volume > 0 ? item.volume : '?'}巻
                            </span>
                            <span className="text-slate-500 truncate font-mono text-[11px]">
                              {item.url}
                            </span>
                          </div>
                          {isNew && (
                            <span className="shrink-0 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              新刊！
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".rar,.zip,.cbz"
                className="hidden"
                onChange={handleSelectFiles}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-950 transition flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200">
                    ダウンロード済みの .rar / .zip ファイルを選択
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    KatfileやRapidgatorから保存した数十MBの実ファイルを選択できます
                  </p>
                </div>
              </div>

              {localFiles.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-300">
                    選択されたファイル ({localFiles.length}件):
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {localFiles.map((f, i) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs flex justify-between">
                        <span className="text-slate-200 truncate">{f.name}</span>
                        <span className="text-slate-500 font-mono text-[11px] shrink-0">
                          {(f.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {localFileProgress && (
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-cyan-300 font-mono">
                  {localFileProgress}
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            閉じる
          </button>

          {activeTab === 'url' ? (
            <button
              type="button"
              onClick={handleExecuteUrls}
              disabled={isProcessing || parsedList.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-40"
            >
              <HardDrive className="w-4 h-4" />
              <span>PCフォルダへ分割保存実行</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExecuteLocalFiles}
              disabled={isProcessing || localFiles.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-40"
            >
              <HardDrive className="w-4 h-4" />
              <span>PCフォルダへ分割ストリーム書き込み</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
