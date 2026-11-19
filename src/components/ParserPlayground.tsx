import React, { useState } from 'react';
import { Sparkles, Code, CheckCircle, ArrowRight } from 'lucide-react';
import { parsePostTitle, ParseResult } from '../utils/parser';

export const ParserPlayground: React.FC = () => {
  const sampleTitles = [
    '[一般コミック] 葬送のフリーレン 第01-13巻 [Sousou no Frieren vol 01-13]',
    '[成年コミック] [武田弘光] マケン姫っ!外伝 第02巻',
    '[Light Novel] 転生したらスライムだった件 第01-22巻',
    '[雑誌] 週刊少年ジャンプ 2025年13号',
    '【同人誌】作品名 (オリジナル) 第1-5巻 [完]',
    '[一般コミック] ONE PIECE 第01-110巻 [ONE PIECE vol 01-110]',
  ];

  const [inputTitle, setInputTitle] = useState<string>(sampleTitles[0]);
  const [parsed, setParsed] = useState<ParseResult>(() => parsePostTitle(sampleTitles[0]));

  const handleInputChange = (text: string) => {
    setInputTitle(text);
    setParsed(parsePostTitle(text));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        <h3 className="text-sm font-bold text-slate-900">
          タイトル & 最大巻数 抽出テスター (Parser Playground)
        </h3>
      </div>

      <div className="space-y-3 text-xs">
        {/* Sample chips */}
        <div>
          <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
            サンプルタイトルで試す:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sampleTitles.map((sample, idx) => (
              <button
                key={idx}
                onClick={() => handleInputChange(sample)}
                className={`px-2 py-1 rounded text-[11px] font-medium border text-left transition-colors truncate max-w-[280px] ${
                  inputTitle === sample
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {/* Input box */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            解析テストする投稿タイトル (HTML内のrawTitle):
          </label>
          <textarea
            rows={2}
            value={inputTitle}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="[一般コミック] 作品名 第01-10巻 [English Title]"
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-mono"
          />
        </div>

        {/* Extracted Output Result */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
            <span>抽出結果 (Parsed Output)</span>
            <span className="text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> リアルタイム抽出
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">作品名 (Clean Title)</span>
              <span className="text-xs font-bold text-slate-900 truncate block mt-0.5" title={parsed.cleanTitle}>
                {parsed.cleanTitle || '(空)'}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">最大巻数 (Max Volume)</span>
              <span className="text-xs font-bold text-indigo-700 block mt-0.5">
                {parsed.maxVolume > 0 ? `第 ${parsed.maxVolume} 巻` : '0 (巻数なし)'}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">カテゴリ</span>
              <span className="text-xs font-semibold text-slate-800 block mt-0.5">
                {parsed.category}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">巻数表記 (Raw Match)</span>
              <span className="text-xs font-mono text-slate-700 block mt-0.5 truncate" title={parsed.rawVolumeStr}>
                {parsed.rawVolumeStr || 'なし'}
              </span>
            </div>
          </div>

          {parsed.author && (
            <div className="text-[11px] text-slate-600 pt-1">
              抽出作者名: <strong className="text-slate-800">{parsed.author}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
