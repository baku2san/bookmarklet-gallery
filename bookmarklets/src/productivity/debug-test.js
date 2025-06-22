/**
 * Bookmarklet Debugger
 * ブックマークレットのデバッグ用ツール
 */

javascript: (function () {
    'use strict';

    try {
        alert('✅ ブックマークレットの実行が開始されました！\n\n詳細情報:\n' +
            '- ページタイトル: ' + document.title + '\n' +
            '- URL: ' + window.location.href + '\n' +
            '- User Agent: ' + navigator.userAgent.substring(0, 50) + '...\n' +
            '- 現在時刻: ' + new Date().toLocaleString());

        console.log('Bookmarklet Debug Info:', {
            title: document.title,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        alert('❌ エラーが発生しました: ' + error.message);
        console.error('Bookmarklet Error:', error);
    }
})();
