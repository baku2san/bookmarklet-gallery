/**
 * 新規ブックマークレット: Hello World
 * @description シンプルなテストブックマークレット
 * @version 1.0.0
 */
(function () {
  'use strict';

  // 基本動作確認
  const message = `Hello, Bookmarklet Gallery!
  
現在のページ: ${document.title}
URL: ${location.href}
実行時刻: ${new Date().toLocaleString('ja-JP')}`;

  // アラート表示
  alert(message);

  // コンソールにも出力
  console.log('🔖 Hello World ブックマークレット実行完了');
})();
