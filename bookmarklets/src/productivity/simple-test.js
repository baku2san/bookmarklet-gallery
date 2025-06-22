/**
 * Simple Test Bookmarklet
 * シンプルなテスト用ブックマークレット
 */

javascript: (function () {
    'use strict';

    // 既存のパネルを削除
    var existingPanel = document.getElementById('shima-test-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    // テストパネルを作成
    var panel = document.createElement('div');
    panel.id = 'shima-test-panel';
    panel.style.cssText = 'position:fixed!important;top:20px!important;right:20px!important;width:300px!important;background:white!important;border:2px solid #007acc!important;border-radius:8px!important;padding:20px!important;z-index:2147483647!important;font-family:Arial,sans-serif!important;box-shadow:0 4px 20px rgba(0,0,0,0.3)!important;';

    panel.innerHTML = '<h3 style="margin:0 0 10px 0!important;color:#007acc!important;">Test Bookmarklet</h3><p style="margin:0 0 10px 0!important;">ブックマークレットが正常に動作しています！</p><button onclick="this.parentElement.remove()" style="background:#007acc!important;color:white!important;border:none!important;padding:8px 16px!important;border-radius:4px!important;cursor:pointer!important;">閉じる</button>';

    document.body.appendChild(panel);
})();
