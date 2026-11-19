import React, { useState, useEffect } from 'react';
import { Play, Square, Pause, RotateCcw, Settings2, Sliders, ArrowRight, Sparkles, AlertCircle, ExternalLink, Globe } from 'lucide-react';
import { CrawlSettings, ScraperState, Checkpoint } from '../types';

interface CrawlConsoleProps {
  state: ScraperState | null;
  checkpoint: Checkpoint | null;
  previousCheckpoint?: Checkpoint | null;
  activeCategory: 'manga' | 'magazine';
  onCategoryChange: (category: 'manga' | 'magazine') => void;
  onStart: (settings: CrawlSettings) => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset?: () => void;
  onClearDb: () => void;
}

export const CrawlConsole: React.FC<CrawlConsoleProps> = ({
  state,
  checkpoint,
  previousCheckpoint,
  activeCategory,
  onCategoryChange,
  onStart,
  onStop,
  onPause,
  onResume,
  onReset,
  onClearDb,
}) => {
  const prevCp = previousCheckpoint || checkpoint?.previous || null;
  const [startPage, setStartPage] = useState<number | string>(activeCategory === 'manga' ? 2150 : 1);
  const [maxPages, setMaxPages] = useState<number | string>(activeCategory === 'manga' ? 2150 : 100);
  const [waitMs, setWaitMs] = useState<number | string>(1500);
  const [stopOnCheckpoint, setStopOnCheckpoint] = useState<boolean>(false);
  const [mode, setMode] = useState<'live' | 'simulation'>('live');
  const [baseUrl, setBaseUrl] = useState<string>(`https://dl-raw.si/category/${activeCategory}`);
  const [targetUrlInput, setTargetUrlInput] = useState<string>(`https://dl-raw.si/category/${activeCategory}/page/${activeCategory === 'manga' ? 2150 : 1}/`);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [forceUnlocked, setForceUnlocked] = useState<boolean>(false);

  const isRunning = !forceUnlocked && state?.status === 'running';
  const isPaused = !forceUnlocked && state?.status === 'paused';

  // Last known crawled page
  const lastPage = state?.currentPage || 1;

  const buildEffectiveUrl = (base: string, page: number | string, cat: string = activeCategory) => {
    let b = (base || `https://dl-raw.si/category/${cat}`).trim().replace(/\/page\/\d+\/?$/, '').replace(/\/+$/, '');
    const p = Math.max(1, parseInt(String(page), 10) || 1);
    return `${b}/page/${p}/`;
  };

  const handleSwitchCategory = (newCat: 'manga' | 'magazine') => {
    if (isRunning) return;
    onCategoryChange(newCat);
    const newBase = `https://dl-raw.si/category/${newCat}`;
    setBaseUrl(newBase);
    const curPage = Math.max(1, parseInt(String(startPage), 10) || (newCat === 'manga' ? 2150 : 1));
    setTargetUrlInput(`${newBase}/page/${curPage}/`);
  };

  const handleTargetUrlChange = (inputVal: string) => {
    setTargetUrlInput(inputVal);
    const trimmed = inputVal.trim();

    // Auto-switch category based on entered URL
    if (trimmed.includes('/category/magazine')) {
      if (activeCategory !== 'magazine') {
        onCategoryChange('magazine');
      }
    } else if (trimmed.includes('/category/manga')) {
      if (activeCategory !== 'manga') {
        onCategoryChange('manga');
      }
    }

    const pageMatch = trimmed.match(/\/page\/(\d+)\/?$/);
    if (pageMatch) {
      const p = parseInt(pageMatch[1], 10);
      const cleanBase = trimmed.replace(/\/page\/\d+\/?$/, '').replace(/\/+$/, '');
      setBaseUrl(cleanBase);
      setStartPage(p);
      const curMax = parseInt(String(maxPages), 10) || 1;
      if (curMax < p) setMaxPages(p);
    } else {
      const cleanBase = trimmed.replace(/\/+$/, '');
      if (cleanBase) {
        setBaseUrl(cleanBase);
      }
    }
  };

  const handleApplyPresetUrl = (url: string) => {
    handleTargetUrlChange(url);
  };

  const handleStartPageChange = (val: number | string) => {
    setStartPage(val);
    if (val !== '') {
      const p = Math.max(1, parseInt(String(val), 10) || 1);
      setTargetUrlInput(buildEffectiveUrl(baseUrl, p, activeCategory));
    }
  };

  // Sync settings when scraper is idle or completed
  useEffect(() => {
    if (state?.status === 'stopped' || state?.status === 'completed' || state?.status === 'idle') {
      setForceUnlocked(false);
    }
  }, [state?.status]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    setForceUnlocked(false);
    const sp = Math.max(1, parseInt(String(startPage), 10) || 1);
    const mp = Math.max(sp, parseInt(String(maxPages), 10) || sp);
    onStart({
      category: activeCategory,
      baseUrl: baseUrl || `https://dl-raw.si/category/${activeCategory}`,
      startPage: sp,
      maxPages: mp,
      waitMs: Math.max(200, parseInt(String(waitMs), 10) || 1500),
      stopOnCheckpoint,
      mode,
    });
  };

  const handleStopWithUnlock = () => {
    onStop();
    setForceUnlocked(true);
  };

  const handleResumeFromCurrent = (page: number) => {
    handleStartPageChange(page);
    const currentMax = parseInt(String(maxPages), 10) || 2150;
    if (currentMax <= page) {
      setMaxPages(page + 500);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">巡回クロール設定 & 実行</h2>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              クロール実行中 (現在: P.{state?.currentPage || '?'})
            </span>
          )}
          {state?.status === 'stopped' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              P.{lastPage} で停止中
            </span>
          )}
          {state?.status === 'completed' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              完了 (到達: P.{lastPage})
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            {showAdvanced ? '詳細設定を閉じる' : '詳細オプション'}
          </button>
        </div>
      </div>

      {/* Resume from interrupted page suggestion banner */}
      {lastPage > 1 && !isRunning && (
        <div className="mb-4 p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-indigo-900 font-medium">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              直近の到達ページは <strong>P.{lastPage}</strong> です。ここから続きを巡回しますか？
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleResumeFromCurrent(lastPage)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold transition-colors shadow-xs"
            >
              P.{lastPage} から再開設定にする
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleStart}>
        {/* Category Switch (manga / magazine) */}
        <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-amber-50/70 border border-slate-200/90 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <span>カテゴリー切り替えSW (Category Switch):</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              選択したカテゴリーに応じて巡回URLおよび保存先カテゴリーが自動的に分離されます
            </p>
          </div>

          <div className="inline-flex p-1 bg-white border border-slate-300 rounded-lg shadow-inner">
            <button
              type="button"
              id="switch-manga"
              disabled={isRunning}
              onClick={() => handleSwitchCategory('manga')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeCategory === 'manga'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              📚 manga (漫画)
            </button>
            <button
              type="button"
              id="switch-magazine"
              disabled={isRunning}
              onClick={() => handleSwitchCategory('magazine')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeCategory === 'magazine'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              📰 magazine (雑誌)
            </button>
          </div>
        </div>

        {/* Search URL Input & Presets */}
        <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span>検索・巡回URL (Search URL)</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                activeCategory === 'manga' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {activeCategory === 'manga' ? 'manga カテゴリー' : 'magazine カテゴリー'}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <a
                href={buildEffectiveUrl(baseUrl, startPage, activeCategory)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 font-medium bg-white px-2 py-0.5 rounded border border-indigo-200 shadow-2xs"
                title="ブラウザで実際の巡回対象URLを確認"
              >
                実際のURLを開く
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              value={targetUrlInput}
              onChange={(e) => handleTargetUrlChange(e.target.value)}
              disabled={isRunning}
              placeholder={
                activeCategory === 'manga'
                  ? 'https://dl-raw.si/category/manga/page/2150/'
                  : 'https://dl-raw.si/category/magazine/page/1/'
              }
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 text-slate-900 shadow-inner"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-0.5">
            <span className="text-slate-500 font-medium">プリセットURL:</span>
            {activeCategory === 'manga' ? (
              <>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleApplyPresetUrl('https://dl-raw.si/category/manga/page/2150/')}
                  className={`px-2 py-0.5 rounded transition-colors font-semibold ${
                    targetUrlInput.includes('/category/manga/page/2150')
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  ★ Manga P.2150 (最終・最古)
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleApplyPresetUrl('https://dl-raw.si/category/manga/page/1/')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    targetUrlInput.endsWith('/category/manga/page/1/') || targetUrlInput.endsWith('/category/manga/')
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Manga P.1 (新着最新)
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleApplyPresetUrl('https://dl-raw.si/category/magazine/page/1/')}
                  className={`px-2 py-0.5 rounded transition-colors font-semibold ${
                    targetUrlInput.endsWith('/category/magazine/page/1/') || targetUrlInput.endsWith('/category/magazine/')
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  ★ Magazine P.1 (新着最新)
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleApplyPresetUrl('https://dl-raw.si/category/magazine/page/50/')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    targetUrlInput.includes('/category/magazine/page/50')
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Magazine P.50
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleApplyPresetUrl('https://dl-raw.si/category/magazine/page/100/')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    targetUrlInput.includes('/category/magazine/page/100')
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Magazine P.100
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Target Start Page */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              巡回開始ページ (Start Page)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="99999"
                value={startPage}
                onChange={(e) => handleStartPageChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                onBlur={() => {
                  if (startPage === '' || Number(startPage) < 1) handleStartPageChange(1);
                }}
                disabled={isRunning}
                placeholder="2150 や 1 など"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 text-slate-900 font-bold"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400">Page</span>
            </div>
            <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[11px]">
              <span className="text-slate-400">クイック:</span>
              {activeCategory === 'manga' ? (
                <>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleStartPageChange(2150)}
                    className="text-indigo-700 font-bold px-1.5 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200"
                    title="Mangaカテゴリ最終ページ 2150P"
                  >
                    2150P (最終)
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleStartPageChange(1)}
                    className="text-indigo-600 hover:underline px-1 py-0.5 rounded hover:bg-indigo-50"
                  >
                    1P (最新)
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleStartPageChange(1000)}
                    className="text-indigo-600 hover:underline px-1 py-0.5 rounded hover:bg-indigo-50"
                  >
                    1000P
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleStartPageChange(2000)}
                    className="text-indigo-600 hover:underline px-1 py-0.5 rounded hover:bg-indigo-50"
                  >
                    2000P
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleStartPageChange(1)}
                    className="text-amber-700 font-bold px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200"
                    title="Magazineカテゴリ先頭ページ 1P"
                  >
                    1P (最新)
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleStartPageChange(10)}
                    className="text-amber-700 hover:underline px-1 py-0.5 rounded hover:bg-amber-50"
                  >
                    10P
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleStartPageChange(50)}
                    className="text-amber-700 hover:underline px-1 py-0.5 rounded hover:bg-amber-50"
                  >
                    50P
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleStartPageChange(100)}
                    className="text-amber-700 hover:underline px-1 py-0.5 rounded hover:bg-amber-50"
                  >
                    100P
                  </button>
                </>
              )}
              {lastPage > 1 && (
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleStartPageChange(lastPage)}
                  className="text-slate-700 font-bold px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300"
                  title={`直近停止ページ ${lastPage}P をセット`}
                >
                  {lastPage}P
                </button>
              )}
            </div>
          </div>

          {/* Target Max Page */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              巡回終了ページ (Max Page)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="99999"
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                onBlur={() => {
                  if (maxPages === '' || Number(maxPages) < 1) setMaxPages(2150);
                }}
                disabled={isRunning}
                placeholder="2150 や 3300 など"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 text-slate-900 font-bold"
              />
              <span className="absolute right-3 top-2.5 text-xs text-indigo-600 font-medium">Page</span>
            </div>
            <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[11px]">
              <span className="text-slate-400">プリセット:</span>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setMaxPages(2150)}
                className="text-indigo-700 font-bold px-1.5 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200"
              >
                2150P (Manga最終)
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setMaxPages(2200)}
                className="text-indigo-600 hover:underline px-1 py-0.5 rounded hover:bg-indigo-50"
              >
                2200Pまで
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setMaxPages(3300)}
                className="text-indigo-600 hover:underline px-1 py-0.5 rounded hover:bg-indigo-50 font-bold"
              >
                全ページ(3300P)
              </button>
            </div>
          </div>

          {/* Wait Interval */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              アクセス待機間隔 (WAIT)
            </label>
            <div className="relative">
              <input
                type="number"
                step="100"
                min="200"
                max="10000"
                value={waitMs}
                onChange={(e) => setWaitMs(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                onBlur={() => {
                  if (waitMs === '' || Number(waitMs) < 200) setWaitMs(1500);
                }}
                disabled={isRunning}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 text-slate-900"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400">ミリ秒 (ms)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              現在: {((Number(waitMs) || 1500) / 1000).toFixed(1)}秒 待機 (ブロック防止)
            </p>
          </div>

          {/* Incremental Checkpoint Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              チェックポイント差分判定
            </label>
            <div className="pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stopOnCheckpoint}
                  onChange={(e) => setStopOnCheckpoint(e.target.checked)}
                  disabled={isRunning}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-800 font-semibold">
                  既知作品で自動停止
                </span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {stopOnCheckpoint ? (
                <span className="text-amber-700 font-medium">ON (過去データ遭遇で自動停止)</span>
              ) : (
                <span className="text-emerald-700 font-medium">OFF (指定範囲を全て強制巡回)</span>
              )}
            </p>
          </div>
        </div>

        {/* Notice about checkpoint vs continuous crawl */}
        {stopOnCheckpoint && (
          <div className="mb-4 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1.5">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>差分停止モード有効:</strong> 巡回中に過去取得済みのチェックポイントに出会うと自動停止します。
                途中で停止させずに指定した終了ページまで全て巡回したい場合は、<strong>「既知作品で自動停止」のチェックを外してOFF</strong>にしてください。
              </div>
            </div>

            {(prevCp || checkpoint) && (
              <div className="p-2 bg-white/80 rounded-lg border border-amber-200 text-[11px] flex flex-wrap items-center gap-2">
                <span className="font-bold text-amber-800">
                  {prevCp ? '🛑 停止ターゲット（一つ前の最新タイトル）:' : '🛑 停止ターゲット（現在保存中CP）:'}
                </span>
                <span className="font-semibold text-slate-900">
                  {prevCp ? `${prevCp.title} (${prevCp.displayVolume || prevCp.maxVolume + '巻'})` : `${checkpoint?.title} (${checkpoint?.displayVolume || checkpoint?.maxVolume + '巻'})`}
                </span>
                {prevCp && checkpoint && prevCp.title !== checkpoint.title && (
                  <span className="text-slate-500 text-[10px]">
                    (※最新CP: {checkpoint.title})
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 mb-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  対象ベースURL (Base URL)
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  disabled={isRunning}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  取得モード (Fetch Mode)
                </label>
                <div className="flex items-center gap-4 mt-1.5">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="crawlMode"
                      value="live"
                      checked={mode === 'live'}
                      onChange={() => setMode('live')}
                      disabled={isRunning}
                      className="text-indigo-600"
                    />
                    <span>実サイト巡回 (Live + フォールバック)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="crawlMode"
                      value="simulation"
                      checked={mode === 'simulation'}
                      onChange={() => setMode('simulation')}
                      disabled={isRunning}
                      className="text-indigo-600"
                    />
                    <span>テストシミュレーション (10P/200件)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            {!isRunning && !isPaused ? (
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-white" />
                クロール開始 (ページ {startPage || 1} 〜 {maxPages || 1000})
              </button>
            ) : (
              <>
                {isRunning ? (
                  <button
                    type="button"
                    onClick={onPause}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition-all"
                  >
                    <Pause className="w-4 h-4" />
                    一時停止
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onResume}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-all"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    再開する
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStopWithUnlock}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-sm transition-all active:scale-[0.98]"
                >
                  <Square className="w-4 h-4 fill-white" />
                  停止 (Stop)
                </button>
              </>
            )}

            {/* Unlock button if ever stuck */}
            {isRunning && (
              <button
                type="button"
                onClick={() => setForceUnlocked(true)}
                title="入力欄のロックを解除して設定を変更できるようにします"
                className="inline-flex items-center gap-1 px-3 py-2 text-xs text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                設定変更を許可
              </button>
            )}

            {onReset && (
              <button
                type="button"
                onClick={onReset}
                title="クロール状態を強制的に待機状態へ戻します"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                状態リセット
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={onClearDb}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              データ全消去
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
