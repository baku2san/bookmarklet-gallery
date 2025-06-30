/**
 * Page Analyzer Bookmarklet
 * Analyzes and displays basic information about the current page
 */

javascript: (function () {
  'use strict';

  // =============================================================================
  // MemoryManager - メモリーリーク対策ユーティリティ（Page Analyzer 用）
  // =============================================================================
  class MemoryManager {
    constructor() {
      this.eventListeners = new Map();
      this.isCleanedUp = false;
    }

    addEventListener(element, type, handler, options = {}) {
      if (this.isCleanedUp || !element || typeof handler !== 'function') return;

      element.addEventListener(type, handler, options);

      if (!this.eventListeners.has(element)) {
        this.eventListeners.set(element, []);
      }

      this.eventListeners.get(element).push({ type, handler, options });
    }

    cleanup() {
      if (this.isCleanedUp) return;

      // イベントリスナーのクリーンアップ
      for (const [element, listeners] of this.eventListeners.entries()) {
        for (const listener of listeners) {
          try {
            element.removeEventListener(listener.type, listener.handler, listener.options);
          } catch (error) {
            console.warn('Page Analyzer MemoryManager: Error removing event listener:', error);
          }
        }
      }
      this.eventListeners.clear();

      this.isCleanedUp = true;
      console.log('📊 Page Analyzer: メモリークリーンアップ完了');
    }
  }

  // メモリーマネージャーのインスタンス作成
  const memoryManager = new MemoryManager();

  // Remove existing panel if present
  var existingPanel = document.getElementById('shima-page-analyzer');
  if (existingPanel) {
    existingPanel.remove();
    return;
  }

  // Create analysis panel
  var panel = document.createElement('div');
  panel.id = 'shima-page-analyzer';
  panel.style.cssText = `
    all: initial;
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    width: 350px !important;
    max-height: 500px !important;
    background: white !important;
    border: 2px solid #007acc !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
    z-index: 2147483647 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    line-height: 1.4 !important;
    color: #333 !important;
    overflow-y: auto !important;
  `;

  // Analyze page content
  function analyzePage() {
    var analysis = {
      title: document.title || 'No title',
      url: window.location.href,
      domain: window.location.hostname,
      protocol: window.location.protocol,
      wordCount: (document.body.innerText || '').split(/\s+/).filter(word => word.length > 0)
        .length,
      charCount: (document.body.innerText || '').length,
      images: document.images.length,
      links: document.links.length,
      forms: document.forms.length,
      scripts: document.scripts.length,
      stylesheets: document.styleSheets.length,
      headings: {
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('h2').length,
        h3: document.querySelectorAll('h3').length,
        h4: document.querySelectorAll('h4').length,
        h5: document.querySelectorAll('h5').length,
        h6: document.querySelectorAll('h6').length,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      doctype: document.doctype ? document.doctype.name : 'No DOCTYPE',
      language: document.documentElement.lang || 'Not specified',
      charset: document.characterSet || 'Not specified',
    };

    // SEO Analysis
    var metaDescription = document.querySelector('meta[name="description"]');
    var metaKeywords = document.querySelector('meta[name="keywords"]');
    var metaViewport = document.querySelector('meta[name="viewport"]');
    var canonicalLink = document.querySelector('link[rel="canonical"]');

    analysis.seo = {
      metaDescription: metaDescription ? metaDescription.content : 'Missing',
      metaKeywords: metaKeywords ? metaKeywords.content : 'Missing',
      metaViewport: metaViewport ? metaViewport.content : 'Missing',
      canonical: canonicalLink ? canonicalLink.href : 'Missing',
      titleLength: analysis.title.length,
      hasOpenGraph: !!document.querySelector('meta[property^="og:"]'),
      hasTwitterCard: !!document.querySelector('meta[name^="twitter:"]'),
    };

    return analysis;
  }

  // Create HTML content
  function createContent(analysis) {
    return `
      <div style="padding: 15px !important;">
        <div style="display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 15px !important; border-bottom: 1px solid #eee !important; padding-bottom: 10px !important;">
          <h3 style="margin: 0 !important; color: #007acc !important; font-size: 16px !important;">Page Analyzer</h3>
          <button id="shima-close-analyzer" style="background: #ff4757 !important; color: white !important; border: none !important; border-radius: 4px !important; padding: 4px 8px !important; cursor: pointer !important; font-size: 12px !important;">✕</button>
        </div>

        <div style="margin-bottom: 12px !important;">
          <h4 style="margin: 0 0 5px 0 !important; font-size: 14px !important; color: #555 !important;">Basic Info</h4>
          <div style="font-size: 12px !important; color: #666 !important;">
            <div><strong>Title:</strong> ${analysis.title}</div>
            <div><strong>Domain:</strong> ${analysis.domain}</div>
            <div><strong>Protocol:</strong> ${analysis.protocol}</div>
            <div><strong>Language:</strong> ${analysis.language}</div>
            <div><strong>Charset:</strong> ${analysis.charset}</div>
            <div><strong>Doctype:</strong> ${analysis.doctype}</div>
          </div>
        </div>

        <div style="margin-bottom: 12px !important;">
          <h4 style="margin: 0 0 5px 0 !important; font-size: 14px !important; color: #555 !important;">Content</h4>
          <div style="font-size: 12px !important; color: #666 !important;">
            <div><strong>Words:</strong> ${analysis.wordCount.toLocaleString()}</div>
            <div><strong>Characters:</strong> ${analysis.charCount.toLocaleString()}</div>
            <div><strong>Images:</strong> ${analysis.images}</div>
            <div><strong>Links:</strong> ${analysis.links}</div>
            <div><strong>Forms:</strong> ${analysis.forms}</div>
          </div>
        </div>

        <div style="margin-bottom: 12px !important;">
          <h4 style="margin: 0 0 5px 0 !important; font-size: 14px !important; color: #555 !important;">Headings</h4>
          <div style="font-size: 12px !important; color: #666 !important;">
            <div>H1: ${analysis.headings.h1} | H2: ${analysis.headings.h2} | H3: ${analysis.headings.h3}</div>
            <div>H4: ${analysis.headings.h4} | H5: ${analysis.headings.h5} | H6: ${analysis.headings.h6}</div>
          </div>
        </div>

        <div style="margin-bottom: 12px !important;">
          <h4 style="margin: 0 0 5px 0 !important; font-size: 14px !important; color: #555 !important;">Resources</h4>
          <div style="font-size: 12px !important; color: #666 !important;">
            <div><strong>Scripts:</strong> ${analysis.scripts}</div>
            <div><strong>Stylesheets:</strong> ${analysis.stylesheets}</div>
          </div>
        </div>

        <div style="margin-bottom: 12px !important;">
          <h4 style="margin: 0 0 5px 0 !important; font-size: 14px !important; color: #555 !important;">SEO</h4>
          <div style="font-size: 12px !important; color: #666 !important;">
            <div><strong>Title Length:</strong> ${analysis.seo.titleLength} chars ${analysis.seo.titleLength > 60 ? '⚠️' : '✅'}</div>
            <div><strong>Meta Description:</strong> ${analysis.seo.metaDescription !== 'Missing' ? '✅' : '❌'}</div>
            <div><strong>Canonical URL:</strong> ${analysis.seo.canonical !== 'Missing' ? '✅' : '❌'}</div>
            <div><strong>Open Graph:</strong> ${analysis.seo.hasOpenGraph ? '✅' : '❌'}</div>
            <div><strong>Twitter Card:</strong> ${analysis.seo.hasTwitterCard ? '✅' : '❌'}</div>
          </div>
        </div>

        <div style="margin-bottom: 12px !important;">
          <h4 style="margin: 0 0 5px 0 !important; font-size: 14px !important; color: #555 !important;">Viewport</h4>
          <div style="font-size: 12px !important; color: #666 !important;">
            <div><strong>Size:</strong> ${analysis.viewport.width} × ${analysis.viewport.height}</div>
            <div><strong>Meta Viewport:</strong> ${analysis.seo.metaViewport !== 'Missing' ? '✅' : '❌'}</div>
          </div>
        </div>

        <div style="text-align: center !important; margin-top: 15px !important; padding-top: 10px !important; border-top: 1px solid #eee !important;">
          <button id="shima-copy-report" style="background: #007acc !important; color: white !important; border: none !important; border-radius: 4px !important; padding: 6px 12px !important; cursor: pointer !important; font-size: 12px !important; margin-right: 8px !important;">Copy Report</button>
          <button id="shima-export-csv" style="background: #28a745 !important; color: white !important; border: none !important; border-radius: 4px !important; padding: 6px 12px !important; cursor: pointer !important; font-size: 12px !important;">Export CSV</button>
        </div>
      </div>
    `;
  }

  // Generate text report
  function generateReport(analysis) {
    return `
PAGE ANALYSIS REPORT
===================
URL: ${analysis.url}
Title: ${analysis.title}
Domain: ${analysis.domain}
Generated: ${new Date().toLocaleString()}

CONTENT METRICS
- Words: ${analysis.wordCount.toLocaleString()}
- Characters: ${analysis.charCount.toLocaleString()}
- Images: ${analysis.images}
- Links: ${analysis.links}
- Forms: ${analysis.forms}

HEADINGS STRUCTURE
- H1: ${analysis.headings.h1}
- H2: ${analysis.headings.h2}
- H3: ${analysis.headings.h3}
- H4: ${analysis.headings.h4}
- H5: ${analysis.headings.h5}
- H6: ${analysis.headings.h6}

SEO ANALYSIS
- Title Length: ${analysis.seo.titleLength} characters
- Meta Description: ${analysis.seo.metaDescription !== 'Missing' ? 'Present' : 'Missing'}
- Canonical URL: ${analysis.seo.canonical !== 'Missing' ? 'Present' : 'Missing'}
- Open Graph: ${analysis.seo.hasOpenGraph ? 'Present' : 'Missing'}
- Twitter Cards: ${analysis.seo.hasTwitterCard ? 'Present' : 'Missing'}

TECHNICAL INFO
- Language: ${analysis.language}
- Character Set: ${analysis.charset}
- DOCTYPE: ${analysis.doctype}
- Scripts: ${analysis.scripts}
- Stylesheets: ${analysis.stylesheets}
- Viewport: ${analysis.viewport.width} × ${analysis.viewport.height}
    `.trim();
  }

  // Copy to clipboard
  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          alert('Report copied to clipboard!');
        })
        .catch(() => {
          fallbackCopy(text);
        });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      alert('Report copied to clipboard!');
    } catch (err) {
      alert('Could not copy report. Please select and copy manually.');
    }
    document.body.removeChild(textarea);
  }

  // Export as CSV
  function exportCSV(analysis) {
    var csv = 'Metric,Value\n';
    csv += `URL,"${analysis.url}"\n`;
    csv += `Title,"${analysis.title}"\n`;
    csv += `Domain,"${analysis.domain}"\n`;
    csv += `Word Count,${analysis.wordCount}\n`;
    csv += `Character Count,${analysis.charCount}\n`;
    csv += `Images,${analysis.images}\n`;
    csv += `Links,${analysis.links}\n`;
    csv += `Forms,${analysis.forms}\n`;
    csv += `H1 Count,${analysis.headings.h1}\n`;
    csv += `H2 Count,${analysis.headings.h2}\n`;
    csv += `H3 Count,${analysis.headings.h3}\n`;

    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = `page-analysis-${analysis.domain}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Main execution
  try {
    var analysis = analyzePage();
    panel.innerHTML = createContent(analysis);

    // Add event listeners with MemoryManager
    const closeBtn = panel.querySelector('#shima-close-analyzer');
    if (closeBtn) {
      memoryManager.addEventListener(closeBtn, 'click', function () {
        memoryManager.cleanup();
        panel.remove();
      });
    }

    const copyBtn = panel.querySelector('#shima-copy-report');
    if (copyBtn) {
      memoryManager.addEventListener(copyBtn, 'click', function () {
        copyToClipboard(generateReport(analysis));
      });
    }

    const exportBtn = panel.querySelector('#shima-export-csv');
    if (exportBtn) {
      memoryManager.addEventListener(exportBtn, 'click', function () {
        exportCSV(analysis);
      });
    }

    // Add to page
    document.body.appendChild(panel);
  } catch (error) {
    console.error('Page Analyzer Error:', error);
    alert('Error analyzing page: ' + error.message);
  }
})();
