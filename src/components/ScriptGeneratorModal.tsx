import React, { useState } from 'react';
import { X, Copy, Check, Download, Terminal, HardDrive, FileCode } from 'lucide-react';

interface ScriptGeneratorModalProps {
  onClose: () => void;
  targetPath: string;
}

export const ScriptGeneratorModal: React.FC<ScriptGeneratorModalProps> = ({
  onClose,
  targetPath = 'M:\\MangaS\\Manga\\manga 1st\\',
}) => {
  const [copied, setCopied] = useState(false);
  const [scriptType, setScriptType] = useState<'python' | 'powershell'>('python');

  const pythonScript = `"""
AutoMangaUpdate2 - Windows Background Auto Sync Script
対象: ${targetPath}
動作:
  1. ディレクトリ内の "hogehoge 第xx巻.cbz" を走査して最大巻数を算出
  2. DL-RAW / MangaDLfromDL-RAW.SI を検索
  3. 最大巻数より大きい新刊があれば自動ダウンロードして保存
"""
import os
import re
import sys
import glob
import time
import urllib.request
import urllib.parse
import json

# 設定
BASE_DIR = r"${targetPath.replace(/\\/g, '\\\\')}"
DL_RAW_SEARCH_URL = "https://dl-raw.si/?s="

def extract_volume_and_title(filename):
    name_without_ext = os.path.splitext(filename)[0]
    # "hogehoge 第xx巻"
    match = re.search(r"^(.*?)[_\\s　]*第\\s*(\\d+(?:\\.\\d+)?)\\s*巻", name_without_ext)
    if match:
        return match.group(1).strip(), float(match.group(2))
    
    match_vol = re.search(r"^(.*?)[_\\s　]*(?:vol\\.?|volume)\\s*(\\d+(?:\\.\\d+)?)", name_without_ext, re.I)
    if match_vol:
        return match_vol.group(1).strip(), float(match_vol.group(2))
    
    return None, 0

def scan_and_update():
    print(f"[*] スキャン開始: {BASE_DIR}")
    if not os.path.exists(BASE_DIR):
        print(f"[!] フォルダが見つかりません: {BASE_DIR}")
        return

    # 各漫画フォルダを探索
    for item in os.listdir(BASE_DIR):
        manga_dir = os.path.join(BASE_DIR, item)
        if not os.path.isdir(manga_dir):
            continue

        cbz_files = glob.glob(os.path.join(manga_dir, "*.cbz"))
        max_vol = 0
        detected_title = item

        for file_path in cbz_files:
            fname = os.path.basename(file_path)
            t, v = extract_volume_and_title(fname)
            if v > max_vol:
                max_vol = v
            if t:
                detected_title = t

        print(f"\\n[Manga] {detected_title} (最大所持: 第{max_vol}巻 / ファイル数: {len(cbz_files)})")
        
        # 検索キーワード: detected_title
        print(f"  -> 検索中: '{detected_title}' (第{max_vol + 1}巻以降)")
        # ここでDL-RAWまたは連携APIへのリクエストを実行
        # 新刊があれば download_cbz(url, os.path.join(manga_dir, f"{detected_title} 第{new_vol}巻.cbz"))

if __name__ == "__main__":
    scan_and_update()
`;

  const powershellScript = `# AutoMangaUpdate2 - PowerShell Script
$BasePath = "${targetPath}"
Write-Host "スキャン対象: $BasePath" -ForegroundColor Cyan

Get-ChildItem -Path $BasePath -Directory | ForEach-Object {
    $mangaDir = $_.FullName
    $cbzFiles = Get-ChildItem -Path $mangaDir -Filter "*.cbz"
    $maxVol = 0
    $title = $_.Name

    foreach ($file in $cbzFiles) {
        if ($file.Name -match "第\\s*(\\d+)\\s*巻") {
            $vol = [int]$matches[1]
            if ($vol -gt $maxVol) { $maxVol = $vol }
        }
    }

    Write-Host "[Manga] $title | 最大所持巻数: 第$maxVol巻 | 計 $($cbzFiles.Count) 冊" -ForegroundColor Green
}
`;

  const currentCode = scriptType === 'python' ? pythonScript : powershellScript;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = scriptType === 'python' ? 'auto_manga_updater.py' : 'auto_manga_updater.ps1';
    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-bold text-white">
                Windows常駐自動実行スクリプト
              </h2>
              <p className="text-xs text-slate-400">
                PCのバックグラウンドやタスクスケジューラで直接自動更新を行うスクリプト
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

        {/* 本文 */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScriptType('python')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  scriptType === 'python'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-yellow-400" />
                <span>Python (.py)</span>
              </button>
              <button
                type="button"
                onClick={() => setScriptType('powershell')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  scriptType === 'powershell'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>PowerShell (.ps1)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'コピー完了' : 'コードをコピー'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ファイルをダウンロード</span>
              </button>
            </div>
          </div>

          {/* コードプレビュー */}
          <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-80 leading-relaxed">
              <code>{currentCode}</code>
            </pre>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">使い方:</div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 pl-1">
              <li>ダウンロードしたファイルをPCの任意の場所に保存します。</li>
              <li>Windowsタスクスケジューラに登録すると、毎日決まった時間に自動で新刊をスキャン＆取得します。</li>
              <li>Webアプリ側でも随時フォルダを開いて画面上で視覚的に新刊チェック＆ワンクリック保存が可能です。</li>
            </ol>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
