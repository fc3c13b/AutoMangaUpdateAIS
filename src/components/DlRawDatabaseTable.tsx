import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  Upload,
  BookOpen,
  ArrowUpDown,
  ExternalLink,
  Trash2,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { MangaItem } from '../types';

interface DlRawDatabaseTableProps {
  refreshKey?: number;
  onDeleteItem?: (id: string) => void;
  onSelectItem: (item: MangaItem) => void;
  onSetCheckpoint?: (item: MangaItem) => void;
  onExport: (format: 'json' | 'csv') => void;
  onImportSuccess?: () => void;
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const DlRawDatabaseTable: React.FC<DlRawDatabaseTableProps> = ({
  refreshKey = 0,
  onDeleteItem,
  onSelectItem,
  onSetCheckpoint,
  onExport,
  onImportSuccess,
  showNotification,
}) => {
  const [items, setItems] = useState<MangaItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalAll, setTotalAll] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'volume-desc' | 'volume-asc' | 'updated-desc' | 'title-asc' | 'updated-asc'>('updated-desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Categories list
  const categoryFilters = [
    { id: 'all', label: 'すべて' },
    { id: 'manga', label: '📚 漫画 (manga)' },
    { id: 'magazine', label: '📰 雑誌 (magazine)' },
  ];

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch manga data from server with pagination & filters
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        sort: sortBy,
      });

      if (debouncedQuery.trim()) {
        params.set('q', debouncedQuery.trim());
      }
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }

      const res = await fetch(`/api/manga?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setItems(data.items || []);
        setTotalCount(data.total || 0);
        setTotalAll(data.totalAll || data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (e) {
      console.error('Failed to load manga page:', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, debouncedQuery, selectedCategory, sortBy]);

  // Refetch when filters or refreshKey changes
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Reset page when category or sort changes
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  const handleSortChange = (sort: any) => {
    setSortBy(sort);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('この作品データを削除しますか？')) return;

    try {
      const res = await fetch(`/api/manga/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showNotification('作品を削除しました', 'info');
        fetchData();
        if (onDeleteItem) onDeleteItem(id);
      }
    } catch (e: any) {
      showNotification(`削除エラー: ${e.message}`, 'error');
    }
  };

  // Import JSON file handler
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      showNotification(`ファイル "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)}MB) を読み込み・解析中...`, 'info');
      
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/import?mode=merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });

      const result = await res.json();
      if (result.success) {
        showNotification(result.message || 'インポートが完了しました', 'success');
        fetchData();
        if (onImportSuccess) onImportSuccess();
      } else {
        showNotification(result.error || 'インポートに失敗しました', 'error');
      }
    } catch (err: any) {
      showNotification(`インポートエラー: ${err.message}`, 'error');
    } finally {
      setIsImporting(false);
      e.target.value = ''; // Reset input
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'manga':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">漫画</span>;
      case 'magazine':
      case '雑誌':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">雑誌</span>;
      case '一般コミック':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">一般</span>;
      case '成年コミック':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">成年</span>;
      case 'Light Novel':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">ラノベ</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">{cat || '漫画'}</span>;
    }
  };

  const startIndex = (currentPage - 1) * pageSize;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header & Controls Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              抽出漫画タイトル & 最大巻数リスト
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
              {totalCount.toLocaleString()} 件
              {debouncedQuery || selectedCategory !== 'all' ? ` (全 ${totalAll.toLocaleString()} 件中)` : ''}
            </span>
            {isLoading && <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />}
          </div>

          {/* Export & Import */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchData()}
              disabled={isLoading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs transition-colors"
              title="リストを手動再読込"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => onExport('csv')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
              title="全件をCSV形式でダウンロード"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              CSV保存
            </button>

            <button
              onClick={() => onExport('json')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
              title="全件をJSON形式でダウンロード"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              JSON保存
            </button>

            <label
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors cursor-pointer ${
                isImporting ? 'opacity-50 pointer-events-none' : ''
              }`}
              title="保存済みのJSONファイルをインポート・統合"
            >
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {isImporting ? 'インポート中...' : 'JSONインポート (復元)'}
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          {/* Search box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="全34,000件以上からタイトル・作者・キーワードで高速検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="sm:col-span-4 flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {categoryFilters.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="sm:col-span-2 flex items-center justify-end gap-2">
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 font-medium"
            >
              <option value="updated-desc">更新が新しい順</option>
              <option value="volume-desc">最大巻数が多い順</option>
              <option value="volume-asc">最大巻数が少ない順</option>
              <option value="title-asc">タイトル50音順</option>
              <option value="updated-asc">登録が古い順</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      {totalCount === 0 && !isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">該当する漫画データはありません</p>
          <p className="text-xs text-slate-400 mt-1">
            {totalAll === 0
              ? '「クロール開始」を実行するか、「JSONインポート」でバックアップを読み込んでください。'
              : '検索条件やカテゴリを変更してください。'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto min-h-[320px]">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">漫画タイトル (正規化名)</th>
                <th className="py-3 px-3 w-28 text-center">抽出最大巻数</th>
                <th className="py-3 px-3 w-24">カテゴリ</th>
                <th className="py-3 px-4 hidden md:table-cell">最新投稿タイトル</th>
                <th className="py-3 px-3 w-28 hidden lg:table-cell">最終更新日時</th>
                <th className="py-3 px-3 w-20 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr
                  key={item.id || item.normalizedTitle || idx}
                  className="hover:bg-indigo-50/40 transition-colors group cursor-pointer"
                  onClick={() => onSelectItem(item)}
                >
                  <td className="py-3 px-4 text-center text-slate-400 text-xs font-mono">
                    {startIndex + idx + 1}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {item.title}
                      </span>
                      {item.author && (
                        <span className="text-xs text-slate-400 hidden sm:inline">
                          [{item.author}]
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                      {item.displayVolume || `第${item.maxVolume}巻`}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {getCategoryBadge(item.category)}
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-xs text-slate-500 max-w-[280px] truncate" title={item.latestPostTitle}>
                    {item.latestPostTitle}
                  </td>
                  <td className="py-3 px-3 hidden lg:table-cell text-xs text-slate-400 whitespace-nowrap">
                    {item.lastUpdatedAt ? new Date(item.lastUpdatedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      {onSetCheckpoint && (
                        <button
                          onClick={() => onSetCheckpoint(item)}
                          className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="この作品を巡回チェックポイントに設定"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <a
                        href={item.latestUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="元記事を開く"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={(e) => handleDelete(e, item.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalCount > 0 && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              表示中: <strong>{startIndex + 1}</strong>〜<strong>{Math.min(startIndex + pageSize, totalCount)}</strong> 件 / 全 <strong>{totalCount.toLocaleString()}</strong> 件
            </span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1">
              <span>表示件数:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium"
              >
                <option value={25}>25件</option>
                <option value={50}>50件</option>
                <option value={100}>100件</option>
                <option value={200}>200件</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1 || isLoading}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="最初のページ"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="前のページ"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-semibold text-slate-700">
              {currentPage} / {totalPages} ページ
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || isLoading}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="次のページ"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || isLoading}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="最後のページ"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
