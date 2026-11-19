/**
 * Realistic HTML generator mimicking dl-raw.si WordPress theme
 * Used for reliable test execution and offline fallback testing.
 */

interface RawPost {
  title: string;
  slug: string;
  category: string;
  date: string;
}

export const MANGA_DATA_BASE: RawPost[] = [
  // Page 1 (Newest items)
  { title: '[一般コミック] 葬送のフリーレン 第01-13巻 [Sousou no Frieren vol 01-13]', slug: 'sousou-no-frieren-13', category: '一般コミック', date: '2025-02-27' },
  { title: '[一般コミック] 呪術廻戦 第28巻 [Jujutsu Kaisen vol 28]', slug: 'jujutsu-kaisen-28', category: '一般コミック', date: '2025-02-27' },
  { title: '[一般コミック] 薬屋のひとりごと 第01-14巻 [Kusuriya no Hitorigoto 14]', slug: 'kusuriya-no-hitorigoto-14', category: '一般コミック', date: '2025-02-26' },
  { title: '[Light Novel] 転生したらスライムだった件 第01-22巻', slug: 'ten-sura-ln-22', category: 'Light Novel', date: '2025-02-26' },
  { title: '[一般コミック] チェンソーマン 第18巻 [Chainsaw Man vol 18]', slug: 'chainsaw-man-18', category: '一般コミック', date: '2025-02-26' },
  { title: '[雑誌] 週刊少年ジャンプ 2025年13号', slug: 'shonen-jump-2025-13', category: '雑誌', date: '2025-02-25' },
  { title: '[一般コミック] ダンジョン飯 第01-14巻 [完] [Dungeon Meshi vol 01-14]', slug: 'dungeon-meshi-14', category: '一般コミック', date: '2025-02-25' },
  { title: '[成年コミック] [メゴヒロ] 幼馴染がギャルになって帰ってきた件 第01巻', slug: 'megohiro-gal-01', category: '成年コミック', date: '2025-02-25' },
  { title: '[一般コミック] 推しの子 第01-16巻 [完] [Oshi no Ko vol 01-16]', slug: 'oshi-no-ko-16', category: '一般コミック', date: '2025-02-24' },
  { title: '[一般コミック] SPY×FAMILY 第01-14巻 [SPY×FAMILY vol 01-14]', slug: 'spy-family-14', category: '一般コミック', date: '2025-02-24' },
  { title: '[Light Novel] Re:ゼロから始める異世界生活 第01-38巻', slug: 'rezero-ln-38', category: 'Light Novel', date: '2025-02-24' },
  { title: '[一般コミック] ブルーロック 第01-31巻 [Blue Lock vol 01-31]', slug: 'blue-lock-31', category: '一般コミック', date: '2025-02-23' },
  { title: '[一般コミック] 怪獣8号 第01-14巻 [Kaiju No. 8 vol 01-14]', slug: 'kaiju-8-14', category: '一般コミック', date: '2025-02-23' },
  { title: '[雑誌] 週刊ヤングジャンプ 2025年12号', slug: 'young-jump-2025-12', category: '雑誌', date: '2025-02-23' },
  { title: '[一般コミック] 逃げ上手の若君 第01-18巻 [The Elusive Samurai vol 01-18]', slug: 'nigejouzu-18', category: '一般コミック', date: '2025-02-22' },
  { title: '[成年コミック] [武田弘光] マケン姫っ!外伝 第02巻', slug: 'maken-ki-gaiden-02', category: '成年コミック', date: '2025-02-22' },
  { title: '[一般コミック] 僕のヒーローアカデミア 第01-42巻 [完] [My Hero Academia vol 01-42]', slug: 'heroaca-42', category: '一般コミック', date: '2025-02-21' },
  { title: '[Light Novel] ようこそ実力至上主義の教室へ 2年生編 第01-12巻', slug: 'youjitsu-2nd-12', category: 'Light Novel', date: '2025-02-21' },
  { title: '[一般コミック] ワンパンマン 第01-32巻 [One Punch-Man vol 01-32]', slug: 'one-punch-man-32', category: '一般コミック', date: '2025-02-20' },
  { title: '[一般コミック] アオのハコ 第01-17巻 [Blue Box vol 01-17]', slug: 'ao-no-hako-17', category: '一般コミック', date: '2025-02-20' },

  // Page 2
  { title: '[一般コミック] ONE PIECE 第01-110巻 [ONE PIECE vol 01-110]', slug: 'one-piece-110', category: '一般コミック', date: '2025-02-19' },
  { title: '[一般コミック] キングダム 第01-73巻 [Kingdom vol 01-73]', slug: 'kingdom-73', category: '一般コミック', date: '2025-02-19' },
  { title: '[一般コミック] シャングリラ・フロンティア 第01-19巻', slug: 'shanfro-19', category: '一般コミック', date: '2025-02-18' },
  { title: '[Light Novel] 無職転生 ～異世界行ったら本気だす～ 第01-26巻 [完]', slug: 'mushoku-ln-26', category: 'Light Novel', date: '2025-02-18' },
  { title: '[雑誌] 週刊少年マガジン 2025年11号', slug: 'shonen-magazine-2025-11', category: '雑誌', date: '2025-02-17' },
  { title: '[一般コミック] ダンダダン 第01-17巻 [Dandadan vol 01-17]', slug: 'dandadan-17', category: '一般コミック', date: '2025-02-17' },
  { title: '[成年コミック] [朝凪] 少女騎士の受難 第01巻', slug: 'asanagi-knight-01', category: '成年コミック', date: '2025-02-16' },
  { title: '[一般コミック] カグラバチ 第01-05巻 [Kagurabachi vol 01-05]', slug: 'kagurabachi-05', category: '一般コミック', date: '2025-02-16' },
  { title: '[一般コミック] 魔入りました！入間くん 第01-39巻', slug: 'iruma-kun-39', category: '一般コミック', date: '2025-02-15' },
  { title: '[Light Novel] オーバーロード 第01-16巻', slug: 'overlord-ln-16', category: 'Light Novel', date: '2025-02-15' },
  { title: '[一般コミック] サカモトデイズ 第01-19巻 [SAKAMOTO DAYS vol 01-19]', slug: 'sakamoto-days-19', category: '一般コミック', date: '2025-02-14' },
  { title: '[一般コミック] 忘却バッテリー 第01-19巻', slug: 'boukyaku-battery-19', category: '一般コミック', date: '2025-02-14' },
  { title: '[雑誌] 週刊少年サンデー 2025年11号', slug: 'shonen-sunday-2025-11', category: '雑誌', date: '2025-02-13' },
  { title: '[一般コミック] 葬送のフリーレン 第12巻 (分冊更新)', slug: 'sousou-no-frieren-12-prev', category: '一般コミック', date: '2025-02-13' },
  { title: '[一般コミック] チ。―地球の運動について― 第01-08巻 [完]', slug: 'chi-chikyu-08', category: '一般コミック', date: '2025-02-12' },
  { title: '[成年コミック] [鬼月あるちゅ] 吸血姫の檻', slug: 'onizuki-vampire', category: '成年コミック', date: '2025-02-12' },
  { title: '[一般コミック] メダリスト 第01-11巻 [Medalist vol 01-11]', slug: 'medalist-11', category: '一般コミック', date: '2025-02-11' },
  { title: '[Light Novel] ダンジョンに出会いを求めるのは間違っているだろうか 第01-20巻', slug: 'danmachi-ln-20', category: 'Light Novel', date: '2025-02-11' },
  { title: '[一般コミック] ウィンドブレイカー 第01-19巻 [WIND BREAKER 19]', slug: 'wind-breaker-19', category: '一般コミック', date: '2025-02-10' },
  { title: '[一般コミック] 薫る花は凛と咲く 第01-14巻', slug: 'kaoruhana-14', category: '一般コミック', date: '2025-02-10' },

  // Page 3
  { title: '[一般コミック] 東京卍リベンジャーズ 第01-31巻 [完]', slug: 'tokyo-revengers-31', category: '一般コミック', date: '2025-02-09' },
  { title: '[一般コミック] 鬼滅の刃 第01-23巻 [完] [Kimetsu no Yaiba 01-23]', slug: 'kimetsu-23', category: '一般コミック', date: '2025-02-09' },
  { title: '[Light Novel] 薬屋のひとりごと 原作小説 第01-15巻', slug: 'kusuriya-novel-15', category: 'Light Novel', date: '2025-02-08' },
  { title: '[雑誌] ヤングアニマル 2025年04号', slug: 'young-animal-2025-04', category: '雑誌', date: '2025-02-08' },
  { title: '[一般コミック] 終末のワルキューレ 第01-23巻', slug: 'valkyrie-23', category: '一般コミック', date: '2025-02-07' },
  { title: '[一般コミック] 極主夫道 第01-14巻 [Gokushufudou 14]', slug: 'gokushufudou-14', category: '一般コミック', date: '2025-02-07' },
  { title: '[成年コミック] [黒本君] 催眠メイド喫茶', slug: 'kurohonkun-maid', category: '成年コミック', date: '2025-02-06' },
  { title: '[一般コミック] ベルセルク 第01-42巻 [BERSERK vol 01-42]', slug: 'berserk-42', category: '一般コミック', date: '2025-02-06' },
  { title: '[一般コミック] HUNTER×HUNTER 第01-38巻 [HUNTER×HUNTER vol 38]', slug: 'hunter-hunter-38', category: '一般コミック', date: '2025-02-05' },
  { title: '[Light Novel] 魔法科高校の劣等生 第01-32巻 [完]', slug: 'mahouka-32', category: 'Light Novel', date: '2025-02-05' },
  { title: '[一般コミック] ブルーピリオド 第01-16巻 [Blue Period vol 16]', slug: 'blue-period-16', category: '一般コミック', date: '2025-02-04' },
  { title: '[一般コミック] 違国日記 第01-11巻 [完]', slug: 'ikoku-nikki-11', category: '一般コミック', date: '2025-02-04' },
  { title: '[雑誌] モーニング 2025年10号', slug: 'morning-2025-10', category: '雑誌', date: '2025-02-03' },
  { title: '[一般コミック] 宝石の国 第01-13巻 [完] [Houseki no Kuni 13]', slug: 'houseki-no-kuni-13', category: '一般コミック', date: '2025-02-03' },
  { title: '[一般コミック] 進撃の巨人 第01-34巻 [完] [Attack on Titan 01-34]', slug: 'shingeki-34', category: '一般コミック', date: '2025-02-02' },
  { title: '[成年コミック] [ホムンクルス] 姉恋狂詩曲 第01-02巻', slug: 'homunculus-anekoi-02', category: '成年コミック', date: '2025-02-02' },
  { title: '[一般コミック] 転生したら第七王子だったので、気ままに魔術を極めます 第01-17巻', slug: 'dainana-ouji-17', category: '一般コミック', date: '2025-02-01' },
  { title: '[Light Novel] この素晴らしい世界に祝福を! 第01-17巻 [完]', slug: 'konosuba-ln-17', category: 'Light Novel', date: '2025-02-01' },
  { title: '[一般コミック] 葬送のフリーレン 第11巻', slug: 'sousou-no-frieren-11-old', category: '一般コミック', date: '2025-01-31' },
  { title: '[一般コミック] 呪術廻戦 第27巻 [Jujutsu Kaisen 27]', slug: 'jujutsu-kaisen-27-old', category: '一般コミック', date: '2025-01-31' },

  // Page 4-10 generator base
  { title: '[一般コミック] ゴールデンカムイ 第01-31巻 [完] [Golden Kamuy 31]', slug: 'golden-kamuy-31', category: '一般コミック', date: '2025-01-30' },
  { title: '[一般コミック] ドクターストーン 第01-27巻 [完] [Dr.STONE 27]', slug: 'dr-stone-27', category: '一般コミック', date: '2025-01-30' },
  { title: '[Light Novel] 陰の実力者になりたくて! 第01-06巻', slug: 'kage-no-jitsuryokusha-06', category: 'Light Novel', date: '2025-01-29' },
  { title: '[雑誌] ビッグコミックスペリオール 2025年05号', slug: 'superior-2025-05', category: '雑誌', date: '2025-01-29' },
  { title: '[一般コミック] ワールドトリガー 第01-27巻 [World Trigger 27]', slug: 'world-trigger-27', category: '一般コミック', date: '2025-01-28' },
  { title: '[一般コミック] 亜人 第01-17巻 [完] [Ajin 17]', slug: 'ajin-17', category: '一般コミック', date: '2025-01-28' },
  { title: '[成年コミック] [師走の翁] 爆乳家政婦さん 第01巻', slug: 'shiwasu-kaseifu-01', category: '成年コミック', date: '2025-01-27' },
  { title: '[一般コミック] 宇宙兄弟 第01-44巻 [Space Brothers 44]', slug: 'space-brothers-44', category: '一般コミック', date: '2025-01-27' },
  { title: '[一般コミック] 鋼の錬金術師 完全版 第01-18巻 [完]', slug: 'hagaren-kanzenban-18', category: '一般コミック', date: '2025-01-26' },
  { title: '[Light Novel] ソードアート・オンライン 第01-28巻', slug: 'sao-ln-28', category: 'Light Novel', date: '2025-01-26' },
  { title: '[一般コミック] BLEACH モノクロ版 第01-74巻 [完]', slug: 'bleach-74', category: '一般コミック', date: '2025-01-25' },
  { title: '[一般コミック] NARUTO -ナルト- 第01-72巻 [完]', slug: 'naruto-72', category: '一般コミック', date: '2025-01-25' },
  { title: '[雑誌] 週刊少年チャンピオン 2025年09号', slug: 'champion-2025-09', category: '雑誌', date: '2025-01-24' },
  { title: '[一般コミック] ぐらんぶる 第01-23巻 [Grand Blue 23]', slug: 'grand-blue-23', category: '一般コミック', date: '2025-01-24' },
  { title: '[一般コミック] よふかしのうた 第01-20巻 [完]', slug: 'yofukashi-20', category: '一般コミック', date: '2025-01-23' },
  { title: '[成年コミック] [荒岸来歩] 清楚系彼女の裏の顔', slug: 'aragishi-kanojo', category: '成年コミック', date: '2025-01-23' },
  { title: '[一般コミック] 葬送のフリーレン 第10巻', slug: 'sousou-no-frieren-10-old', category: '一般コミック', date: '2025-01-22' },
  { title: '[Light Novel] 探偵はもう、死んでいる。 第01-11巻', slug: 'tanmoshi-ln-11', category: 'Light Novel', date: '2025-01-22' },
  { title: '[一般コミック] スラムダンク 新装再編版 第01-20巻 [完]', slug: 'slamdunk-shinsou-20', category: '一般コミック', date: '2025-01-21' },
  { title: '[一般コミック] ジョジョの奇妙な冒険 第9部 ザ・ジョジョランズ 第01-04巻', slug: 'jojolands-04', category: '一般コミック', date: '2025-01-21' },
];

/**
 * Generate 20 items per page for pages 1 to 10
 */
export function generatePagePosts(pageNumber: number): RawPost[] {
  const postsPerPage = 20;
  const startIndex = ((pageNumber - 1) * postsPerPage) % MANGA_DATA_BASE.length;
  const result: RawPost[] = [];

  for (let i = 0; i < postsPerPage; i++) {
    const base = MANGA_DATA_BASE[(startIndex + i) % MANGA_DATA_BASE.length];
    // Slightly adjust date or volume on deeper pages to simulate natural blog archive
    const adjustedTitle = pageNumber > 3 && base.title.includes('フリーレン')
      ? `[一般コミック] 葬送のフリーレン 第01-0${Math.max(1, 13 - pageNumber)}巻`
      : base.title;

    result.push({
      ...base,
      title: adjustedTitle,
      slug: `${base.slug}-p${pageNumber}-i${i}`,
    });
  }

  return result;
}

/**
 * Generates sample DL-RAW HTML with standard layout + Popular Posts in sidebar
 */
export function generateMockDlRawHtml(pageNumber: number): string {
  const posts = generatePagePosts(pageNumber);

  const postsHtml = posts
    .map(
      (post, idx) => `
    <article id="post-${pageNumber * 100 + idx}" class="post-${pageNumber * 100 + idx} post type-post status-publish format-standard has-post-thumbnail hentry category-comic">
      <div class="post-thumbnail">
        <a href="https://dl-raw.si/${post.slug}/">
          <img width="300" height="425" src="https://picsum.photos/seed/${post.slug}/300/425" class="attachment-post-thumbnail size-post-thumbnail wp-post-image" alt="${post.title}" />
        </a>
      </div>
      <header class="entry-header">
        <h2 class="entry-title">
          <a href="https://dl-raw.si/${post.slug}/" rel="bookmark">${post.title}</a>
        </h2>
      </header>
      <div class="entry-summary">
        <p>RAW Manga / 無料 コミック ダウンロード ${post.title}</p>
      </div>
      <footer class="entry-footer">
        <span class="posted-on"><time class="entry-date published">${post.date}</time></span>
        <span class="cat-links"><a href="https://dl-raw.si/category/${post.category}/">${post.category}</a></span>
      </footer>
    </article>
  `
    )
    .join('\n');

  // Sidebar with popular posts (MUST BE EXCLUDED according to Rule 2)
  const popularPostsSidebarHtml = `
    <aside id="secondary" class="widget-area sidebar" role="complementary">
      <div class="widget popular-posts widget_popular_posts">
        <h3 class="widget-title">Popular Posts</h3>
        <ul class="popular-posts-list">
          <li><a href="https://dl-raw.si/popular-one-piece-110/">[一般コミック] ONE PIECE 第01-110巻 [Popular]</a></li>
          <li><a href="https://dl-raw.si/popular-jujutsu-kaisen-28/">[一般コミック] 呪術廻戦 第28巻 [Popular]</a></li>
          <li><a href="https://dl-raw.si/popular-frieren-13/">[一般コミック] 葬送のフリーレン 第01-13巻 [Popular]</a></li>
          <li><a href="https://dl-raw.si/popular-kingdom-73/">[一般コミック] キングダム 第01-73巻 [Popular]</a></li>
          <li><a href="https://dl-raw.si/popular-spy-family-14/">[一般コミック] SPY×FAMILY 第01-14巻 [Popular]</a></li>
        </ul>
      </div>
      <div class="widget widget_categories">
        <h3 class="widget-title">Categories</h3>
        <ul>
          <li><a href="https://dl-raw.si/category/comic/">一般コミック (12450)</a></li>
          <li><a href="https://dl-raw.si/category/adult/">成年コミック (8930)</a></li>
          <li><a href="https://dl-raw.si/category/novel/">Light Novel (4120)</a></li>
          <li><a href="https://dl-raw.si/category/magazine/">雑誌 (1540)</a></li>
        </ul>
      </div>
    </aside>
  `;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>DL-RAW.SI - Raw Manga Download (Page ${pageNumber})</title>
</head>
<body class="home blog paged paged-${pageNumber}">
  <header id="masthead" class="site-header">
    <div class="site-branding">
      <h1 class="site-title"><a href="https://dl-raw.si/">DL-RAW.SI</a></h1>
      <p class="site-description">Download Free Raw Japanese Manga & Light Novels</p>
    </div>
  </header>
  <div id="content" class="site-content">
    <div id="primary" class="content-area">
      <main id="main" class="site-main" role="main">
        <div class="posts-wrap">
          ${postsHtml}
        </div>
        <nav class="navigation pagination" aria-label="Posts navigation">
          <div class="nav-links">
            ${pageNumber > 1 ? `<a class="prev page-numbers" href="https://dl-raw.si/page/${pageNumber - 1}/">« Previous</a>` : ''}
            <span aria-current="page" class="page-numbers current">${pageNumber}</span>
            <a class="page-numbers" href="https://dl-raw.si/page/${pageNumber + 1}/">${pageNumber + 1}</a>
            <a class="next page-numbers" href="https://dl-raw.si/page/${pageNumber + 1}/">Next »</a>
          </div>
        </nav>
      </main>
    </div>
    ${popularPostsSidebarHtml}
  </div>
  <footer id="colophon" class="site-footer">
    <div class="site-info">© 2025 DL-RAW.SI</div>
  </footer>
</body>
</html>
`;
}
