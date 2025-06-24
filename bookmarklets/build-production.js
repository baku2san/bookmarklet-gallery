#!/usr/bin/env node
/**
 * Bookmarklet Builder (設定ファイル対応版)
 * 設定ファイル（gallery.yml）から自動的にブックマークレットを読み込み
 * 開発版: 可読性の高いコード（コメント・フォーマット保持）
 * 本番版: dist/install.htmlでminify適用
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { minify } = require('terser');

// 設定ファイルの読み込み
const CONFIG_FILE = './src/gallery.yml';
let config;

try {
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
  config = yaml.load(configContent);
  console.log(`✅ 設定ファイル読み込み完了: ${CONFIG_FILE}`);
} catch (error) {
  console.error(`❌ 設定ファイルの読み込みに失敗: ${CONFIG_FILE}`);
  console.error(error.message);
  process.exit(1);
}

// 設定から有効なブックマークレットのみを抽出
const BOOKMARKLETS = config.bookmarklets.filter(item => item.enabled !== false);
const CATEGORIES = config.categories || {};
const BUILD_CONFIG = config.build || {};

console.log(`📋 登録されたブックマークレット: ${BOOKMARKLETS.length}件`);
BOOKMARKLETS.forEach(item => {
  console.log(`  - ${item.title} (${item.file})`);
});

/**
 * distディレクトリの準備
 */
function prepareDist() {
  const distDir = './dist';

  // distディレクトリが存在しない場合は作成
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log(`📁 distディレクトリを作成: ${distDir}`);
  }
}

/**
 * 開発者向け裏ページの生成
 * enabled:false のブックマークレットも含めた完全版ページを作成
 */
async function generateDevPage() {
  const devPageConfig = BUILD_CONFIG.devPage || {};
  const shouldGenerate = devPageConfig.generate !== false; // デフォルトはtrue

  if (!shouldGenerate) {
    console.log(`⚙️ 開発者向け裏ページの生成はスキップされました (generate: false)`);
    return;
  }

  const filename = devPageConfig.filename || 'dev.html';
  const outputPath = path.join('./dist', filename);

  try {
    // 全てのブックマークレット（enabled:false含む）を取得
    const allBookmarklets = config.bookmarklets || [];
    const enabledBookmarklets = allBookmarklets.filter(item => item.enabled !== false);
    const disabledBookmarklets = allBookmarklets.filter(item => item.enabled === false);

    console.log(`🔧 開発者向け裏ページ生成開始...`);
    console.log(`� 有効なブックマークレット: ${enabledBookmarklets.length}件`);
    console.log(`⚠️ 無効なブックマークレット: ${disabledBookmarklets.length}件`);

    // 裏ページHTML生成（メインページとほぼ同じだが、無効なものも含む）
    const devPageHtml = await generateGalleryHtml(allBookmarklets, true);

    fs.writeFileSync(outputPath, devPageHtml, 'utf8');
    console.log(`✅ 開発者向け裏ページ生成完了: ./dist/${filename}`);

    return filename;
  } catch (error) {
    console.warn(`⚠️ 開発者向け裏ページの生成に失敗: ${error.message}`);
    return null;
  }
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 本番用minify処理（本番版生成時のみ適用）
 * Terserを使用してより強力な最適化を実行
 */
async function minifyForProduction(content) {
  try {
    // 先頭のjavascript:プレフィックスを削除
    content = content.replace(/^\s*javascript:\s*/i, '').trim(); // Terserを使用してminify
    const result = await minify(content, {
      compress: {
        dead_code: true,
        drop_console: false, // console.logは保持（デバッグ用）
        drop_debugger: true,
        conditionals: true,
        evaluate: true,
        booleans: true,
        loops: true,
        unused: true,
        hoist_funs: true,
        keep_fargs: false,
        hoist_vars: false,
        if_return: true,
        join_vars: true,
        collapse_vars: true,
        reduce_vars: true,
        warnings: false,
        negate_iife: true,
        pure_getters: true,
        pure_funcs: null,
        expression: false,
        keep_fnames: false,
        keep_infinity: false,
        passes: 2,
      },
      mangle: {
        toplevel: true,
        eval: false,
        keep_fnames: false,
        reserved: ['alert', 'console', 'document', 'window'], // 重要なグローバル変数は保護
      },
      format: {
        ascii_only: false,
        beautify: false,
        braces: false,
        comments: false,
        indent_level: 0,
        indent_start: 0,
        inline_script: true,
        keep_quoted_props: false,
        max_line_len: false,
        preamble: null,
        quote_keys: false,
        quote_style: 0,
        semicolons: true,
        shebang: false,
        webkit: false,
        wrap_iife: false,
      },
    });

    if (result.error) {
      console.warn('⚠️ Terserでのminifyに失敗。フォールバック処理を使用:', result.error.message);
      return fallbackMinify(content);
    }

    return result.code;
  } catch (error) {
    console.warn('⚠️ Terserでのminifyに失敗。フォールバック処理を使用:', error.message);
    return fallbackMinify(content);
  }
}

/**
 * フォールバック用のシンプルなminify処理
 */
function fallbackMinify(content) {
  // JavaScriptコメント削除（文字列リテラル内を保護）
  content = removeComments(content);

  // テンプレートリテラルをシングルクォート文字列に変換
  content = content.replace(/`([^`]*)`/g, function (match, content) {
    return "'" + content.replace(/\n/g, '\\n').replace(/'/g, "\\'") + "'";
  });

  // 余分な空白・改行を削除
  content = content
    .replace(/\n\s*/g, ' ') // 改行と空白を1つの空白に
    .replace(/\s*([{}();,=+\-*\/:?!<>])\s*/g, '$1') // 演算子周辺の空白削除
    .replace(/\s+/g, ' ') // 連続する空白を1つに
    .trim();

  return content;
}

/**
 * JavaScriptコードからコメントを安全に削除
 * 文字列リテラル内のコメント記号を保護しながら削除
 */
function removeComments(code) {
  let result = '';
  let inString = false;
  let stringChar = '';
  let inRegex = false;
  let inSingleComment = false;
  let inMultiComment = false;
  let escapeNext = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i + 1];
    const prevChar = code[i - 1];

    // エスケープ処理
    if (escapeNext) {
      if (!inSingleComment && !inMultiComment) {
        result += char;
      }
      escapeNext = false;
      continue;
    }

    if (char === '\\' && (inString || inRegex)) {
      escapeNext = true;
      if (!inSingleComment && !inMultiComment) {
        result += char;
      }
      continue;
    }

    // 文字列リテラル処理
    if (!inSingleComment && !inMultiComment && !inRegex) {
      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringChar = char;
        result += char;
        continue;
      } else if (char === stringChar && inString) {
        inString = false;
        stringChar = '';
        result += char;
        continue;
      }
    }

    // コメント開始の検出
    if (!inString && !inRegex) {
      // 単行コメント
      if (char === '/' && nextChar === '/' && !inMultiComment) {
        inSingleComment = true;
        i++; // 次の文字もスキップ
        continue;
      }

      // 複数行コメント
      if (char === '/' && nextChar === '*' && !inSingleComment) {
        inMultiComment = true;
        i++; // 次の文字もスキップ
        continue;
      }
    }

    // コメント終了の検出
    if (inSingleComment && char === '\n') {
      inSingleComment = false;
      result += ' '; // 改行を空白に置換
      continue;
    }

    if (inMultiComment && char === '*' && nextChar === '/') {
      inMultiComment = false;
      i++; // 次の文字もスキップ
      result += ' '; // コメント箇所を空白に置換
      continue;
    }

    // 通常の文字
    if (!inSingleComment && !inMultiComment) {
      result += char;
    }
  }

  return result.trim();
}

/**
 * ブックマークレットファイルの検索とロード
 * 設定ファイルで指定されたディレクトリから自動検索
 */
function findBookmarkletFile(filename) {
  const searchDirs = BUILD_CONFIG.searchDirs || ['./productivity', './development'];

  for (const dir of searchDirs) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  // 従来の固定パス検索（後方互換性）
  const legacyPaths = [path.join('./productivity', filename), path.join('./development', filename)];

  for (const filePath of legacyPaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

/**
 * JavaScriptファイルを読み込み、本番用に圧縮（本番版生成時のみ）
 */
async function processBookmarkletFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const shouldMinify = BUILD_CONFIG.minify !== false;

    let processed;
    if (shouldMinify) {
      processed = await minifyForProduction(content);

      const originalSize = content.length;
      const finalSize = processed.length;
      const reduction = Math.round((1 - finalSize / originalSize) * 100);

      console.log(
        `📦 ${path.basename(filePath)}: ${originalSize} → ${finalSize} bytes (${reduction}% reduction)`
      );
    } else {
      processed = content;
      console.log(`📄 ${path.basename(filePath)}: minify無効 (${content.length} bytes)`);
    }

    return `javascript:${processed}`;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return `javascript:alert('Error: ブックマークレットの読み込みに失敗しました');`;
  }
}

/**
 * ブックマークレットカードのHTMLを生成
 */
async function generateBookmarkletCard(bookmarklet, isDevPage = false) {
  let bookmarkletCode = '';
  let filePath = null;
  const isDisabled = bookmarklet.enabled === false;
  const devPageConfig = BUILD_CONFIG.devPage || {};

  if (bookmarklet.file) {
    filePath = findBookmarkletFile(bookmarklet.file);

    if (!filePath) {
      console.warn(`⚠️ ファイルが見つかりません: ${bookmarklet.file}`);
      bookmarkletCode = `javascript:alert('${bookmarklet.title} のファイルが見つかりません: ${bookmarklet.file}');`;
    } else {
      console.log(`🔍 ファイル検出: ${filePath}`);
      bookmarkletCode = await processBookmarkletFile(filePath);
    }
  } else {
    console.warn(`⚠️ ファイルが指定されていません: ${bookmarklet.title}`);
    bookmarkletCode = `javascript:alert('${bookmarklet.title} は未実装です');`;
  }

  const featuresHtml = bookmarklet.features
    ? bookmarklet.features.map(f => `<li>${f}</li>`).join('')
    : '';

  // 無効なブックマークレット用の警告とスタイル
  const disabledClass = isDisabled && isDevPage ? ' bookmarklet-disabled' : '';
  const disabledWarning =
    isDisabled && isDevPage && devPageConfig.disabledDisplay?.show !== false
      ? `
                    <div class="disabled-warning">
                        ${devPageConfig.disabledDisplay?.warningText || '⚠️ 開発中・テスト中のブックマークレットです'}
                    </div>`
      : '';

  return `
                <div class="bookmarklet-card${disabledClass}">
                    <div class="bookmarklet-header">
                        <div class="bookmarklet-icon">${bookmarklet.icon}</div>
                        <div>
                            <div class="bookmarklet-title">${bookmarklet.title}</div>
                            <div class="bookmarklet-description">${bookmarklet.description}</div>
                        </div>
                    </div>
                    ${disabledWarning}
                    ${
                      featuresHtml
                        ? `
                    <div class="bookmarklet-features">
                        <h4>主な機能:</h4>
                        <ul>${featuresHtml}</ul>
                    </div>`
                        : ''
                    }
                    <div class="bookmarklet-install">
                        <a href="${escapeHtml(bookmarkletCode)}" class="bookmarklet-link">
                            📌 ${bookmarklet.title}
                        </a>
                        <div class="install-hint">👆 このボタンをブックマークバーに<strong>ドラッグ</strong>してください</div>
                    </div>
                </div>`;
}

/**
 * ギャラリーHTML生成（有効・無効ブックマークレット対応）
 */
async function generateGalleryHtml(bookmarkletsToInclude, isDevPage = false) {
  // カテゴリ別にブックマークレットを分類
  const categorizedBookmarklets = {};

  // 設定ファイルで定義されたカテゴリの初期化
  Object.keys(CATEGORIES).forEach(categoryKey => {
    categorizedBookmarklets[categoryKey] = [];
  });

  // ブックマークレットをカテゴリ別に分類
  for (const bookmarklet of bookmarkletsToInclude) {
    const category = bookmarklet.category;
    if (!categorizedBookmarklets[category]) {
      categorizedBookmarklets[category] = [];
      console.warn(`⚠️ 未定義のカテゴリ: ${category}`);
    }
    categorizedBookmarklets[category].push(bookmarklet);
  }

  // カテゴリ別HTML生成
  const categoryHtmlSections = {};
  for (const [categoryKey, categoryConfig] of Object.entries(CATEGORIES)) {
    const bookmarklets = categorizedBookmarklets[categoryKey] || [];
    const cardPromises = bookmarklets.map(b => generateBookmarkletCard(b, isDevPage));
    const cardsHtml = (await Promise.all(cardPromises)).join('');

    categoryHtmlSections[categoryKey] = `
        <section class="category ${categoryKey}">
            <h2>${categoryConfig.name}</h2>
            <p class="category-description">${categoryConfig.description}</p>
            <div class="bookmarklets-grid">
                ${cardsHtml}
            </div>
        </section>`;
  }

  // HTMLテンプレート生成
  const template = createHtmlTemplate(isDevPage);
  const galleryTitle = config.gallery?.title || '🔖 Bookmarklet Gallery';

  // カテゴリセクションを順序通りに結合（セパレーター付き）
  const sortedCategories = Object.entries(CATEGORIES)
    .sort(([, a], [, b]) => (a.order || 999) - (b.order || 999))
    .map(([key]) => key);

  const allCategoriesHtml = sortedCategories
    .map((categoryKey, index) => {
      const categoryHtml = categoryHtmlSections[categoryKey] || '';
      const separator =
        index < sortedCategories.length - 1 ? '<div class="category-separator"></div>' : '';
      return categoryHtml + separator;
    })
    .join('');

  // テンプレートの置換
  const html = template
    .replace('{{BUILD_DATE}}', new Date().toLocaleString('ja-JP'))
    .replace('{{GALLERY_TITLE}}', galleryTitle)
    .replace('{{CATEGORIES_CONTENT}}', allCategoriesHtml);

  return html;
}

/**
 * HTMLテンプレート生成（メイン・裏ページ対応）
 */
function createHtmlTemplate(isDevPage = false) {
  const galleryTitle = config.gallery?.title || '🔖 Bookmarklet Gallery';
  const galleryDescription =
    config.gallery?.description || 'Interactive gallery of useful bookmarklets';
  const devPageConfig = BUILD_CONFIG.devPage || {};

  const pageTitle = isDevPage ? `${galleryTitle} (開発版)` : galleryTitle;

  // 開発者向けリンク（本番ページの右下にひっそりと配置）
  const devLinkHtml =
    !isDevPage && devPageConfig.showLinkFromMain !== false
      ? `
        <div class="dev-link-footer">
            <a href="./${devPageConfig.filename || 'dev.html'}" class="dev-link-small">
                🔧 開発者向け
            </a>
        </div>`
      : '';

  const devPageWarning = isDevPage
    ? `
        <div class="dev-warning">
            <h3>⚠️ 開発者向けページ</h3>
            <p>このページには enabled:false のブックマークレットも含まれています。</p>
            <p><a href="./install.html">← 通常ページに戻る</a></p>
        </div>`
    : '';

  // 開発戦略説明（開発者向けページでのみ表示）
  const developmentStrategy = isDevPage
    ? `
            <div class="build-strategy">
                <h3>📋 開発戦略</h3>
                <p><strong>開発版:</strong> 可読性重視（コメント・フォーマット保持）</p>
                <p><strong>本番版:</strong> Terser使用でアグレッシブ最適化（最大サイズ削減）</p>
                <p><strong>圧縮効果:</strong> 変数名短縮、デッドコード除去、構文最適化</p>
            </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); overflow: hidden; position: relative; }
        .header { background: linear-gradient(135deg, #007acc, #0078d4); color: white; padding: 30px; text-align: center; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { font-size: 1.1em; opacity: 0.9; }
        .content { padding: 30px; }
        .instructions { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin-bottom: 30px; border-radius: 4px; }
        .instructions h2 { color: #1976d2; margin-bottom: 15px; }
        .instructions ol { padding-left: 20px; }
        .instructions li { margin-bottom: 8px; }
        
        /* カテゴリセクションのスタイリング - 区切りを明確に */
        .category { 
            margin-bottom: 50px; 
            background: #fafafa; 
            border-radius: 12px; 
            padding: 30px; 
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            border: 1px solid #e8e8e8;
            position: relative;
        }
        .category::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            border-radius: 12px 12px 0 0;
        }
        
        /* カテゴリ別の色分け */
        .category.productivity::before { background: linear-gradient(90deg, #ff6b35, #f7931e); }
        .category.development::before { background: linear-gradient(90deg, #4caf50, #8bc34a); }
        
        .category h2 { 
            margin-bottom: 15px; 
            font-size: 1.8em; 
            font-weight: bold; 
            display: flex; 
            align-items: center; 
            gap: 10px;
        }
        .category.productivity h2 { color: #d84315; }
        .category.development h2 { color: #2e7d32; }
        
        .category-description { 
            color: #666; 
            margin-bottom: 25px; 
            font-style: italic; 
            font-size: 1.1em;
            padding-left: 10px;
            border-left: 3px solid #ddd;
        }
        .category.productivity .category-description { border-left-color: #ff6b35; }
        .category.development .category-description { border-left-color: #4caf50; }
        
        /* カテゴリ間のセパレーター */
        .category-separator {
            height: 2px;
            background: linear-gradient(90deg, transparent, #ddd 20%, #ddd 80%, transparent);
            margin: 40px 0;
            position: relative;
        }
        .category-separator::before {
            content: '✦';
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            background: white;
            color: #999;
            padding: 0 15px;
            font-size: 0.9em;
        }
        .bookmarklets-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 25px; }
        .bookmarklet-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: white; transition: all 0.3s ease; position: relative; }
        .bookmarklet-card:hover { box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); transform: translateY(-2px); }
        
        /* カテゴリ別カードスタイル */
        .category.productivity .bookmarklet-card:hover { box-shadow: 0 4px 15px rgba(255, 107, 53, 0.2); }
        .category.development .bookmarklet-card:hover { box-shadow: 0 4px 15px rgba(76, 175, 80, 0.2); }
        .bookmarklet-header { display: flex; align-items: center; margin-bottom: 15px; }
        .bookmarklet-icon { font-size: 2em; margin-right: 15px; }
        .bookmarklet-title { font-size: 1.2em; font-weight: bold; color: #333; margin-bottom: 5px; }
        .bookmarklet-description { color: #666; font-size: 0.9em; }
        .bookmarklet-features { margin-bottom: 15px; }
        .bookmarklet-features h4 { font-size: 0.9em; color: #555; margin-bottom: 8px; }
        .bookmarklet-features ul { padding-left: 20px; }
        .bookmarklet-features li { font-size: 0.85em; color: #666; margin-bottom: 4px; }
        .bookmarklet-install { text-align: center; }
        .bookmarklet-link { display: inline-block; background: #0078d4; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; transition: background 0.3s ease; }
        .bookmarklet-link:hover { background: #106ebe; }
        .install-hint { margin-top: 10px; font-size: 0.8em; color: #666; }
        .build-info { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 6px; font-size: 0.9em; color: #666; text-align: center; }
        .build-strategy { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
        .build-strategy h3 { color: #856404; margin-bottom: 10px; }
        .build-strategy p { color: #856404; font-size: 0.9em; margin-bottom: 5px; }
        
        /* 開発者向けページ用スタイル */
        .dev-link-footer { position: absolute; bottom: 20px; right: 20px; }
        .dev-link-small { display: inline-block; background: #6c757d; color: white !important; text-decoration: none; padding: 6px 12px; border-radius: 3px; font-size: 0.75em; opacity: 0.7; transition: opacity 0.3s ease; }
        .dev-link-small:hover { opacity: 1; background: #5a6268; }
        .dev-warning { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 20px; margin-bottom: 30px; }
        .dev-warning h3 { color: #721c24; margin-bottom: 10px; }
        .dev-warning p { color: #721c24; margin-bottom: 8px; }
        .dev-warning a { color: #0056b3; font-weight: bold; }
        .bookmarklet-disabled { opacity: 0.6; border: 2px dashed #dc3545; }
        .bookmarklet-disabled .bookmarklet-link { background: #6c757d; }
        .bookmarklet-disabled .bookmarklet-link:hover { background: #5a6268; }
        .disabled-warning { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 8px; margin: 10px 0; font-size: 0.85em; color: #721c24; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{GALLERY_TITLE}}</h1>
            <p>${galleryDescription}</p>
        </div>
        ${devPageWarning}
        <div class="content">
            ${developmentStrategy}
            <div class="instructions">
                <h2>📋 インストール方法</h2>
                <ol>
                    <li><strong>ブックマークバーを表示:</strong> ブラウザの設定でブックマークバーを表示してください</li>
                    <li><strong>ドラッグ&ドロップ:</strong> 下のボタンをブックマークバーにドラッグしてください</li>
                    <li><strong>使用:</strong> 対象のページでブックマークをクリックして実行</li>
                </ol>
            </div>

            {{CATEGORIES_CONTENT}}

            <div class="build-info">
                <p>📅 生成日時: {{BUILD_DATE}} | 🔧 ${BUILD_CONFIG.minify !== false ? 'Terser最適化適用済み' : '非圧縮モード'}</p>
                <p>💡 設定ファイル管理により新規追加が簡単</p>
            </div>
        </div>
        ${devLinkHtml}
    </div>
</body>
</html>`;
}

/**
 * メイン実行関数
 */
async function buildInstallPage() {
  console.log('🚀 Bookmarklet Gallery ビルド開始...');
  console.log(`📋 設定ファイル: ${CONFIG_FILE}`);

  // distディレクトリの準備
  prepareDist();

  // カテゴリ別にブックマークレットを分類
  const categorizedBookmarklets = {};

  // 設定ファイルで定義されたカテゴリの初期化
  Object.keys(CATEGORIES).forEach(categoryKey => {
    categorizedBookmarklets[categoryKey] = [];
  });

  // ブックマークレットをカテゴリ別に分類
  for (const bookmarklet of BOOKMARKLETS) {
    const category = bookmarklet.category;
    if (!categorizedBookmarklets[category]) {
      categorizedBookmarklets[category] = [];
      console.warn(`⚠️ 未定義のカテゴリ: ${category}`);
    }
    categorizedBookmarklets[category].push(bookmarklet);
  }

  // カテゴリ別HTML生成
  const categoryHtmlSections = {};
  for (const [categoryKey, categoryConfig] of Object.entries(CATEGORIES)) {
    const bookmarklets = categorizedBookmarklets[categoryKey] || [];
    const cardPromises = bookmarklets.map(b => generateBookmarkletCard(b, false));
    const cardsHtml = (await Promise.all(cardPromises)).join('');

    categoryHtmlSections[categoryKey] = `
        <section class="category">
            <h2>${categoryConfig.name}</h2>
            <p class="category-description">${categoryConfig.description}</p>
            <div class="bookmarklets-grid">
                ${cardsHtml}
            </div>
        </section>`;
  }

  // HTMLテンプレート生成（メインページ）
  const template = createHtmlTemplate(false);
  const galleryTitle = config.gallery?.title || '🔖 Bookmarklet Gallery';

  // カテゴリセクションを順序通りに結合
  const sortedCategories = Object.entries(CATEGORIES)
    .sort(([, a], [, b]) => (a.order || 999) - (b.order || 999))
    .map(([key]) => key);

  const allCategoriesHtml = sortedCategories
    .map(categoryKey => categoryHtmlSections[categoryKey] || '')
    .join('');

  // テンプレートの置換
  const outputFile = BUILD_CONFIG.outputFile || './dist/install.html';
  const html = template
    .replace('{{BUILD_DATE}}', new Date().toLocaleString('ja-JP'))
    .replace('{{GALLERY_TITLE}}', galleryTitle)
    .replace('{{CATEGORIES_CONTENT}}', allCategoriesHtml);

  // ファイル出力
  fs.writeFileSync(outputFile, html, 'utf8');

  // 開発者向け裏ページの生成
  const devPageFilename = await generateDevPage();

  console.log('');
  console.log(`✅ ギャラリーページ生成完了: ${outputFile}`);
  if (devPageFilename) {
    console.log(`🔧 開発者向け裏ページ生成完了: ./dist/${devPageFilename}`);
  }
  console.log(`📊 登録されたブックマークレット:`);

  // 結果サマリー
  Object.entries(categorizedBookmarklets).forEach(([categoryKey, bookmarklets]) => {
    const categoryName = CATEGORIES[categoryKey]?.name || categoryKey;
    console.log(`   ${categoryName}:`);

    bookmarklets.forEach(bookmarklet => {
      const filePath = findBookmarkletFile(bookmarklet.file);
      const status = filePath ? '✅' : '⚠️ ';
      console.log(`     ${status} ${bookmarklet.title} (${bookmarklet.file})`);
    });
  });

  console.log('');
  console.log('💡 開発のポイント:');
  console.log('   • 設定ファイル: gallery.yml で管理');
  console.log('   • JSファイル: コメント・可読性を保持（Git管理用）');
  console.log(`   • HTML出力: ${BUILD_CONFIG.minify !== false ? 'Terser最適化済み' : '非圧縮'}`);
  console.log('   • 新規追加: JSファイル作成 + YMLに登録');
}

// CLI実行時のメイン処理
if (require.main === module) {
  buildInstallPage().catch(error => {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  });
}

module.exports = { buildInstallPage };
