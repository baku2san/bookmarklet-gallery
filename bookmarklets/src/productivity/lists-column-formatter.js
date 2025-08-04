/**
 * Microsoft Lists Column Formatter Bookmarklet
 * Microsoft Lists の JSON 列書式設定支援ツール
 *
 * 機能:
 * - 既存の Lists から JSON 列書式を取得
 * - 書式を他の Lists に適用（列名変更可能）
 * - 書式の保存・管理・共有
 * - クリップボード経由での書式共有
 */

(() => {
  'use strict';

  // =============================================================================
  // Memory Manager の読み込み
  // =============================================================================
  // MemoryManager クラスが利用できない場合は読み込む
  if (typeof MemoryManager === 'undefined') {
    // MemoryManager のロード用スクリプト
    const script = document.createElement('script');
    script.src =
      'https://cdn.jsdelivr.net/gh/shimabukuromeg/bookmarklet-gallery@main/bookmarklets/src/memory-manager.js';
    script.onerror = () => {
      console.warn('MemoryManager の読み込みに失敗。基本機能で動作します。');
      window.MemoryManager = class {
        addEventListener(el, type, handler, opts) {
          el.addEventListener(type, handler, opts);
        }
        removeEventListener(el, type, handler, opts) {
          el.removeEventListener(type, handler, opts);
        }
        setInterval(cb, delay) {
          return setInterval(cb, delay);
        }
        setTimeout(cb, delay) {
          return setTimeout(cb, delay);
        }
        clearInterval(id) {
          clearInterval(id);
        }
        clearTimeout(id) {
          clearTimeout(id);
        }
        cleanup() { }
      };
    };
    document.head.appendChild(script);
  }

  // Memory Manager インスタンス
  const memoryManager = new MemoryManager({
    debugMode: false,
    enableWarnings: true,
  });

  // =============================================================================
  // 定数定義
  // =============================================================================
  const CONSTANTS = {
    PANEL_ID: 'lists-formatter-panel',
    STORAGE_KEY: 'lists-column-formats',
    Z_INDEX: 999999,
    PANEL_WIDTH: 400,
    PANEL_HEIGHT: 600,
  };

  // SharePoint デザインシステム
  const SHAREPOINT_DESIGN_SYSTEM = {
    COLORS: {
      PRIMARY: '#0078d4',
      BACKGROUND: {
        PRIMARY: '#ffffff',
        SECONDARY: '#f8f9fa',
        TERTIARY: '#f3f2f1',
      },
      TEXT: {
        PRIMARY: '#323130',
        SECONDARY: '#605e5c',
        MUTED: '#8a8886',
        INVERSE: '#ffffff',
      },
      BORDER: {
        DEFAULT: '#edebe9',
        FOCUS: '#0078d4',
      },
      STATUS: {
        SUCCESS: '#107c10',
        WARNING: '#ffaa44',
        ERROR: '#d13438',
        INFO: '#0078d4',
      },
    },
    TYPOGRAPHY: {
      FONT_FAMILY: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Web Regular', 'Segoe UI Symbol', 'Helvetica Neue', Arial, sans-serif`,
      SIZES: {
        H1: '20px',
        H2: '18px',
        H3: '16px',
        H4: '14px',
        BODY: '14px',
        CAPTION: '12px',
        SMALL: '11px',
      },
      WEIGHTS: {
        NORMAL: '400',
        MEDIUM: '500',
        SEMIBOLD: '600',
        BOLD: '700',
      },
    },
    SPACING: {
      XS: '4px',
      SM: '8px',
      MD: '12px',
      LG: '16px',
      XL: '24px',
    },
    BORDER_RADIUS: {
      SM: '2px',
      MD: '4px',
      LG: '6px',
      XL: '8px',
    },
    SHADOWS: {
      PANEL: '0 8px 16px rgba(0, 0, 0, 0.14), 0 0 2px rgba(0, 0, 0, 0.12)',
    },
  };

  // =============================================================================
  // ユーティリティクラス
  // =============================================================================
  class Utils {
    // HTML エスケープ
    static escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // 現在のサイト情報を取得（SharePoint & OneDrive対応）
    static getSiteInfo() {
      const url = window.location.href;
      const hostname = window.location.hostname;

      // OneDrive の判定
      const isOneDrive =
        hostname.includes('onedrive.live.com') ||
        hostname.includes('-my.sharepoint.com') ||
        url.includes('/personal/');

      // SharePoint Online または SharePoint Server の判定
      const isSharePointOnline = hostname.includes('.sharepoint.com');
      const isSharePointServer =
        document.querySelector('[data-automation-id="siteLogo"]') ||
        document.querySelector('.ms-siteHeader-siteName') ||
        url.includes('/_layouts/');

      // OneDrive、SharePoint、またはSharePoint Serverのいずれでもない場合
      if (!isOneDrive && !isSharePointOnline && !isSharePointServer) {
        return null;
      }

      // ベースURLの取得
      let baseUrl = window.location.origin;
      const pathParts = window.location.pathname.split('/').filter(p => p);

      if (isOneDrive) {
        // OneDrive の場合
        if (hostname.includes('onedrive.live.com')) {
          // Consumer OneDrive: https://onedrive.live.com/
          baseUrl = window.location.origin;
        } else if (hostname.includes('-my.sharepoint.com')) {
          // Business OneDrive: https://tenant-my.sharepoint.com/personal/user_tenant_onmicrosoft_com
          if (pathParts.length >= 2 && pathParts[0] === 'personal') {
            baseUrl += `/${pathParts[0]}/${pathParts[1]}`;
          }
        }
      } else if (isSharePointOnline) {
        // SharePoint Online: /sites/sitename または /teams/teamname 形式
        if (pathParts.length >= 2 && (pathParts[0] === 'sites' || pathParts[0] === 'teams')) {
          baseUrl += `/${pathParts[0]}/${pathParts[1]}`;
        }
      } else {
        // SharePoint Server: サイトパスを推定
        const sitePath = pathParts.slice(0, -1).join('/');
        if (sitePath) {
          baseUrl += `/${sitePath}`;
        }
      }

      return {
        baseUrl,
        isOneDrive,
        isSharePointOnline,
        isSharePointServer,
        platformType: isOneDrive
          ? 'OneDrive'
          : isSharePointOnline
            ? 'SharePoint Online'
            : 'SharePoint Server',
        currentUrl: url,
      };
    }

    // Lists ページかどうかを判定（OneDrive対応）
    static isListsPage() {
      const url = window.location.href;
      const hostname = window.location.hostname;

      // OneDriveでのリスト判定
      if (hostname.includes('onedrive.live.com') || hostname.includes('-my.sharepoint.com')) {
        return (
          url.includes('/lists/') ||
          url.includes('?env=WebViewList') ||
          url.includes('?view=') ||
          document.querySelector('[data-automation-id="ColumnHeader"]') ||
          document.querySelector('.ms-List-page') ||
          document.querySelector('[data-automation-id="listView"]') ||
          // OneDrive特有のセレクタ
          document.querySelector('[data-automation-id="detailsListHeaderRow"]') ||
          document.querySelector('.od-ItemContent-list')
        );
      }

      // SharePointでのリスト判定（従来通り）
      return (
        url.includes('/lists/') ||
        url.includes('?env=WebViewList') ||
        document.querySelector('[data-automation-id="ColumnHeader"]') ||
        document.querySelector('.ms-List-page')
      );
    }

    // 現在のリスト情報を取得（OneDrive対応）
    static getCurrentListInfo() {
      const hostname = window.location.hostname;
      const url = window.location.href;
      let listTitle = '';

      // OneDriveでのリスト名取得
      if (hostname.includes('onedrive.live.com') || hostname.includes('-my.sharepoint.com')) {
        // Method 1: OneDrive特有のページタイトルから
        const title = document.title;
        if (title) {
          // OneDriveの場合、タイトルから「- OneDrive」や「- Personal」を除去
          listTitle = title
            .replace(/ - OneDrive.*$/, '')
            .replace(/ - Personal.*$/, '')
            .replace(/ - Microsoft Lists.*$/, '')
            .split(' - ')[0];
        }

        // Method 2: OneDrive特有のヘッダーから
        if (!listTitle) {
          const headerElement =
            document.querySelector('[data-automation-id="pageHeader"] h1') ||
            document.querySelector('[data-automation-id="breadcrumb"] span:last-child') ||
            document.querySelector('.od-ItemContent-title') ||
            document.querySelector('h1');
          if (headerElement) {
            listTitle = headerElement.textContent.trim();
          }
        }

        // Method 3: OneDrive URLパターンから推定
        if (!listTitle) {
          // OneDrive Business: /personal/user/Documents/Lists/ListName
          let match = url.match(/\/Lists\/([^\/\?]+)/);
          if (match) {
            listTitle = decodeURIComponent(match[1]).replace(/\+/g, ' ');
          } else {
            // Consumer OneDrive: 異なるパターンの可能性
            match = url.match(/\/lists\/([^\/\?]+)/);
            if (match) {
              listTitle = decodeURIComponent(match[1]).replace(/\+/g, ' ');
            }
          }
        }
      } else {
        // SharePointでのリスト名取得（従来通り）
        // Method 1: ページタイトルから
        const title = document.title;
        if (title && !title.includes('SharePoint')) {
          listTitle = title.split(' - ')[0];
        }

        // Method 2: ヘッダーから
        if (!listTitle) {
          const headerElement =
            document.querySelector('[data-automation-id="pageHeader"] h1') ||
            document.querySelector('.ms-List-page h1') ||
            document.querySelector('h1');
          if (headerElement) {
            listTitle = headerElement.textContent.trim();
          }
        }

        // Method 3: URLから推定
        if (!listTitle) {
          const match = window.location.pathname.match(/\/lists\/([^\/]+)/);
          if (match) {
            listTitle = decodeURIComponent(match[1]).replace(/\+/g, ' ');
          }
        }
      }

      return {
        title: listTitle,
        url: url,
        platform: hostname.includes('onedrive.live.com')
          ? 'OneDrive Consumer'
          : hostname.includes('-my.sharepoint.com')
            ? 'OneDrive Business'
            : hostname.includes('.sharepoint.com')
              ? 'SharePoint Online'
              : 'SharePoint Server',
      };
    }

    // ローカルストレージから書式データを取得
    static getSavedFormats() {
      try {
        const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch (error) {
        console.warn('保存された書式の取得に失敗:', error);
        return [];
      }
    }

    // ローカルストレージに書式データを保存
    static saveFormats(formats) {
      try {
        localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(formats));
        return true;
      } catch (error) {
        console.error('書式の保存に失敗:', error);
        return false;
      }
    }

    // 現在の日時を文字列で取得
    static getCurrentTimestamp() {
      return new Date().toLocaleString('ja-JP');
    }
  }

  // =============================================================================
  // デフォルト書式プロバイダークラス
  // =============================================================================
  class DefaultFormatProvider {
    constructor() {
      this.defaultFormats = this.initializeDefaultFormats();
    }

    // デフォルト書式テンプレートを初期化
    initializeDefaultFormats() {
      return {
        Number: [
          {
            id: 'number-percentage-color',
            name: 'パーセンテージ色分け',
            description: '数値を0-100%として色分け表示',
            category: 'visualization',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "background-color": "=if(@currentField >= 80, '#107c10', if(@currentField >= 60, '#ffaa44', if(@currentField >= 40, '#ff8c00', '#d13438')))",
                "color": "white",
                "padding": "4px 8px",
                "border-radius": "4px",
                "text-align": "center",
                "font-weight": "bold"
              },
              "txtContent": "=@currentField + '%'"
            },
            sampleData: 75
          },
          {
            id: 'number-progress-bar',
            name: '進捗バー',
            description: '数値を進捗バーとして表示',
            category: 'visualization',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "background-color": "#f3f2f1",
                "border-radius": "10px",
                "height": "20px",
                "position": "relative",
                "overflow": "hidden"
              },
              "children": [
                {
                  "elmType": "div",
                  "style": {
                    "background-color": "=if(@currentField >= 80, '#107c10', if(@currentField >= 60, '#0078d4', '#ffaa44'))",
                    "height": "100%",
                    "width": "=@currentField + '%'",
                    "transition": "width 0.3s ease"
                  }
                },
                {
                  "elmType": "div",
                  "style": {
                    "position": "absolute",
                    "top": "50%",
                    "left": "50%",
                    "transform": "translate(-50%, -50%)",
                    "font-size": "12px",
                    "font-weight": "bold",
                    "color": "#323130"
                  },
                  "txtContent": "=@currentField + '%'"
                }
              ]
            },
            sampleData: 65
          }
        ],
        Person: [
          {
            id: 'person-avatar-name',
            name: 'アバター + 名前',
            description: 'ユーザーのアバターと名前を表示',
            category: 'display',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "display": "flex",
                "align-items": "center",
                "gap": "8px",
                "flex-wrap": "wrap"
              },
              "children": [
                {
                  "forEach": "user in @currentField",
                  "elmType": "div",
                  "style": {
                    "display": "flex",
                    "align-items": "center",
                    "gap": "8px"
                  },
                  "children": [
                    {
                      "elmType": "img",
                      "attributes": {
                        "src": "=getUserImage([$user.email], 'S')",
                        "alt": "User Image"
                      },
                      "style": {
                        "width": "32px",
                        "height": "32px",
                        "border-radius": "50%",
                        "border": "2px solid #0078d4"
                      }
                    },
                    {
                      "elmType": "div",
                      "txtContent": "[$user.title]",
                      "style": {
                        "font-weight": "500"
                      }
                    }
                  ]
                }
              ]
            },
            sampleData: [{ title: "田中太郎", email: "tanaka@example.com" }, { title: "佐藤花子", email: "sato@example.com" }]
          },
          {
            id: 'person-hover-card',
            name: 'ホバーカード付きユーザー',
            description: 'ホバー時に詳細カードを表示するユーザー書式',
            category: 'display',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "display": "flex",
                "align-items": "center",
                "gap": "8px",
                "flex-wrap": "wrap"
              },
              "children": [
                {
                  "forEach": "user in @currentField",
                  "elmType": "div",
                  "style": {
                    "display": "flex",
                    "align-items": "center",
                    "gap": "8px"
                  },
                  "children": [
                    {
                      "elmType": "img",
                      "attributes": {
                        "src": "=getUserImage([$user.email], 'S')",
                        "alt": "User Image"
                      },
                      "style": {
                        "width": "32px",
                        "height": "32px",
                        "border-radius": "50%",
                        "border": "2px solid #0078d4"
                      }
                    },
                    {
                      "elmType": "div",
                      "txtContent": "[$user.title]",
                      "style": {
                        "font-weight": "500"
                      }
                    }
                  ],
                  "customCardProps": {
                    "openOnEvent": "hover",
                    "directionalHint": "bottomCenter",
                    "isBeakVisible": false,
                    "formatter": {
                      "elmType": "div",
                      "style": {
                        "width": "400px",
                        "padding": "20px 24px",
                        "flex-shrink": "0",
                        "color": "#333333",
                        "display": "block"
                      },
                      "children": [
                        {
                          "elmType": "div",
                          "style": {
                            "display": "flex",
                            "align-items": "center"
                          },
                          "children": [
                            {
                              "elmType": "img",
                              "style": {
                                "width": "72px",
                                "height": "72px",
                                "overflow": "hidden",
                                "border-radius": "50%",
                                "margin": "2px",
                                "flex-shrink": "0"
                              },
                              "attributes": {
                                "src": "=@currentWeb + '/_layouts/15/userphoto.aspx?size=M&accountname=' + @currentField.email",
                                "title": "@currentField.title",
                                "alt": "='Profile picture of ' + @currentField.title"
                              }
                            },
                            {
                              "elmType": "div",
                              "style": {
                                "margin-left": "12px",
                                "height": "72px",
                                "width": "320px"
                              },
                              "children": [
                                {
                                  "elmType": "div",
                                  "style": {
                                    "overflow": "hidden",
                                    "text-overflow": "ellipsis",
                                    "white-space": "nowrap"
                                  },
                                  "attributes": {
                                    "class": "ms-fontSize-16 ms-fontWeight-semibold",
                                    "title": "@currentField.title"
                                  },
                                  "txtContent": "@currentField.title"
                                },
                                {
                                  "elmType": "div",
                                  "txtContent": "@currentField.jobTitle"
                                },
                                {
                                  "elmType": "div",
                                  "txtContent": "@currentField.department"
                                },
                                {
                                  "elmType": "div",
                                  "txtContent": "@currentField.email"
                                }
                              ]
                            }
                          ]
                        },
                        {
                          "elmType": "div",
                          "style": {
                            "margin-top": "5px"
                          },
                          "children": [
                            {
                              "elmType": "a",
                              "attributes": {
                                "class": "ms-fontColor-themePrimary ms-bgColor-gray20--hover",
                                "href": "='mailto:' + @currentField.email"
                              },
                              "style": {
                                "padding": "10px",
                                "cursor": "pointer",
                                "text-decoration": "none",
                                "display": "=if(length(@currentField.email) == 0, 'none', 'inline-block')"
                              },
                              "children": [
                                {
                                  "elmType": "span",
                                  "attributes": {
                                    "iconName": "Mail",
                                    "class": "ms-fontSize-16"
                                  },
                                  "style": {
                                    "padding-right": "6px",
                                    "position": "relative",
                                    "top": "3px"
                                  }
                                },
                                {
                                  "elmType": "span",
                                  "txtContent": "Send email"
                                }
                              ]
                            },
                            {
                              "elmType": "a",
                              "attributes": {
                                "class": "ms-fontColor-themePrimary ms-bgColor-gray20--hover",
                                "target": "_blank",
                                "href": "=@currentWeb + '/_layouts/15/userdisp.aspx?ID=' + @currentField.id"
                              },
                              "style": {
                                "padding": "10px",
                                "cursor": "pointer",
                                "text-decoration": "none",
                                "display": "=if(length(@currentField.email) == 0, 'none', 'inline-block')"
                              },
                              "children": [
                                {
                                  "elmType": "span",
                                  "attributes": {
                                    "iconName": "ContactCard",
                                    "class": "ms-fontSize-16"
                                  },
                                  "style": {
                                    "padding-right": "6px",
                                    "position": "relative",
                                    "top": "3px"
                                  }
                                },
                                {
                                  "elmType": "span",
                                  "txtContent": "View Profile"
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  }
                }
              ]
            },
            sampleData: [{ title: "田中太郎", email: "tanaka@example.com", jobTitle: "開発者", department: "IT部" }]
          },
          {
            id: 'person-card',
            name: 'ユーザーカード',
            description: 'カード形式でユーザー情報を表示',
            category: 'display',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "background-color": "#f8f9fa",
                "border": "1px solid #edebe9",
                "border-radius": "6px",
                "padding": "8px",
                "display": "flex",
                "align-items": "center",
                "gap": "8px",
                "max-width": "200px"
              },
              "children": [
                {
                  "elmType": "img",
                  "attributes": {
                    "src": "=getUserImage(@currentField.email, 'S')"
                  },
                  "style": {
                    "width": "24px",
                    "height": "24px",
                    "border-radius": "50%"
                  }
                },
                {
                  "elmType": "div",
                  "children": [
                    {
                      "elmType": "div",
                      "txtContent": "@currentField.title",
                      "style": {
                        "font-size": "13px",
                        "font-weight": "600",
                        "line-height": "1.2"
                      }
                    },
                    {
                      "elmType": "div",
                      "txtContent": "@currentField.email",
                      "style": {
                        "font-size": "11px",
                        "color": "#605e5c",
                        "line-height": "1.2"
                      }
                    }
                  ]
                }
              ]
            },
            sampleData: { title: "佐藤花子", email: "sato@example.com" }
          },
          {
            id: 'person-initials-circle',
            name: 'イニシャル円形',
            description: 'ユーザーのイニシャルを円形で表示',
            category: 'display',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "display": "flex",
                "align-items": "center",
                "gap": "8px"
              },
              "children": [
                {
                  "elmType": "div",
                  "style": {
                    "width": "32px",
                    "height": "32px",
                    "border-radius": "50%",
                    "background-color": "#0078d4",
                    "color": "white",
                    "display": "flex",
                    "align-items": "center",
                    "justify-content": "center",
                    "font-weight": "600",
                    "font-size": "14px"
                  },
                  "txtContent": "=substring(toUpper(@currentField.title), 0, 1)"
                },
                {
                  "elmType": "div",
                  "txtContent": "@currentField.title",
                  "style": {
                    "font-weight": "500"
                  }
                }
              ]
            },
            sampleData: { title: "山田太郎", email: "yamada@example.com" }
          },
          {
            id: 'person-profile-image',
            name: 'プロフィール画像',
            description: 'SharePointプロフィール画像を表示',
            category: 'display',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "display": "flex",
                "align-items": "center",
                "gap": "8px"
              },
              "children": [
                {
                  "elmType": "img",
                  "attributes": {
                    "src": "='/_layouts/15/userphoto.aspx?size=S&username=' + @currentField.email"
                  },
                  "style": {
                    "width": "32px",
                    "height": "32px",
                    "border-radius": "50%",
                    "border": "2px solid #0078d4"
                  }
                },
                {
                  "elmType": "div",
                  "txtContent": "@currentField.title",
                  "style": {
                    "font-weight": "500"
                  }
                }
              ]
            },
            sampleData: { title: "鈴木花子", email: "suzuki@example.com" }
          }
        ],
        DateTime: [
          {
            id: 'datetime-relative',
            name: '相対時間表示',
            description: '現在時刻からの相対時間を表示',
            category: 'display',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "display": "flex",
                "align-items": "center",
                "gap": "6px"
              },
              "children": [
                {
                  "elmType": "span",
                  "style": {
                    "font-size": "14px"
                  },
                  "txtContent": "🕒"
                },
                {
                  "elmType": "span",
                  "txtContent": "=toLocaleDateString(@currentField) + ' (' + toRelativeTime(@currentField) + ')'"
                }
              ]
            },
            sampleData: "2024-01-15T10:00:00Z"
          },
          {
            id: 'datetime-icon-date',
            name: 'アイコン付き日付',
            description: 'カレンダーアイコン付きで日付を表示',
            category: 'display',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "display": "flex",
                "align-items": "center",
                "gap": "8px",
                "background-color": "#f3f2f1",
                "padding": "4px 8px",
                "border-radius": "4px",
                "border-left": "3px solid #0078d4"
              },
              "children": [
                {
                  "elmType": "span",
                  "style": {
                    "font-size": "16px"
                  },
                  "txtContent": "📅"
                },
                {
                  "elmType": "span",
                  "txtContent": "=toLocaleDateString(@currentField)",
                  "style": {
                    "font-weight": "500"
                  }
                }
              ]
            },
            sampleData: "2024-02-20T15:30:00Z"
          }
        ],
        Choice: [
          {
            id: 'choice-color-pill',
            name: 'カラーピル',
            description: '選択肢を色付きピルで表示',
            category: 'visualization',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "background-color": "=if(@currentField == '完了', '#107c10', if(@currentField == '進行中', '#0078d4', if(@currentField == '保留', '#ffaa44', '#8a8886')))",
                "color": "white",
                "padding": "4px 12px",
                "border-radius": "12px",
                "font-size": "12px",
                "font-weight": "600",
                "text-align": "center",
                "display": "inline-block"
              },
              "txtContent": "@currentField"
            },
            sampleData: "進行中"
          },
          {
            id: 'choice-icon-status',
            name: 'アイコン付きステータス',
            description: 'アイコン付きでステータスを表示',
            category: 'visualization',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "display": "flex",
                "align-items": "center",
                "gap": "6px"
              },
              "children": [
                {
                  "elmType": "span",
                  "style": {
                    "font-size": "14px"
                  },
                  "txtContent": "=if(@currentField == '完了', '✅', if(@currentField == '進行中', '🔄', if(@currentField == '保留', '⏸️', '❓')))"
                },
                {
                  "elmType": "span",
                  "txtContent": "@currentField",
                  "style": {
                    "font-weight": "500"
                  }
                }
              ]
            },
            sampleData: "完了"
          }
        ],
        Boolean: [
          {
            id: 'boolean-check-cross',
            name: 'チェック/バツ',
            description: 'はい/いいえをチェックマーク/バツ印で表示',
            category: 'visualization',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "text-align": "center",
                "font-size": "16px"
              },
              "txtContent": "=if(@currentField == true, '✅', '❌')"
            },
            sampleData: true
          },
          {
            id: 'boolean-status-badge',
            name: 'ステータスバッジ',
            description: 'はい/いいえをステータスバッジで表示',
            category: 'visualization',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "background-color": "=if(@currentField == true, '#107c10', '#d13438')",
                "color": "white",
                "padding": "4px 8px",
                "border-radius": "4px",
                "font-size": "12px",
                "font-weight": "600",
                "text-align": "center",
                "display": "inline-block"
              },
              "txtContent": "=if(@currentField == true, 'はい', 'いいえ')"
            },
            sampleData: false
          }
        ],
        Text: [
          {
            id: 'text-highlight',
            name: 'ハイライト表示',
            description: 'テキストをハイライト表示',
            category: 'display',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "background-color": "#fff4ce",
                "border-left": "3px solid #ffaa44",
                "padding": "6px 8px",
                "font-weight": "500"
              },
              "txtContent": "@currentField"
            },
            sampleData: "重要なテキスト"
          },
          {
            id: 'text-badge',
            name: 'バッジ表示',
            description: 'テキストをバッジ形式で表示',
            category: 'display',
            formatJson: {
              "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
              "elmType": "div",
              "style": {
                "background-color": "#0078d4",
                "color": "white",
                "padding": "4px 8px",
                "border-radius": "4px",
                "font-size": "12px",
                "font-weight": "600",
                "display": "inline-block"
              },
              "txtContent": "@currentField"
            },
            sampleData: "ラベル"
          }
        ]
      };
    }

    // 指定された列タイプのデフォルト書式を取得
    getDefaultFormatsForType(columnType) {
      const normalizedType = ColumnFormatManager.normalizeColumnType(columnType);
      return this.defaultFormats[normalizedType] || [];
    }

    // 全てのデフォルト書式を取得
    getAllDefaultFormats() {
      return this.defaultFormats;
    }

    // デフォルト書式を列に適用するためにカスタマイズ
    customizeFormatForColumn(formatTemplate, columnInternalName, columnTitle) {
      const customizedFormat = JSON.parse(JSON.stringify(formatTemplate.formatJson));

      // フィールド参照を実際の列名に置換
      const replaceFieldReferences = (obj) => {
        if (typeof obj === 'string') {
          return obj.replace(/\[\$FieldName\]/g, `[$${columnInternalName}]`)
            .replace(/\[\$FieldName\.([^\]]+)\]/g, `[$${columnInternalName}.$1]`);
        } else if (Array.isArray(obj)) {
          return obj.map(replaceFieldReferences);
        } else if (obj && typeof obj === 'object') {
          const result = {};
          for (const [key, value] of Object.entries(obj)) {
            result[key] = replaceFieldReferences(value);
          }
          return result;
        }
        return obj;
      };

      return replaceFieldReferences(customizedFormat);
    }

    // デフォルト書式の検証
    validateDefaultFormat(formatTemplate) {
      try {
        if (!formatTemplate.id || !formatTemplate.name || !formatTemplate.formatJson) {
          return { isValid: false, error: '必須フィールドが不足しています' };
        }

        // JSON構造の基本検証
        if (typeof formatTemplate.formatJson !== 'object') {
          return { isValid: false, error: 'formatJsonが無効です' };
        }

        return { isValid: true };
      } catch (error) {
        return { isValid: false, error: error.message };
      }
    }

    // 指定された列タイプのサンプルデータを生成
    generateSampleDataForType(columnType) {
      const sampleDataMap = {
        Number: 75,
        Person: { title: "サンプルユーザー", email: "sample@example.com" },
        DateTime: new Date().toISOString(),
        Choice: "サンプル選択肢",
        Boolean: true,
        Text: "サンプルテキスト"
      };

      const normalizedType = ColumnFormatManager.normalizeColumnType(columnType);
      return sampleDataMap[normalizedType] || "サンプルデータ";
    }
  }

  // =============================================================================
  // 列書式管理クラス
  // =============================================================================
  class ColumnFormatManager {
    constructor() {
      this.formats = Utils.getSavedFormats();
    }

    // 書式を保存
    saveFormat(formatData) {
      const newFormat = {
        id: Date.now().toString(),
        name: formatData.name,
        description: formatData.description || '',
        columnType: formatData.columnType,
        formatJson: formatData.formatJson,
        sourceList: formatData.sourceList || '',
        sourceColumn: formatData.sourceColumn || '',
        createdAt: Utils.getCurrentTimestamp(),
      };

      this.formats.unshift(newFormat);

      // 最大50件まで保持
      if (this.formats.length > 50) {
        this.formats = this.formats.slice(0, 50);
      }

      Utils.saveFormats(this.formats);
      return newFormat;
    }

    // 書式を削除
    deleteFormat(formatId) {
      this.formats = this.formats.filter(f => f.id !== formatId);
      Utils.saveFormats(this.formats);
    }

    // 書式を更新
    updateFormat(formatId, updates) {
      try {
        const formatIndex = this.formats.findIndex(f => f.id === formatId);
        if (formatIndex === -1) {
          return false;
        }

        // 更新可能なフィールドのみを更新
        const allowedFields = ['name', 'description'];
        const updatedFormat = { ...this.formats[formatIndex] };

        for (const [key, value] of Object.entries(updates)) {
          if (allowedFields.includes(key)) {
            updatedFormat[key] = value;
          }
        }

        this.formats[formatIndex] = updatedFormat;
        Utils.saveFormats(this.formats);
        return true;
      } catch (error) {
        console.error('書式の更新に失敗:', error);
        return false;
      }
    }

    // 書式を取得
    getFormat(formatId) {
      return this.formats.find(f => f.id === formatId);
    }

    // 全書式を取得
    getAllFormats() {
      return this.formats;
    }

    // 書式をクリップボードにコピー
    async copyFormatToClipboard(formatId) {
      const format = this.getFormat(formatId);
      if (!format) return false;

      const exportData = {
        name: format.name,
        description: format.description,
        columnType: format.columnType,
        formatJson: format.formatJson,
        exportedAt: Utils.getCurrentTimestamp(),
        exportedFrom: 'Microsoft Lists Column Formatter',
      };

      try {
        await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
        return true;
      } catch (error) {
        console.error('クリップボードへのコピーに失敗:', error);
        return false;
      }
    }

    // クリップボードから書式をインポート
    async importFormatFromClipboard() {
      try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text); // 内部書式形式（メタデータ付き）の場合
        if (data.formatJson && data.name) {
          const originalColumnType = data.columnType || 'Unknown';
          const normalizedType = ColumnFormatManager.normalizeColumnType(originalColumnType);

          const importedFormat = {
            name: `${data.name} (インポート)`,
            description: data.description || '',
            columnType: normalizedType,
            formatJson: data.formatJson,
            sourceList: 'インポート',
            sourceColumn: '',
          };

          return this.saveFormat(importedFormat);
        }

        // 純粋なJSON列書式（Microsoft公式スキーマ）の場合
        if (this.isValidColumnFormat(data)) {
          const timestamp = new Date().toLocaleString('ja-JP');
          const importedFormat = {
            name: `列書式 (${timestamp})`,
            description: 'クリップボードからインポートされた列書式',
            columnType: 'Generic', // インポート書式は汎用タイプとして扱う
            formatJson: data,
            sourceList: 'インポート',
            sourceColumn: '',
          };

          return this.saveFormat(importedFormat);
        }

        return null;
      } catch (error) {
        console.error('クリップボードからのインポートに失敗:', error);
        return null;
      }
    }

    // JSON列書式の妥当性チェック
    isValidColumnFormat(data) {
      // Microsoft Lists列書式の基本構造をチェック
      return (
        typeof data === 'object' &&
        data !== null &&
        (data.elmType || data.$schema || data.txtContent || data.style)
      );
    }

    // SharePointの列タイプを正規化（API由来の正確な型情報用）
    static normalizeColumnType(typeAsString) {
      if (!typeAsString) return 'Unknown';

      // SharePoint内部タイプを一般的な表示名に正規化
      const typeMapping = {
        Text: 'Text',
        Note: 'Text', // 複数行テキスト
        Number: 'Number',
        DateTime: 'DateTime',
        Boolean: 'Boolean',
        Choice: 'Choice',
        MultiChoice: 'Choice',
        Lookup: 'Lookup',
        LookupMulti: 'Lookup',
        User: 'Person', // User は Person として表示
        UserMulti: 'Person',
        URL: 'URL',
        Currency: 'Number',
        Integer: 'Number',
        Counter: 'Number',
        Guid: 'Text',
        File: 'File',
        Attachments: 'File',
        Calculated: 'Calculated',
        Threading: 'Text',
        GridChoice: 'Choice',
        Computed: 'Calculated',
        TaxonomyFieldType: 'Taxonomy',
        TaxonomyFieldTypeMulti: 'Taxonomy',
      };

      return typeMapping[typeAsString] || typeAsString;
    }
  }

  // =============================================================================
  // SharePoint API クライアント（OneDrive対応）
  // =============================================================================
  class SharePointApiClient {
    constructor(siteInfo) {
      this.siteInfo = siteInfo;

      // OneDriveとSharePointでAPIエンドポイントを使い分け
      if (siteInfo.isOneDrive) {
        // OneDriveの場合はMicrosoft Graph APIまたはSharePoint REST APIを使用
        this.apiBaseUrl = `${siteInfo.baseUrl}/_api`;
        this.isOneDriveMode = true;
      } else {
        // SharePointの場合は従来通り
        this.apiBaseUrl = `${siteInfo.baseUrl}/_api`;
        this.isOneDriveMode = false;
      }
    }

    // 書式の事前検証（プレビュー用）
    validateFormatCompatibility(formatJson, sourceField, targetField) {
      const validation = {
        isCompatible: true,
        warnings: [],
        errors: [],
        suggestions: [],
        previewData: null,
      };

      try {
        // 1. データ構造の違いをチェック
        const structureCheck = this.checkDataStructure(sourceField, targetField);
        validation.warnings.push(...structureCheck.warnings);
        validation.errors.push(...structureCheck.errors);

        // 2. 書式構文の検証
        const syntaxCheck = this.validateFormatSyntax(formatJson, targetField);
        validation.warnings.push(...syntaxCheck.warnings);
        validation.errors.push(...syntaxCheck.errors);

        // 3. サンプルデータでのプレビュー生成
        const previewData = this.generateFormatPreview(formatJson, targetField);
        validation.previewData = previewData;

        // 4. 自動修正の提案
        if (validation.errors.length > 0) {
          const suggestions = this.generateAutoFixSuggestions(formatJson, sourceField, targetField);
          validation.suggestions = suggestions;
        }

        validation.isCompatible = validation.errors.length === 0;
      } catch (error) {
        validation.errors.push(`検証中にエラーが発生しました: ${error.message}`);
        validation.isCompatible = false;
      }

      return validation;
    }

    // データ構造の違いをチェック
    checkDataStructure(sourceField, targetField) {
      const warnings = [];
      const errors = [];

      // 複数値フィールドのチェック
      if (sourceField.DetailedType?.isMultiValue !== targetField.DetailedType?.isMultiValue) {
        if (targetField.DetailedType?.isMultiValue) {
          errors.push('単一値用の書式を複数値フィールドに適用しようとしています');
          errors.push('配列データ構造のため、書式が正しく動作しない可能性があります');
        } else {
          warnings.push('複数値用の書式を単一値フィールドに適用しようとしています');
        }
      }

      // 参照フィールドのプロパティチェック
      if (sourceField.TypeAsString !== targetField.TypeAsString) {
        const sourceProps = this.getFieldProperties(sourceField.TypeAsString);
        const targetProps = this.getFieldProperties(targetField.TypeAsString);

        const missingProps = sourceProps.filter(prop => !targetProps.includes(prop));
        if (missingProps.length > 0) {
          errors.push(
            `対象フィールドに存在しないプロパティが使用されています: ${missingProps.join(', ')}`
          );
        }
      }

      return { warnings, errors };
    }

    // フィールドタイプ別のプロパティを取得
    getFieldProperties(typeAsString) {
      const propertyMap = {
        Lookup: ['lookupId', 'lookupValue'],
        LookupMulti: ['lookupId', 'lookupValue'], // 配列形式
        User: ['id', 'title', 'email', 'picture'],
        UserMulti: ['id', 'title', 'email', 'picture'], // 配列形式
        Choice: [], // 直接値
        MultiChoice: [], // 配列形式
        Text: [],
        Note: [],
        Number: [],
        Currency: [],
        DateTime: [],
        Boolean: [],
      };

      return propertyMap[typeAsString] || [];
    }

    // 書式構文の検証
    validateFormatSyntax(formatJson, targetField) {
      const warnings = [];
      const errors = [];

      try {
        // JSON構文の基本チェック
        const jsonString = JSON.stringify(formatJson);

        // フィールド参照の検証
        const fieldReferences = this.extractFieldReferences(jsonString);
        for (const fieldRef of fieldReferences) {
          const validationResult = this.validateFieldReference(fieldRef, targetField);
          warnings.push(...validationResult.warnings);
          errors.push(...validationResult.errors);
        }

        // 式の構文チェック
        const expressions = this.extractExpressions(jsonString);
        for (const expr of expressions) {
          const exprValidation = this.validateExpression(expr, targetField);
          warnings.push(...exprValidation.warnings);
          errors.push(...exprValidation.errors);
        }
      } catch (error) {
        errors.push(`JSON構文エラー: ${error.message}`);
      }

      return { warnings, errors };
    }

    // フィールド参照を抽出
    extractFieldReferences(jsonString) {
      const regex = /\[\$([^\]]+)\]/g;
      const references = [];
      let match;

      while ((match = regex.exec(jsonString)) !== null) {
        references.push(match[1]);
      }

      return [...new Set(references)]; // 重複除去
    }

    // フィールド参照の検証
    validateFieldReference(fieldRef, targetField) {
      const warnings = [];
      const errors = [];

      // プロパティアクセスのチェック（例: Field.lookupValue）
      if (fieldRef.includes('.')) {
        const [, property] = fieldRef.split('.');
        const availableProps = this.getFieldProperties(targetField.TypeAsString);

        if (!availableProps.includes(property)) {
          errors.push(
            `プロパティ '${property}' は ${targetField.TypeAsString} フィールドでは使用できません`
          );
        }
      }

      // 複数値フィールドでの配列処理チェック
      if (targetField.DetailedType?.isMultiValue && !fieldRef.includes('join(')) {
        warnings.push(`複数値フィールド '${fieldRef}' では join() 関数の使用を推奨します`);
      }

      return { warnings, errors };
    }

    // 式を抽出
    extractExpressions(jsonString) {
      const regex = /"=([^"]+)"/g;
      const expressions = [];
      let match;

      while ((match = regex.exec(jsonString)) !== null) {
        expressions.push(match[1]);
      }

      return expressions;
    }

    // 式の検証
    validateExpression(expression, targetField) {
      const warnings = [];
      const errors = [];

      // 複数値フィールドでの比較演算子チェック
      if (targetField.DetailedType?.isMultiValue) {
        if (expression.includes('==') || expression.includes('!=')) {
          warnings.push(
            `複数値フィールドでは '==' や '!=' の代わりに indexOf() の使用を推奨します`
          );
        }
      }

      // 数値フィールドでの文字列操作チェック
      if (targetField.DetailedType?.category === 'numeric') {
        if (expression.includes('substring(') || expression.includes('indexOf(')) {
          warnings.push('数値フィールドで文字列操作を行っています。意図した動作か確認してください');
        }
      }

      return { warnings, errors };
    }

    // プレビューデータの生成
    generateFormatPreview(formatJson, targetField) {
      try {
        // サンプルデータを生成
        const sampleData = this.generateSampleData(targetField);

        // 書式をサンプルデータに適用したプレビューHTMLを生成
        const previewHtml = this.renderFormatPreview(formatJson, sampleData, targetField);

        return {
          sampleData,
          previewHtml,
          success: true,
        };
      } catch (error) {
        return {
          sampleData: null,
          previewHtml: `<div style="color: red;">プレビュー生成エラー: ${error.message}</div>`,
          success: false,
        };
      }
    }

    // サンプルデータを生成
    generateSampleData(field) {
      const typeAsString = field.TypeAsString;
      const isMultiValue = field.DetailedType?.isMultiValue;

      const sampleDataMap = {
        Text: isMultiValue ? ['サンプル1', 'サンプル2'] : 'サンプルテキスト',
        Note: 'これは複数行テキストのサンプルです。\n改行も含まれています。',
        Number: isMultiValue ? [100, 200] : 150,
        Currency: isMultiValue ? [1000, 2000] : 1500,
        DateTime: isMultiValue
          ? ['2024-01-15T10:00:00Z', '2024-02-15T15:30:00Z']
          : '2024-01-15T10:00:00Z',
        Boolean: true,
        Choice: isMultiValue ? ['選択肢1', '選択肢2'] : '選択肢1',
        User: isMultiValue
          ? [
            { id: 1, title: '田中太郎', email: 'tanaka@example.com' },
            { id: 2, title: '佐藤花子', email: 'sato@example.com' },
          ]
          : { id: 1, title: '田中太郎', email: 'tanaka@example.com' },
        Lookup: isMultiValue
          ? [
            { lookupId: 1, lookupValue: '項目1' },
            { lookupId: 2, lookupValue: '項目2' },
          ]
          : { lookupId: 1, lookupValue: 'サンプル項目' },
        URL: { Url: 'https://example.com', Description: 'サンプルリンク' },
      };

      return sampleDataMap[typeAsString] || 'サンプルデータ';
    }

    // プレビューHTMLをレンダリング
    renderFormatPreview(formatJson, sampleData, field) {
      try {
        // 簡易的なプレビューレンダリング
        // 実際のSharePoint書式エンジンの完全な再現は困難なため、
        // 基本的な要素とスタイルのみをプレビュー

        const preview = this.renderElement(formatJson, sampleData, field);

        return `
          <div style="border: 1px solid #ccc; padding: 10px; background: #f9f9f9; border-radius: 4px;">
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">プレビュー（実際の表示と異なる場合があります）</div>
            <div style="background: white; padding: 8px; border-radius: 2px;">
              ${preview}
            </div>
          </div>
        `;
      } catch (error) {
        return `<div style="color: red;">プレビューレンダリングエラー: ${error.message}</div>`;
      }
    }

    // 要素をレンダリング
    renderElement(element, data, field) {
      if (typeof element === 'string') {
        return this.processTextContent(element, data, field);
      }

      if (!element.elmType) {
        return JSON.stringify(element);
      }

      const tagName = element.elmType;
      let html = `<${tagName}`;

      // 属性を処理
      if (element.attributes) {
        for (const [key, value] of Object.entries(element.attributes)) {
          const processedValue = this.processTextContent(value, data, field);
          html += ` ${key}="${processedValue}"`;
        }
      }

      // スタイルを処理
      if (element.style) {
        let styleStr = '';
        for (const [key, value] of Object.entries(element.style)) {
          const processedValue = this.processTextContent(value, data, field);
          styleStr += `${key}: ${processedValue}; `;
        }
        html += ` style="${styleStr}"`;
      }

      html += '>';

      // テキストコンテンツを処理
      if (element.txtContent) {
        const processedText = this.processTextContent(element.txtContent, data, field);
        html += processedText;
      }

      // 子要素を処理
      if (element.children) {
        for (const child of element.children) {
          html += this.renderElement(child, data, field);
        }
      }

      html += `</${tagName}>`;
      return html;
    }

    // テキストコンテンツを処理
    processTextContent(content, data, field) {
      if (typeof content !== 'string') {
        return String(content);
      }

      // フィールド参照を置換
      let processed = content.replace(/\[\$([^\]]+)\]/g, (_, fieldRef) => {
        return this.resolveFieldReference(fieldRef, data, field);
      });

      // 簡易的な式の処理（完全ではない）
      if (processed.startsWith('=')) {
        processed = this.processExpression(processed.substring(1), data, field);
      }

      return processed;
    }

    // フィールド参照を解決
    resolveFieldReference(fieldRef, data) {
      try {
        if (fieldRef.includes('.')) {
          const [, property] = fieldRef.split('.');
          if (Array.isArray(data)) {
            return data.map(item => item[property] || '').join(', ');
          } else if (data && typeof data === 'object') {
            return data[property] || '';
          }
        }

        if (Array.isArray(data)) {
          return data.join(', ');
        }

        return String(data || '');
      } catch (error) {
        return `[エラー: ${fieldRef}]`;
      }
    }

    // 簡易的な式の処理
    processExpression(expression, data) {
      try {
        // 非常に基本的な式のみサポート
        // セキュリティ上の理由で eval() は使用しない

        if (expression.includes('if(')) {
          return '[条件式の結果]';
        }

        if (expression.includes('join(')) {
          return Array.isArray(data) ? data.join(', ') : String(data);
        }

        return `[式: ${expression}]`;
      } catch (error) {
        return `[式エラー: ${expression}]`;
      }
    }

    // 自動修正の提案を生成
    generateAutoFixSuggestions(formatJson, sourceField, targetField) {
      const suggestions = [];

      // 複数値フィールド用の修正提案
      if (targetField.DetailedType?.isMultiValue && !sourceField.DetailedType?.isMultiValue) {
        suggestions.push({
          type: 'multivalue_fix',
          title: '複数値フィールド対応',
          description: 'フィールド参照を join() 関数で囲んで配列を文字列に変換',
          autoFix: this.generateMultiValueFix(formatJson),
        });
      }

      // プロパティ名の修正提案
      const sourceProps = this.getFieldProperties(sourceField.TypeAsString);
      const targetProps = this.getFieldProperties(targetField.TypeAsString);
      const propMapping = this.getPropertyMapping(
        sourceField.TypeAsString,
        targetField.TypeAsString
      );

      if (Object.keys(propMapping).length > 0) {
        suggestions.push({
          type: 'property_mapping',
          title: 'プロパティ名の変更',
          description: `${sourceField.TypeAsString} から ${targetField.TypeAsString} へのプロパティマッピング`,
          autoFix: this.generatePropertyMappingFix(formatJson, propMapping),
        });
      }

      return suggestions;
    }

    // 複数値フィールド用の修正を生成
    generateMultiValueFix(formatJson) {
      const jsonString = JSON.stringify(formatJson);
      const fixed = jsonString.replace(/\[\$([^\]]+)\]/g, (match, fieldRef) => {
        if (!fieldRef.includes('.') && !fieldRef.includes('join(')) {
          return `join([$${fieldRef}], ', ')`;
        }
        return match;
      });

      try {
        return JSON.parse(fixed);
      } catch (error) {
        return formatJson; // 修正に失敗した場合は元の書式を返す
      }
    }

    // プロパティマッピングの修正を生成
    generatePropertyMappingFix(formatJson, propMapping) {
      let jsonString = JSON.stringify(formatJson);

      for (const [oldProp, newProp] of Object.entries(propMapping)) {
        const regex = new RegExp(`\\.${oldProp}\\b`, 'g');
        jsonString = jsonString.replace(regex, `.${newProp}`);
      }

      try {
        return JSON.parse(jsonString);
      } catch (error) {
        return formatJson;
      }
    }

    // プロパティマッピングを取得
    getPropertyMapping(sourceType, targetType) {
      const mappings = {
        'Lookup->User': { lookupValue: 'title', lookupId: 'id' },
        'User->Lookup': { title: 'lookupValue', id: 'lookupId' },
        // 他のマッピングも必要に応じて追加
      };

      return mappings[`${sourceType}->${targetType}`] || {};
    }

    // リスト一覧を取得（OneDrive対応）
    async getLists() {
      try {
        // OneDriveの場合は特別な処理
        if (this.isOneDriveMode) {
          return await this.getOneDriveLists();
        }

        // SharePointの場合は従来通り
        const response = await fetch(
          `${this.apiBaseUrl}/web/lists?$select=Id,Title,BaseType&$filter=Hidden eq false`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json;odata=verbose',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.d.results.filter(list => list.BaseType === 0); // GenericList のみ
      } catch (error) {
        console.error('リスト取得エラー:', error);
        return [];
      }
    }

    // OneDrive専用のリスト取得
    async getOneDriveLists() {
      try {
        // OneDriveでもSharePoint REST APIが使用可能
        const response = await fetch(
          `${this.apiBaseUrl}/web/lists?$select=Id,Title,BaseType,Description&$filter=Hidden eq false and BaseType eq 0`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json;odata=verbose',
            },
          }
        );

        if (!response.ok) {
          // OneDriveで認証エラーの場合、現在のリストのみを返す
          if (response.status === 401 || response.status === 403) {
            return await this.getCurrentOneDriveList();
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const lists = data.d.results || [];

        // OneDriveの場合、追加の情報を付与
        return lists.map(list => ({
          ...list,
          Platform: 'OneDrive',
          IsOneDrive: true,
        }));
      } catch (error) {
        console.error('OneDriveリスト取得エラー:', error);
        // フォールバック: 現在のリストのみを返す
        return await this.getCurrentOneDriveList();
      }
    }

    // 現在のOneDriveリストを取得（フォールバック用）
    async getCurrentOneDriveList() {
      try {
        const currentListInfo = Utils.getCurrentListInfo();

        if (currentListInfo.title) {
          // 現在のリストの情報を推定で作成
          return [
            {
              Id: 'current-list',
              Title: currentListInfo.title,
              BaseType: 0,
              Platform: currentListInfo.platform,
              IsOneDrive: true,
              IsCurrent: true,
              Description: '現在表示中のリスト',
            },
          ];
        }

        return [];
      } catch (error) {
        console.error('現在のOneDriveリスト取得エラー:', error);
        return [];
      }
    }

    // リストの列情報を取得（詳細な型情報付き）
    async getListFields(listId) {
      try {
        const response = await fetch(
          `${this.apiBaseUrl}/web/lists('${listId}')/fields?$select=Id,Title,InternalName,TypeAsString,TypeDisplayName,TypeShortDescription,SchemaXml,FieldTypeKind,MaxLength,Required,Indexed,EnforceUniqueValues,Choices,LookupList,LookupField,ReadOnlyField&$filter=Hidden eq false`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json;odata=verbose',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // 各フィールドに詳細な型情報を追加
        return data.d.results.map(field => ({
          ...field,
          DetailedType: this.getDetailedFieldType(field),
          FormattingCompatibility: this.getFormattingCompatibility(field),
        }));
      } catch (error) {
        console.error('列情報取得エラー:', error);
        return [];
      }
    }

    // 詳細な列型情報を取得
    getDetailedFieldType(field) {
      const baseType = field.TypeAsString;
      const fieldTypeKind = field.FieldTypeKind;

      // より詳細な型分類
      const detailedTypeInfo = {
        baseType: baseType,
        category: this.getFieldCategory(baseType, fieldTypeKind),
        displayName: this.getFieldDisplayName(baseType, field),
        isMultiValue: this.isMultiValueField(baseType),
        supportedFormats: this.getSupportedFormats(baseType, fieldTypeKind),
        constraints: this.getFieldConstraints(field),
      };

      return detailedTypeInfo;
    }

    // フィールドカテゴリを取得
    getFieldCategory(typeAsString) {
      const categoryMap = {
        // テキスト系
        Text: 'text',
        Note: 'text',
        Guid: 'text',

        // 数値系
        Number: 'numeric',
        Currency: 'numeric',
        Integer: 'numeric',
        Counter: 'numeric',

        // 日時系
        DateTime: 'datetime',

        // 選択系
        Choice: 'choice',
        MultiChoice: 'choice',
        Boolean: 'choice',

        // 参照系
        Lookup: 'reference',
        LookupMulti: 'reference',
        User: 'reference',
        UserMulti: 'reference',

        // リッチ系
        URL: 'rich',
        File: 'rich',
        Attachments: 'rich',

        // 計算系
        Calculated: 'computed',
        Computed: 'computed',

        // 分類系
        TaxonomyFieldType: 'taxonomy',
        TaxonomyFieldTypeMulti: 'taxonomy',
      };

      return categoryMap[typeAsString] || 'other';
    }

    // フィールド表示名を取得
    getFieldDisplayName(typeAsString) {
      const displayNameMap = {
        Text: '1行テキスト',
        Note: '複数行テキスト',
        Number: '数値',
        Currency: '通貨',
        DateTime: '日付と時刻',
        Boolean: 'はい/いいえ',
        Choice: '選択肢',
        MultiChoice: '選択肢（複数選択可）',
        Lookup: '参照',
        LookupMulti: '参照（複数値）',
        User: 'ユーザーまたはグループ',
        UserMulti: 'ユーザーまたはグループ（複数値）',
        URL: 'ハイパーリンク',
        Calculated: '計算値',
        TaxonomyFieldType: '管理メタデータ',
        TaxonomyFieldTypeMulti: '管理メタデータ（複数値）',
      };

      return displayNameMap[typeAsString] || typeAsString;
    }

    // 複数値フィールドかどうか判定
    isMultiValueField(typeAsString) {
      const multiValueTypes = ['MultiChoice', 'LookupMulti', 'UserMulti', 'TaxonomyFieldTypeMulti'];
      return multiValueTypes.includes(typeAsString);
    }

    // サポートされる書式タイプを取得
    getSupportedFormats(typeAsString) {
      const formatSupport = {
        Text: ['text', 'icon', 'link', 'image'],
        Note: ['text', 'html'],
        Number: ['number', 'bar', 'icon', 'trend'],
        Currency: ['currency', 'bar', 'icon'],
        DateTime: ['date', 'relative', 'icon'],
        Boolean: ['icon', 'text'],
        Choice: ['text', 'icon', 'pill'],
        MultiChoice: ['pills', 'icons'],
        User: ['person', 'icon'],
        UserMulti: ['people', 'icons'],
        Lookup: ['text', 'link', 'icon'],
        URL: ['link', 'icon'],
        Calculated: ['auto'], // 計算結果の型に依存
      };

      return formatSupport[typeAsString] || ['text'];
    }

    // フィールド制約情報を取得
    getFieldConstraints(field) {
      return {
        required: field.Required || false,
        maxLength: field.MaxLength || null,
        indexed: field.Indexed || false,
        unique: field.EnforceUniqueValues || false,
        choices: field.Choices ? field.Choices.results : null,
        lookupList: field.LookupList || null,
        lookupField: field.LookupField || null,
      };
    }

    // 書式互換性情報を取得
    getFormattingCompatibility(field) {
      const detailedType = this.getDetailedFieldType(field);

      return {
        canReceiveFormats: this.canReceiveFormats(field.TypeAsString),
        canProvideFormats: this.canProvideFormats(field.TypeAsString),
        compatibleTypes: this.getCompatibleTypes(field.TypeAsString),
        riskLevel: this.getCompatibilityRisk(field.TypeAsString, detailedType),
      };
    }

    // 書式を受け取れるかどうか
    canReceiveFormats(typeAsString, field = null) {
      // 完全に書式適用不可な型
      const blockedTypes = ['Counter', 'Computed', 'Calculated'];
      if (blockedTypes.includes(typeAsString)) {
        return false;
      }

      // 読み取り専用でも書式設定可能な特別な列
      if (field && field.ReadOnlyField) {
        const formatableReadOnlyFields = [
          'Author',      // 登録者
          'Editor',      // 更新者
          'Created',     // 作成日時
          'Modified',    // 更新日時
          'ID'           // ID列
        ];

        // InternalName で判定
        if (formatableReadOnlyFields.includes(field.InternalName)) {
          return true;
        }

        // TypeAsString で判定（User型の読み取り専用フィールド）
        if (typeAsString === 'User' &&
          (field.InternalName === 'Author' || field.InternalName === 'Editor')) {
          return true;
        }

        // DateTime型の読み取り専用フィールド
        if (typeAsString === 'DateTime' &&
          (field.InternalName === 'Created' || field.InternalName === 'Modified')) {
          return true;
        }

        // その他の読み取り専用フィールドは基本的に不可
        return false;
      }

      return true;
    }

    // 書式を提供できるかどうか
    canProvideFormats() {
      // すべての表示可能フィールドは書式提供可能
      return true;
    }

    // 互換性のある型を取得
    getCompatibleTypes(typeAsString) {
      const compatibilityGroups = {
        text: ['Text', 'Note', 'Guid'],
        numeric: ['Number', 'Currency', 'Integer'],
        choice: ['Choice', 'MultiChoice', 'Boolean'],
        reference: ['Lookup', 'LookupMulti', 'User', 'UserMulti'],
        datetime: ['DateTime'],
        url: ['URL'],
        taxonomy: ['TaxonomyFieldType', 'TaxonomyFieldTypeMulti'],
      };

      for (const [, types] of Object.entries(compatibilityGroups)) {
        if (types.includes(typeAsString)) {
          return types;
        }
      }

      return [typeAsString]; // 自分自身のみ互換
    }

    // 互換性リスクレベルを取得
    getCompatibilityRisk(typeAsString, detailedType) {
      const risks = [];
      let riskLevel = 'low';

      // 複数値フィールドは高リスク
      if (detailedType.isMultiValue) {
        risks.push('複数値フィールド：配列データ構造のため書式エラーの可能性');
        riskLevel = 'high';
      }

      // 参照フィールドは中リスク
      if (detailedType.category === 'reference') {
        risks.push('参照フィールド：データ構造の違いによる表示エラーの可能性');
        if (riskLevel !== 'high') riskLevel = 'medium';
      }

      // 計算フィールドは中リスク
      if (typeAsString === 'Calculated') {
        risks.push('計算フィールド：計算結果の型に依存するため予期しない動作の可能性');
        if (riskLevel !== 'high') riskLevel = 'medium';
      }

      // 読み取り専用フィールドは適用不可
      if (!this.canReceiveFormats(typeAsString)) {
        risks.push('読み取り専用フィールド：書式適用不可');
        riskLevel = 'blocked';
      }

      return {
        level: riskLevel,
        reasons: risks,
        description: this.getRiskDescription(riskLevel),
      };
    }

    // リスクレベルの説明を取得
    getRiskDescription(riskLevel) {
      const descriptions = {
        low: '安全：同じ型カテゴリ内での適用のため、問題が発生する可能性は低いです',
        medium: '注意：データ構造の違いにより、書式が正しく表示されない可能性があります',
        high: '危険：書式エラーやデータ表示の問題が発生する可能性が高いです',
        blocked: '不可：このフィールドには書式を適用できません',
      };
      return descriptions[riskLevel] || '不明なリスクレベル';
    }

    // 現在のビューまたはデフォルトビューで表示される列を取得
    async getCurrentViewFields(listId) {
      try {
        // 1. 現在のビューを検出
        const currentViewId = this.getCurrentViewId();

        if (currentViewId) {
          // 現在のビューの列を取得
          const currentViewInfo = await this.getViewFields(listId, currentViewId);
          if (currentViewInfo && currentViewInfo.fields.length > 0) {
            return {
              ...currentViewInfo,
              isCurrent: true,
              message: `現在のビュー「${currentViewInfo.viewTitle}」の列を表示しています`
            };
          }
        }

        // 2. フォールバック: デフォルトビューを取得
        const viewResponse = await fetch(
          `${this.apiBaseUrl}/web/lists('${listId}')/defaultView?$select=Id,Title,ViewFields&$expand=ViewFields`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json;odata=verbose',
            },
          }
        );

        if (!viewResponse.ok) {
          throw new Error(`HTTP ${viewResponse.status}`);
        }

        const viewData = await viewResponse.json();
        const defaultView = viewData.d;

        if (!defaultView.ViewFields || !defaultView.ViewFields.Items) {
          // ViewFieldsが取得できない場合は全列を返す
          return await this.getListFields(listId);
        }

        const viewFieldNames = defaultView.ViewFields.Items;

        // ビューで表示される列の詳細情報を取得
        const fieldsResponse = await fetch(
          `${this.apiBaseUrl}/web/lists('${listId}')/fields?$select=Id,Title,InternalName,TypeAsString,SchemaXml&$filter=Hidden eq false`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json;odata=verbose',
            },
          }
        );

        if (!fieldsResponse.ok) {
          throw new Error(`HTTP ${fieldsResponse.status}`);
        }

        const fieldsData = await fieldsResponse.json();
        const allFields = fieldsData.d.results;

        // ビューに表示される列のみをフィルタリング
        const viewFields = allFields.filter(
          field => viewFieldNames.includes(field.InternalName) && !field.ReadOnlyField // 読み取り専用列は除外
        );

        // ビュー情報も含めて返す
        return {
          viewTitle: defaultView.Title,
          viewId: defaultView.Id,
          fields: viewFields,
          viewFieldCount: viewFieldNames.length,
          totalFieldCount: allFields.length,
        };
      } catch (error) {
        console.error('デフォルトビュー列取得エラー:', error);
        // エラーの場合は従来の方法にフォールバック
        const fallbackFields = await this.getListFields(listId);
        return {
          viewTitle: 'デフォルトビュー',
          viewId: null,
          fields: fallbackFields,
          viewFieldCount: fallbackFields.length,
          totalFieldCount: fallbackFields.length,
        };
      }
    }

    // 列の書式設定を取得
    async getColumnFormatting(listId, fieldId) {
      try {
        const response = await fetch(
          `${this.apiBaseUrl}/web/lists('${listId}')/fields('${fieldId}')`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json;odata=verbose',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const field = data.d;

        // CustomFormatter がある場合はそれを返す
        if (field.CustomFormatter) {
          return JSON.parse(field.CustomFormatter);
        }

        return null;
      } catch (error) {
        console.error('列書式取得エラー:', error);
        return null;
      }
    }

    // 列の書式設定を適用
    async applyColumnFormatting(listId, fieldId, formatJson) {
      try {
        // Request digest の取得
        const digestResponse = await fetch(`${this.apiBaseUrl}/contextinfo`, {
          method: 'POST',
          headers: {
            Accept: 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
          },
        });

        if (!digestResponse.ok) {
          throw new Error('Request digest の取得に失敗');
        }

        const digestData = await digestResponse.json();
        const requestDigest = digestData.d.GetContextWebInformation.FormDigestValue;

        // 列の書式設定を更新
        const updateResponse = await fetch(
          `${this.apiBaseUrl}/web/lists('${listId}')/fields('${fieldId}')`,
          {
            method: 'PATCH',
            headers: {
              Accept: 'application/json;odata=verbose',
              'Content-Type': 'application/json;odata=verbose',
              'X-RequestDigest': requestDigest,
              'IF-MATCH': '*',
              'X-HTTP-Method': 'MERGE',
            },
            body: JSON.stringify({
              __metadata: { type: 'SP.Field' },
              CustomFormatter: JSON.stringify(formatJson),
            }),
          }
        );

        if (!updateResponse.ok) {
          throw new Error(`HTTP ${updateResponse.status}`);
        }

        return true;
      } catch (error) {
        console.error('列書式適用エラー:', error);
        return false;
      }
    }
  }

  // =============================================================================
  // UI 管理クラス
  // =============================================================================
  class UIManager {
    constructor(apiClient, formatManager) {
      this.apiClient = apiClient;
      this.formatManager = formatManager;
      this.defaultFormatProvider = new DefaultFormatProvider();
      this.currentView = 'main'; // main, extract, apply, manage, defaults
      this.selectedList = null;
      this.selectedField = null;
    }

    // パネルを作成
    createPanel() {
      // 既存パネルがあれば削除
      const existingPanel = document.getElementById(CONSTANTS.PANEL_ID);
      if (existingPanel) {
        memoryManager.cleanup(); // メモリクリーンアップ
        existingPanel.remove();
      }

      const panel = document.createElement('div');
      panel.id = CONSTANTS.PANEL_ID;
      panel.style.cssText = this.getPanelStyles();

      document.body.appendChild(panel);

      // パネルのコンテンツが設定された後にドラッグ機能を有効化
      setTimeout(() => {
        this.makeDraggable(panel);
      }, 100);

      return panel;
    }

    // パネルスタイル
    getPanelStyles() {
      return `
        position: fixed !important;
        top: 50px !important;
        right: 50px !important;
        width: ${CONSTANTS.PANEL_WIDTH}px !important;
        height: ${CONSTANTS.PANEL_HEIGHT}px !important;
        background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY} !important;
        border: 2px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} !important;
        box-shadow: ${SHAREPOINT_DESIGN_SYSTEM.SHADOWS.PANEL} !important;
        z-index: ${CONSTANTS.Z_INDEX} !important;
        font-family: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.FONT_FAMILY} !important;
        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
        color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        min-width: 350px !important;
        min-height: 400px !important;
      `;
    }

    // ドラッグ可能にする
    makeDraggable(element) {
      // HTMLが再生成された場合は既存のマークをリセット
      const header = element.querySelector('.formatter-header');
      if (header && !header.dataset.dragSetup) {
        // リサイズハンドルのみクリーンアップ（ヘッダーは保持）
        this.cleanupResizeHandle(element);

        this.setupWindowMove(element);
        this.setupResize(element);

        // ヘッダーに設定完了マークを付ける（より確実）
        header.dataset.dragSetup = 'true';
        element.dataset.draggableSetup = 'true';
      }
    }

    // リサイズハンドルのみクリーンアップ（ヘッダーのボタンは保持）
    cleanupResizeHandle(element) {
      // リサイズハンドルのみを削除（ヘッダーのボタンは保持）
      const resizeHandle = element.querySelector('.resize-handle');
      if (resizeHandle) {
        resizeHandle.remove();
      }
    }

    // ウィンドウ移動機能
    setupWindowMove(element) {
      let isDragging = false;
      let startX, startY, initialX, initialY;

      const header = element.querySelector('.formatter-header');
      if (!header) return;

      header.style.cursor = 'move';

      const handleMouseDown = e => {
        // リサイズハンドルまたはその子要素がクリックされた場合は移動しない
        if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle')) {
          return;
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = element.offsetLeft;
        initialY = element.offsetTop;

        header.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none'; // テキスト選択を無効化
        e.preventDefault();
      };

      const handleMouseMove = e => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newX = initialX + deltaX;
        let newY = initialY + deltaY;

        // ビューポート境界内に制限
        const maxX = window.innerWidth - element.offsetWidth;
        const maxY = window.innerHeight - element.offsetHeight;

        newX = Math.max(0, Math.min(maxX, newX));
        newY = Math.max(0, Math.min(maxY, newY));

        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
        element.style.right = 'auto';
      };

      const handleMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          header.style.cursor = 'move';
          document.body.style.userSelect = ''; // テキスト選択を再有効化
        }
      };

      memoryManager.addEventListener(header, 'mousedown', handleMouseDown);
      memoryManager.addEventListener(document, 'mousemove', handleMouseMove);
      memoryManager.addEventListener(document, 'mouseup', handleMouseUp);
    }

    // リサイズ機能
    setupResize(element) {
      // 既にリサイズハンドルが存在する場合はスキップ
      if (element.querySelector('.resize-handle')) {
        return;
      }

      // リサイズハンドルを追加
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.style.cssText = `
        position: absolute !important;
        bottom: -2px !important;
        right: -2px !important;
        width: 24px !important;
        height: 24px !important;
        cursor: se-resize !important;
        background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 !important;
        z-index: 1001 !important;
        opacity: 0.7 !important;
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
      `;

      // リサイズアイコン追加（標準的なグリップスタイル）
      resizeHandle.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 14 14" style="
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          fill: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
        ">
          <!-- 対角線のドット -->
          <circle cx="8" cy="8" r="1.5"/>
          <circle cx="5" cy="11" r="1.5"/>
          <circle cx="11" cy="5" r="1.5"/>
          <circle cx="11" cy="8" r="1.5"/>
          <circle cx="8" cy="11" r="1.5"/>
          <circle cx="11" cy="11" r="1.5"/>
        </svg>
      `;

      element.appendChild(resizeHandle);

      let isResizing = false;
      let startX, startY, startWidth, startHeight;
      const handleMouseDown = e => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(element).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(element).height, 10);

        // カーソルスタイルの統一
        document.body.style.cursor = 'se-resize';
        resizeHandle.style.cursor = 'se-resize';
        document.body.style.userSelect = 'none'; // テキスト選択を無効化
        resizeHandle.style.opacity = '1';
        resizeHandle.style.transform = 'scale(1.1)';

        e.preventDefault();
        e.stopPropagation();
      };

      const handleMouseMove = e => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const newWidth = startWidth + deltaX;
        const newHeight = startHeight + deltaY;

        // 最小サイズ制限
        const minWidth = 350;
        const minHeight = 400;

        // 最大サイズ制限（ビューポートの90%）
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.9;

        const finalWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        const finalHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

        element.style.width = `${finalWidth}px`;
        element.style.height = `${finalHeight}px`;

        // パネルが画面外に出ないように位置を調整
        const rect = element.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          element.style.left = `${window.innerWidth - finalWidth}px`;
          element.style.right = 'auto';
        }
        if (rect.bottom > window.innerHeight) {
          element.style.top = `${window.innerHeight - finalHeight}px`;
        }
      };

      const handleMouseUp = () => {
        if (isResizing) {
          isResizing = false;
          document.body.style.cursor = '';
          resizeHandle.style.cursor = 'se-resize';
          document.body.style.userSelect = ''; // テキスト選択を再有効化
          resizeHandle.style.opacity = '0.7';
          resizeHandle.style.transform = 'scale(1)';
        }
      };

      // ホバー効果
      const handleMouseEnter = () => {
        if (!isResizing) {
          resizeHandle.style.opacity = '1';
          resizeHandle.style.transform = 'scale(1.05)';
        }
      };

      const handleMouseLeave = () => {
        if (!isResizing) {
          resizeHandle.style.opacity = '0.7';
          resizeHandle.style.transform = 'scale(1)';
        }
      }; // イベントリスナーの登録
      memoryManager.addEventListener(resizeHandle, 'mousedown', handleMouseDown);
      memoryManager.addEventListener(document, 'mousemove', handleMouseMove);
      memoryManager.addEventListener(document, 'mouseup', handleMouseUp);
      memoryManager.addEventListener(resizeHandle, 'mouseenter', handleMouseEnter);
      memoryManager.addEventListener(resizeHandle, 'mouseleave', handleMouseLeave);
    }

    // メインビューを表示
    showMainView() {
      this.currentView = 'main';
      const panel = document.getElementById(CONSTANTS.PANEL_ID);
      if (!panel) return;

      panel.innerHTML = this.generateMainViewHTML();
      this.attachMainViewEvents();

      // ドラッグ機能を再有効化（まだ設定されていない場合のみ）
      setTimeout(() => {
        this.makeDraggable(panel);
      }, 50);
    } // メインビューHTML生成
    generateMainViewHTML() {
      const currentList = Utils.getCurrentListInfo();
      const savedFormatsCount = this.formatManager.getAllFormats().length;

      // 保存された書式がある場合は管理ボタンを目立つ色にする
      const manageButtonStyle = savedFormatsCount > 0 ? 'primary' : 'secondary';

      return `        <div class="formatter-header" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 0 !important;
             display: flex !important; justify-content: space-between !important; align-items: center !important;
             cursor: move !important;">
          <div style="display: flex !important; align-items: center !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
            <span style="font-size: 12px !important; opacity: 0.8 !important;" title="ドラッグしてウィンドウを移動">⋮⋮</span>
            <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
              📊 Lists Column Formatter
            </h3>
          </div>
          <button id="close-panel" style="background: transparent !important; border: none !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                  font-size: 18px !important; cursor: pointer !important; padding: 4px !important;">✕</button>
        </div>

        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; flex: 1 !important; overflow-y: auto !important;">
          ${currentList.title
          ? `
            <div style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
                 padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                 border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                 margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <div style="font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;
                   color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                現在のリスト: ${Utils.escapeHtml(currentList.title)}
              </div>
              <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                   color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                   margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} !important;">
                列書式の取得・適用が可能です
              </div>
            </div>
          `
          : ''
        }

          <div style="display: grid !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;">
            <button id="extract-format" class="action-button" style="${this.getButtonStyles('primary')}">
              📤 列書式を取得・保存
            </button>

            <button id="apply-format" class="action-button" style="${this.getButtonStyles('primary')}">
              📥 列書式を適用
            </button>

            <button id="manage-formats" class="action-button" style="${this.getButtonStyles(manageButtonStyle)}"
              title="${savedFormatsCount > 0 ? `${savedFormatsCount}件の書式が保存されています` : '保存された書式はありません'}">
              🗂️ 保存された書式を管理${savedFormatsCount > 0 ? ` (${savedFormatsCount})` : ''}
            </button>

            <button id="view-defaults" class="action-button" style="${this.getButtonStyles('info')}"
              title="列タイプ別のデフォルト書式テンプレートを参照できます">
              🎨 デフォルト書式テンプレート
            </button>

            <hr style="border: none !important; border-top: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                 margin: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} 0 !important;">            <button id="import-format" class="action-button" style="${this.getButtonStyles('info')}"
              title="Microsoft公式のJSON列書式または、このツールでエクスポートした書式をインポートできます">
              📋 クリップボードから書式をインポート
            </button>

            <button id="export-all" class="action-button" style="${this.getButtonStyles('info')}">
              💾 全ての書式をエクスポート
            </button>
          </div>          <div style="margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XL} !important;
               padding-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
               border-top: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
               font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
               color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
            保存数: ${this.formatManager.getAllFormats().length} 件<br>
            📝 インポート可能形式: Microsoft公式JSON列書式、このツールのエクスポート形式
          </div>
        </div>
      `;
    }

    // ボタンスタイル
    getButtonStyles(type = 'primary') {
      const colors = {
        primary: SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY,
        secondary: SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.MUTED,
        info: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.INFO,
        success: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.SUCCESS,
        warning: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.WARNING,
        error: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.ERROR,
      };

      return `
        background: ${colors[type]} !important;
        color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
        border: none !important;
        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
        padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
        font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.MEDIUM} !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        text-align: left !important;
        width: 100% !important;
      `;
    }

    // メインビューイベント追加
    attachMainViewEvents() {
      const closeBtn = document.getElementById('close-panel');
      if (closeBtn) {
        memoryManager.addEventListener(closeBtn, 'click', () => {
          memoryManager.cleanup();
          document.getElementById(CONSTANTS.PANEL_ID)?.remove();
        });
      }

      const extractBtn = document.getElementById('extract-format');
      if (extractBtn) {
        memoryManager.addEventListener(extractBtn, 'click', () => {
          this.showExtractView();
        });
      }

      const applyBtn = document.getElementById('apply-format');
      if (applyBtn) {
        memoryManager.addEventListener(applyBtn, 'click', () => {
          this.showApplyView();
        });
      }

      const manageBtn = document.getElementById('manage-formats');
      if (manageBtn) {
        memoryManager.addEventListener(manageBtn, 'click', () => {
          this.showManageView();
        });
      }

      const defaultsBtn = document.getElementById('view-defaults');
      if (defaultsBtn) {
        memoryManager.addEventListener(defaultsBtn, 'click', () => {
          this.showDefaultsView();
        });
      }

      const importBtn = document.getElementById('import-format');
      if (importBtn) {
        memoryManager.addEventListener(importBtn, 'click', async () => {
          const imported = await this.formatManager.importFormatFromClipboard();
          if (imported) {
            this.showMessage('書式をインポートしました', 'success');
            memoryManager.setTimeout(() => this.showMainView(), 1500);
          } else {
            this.showMessage('インポートに失敗しました', 'error');
          }
        });
      }

      const exportBtn = document.getElementById('export-all');
      if (exportBtn) {
        memoryManager.addEventListener(exportBtn, 'click', () => {
          this.exportAllFormats();
        });
      }

      // ボタンホバー効果
      document.querySelectorAll('.action-button').forEach(button => {
        memoryManager.addEventListener(button, 'mouseenter', () => {
          button.style.opacity = '0.9';
          button.style.transform = 'translateY(-1px)';
        });

        memoryManager.addEventListener(button, 'mouseleave', () => {
          button.style.opacity = '1';
          button.style.transform = 'translateY(0)';
        });
      });
    }

    // 書式取得ビューを表示
    async showExtractView() {
      this.currentView = 'extract';
      const panel = document.getElementById(CONSTANTS.PANEL_ID);
      if (!panel) return;

      panel.innerHTML = this.generateLoadingHTML('リスト情報を取得中...');

      try {
        const lists = await this.apiClient.getLists();
        panel.innerHTML = this.generateExtractViewHTML(lists);
        this.attachExtractViewEvents();
      } catch (error) {
        this.showMessage('リスト情報の取得に失敗しました', 'error');
      }
    }

    // 書式取得ビューHTML生成
    generateExtractViewHTML(lists) {
      return `
        <div class="formatter-header" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 0 !important;
             display: flex !important; justify-content: space-between !important; align-items: center !important;">
          <div style="display: flex !important; align-items: center !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
            <button id="back-to-main" style="background: transparent !important; border: none !important;
                    color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                    font-size: 16px !important; cursor: pointer !important; padding: 4px !important;">←</button>
            <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
              📤 書式を取得
            </h3>
          </div>
          <button id="close-panel" style="background: transparent !important; border: none !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                  font-size: 18px !important; cursor: pointer !important; padding: 4px !important;">✕</button>
        </div>

        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; flex: 1 !important; overflow-y: auto !important;">
          <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
            <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                   font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
              リストを選択:
            </label>
            <select id="list-select" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                    border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                    border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                    font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;">
              <option value="">リストを選択してください</option>
              ${lists
          .map(
            list => `
                <option value="${list.Id}">${Utils.escapeHtml(list.Title)}</option>
              `
          )
          .join('')}
            </select>
          </div>          <div id="fields-container" style="display: none !important;">
            <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                   font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
              列を選択:
            </label>
            <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                 margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
              📋 デフォルトビューで表示される列のみが対象です
            </div>
            <select id="field-select" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                    border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                    border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                    font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
                    margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <option value="">列を選択してください</option>
            </select>
          </div>

          <div id="format-preview" style="display: none !important;"></div>

          <div id="save-container" style="display: none !important;">
            <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;">
              <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                     font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
                書式名:
              </label>
              <input type="text" id="format-name" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                     border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                     border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                     font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;"
                     placeholder="例: 進捗バー書式">
            </div>

            <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                     font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
                説明:
              </label>
              <textarea id="format-description" style="width: 100% !important; height: 60px !important;
                        padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                        border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
                        resize: vertical !important;"
                        placeholder="書式の説明（オプション）"></textarea>
            </div>

            <button id="save-format" style="${this.getButtonStyles('success')}">
              💾 書式を保存
            </button>
          </div>
        </div>
      `;
    }

    // 書式取得ビューイベント追加
    attachExtractViewEvents() {
      const closeBtn = document.getElementById('close-panel');
      if (closeBtn) {
        memoryManager.addEventListener(closeBtn, 'click', () => {
          memoryManager.cleanup();
          document.getElementById(CONSTANTS.PANEL_ID)?.remove();
        });
      }

      const backBtn = document.getElementById('back-to-main');
      if (backBtn) {
        memoryManager.addEventListener(backBtn, 'click', () => {
          this.showMainView();
        });
      }

      const listSelect = document.getElementById('list-select');
      if (listSelect) {
        memoryManager.addEventListener(listSelect, 'change', async e => {
          const listId = e.target.value;
          if (!listId) {
            document.getElementById('fields-container').style.display = 'none';
            return;
          }
          try {
            // 現在のビューまたはデフォルトビューで表示される列のみを取得
            const viewInfo = await this.apiClient.getCurrentViewFields(listId);
            const fieldSelect = document.getElementById('field-select');
            fieldSelect.innerHTML = '<option value="">列を選択してください</option>';

            if (viewInfo.fields.length === 0) {
              fieldSelect.innerHTML += '<option disabled>表示可能な列がありません</option>';
            } else {
              // リストタイトルとビュー情報を表示
              const listTitle =
                document.getElementById('list-select').selectedOptions[0].textContent;
              fieldSelect.innerHTML += `<option disabled>--- ${Utils.escapeHtml(listTitle)} (${Utils.escapeHtml(viewInfo.viewTitle)}: ${viewInfo.fields.length}/${viewInfo.viewFieldCount}列) ---</option>`;
              viewInfo.fields.forEach(field => {
                const detailedType = field.DetailedType || {
                  displayName: field.TypeAsString,
                  supportedFormats: [],
                };
                const compatibility = field.FormattingCompatibility || { riskLevel: 'medium' };

                // リスクレベルに応じたアイコン
                const riskIcon =
                  {
                    low: '🟢',
                    medium: '🟡',
                    high: '🔴',
                  }[compatibility.riskLevel] || '⚪';

                fieldSelect.innerHTML += `
                  <option value="${field.Id}"
                          data-type="${detailedType.baseType}"
                          data-category="${detailedType.category}"
                          data-risk="${compatibility.riskLevel}"
                          data-formats="${detailedType.supportedFormats.join(',')}"
                          title="サポート書式: ${detailedType.supportedFormats.join(', ')}">
                    ${riskIcon} ${Utils.escapeHtml(field.Title)} (${detailedType.displayName})
                  </option>
                `;
              });

              // 除外された列がある場合の説明を追加
              if (viewInfo.fields.length < viewInfo.viewFieldCount) {
                fieldSelect.innerHTML += `<option disabled>--- ${viewInfo.viewFieldCount - viewInfo.fields.length}列が読み取り専用のため除外されました ---</option>`;
              }
            }

            document.getElementById('fields-container').style.display = 'block';
          } catch (error) {
            this.showMessage('列情報の取得に失敗しました', 'error');
          }
        });
      }

      const fieldSelect = document.getElementById('field-select');
      if (fieldSelect) {
        memoryManager.addEventListener(fieldSelect, 'change', async e => {
          const fieldId = e.target.value;
          const listId = document.getElementById('list-select').value;

          if (!fieldId || !listId) {
            document.getElementById('format-preview').style.display = 'none';
            document.getElementById('save-container').style.display = 'none';
            return;
          }

          try {
            const formatJson = await this.apiClient.getColumnFormatting(listId, fieldId);
            const previewContainer = document.getElementById('format-preview');

            if (formatJson) {
              previewContainer.innerHTML = `
                <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
                  <h4 style="margin: 0 0 ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} 0 !important;
                     color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                    📋 現在の書式設定:
                  </h4>
                  <pre style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
                       padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                       border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                       font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                       max-height: 200px !important; overflow-y: auto !important;
                       white-space: pre-wrap !important; word-break: break-word !important;">
  ${Utils.escapeHtml(JSON.stringify(formatJson, null, 2))}
                  </pre>
                </div>
              `;

              // 自動で書式名を設定
              const fieldName = document
                .getElementById('field-select')
                .selectedOptions[0].textContent.split(' (')[0];
              document.getElementById('format-name').value = `${fieldName}の書式`;

              document.getElementById('save-container').style.display = 'block';
            } else {
              previewContainer.innerHTML = `
                <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;
                     background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.WARNING} !important;
                     color: white !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                     border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;">
                  ⚠️ この列には書式設定がありません
                </div>
              `;
              document.getElementById('save-container').style.display = 'none';
            }

            previewContainer.style.display = 'block';
          } catch (error) {
            this.showMessage('書式情報の取得に失敗しました', 'error');
          }
        });
      }

      const saveBtn = document.getElementById('save-format');
      if (saveBtn) {
        memoryManager.addEventListener(saveBtn, 'click', async () => {
          const listId = document.getElementById('list-select').value;
          const fieldId = document.getElementById('field-select').value;
          const formatName = document.getElementById('format-name').value.trim();
          const formatDescription = document.getElementById('format-description').value.trim();

          if (!formatName) {
            this.showMessage('書式名を入力してください', 'warning');
            return;
          }

          try {
            const formatJson = await this.apiClient.getColumnFormatting(listId, fieldId);
            if (!formatJson) {
              this.showMessage('取得可能な書式設定がありません', 'warning');
              return;
            }

            const listSelect = document.getElementById('list-select');
            const fieldSelect = document.getElementById('field-select');

            const formatData = {
              name: formatName,
              description: formatDescription,
              columnType: fieldSelect.selectedOptions[0].dataset.type,
              formatJson: formatJson,
              sourceList: listSelect.selectedOptions[0].textContent,
              sourceColumn: fieldSelect.selectedOptions[0].textContent.split(' (')[0],
            };

            this.formatManager.saveFormat(formatData);
            this.showMessage('書式を保存しました', 'success');

            memoryManager.setTimeout(() => this.showMainView(), 1500);
          } catch (error) {
            this.showMessage('書式の保存に失敗しました', 'error');
          }
        });
      }
    }

    // ローディングHTML生成
    generateLoadingHTML(message) {
      return `
        <div class="formatter-header" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 0 !important;
             display: flex !important; justify-content: center !important; align-items: center !important;">
          <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
            📊 Lists Column Formatter
          </h3>
        </div>

        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; flex: 1 !important;
             display: flex !important; flex-direction: column !important; justify-content: center !important;
             align-items: center !important; text-align: center !important;">
          <div style="font-size: 24px !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
            ⏳
          </div>
          <div style="color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
            ${Utils.escapeHtml(message)}
          </div>
        </div>
      `;
    }

    // メッセージを表示
    showMessage(message, type = 'info') {
      const colors = {
        info: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.INFO,
        success: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.SUCCESS,
        warning: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.WARNING,
        error: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.ERROR,
      };

      const messageDiv = document.createElement('div');
      messageDiv.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: ${colors[type]} !important;
        color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
        padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
        box-shadow: ${SHAREPOINT_DESIGN_SYSTEM.SHADOWS.PANEL} !important;
        z-index: ${CONSTANTS.Z_INDEX + 1} !important;
        font-family: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.FONT_FAMILY} !important;
        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
        max-width: 300px !important;
      `;
      messageDiv.textContent = message;

      document.body.appendChild(messageDiv);

      setTimeout(() => {
        messageDiv.remove();
      }, 3000);
    }

    // 全書式をエクスポート
    exportAllFormats() {
      const formats = this.formatManager.getAllFormats();
      if (formats.length === 0) {
        this.showMessage('エクスポートする書式がありません', 'warning');
        return;
      }

      const exportData = {
        exportedAt: Utils.getCurrentTimestamp(),
        exportedFrom: 'Microsoft Lists Column Formatter',
        formatCount: formats.length,
        formats: formats,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lists-column-formats-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      this.showMessage(`${formats.length}件の書式をエクスポートしました`, 'success');
    }

    // 書式適用ビューを表示
    async showApplyView() {
      this.currentView = 'apply';
      const panel = document.getElementById(CONSTANTS.PANEL_ID);
      if (!panel) return;

      panel.innerHTML = this.generateLoadingHTML('リスト情報を取得中...');

      try {
        const lists = await this.apiClient.getLists();
        const formats = this.formatManager.getAllFormats();
        panel.innerHTML = this.generateApplyViewHTML(lists, formats);
        this.attachApplyViewEvents();
      } catch (error) {
        this.showMessage('リスト情報の取得に失敗しました', 'error');
      }
    }

    // 書式適用ビューHTML生成
    generateApplyViewHTML(lists, formats) {
      return `
        <div class="formatter-header" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 0 !important;
             display: flex !important; justify-content: space-between !important; align-items: center !important;">
          <div style="display: flex !important; align-items: center !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
            <button id="back-to-main" style="background: transparent !important; border: none !important;
                    color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                    font-size: 16px !important; cursor: pointer !important; padding: 4px !important;">←</button>
            <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
              📥 書式を適用
            </h3>
          </div>
          <button id="close-panel" style="background: transparent !important; border: none !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                  font-size: 18px !important; cursor: pointer !important; padding: 4px !important;">✕</button>
        </div>

        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; flex: 1 !important; overflow-y: auto !important;">
          ${formats.length === 0
          ? `
            <div style="text-align: center !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XL} !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
              <div style="font-size: 48px !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">📋</div>
              <div>保存された書式がありません</div>
              <div style="margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                   font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;">
                まず書式を取得・保存してください
              </div>
            </div>
          `
          : `
            <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                     font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
                適用する書式を選択:
              </label>
              <select id="format-select" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                      border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                      border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                      font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;">
                <option value="">書式を選択してください</option>
                ${formats
            .map(
              format => `
                  <option value="${format.id}" data-type="${format.columnType}">
                    ${Utils.escapeHtml(format.name)} (${format.columnType})
                  </option>
                `
            )
            .join('')}
              </select>
            </div>

            <div id="format-details" style="display: none !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <h4 style="margin: 0 0 ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} 0 !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                📋 書式の詳細:
              </h4>
              <div id="format-info"></div>
            </div>

            <div id="target-selection" style="display: none !important;">
              <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;">
                <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                       font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
                  適用先のリストを選択:
                </label>
                <select id="target-list-select" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                        border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;">
                  <option value="">リストを選択してください</option>
                  ${lists
            .map(
              list => `
                    <option value="${list.Id}">${Utils.escapeHtml(list.Title)}</option>
                  `
            )
            .join('')}
                </select>
              </div>

              <div id="target-fields-container" style="display: none !important;">
                <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                       font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
                  適用先の列を選択:
                </label>
                <div id="target-view-info" style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                     color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                     margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                     display: none !important;">
                  📋 現在のビューの列のみが対象です
                </div>
                <select id="target-field-select" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                        border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
                        margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
                  <option value="">列を選択してください</option>
                </select>

                <div id="column-mapping" style="display: none !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
                  <div style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
                       padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                       border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;">
                    <h5 style="margin: 0 0 ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} 0 !important;
                       color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                      🔄 列名マッピング
                    </h5>
                    <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                         color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                         margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
                      書式内の列参照を新しい列名に自動変更します
                    </div>
                    <div id="mapping-info"></div>
                  </div>
                </div>

                <button id="apply-format-btn" style="${this.getButtonStyles('success')}">
                  🎨 書式を適用
                </button>
              </div>
            </div>
          `
        }
        </div>
      `;
    }

    // 書式適用ビューイベント追加
    attachApplyViewEvents() {
      const closeBtn = document.getElementById('close-panel');
      if (closeBtn) {
        memoryManager.addEventListener(closeBtn, 'click', () => {
          memoryManager.cleanup();
          document.getElementById(CONSTANTS.PANEL_ID)?.remove();
        });
      }

      const backBtn = document.getElementById('back-to-main');
      if (backBtn) {
        memoryManager.addEventListener(backBtn, 'click', () => {
          this.showMainView();
        });
      }

      const formatSelect = document.getElementById('format-select');
      if (formatSelect) {
        memoryManager.addEventListener(formatSelect, 'change', e => {
          const formatId = e.target.value;
          const detailsContainer = document.getElementById('format-details');
          const targetContainer = document.getElementById('target-selection');

          if (!formatId) {
            detailsContainer.style.display = 'none';
            targetContainer.style.display = 'none';
            return;
          }

          const format = this.formatManager.getFormat(formatId);
          if (format) {
            document.getElementById('format-info').innerHTML = `
            <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                 margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
              <strong>説明:</strong> ${Utils.escapeHtml(format.description || 'なし')}<br>
              <strong>列タイプ:</strong> ${Utils.escapeHtml(format.columnType)}<br>
              <strong>取得元:</strong> ${Utils.escapeHtml(format.sourceList)} - ${Utils.escapeHtml(format.sourceColumn)}<br>
              <strong>作成日:</strong> ${Utils.escapeHtml(format.createdAt)}
            </div>
            <details style="margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
              <summary style="cursor: pointer !important; font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.MEDIUM} !important;">
                JSON書式を表示
              </summary>
              <pre style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important;
                   padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                   border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                   font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                   max-height: 150px !important; overflow-y: auto !important;
                   white-space: pre-wrap !important; word-break: break-word !important;
                   margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
${Utils.escapeHtml(JSON.stringify(format.formatJson, null, 2))}
              </pre>
            </details>
          `;

            detailsContainer.style.display = 'block';
            targetContainer.style.display = 'block';
          }
        });
      }

      const targetListSelect = document.getElementById('target-list-select');
      if (targetListSelect) {
        memoryManager.addEventListener(targetListSelect, 'change', async e => {
          const listId = e.target.value;
          const fieldsContainer = document.getElementById('target-fields-container');

          if (!listId) {
            fieldsContainer.style.display = 'none';
            return;
          }

          try {
            const formatId = document.getElementById('format-select').value;
            const format = this.formatManager.getFormat(formatId);
            // 現在のビューまたはデフォルトビューの列を取得
            const viewInfo = await this.apiClient.getCurrentViewFields(listId);
            const fields = viewInfo.fields;
            // より高度な互換性チェック
            const compatibleFields = fields.filter(field => {
              const detailedType = field.DetailedType || { baseType: field.TypeAsString };
              const compatibility = field.FormattingCompatibility || {};

              // 基本的な型互換性チェック
              const isBasicCompatible =
                compatibility.compatibleTypes &&
                compatibility.compatibleTypes.includes(format.columnType);

              // 従来の正規化による互換性チェック（フォールバック）
              const isLegacyCompatible =
                ColumnFormatManager.normalizeColumnType(field.TypeAsString) === format.columnType;

              // 書式受信可能かチェック
              const canReceive = compatibility.canReceiveFormats !== false;

              return (isBasicCompatible || isLegacyCompatible) && canReceive;
            });

            // ビュー情報を表示
            const viewInfoElement = document.getElementById('target-view-info');
            if (viewInfoElement && viewInfo.message) {
              viewInfoElement.textContent = viewInfo.message;
              viewInfoElement.style.display = 'block';
            }

            const fieldSelect = document.getElementById('target-field-select');
            fieldSelect.innerHTML = '<option value="">列を選択してください</option>';

            if (compatibleFields.length === 0) {
              fieldSelect.innerHTML += `<option disabled>互換性のある列がありません (${format.columnType})</option>`;
              if (viewInfo.totalFieldCount > viewInfo.viewFieldCount) {
                fieldSelect.innerHTML += `<option disabled>--- 他のビューには ${viewInfo.totalFieldCount - viewInfo.viewFieldCount} 列の追加列があります ---</option>`;
              }
            } else {
              // リストタイトルとビュー情報を表示
              const listTitle = document.getElementById('target-list-select').selectedOptions[0].textContent;
              fieldSelect.innerHTML += `<option disabled>--- ${Utils.escapeHtml(listTitle)} (${Utils.escapeHtml(viewInfo.viewTitle)}: ${compatibleFields.length}/${viewInfo.viewFieldCount}列が互換) ---</option>`;

              compatibleFields.forEach(field => {
                const detailedType = field.DetailedType || { displayName: field.TypeAsString, supportedFormats: [] };
                const compatibility = field.FormattingCompatibility || { riskLevel: 'medium' };

                // リスクレベルに応じたアイコン
                const riskIcon = {
                  'low': '🟢',
                  'medium': '🟡',
                  'high': '🔴'
                }[compatibility.riskLevel?.level || compatibility.riskLevel] || '⚪';

                fieldSelect.innerHTML += `
                  <option value="${field.Id}"
                          data-internal="${field.InternalName}"
                          data-title="${field.Title}"
                          title="サポート書式: ${detailedType.supportedFormats?.join(', ') || 'N/A'}">
                    ${riskIcon} ${Utils.escapeHtml(field.Title)} (${detailedType.displayName || field.TypeAsString})
                  </option>
                `;
              });

              // 除外された列がある場合の説明を追加
              if (fields.length > compatibleFields.length) {
                fieldSelect.innerHTML += `<option disabled>--- ${fields.length - compatibleFields.length}列が型の非互換により除外されました ---</option>`;
              }
            }

            fieldsContainer.style.display = 'block';
          } catch (error) {
            this.showMessage('列情報の取得に失敗しました', 'error');
          }
        });
      }

      const targetFieldSelect = document.getElementById('target-field-select');
      if (targetFieldSelect) {
        memoryManager.addEventListener(targetFieldSelect, 'change', e => {
          const fieldId = e.target.value;
          const mappingContainer = document.getElementById('column-mapping');

          if (!fieldId) {
            mappingContainer.style.display = 'none';
            return;
          }

          const selectedOption = e.target.selectedOptions[0];
          const newColumnName = selectedOption.dataset.title;
          const formatId = document.getElementById('format-select').value;
          const format = this.formatManager.getFormat(formatId);

          document.getElementById('mapping-info').innerHTML = `
            <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;">
              <strong>元の列:</strong> ${Utils.escapeHtml(format.sourceColumn)}<br>
              <strong>新しい列:</strong> ${Utils.escapeHtml(newColumnName)}
            </div>
          `;

          mappingContainer.style.display = 'block';
        });
      }

      const applyFormatBtn = document.getElementById('apply-format-btn');
      if (applyFormatBtn) {
        memoryManager.addEventListener(applyFormatBtn, 'click', async () => {
          const formatId = document.getElementById('format-select').value;
          const listId = document.getElementById('target-list-select').value;
          const fieldId = document.getElementById('target-field-select').value;

          if (!formatId || !listId || !fieldId) {
            this.showMessage('すべての項目を選択してください', 'warning');
            return;
          }

          try {
            const format = this.formatManager.getFormat(formatId);
            const selectedField = document.getElementById('target-field-select').selectedOptions[0];
            const newColumnTitle = selectedField.dataset.title; // 書式JSONの列参照を新しい列名に変更
            let modifiedFormatJson = JSON.parse(JSON.stringify(format.formatJson));

            // デバッグ用ログ
            console.log('置換情報:', {
              sourceColumn: format.sourceColumn,
              newColumnTitle: newColumnTitle,
              formatName: format.name,
              sourceList: format.sourceList,
            });

            // インポートされた書式の場合は列名置換をスキップ（より安全）
            if (
              format.sourceList === 'インポート' ||
              !format.sourceColumn ||
              format.sourceColumn.trim() === ''
            ) {
              console.log('インポート書式または空のsourceColumnのため置換をスキップ');
            } else {
              modifiedFormatJson = this.replaceColumnReferences(
                modifiedFormatJson,
                format.sourceColumn,
                newColumnTitle
              );
            }

            const success = await this.apiClient.applyColumnFormatting(
              listId,
              fieldId,
              modifiedFormatJson
            );

            if (success) {
              this.showMessage('書式を適用しました', 'success');
              memoryManager.setTimeout(() => this.showMainView(), 1500);
            } else {
              this.showMessage('書式の適用に失敗しました', 'error');
            }
          } catch (error) {
            this.showMessage('書式の適用中にエラーが発生しました', 'error');
          }
        });
      }
    }

    // 書式管理ビューを表示
    showManageView() {
      this.currentView = 'manage';
      const panel = document.getElementById(CONSTANTS.PANEL_ID);
      if (!panel) return;

      const formats = this.formatManager.getAllFormats();
      panel.innerHTML = this.generateManageViewHTML(formats);
      this.attachManageViewEvents();

      // ドラッグ機能を再有効化（まだ設定されていない場合のみ）
      setTimeout(() => {
        this.makeDraggable(panel);
      }, 50);
    }

    // 書式管理ビューHTML生成
    generateManageViewHTML(formats) {
      return `        <div class="formatter-header" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 0 !important;
             display: flex !important; justify-content: space-between !important; align-items: center !important;
             cursor: move !important;">
          <div style="display: flex !important; align-items: center !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
            <span style="font-size: 12px !important; opacity: 0.8 !important;" title="ドラッグしてウィンドウを移動">⋮⋮</span>
            <button id="back-to-main" style="background: transparent !important; border: none !important;
                    color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                    font-size: 16px !important; cursor: pointer !important; padding: 4px !important;">←</button>
            <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
              🗂️ 書式管理
            </h3>
          </div>
          <button id="close-panel" style="background: transparent !important; border: none !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                  font-size: 18px !important; cursor: pointer !important; padding: 4px !important;">✕</button>
        </div>

        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; flex: 1 !important; overflow-y: auto !important;">
          ${formats.length === 0
          ? `
            <div style="text-align: center !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XL} !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
              <div style="font-size: 48px !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">📋</div>
              <div>保存された書式がありません</div>
            </div>
          `
          : `
            <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;
                 font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
              ${formats.length} 件の書式が保存されています
            </div>

            <div style="display: grid !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;">
              ${formats
            .map(
              format => `                <div style="border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                     border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                     padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                     background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY} !important;
                     box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;">
                  <div style="display: flex !important; justify-content: space-between !important;
                       align-items: flex-start !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
                    <div style="flex: 1 !important;">
                      <h4 style="margin: 0 0 ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} 0 !important;
                         color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;
                         font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H4} !important;">
                        ${Utils.escapeHtml(format.name)}
                      </h4>
                      <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                           color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
                        ${Utils.escapeHtml(format.description || '説明なし')}
                      </div>
                    </div>
                    <div style="display: flex !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} !important;">
                      <button class="edit-format" data-id="${format.id}"
                              style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.WARNING} !important;
                              color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                              border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                              padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                              font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                              cursor: pointer !important;" title="編集">
                        ✏️
                      </button>
                      <button class="copy-format" data-id="${format.id}"
                              style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.INFO} !important;
                              color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                              border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                              padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                              font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                              cursor: pointer !important;" title="クリップボードにコピー">
                        📋
                      </button>
                      <button class="delete-format" data-id="${format.id}"
                              style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.ERROR} !important;
                              color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                              border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                              padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                              font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                              cursor: pointer !important;" title="削除">
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                       color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
                    <div><strong>列タイプ:</strong> ${Utils.escapeHtml(format.columnType)}</div>
                    <div><strong>取得元:</strong> ${Utils.escapeHtml(format.sourceList)} - ${Utils.escapeHtml(format.sourceColumn)}</div>
                    <div><strong>作成日:</strong> ${Utils.escapeHtml(format.createdAt)}</div>
                  </div>
                </div>
              `
            )
            .join('')}
            </div>
          `
        }
        </div>
      `;
    }

    // 書式管理ビューイベント追加
    attachManageViewEvents() {
      const closeBtn = document.getElementById('close-panel');
      if (closeBtn) {
        memoryManager.addEventListener(closeBtn, 'click', () => {
          memoryManager.cleanup();
          document.getElementById(CONSTANTS.PANEL_ID)?.remove();
        });
      }

      const backBtn = document.getElementById('back-to-main');
      if (backBtn) {
        memoryManager.addEventListener(backBtn, 'click', () => {
          this.showMainView();
        });
      }

      // 編集ボタンのイベント
      document.querySelectorAll('.edit-format').forEach(button => {
        memoryManager.addEventListener(button, 'click', e => {
          const formatId = e.target.dataset.id;
          this.showEditFormatDialog(formatId);
        });
      });

      // コピーボタンのイベント
      document.querySelectorAll('.copy-format').forEach(button => {
        memoryManager.addEventListener(button, 'click', async e => {
          const formatId = e.target.dataset.id;
          const success = await this.formatManager.copyFormatToClipboard(formatId);

          if (success) {
            this.showMessage('クリップボードにコピーしました', 'success');

            // ボタンを一時的に変更
            const originalText = e.target.textContent;
            e.target.textContent = '✓';
            memoryManager.setTimeout(() => {
              e.target.textContent = originalText;
            }, 1000);
          } else {
            this.showMessage('コピーに失敗しました', 'error');
          }
        });
      });

      // 削除ボタンのイベント
      document.querySelectorAll('.delete-format').forEach(button => {
        memoryManager.addEventListener(button, 'click', e => {
          const formatId = e.target.dataset.id;
          const format = this.formatManager.getFormat(formatId);

          if (confirm(`書式「${format.name}」を削除しますか？\nこの操作は取り消せません。`)) {
            this.formatManager.deleteFormat(formatId);
            this.showMessage('書式を削除しました', 'success');

            // ビューを再表示
            memoryManager.setTimeout(() => this.showManageView(), 1000);
          }
        });
      });
    }
    replaceColumnReferences(obj, oldColumnName, newColumnName) {
      // より厳密な置換条件チェック
      if (
        !oldColumnName ||
        oldColumnName.trim() === '' ||
        !newColumnName ||
        newColumnName.trim() === '' ||
        oldColumnName === newColumnName
      ) {
        console.log('置換をスキップ:', {
          oldColumnName: JSON.stringify(oldColumnName),
          newColumnName: JSON.stringify(newColumnName),
          reason: '無効な列名または同じ名前',
        });
        return obj;
      }

      if (typeof obj === 'string') {
        // より安全な置換: 完全な単語マッチのみ
        const trimmedOldName = oldColumnName.trim();
        const trimmedNewName = newColumnName.trim();

        // 特殊文字をエスケープ
        const escapedOldName = trimmedOldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // より厳密な正規表現: 英数字の境界のみを対象
        const regex = new RegExp(`\\b${escapedOldName}\\b`, 'g');
        const result = obj.replace(regex, trimmedNewName);

        // 実際に置換が発生した場合のみログ出力
        if (result !== obj) {
          console.log('文字列置換:', {
            original: obj,
            result: result,
            oldName: trimmedOldName,
            newName: trimmedNewName,
          });
        }

        return result;
      } else if (Array.isArray(obj)) {
        // 配列の各要素を再帰的に処理
        return obj.map(item => this.replaceColumnReferences(item, oldColumnName, newColumnName));
      } else if (obj && typeof obj === 'object') {
        // オブジェクトの各プロパティを再帰的に処理
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = this.replaceColumnReferences(value, oldColumnName, newColumnName);
        }
        return result;
      }
      return obj;
    }

    // 書式編集ダイアログを表示
    showEditFormatDialog(formatId) {
      const format = this.formatManager.getFormat(formatId);
      if (!format) {
        this.showMessage('書式が見つかりません', 'error');
        return;
      }

      // ダイアログHTMLを生成
      const dialogHTML = `
        <div id="edit-format-dialog" style="
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background: rgba(0,0,0,0.5) !important;
          z-index: ${CONSTANTS.Z_INDEX + 1} !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;">

          <div style="
            background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY} !important;
            border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.LG} !important;
            width: 90% !important;
            max-width: 500px !important;
            max-height: 90% !important;
            overflow-y: auto !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;">

            <div style="
              background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
              color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
              padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
              border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.LG} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.LG} 0 0 !important;
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;">
              <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
                ✏️ 書式編集
              </h3>
              <button id="close-edit-dialog" style="
                background: transparent !important;
                border: none !important;
                color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                font-size: 18px !important;
                cursor: pointer !important;
                padding: 4px !important;">✕</button>
            </div>

            <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;">
                <label style="
                  display: block !important;
                  margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                  font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                  書式名:
                </label>
                <input type="text" id="edit-format-name" value="${Utils.escapeHtml(format.name)}" style="
                  width: 100% !important;
                  padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                  border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                  border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                  font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
                  box-sizing: border-box !important;">
              </div>

              <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
                <label style="
                  display: block !important;
                  margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                  font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                  説明:
                </label>
                <textarea id="edit-format-description" style="
                  width: 100% !important;
                  height: 80px !important;
                  padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                  border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                  border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                  font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
                  resize: vertical !important;
                  box-sizing: border-box !important;">${Utils.escapeHtml(format.description || '')}</textarea>
              </div>

              <div style="display: flex !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important; justify-content: flex-end !important;">
                <button id="cancel-edit" style="${this.getButtonStyles('secondary')}">
                  キャンセル
                </button>
                <button id="save-edit" style="${this.getButtonStyles('success')}">
                  💾 保存
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // ダイアログを挿入
      document.body.insertAdjacentHTML('beforeend', dialogHTML);

      // イベントハンドラーを追加
      this.attachEditDialogEvents(formatId);
    }

    // 編集ダイアログのイベントハンドラー
    attachEditDialogEvents(formatId) {
      const dialog = document.getElementById('edit-format-dialog');

      // 閉じるボタン
      const closeBtn = document.getElementById('close-edit-dialog');
      if (closeBtn) {
        memoryManager.addEventListener(closeBtn, 'click', () => {
          dialog?.remove();
        });
      }

      // キャンセルボタン
      const cancelBtn = document.getElementById('cancel-edit');
      if (cancelBtn) {
        memoryManager.addEventListener(cancelBtn, 'click', () => {
          dialog?.remove();
        });
      }

      // 保存ボタン
      const saveBtn = document.getElementById('save-edit');
      if (saveBtn) {
        memoryManager.addEventListener(saveBtn, 'click', () => {
          const name = document.getElementById('edit-format-name')?.value.trim();
          const description = document.getElementById('edit-format-description')?.value.trim();

          if (!name) {
            this.showMessage('書式名を入力してください', 'error');
            return;
          }

          // 書式を更新
          const success = this.formatManager.updateFormat(formatId, { name, description });

          if (success) {
            this.showMessage('書式を更新しました', 'success');
            dialog?.remove();

            // 管理画面を再表示
            memoryManager.setTimeout(() => this.showManageView(), 1000);
          } else {
            this.showMessage('更新に失敗しました', 'error');
          }
        });
      }

      // 背景クリックで閉じる
      if (dialog) {
        memoryManager.addEventListener(dialog, 'click', e => {
          if (e.target === dialog) {
            dialog?.remove();
          }
        });
      }
    }

    // デフォルト書式ビューを表示
    showDefaultsView() {
      this.currentView = 'defaults';
      const panel = document.getElementById(CONSTANTS.PANEL_ID);
      if (!panel) return;

      const allDefaultFormats = this.defaultFormatProvider.getAllDefaultFormats();
      panel.innerHTML = this.generateDefaultsViewHTML(allDefaultFormats);
      this.attachDefaultsViewEvents();

      // ドラッグ機能を再有効化
      setTimeout(() => {
        this.makeDraggable(panel);
      }, 50);
    }

    // デフォルト書式ビューHTML生成
    generateDefaultsViewHTML(allDefaultFormats) {
      const columnTypes = Object.keys(allDefaultFormats);

      return `
        <div class="formatter-header" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 0 !important;
             display: flex !important; justify-content: space-between !important; align-items: center !important;
             cursor: move !important;">
          <div style="display: flex !important; align-items: center !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
            <span style="font-size: 12px !important; opacity: 0.8 !important;" title="ドラッグしてウィンドウを移動">⋮⋮</span>
            <button id="back-to-main" style="background: transparent !important; border: none !important;
                    color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                    font-size: 16px !important; cursor: pointer !important; padding: 4px !important;">←</button>
            <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
              🎨 デフォルト書式テンプレート
            </h3>
          </div>
          <button id="close-panel" style="background: transparent !important; border: none !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                  font-size: 18px !important; cursor: pointer !important; padding: 4px !important;">✕</button>
        </div>

        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; flex: 1 !important; overflow-y: auto !important;">
          <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;
               font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
               color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
            列タイプ別のデフォルト書式テンプレートです。これらの書式は新しい列に適用できます。
          </div>

          ${columnTypes.map(columnType => {
        const formats = allDefaultFormats[columnType];
        const typeDisplayName = this.getColumnTypeDisplayName(columnType);

        return `
              <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XL} !important;">
                <h4 style="margin: 0 0 ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} 0 !important;
                   color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;
                   font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H4} !important;
                   border-bottom: 2px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                   padding-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
                  ${this.getColumnTypeIcon(columnType)} ${typeDisplayName}
                </h4>

                <div style="display: grid !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;">
                  ${formats.map(format => `
                    <div style="border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                         border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                         padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                         background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY} !important;
                         box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;">

                      <div style="display: flex !important; justify-content: space-between !important;
                           align-items: flex-start !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
                        <div style="flex: 1 !important;">
                          <h5 style="margin: 0 0 ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} 0 !important;
                             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;
                             font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H4} !important;">
                            ${Utils.escapeHtml(format.name)}
                          </h5>
                          <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                               color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
                            ${Utils.escapeHtml(format.description)}
                          </div>
                        </div>

                        <div style="display: flex !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} !important;">
                          <button class="copy-default-format" data-format-id="${format.id}" data-column-type="${columnType}"
                                  style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.INFO} !important;
                                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                                  border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                                  padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                                  font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                                  cursor: pointer !important;" title="クリップボードにコピー">
                            📋
                          </button>
                          <button class="save-default-format" data-format-id="${format.id}" data-column-type="${columnType}"
                                  style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.SUCCESS} !important;
                                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                                  border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                                  padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                                  font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                                  cursor: pointer !important;" title="保存済み書式に追加">
                            💾
                          </button>
                        </div>
                      </div>

                      <div style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
                           padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                           border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                           margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
                        <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                             margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} !important;">
                          プレビュー:
                        </div>
                        <div style="background: white !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                             border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;">
                          ${this.generateFormatPreview(format, columnType)}
                        </div>
                      </div>

                      <details style="margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
                        <summary style="cursor: pointer !important; font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.MEDIUM} !important;
                                 font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;">
                          JSON書式を表示
                        </summary>
                        <pre style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important;
                             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                             font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                             max-height: 150px !important; overflow-y: auto !important;
                             white-space: pre-wrap !important; word-break: break-word !important;
                             margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
${Utils.escapeHtml(JSON.stringify(format.formatJson, null, 2))}
                        </pre>
                      </details>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
      }).join('')}
        </div>
      `;
    }

    // デフォルト書式ビューイベント追加
    attachDefaultsViewEvents() {
      const closeBtn = document.getElementById('close-panel');
      if (closeBtn) {
        memoryManager.addEventListener(closeBtn, 'click', () => {
          memoryManager.cleanup();
          document.getElementById(CONSTANTS.PANEL_ID)?.remove();
        });
      }

      const backBtn = document.getElementById('back-to-main');
      if (backBtn) {
        memoryManager.addEventListener(backBtn, 'click', () => {
          this.showMainView();
        });
      }

      // コピーボタンのイベント
      document.querySelectorAll('.copy-default-format').forEach(button => {
        memoryManager.addEventListener(button, 'click', async e => {
          const formatId = e.target.dataset.formatId;
          const columnType = e.target.dataset.columnType;

          const formats = this.defaultFormatProvider.getDefaultFormatsForType(columnType);
          const format = formats.find(f => f.id === formatId);

          if (format) {
            try {
              await navigator.clipboard.writeText(JSON.stringify(format.formatJson, null, 2));
              this.showMessage('クリップボードにコピーしました', 'success');

              // ボタンを一時的に変更
              const originalText = e.target.textContent;
              e.target.textContent = '✓';
              memoryManager.setTimeout(() => {
                e.target.textContent = originalText;
              }, 1000);
            } catch (error) {
              this.showMessage('コピーに失敗しました', 'error');
            }
          }
        });
      });

      // 保存ボタンのイベント
      document.querySelectorAll('.save-default-format').forEach(button => {
        memoryManager.addEventListener(button, 'click', e => {
          const formatId = e.target.dataset.formatId;
          const columnType = e.target.dataset.columnType;

          const formats = this.defaultFormatProvider.getDefaultFormatsForType(columnType);
          const format = formats.find(f => f.id === formatId);

          if (format) {
            const formatData = {
              name: `${format.name} (デフォルト)`,
              description: format.description,
              columnType: columnType,
              formatJson: format.formatJson,
              sourceList: 'デフォルトテンプレート',
              sourceColumn: '',
            };

            this.formatManager.saveFormat(formatData);
            this.showMessage('保存済み書式に追加しました', 'success');

            // ボタンを一時的に変更
            const originalText = e.target.textContent;
            e.target.textContent = '✓';
            memoryManager.setTimeout(() => {
              e.target.textContent = originalText;
            }, 1000);
          }
        });
      });
    }

    // 列タイプの表示名を取得
    getColumnTypeDisplayName(columnType) {
      const displayNames = {
        Number: '数値',
        Person: 'ユーザーまたはグループ',
        DateTime: '日付と時刻',
        Choice: '選択肢',
        Boolean: 'はい/いいえ',
        Text: 'テキスト'
      };
      return displayNames[columnType] || columnType;
    }

    // 列タイプのアイコンを取得
    getColumnTypeIcon(columnType) {
      const icons = {
        Number: '🔢',
        Person: '👤',
        DateTime: '📅',
        Choice: '📋',
        Boolean: '☑️',
        Text: '📝'
      };
      return icons[columnType] || '📄';
    }

    // 書式のプレビューを生成
    generateFormatPreview(format, columnType) {
      try {
        // 簡易的なプレビュー生成
        const sampleData = format.sampleData;

        switch (columnType) {
          case 'Number':
            if (format.id === 'number-percentage-color') {
              const color = sampleData >= 80 ? '#107c10' : sampleData >= 60 ? '#ffaa44' : sampleData >= 40 ? '#ff8c00' : '#d13438';
              return `<div style="background-color: ${color}; color: white; padding: 4px 8px; border-radius: 4px; text-align: center; font-weight: bold; display: inline-block;">${sampleData}%</div>`;
            } else if (format.id === 'number-progress-bar') {
              const barColor = sampleData >= 80 ? '#107c10' : sampleData >= 60 ? '#0078d4' : '#ffaa44';
              return `<div style="background-color: #f3f2f1; border-radius: 10px; height: 20px; position: relative; overflow: hidden; width: 150px;">
                        <div style="background-color: ${barColor}; height: 100%; width: ${sampleData}%;"></div>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 12px; font-weight: bold; color: #323130;">${sampleData}%</div>
                      </div>`;
            }
            break;
          case 'Person':
            if (format.id === 'person-avatar-name') {
              return `<div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: #0078d4; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">👤</div>
                        <div style="font-weight: 500;">${sampleData.title}</div>
                      </div>`;
            } else if (format.id === 'person-card') {
              return `<div style="background-color: #f8f9fa; border: 1px solid #edebe9; border-radius: 6px; padding: 8px; display: flex; align-items: center; gap: 8px; max-width: 200px;">
                        <div style="width: 24px; height: 24px; border-radius: 50%; background: #0078d4; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">👤</div>
                        <div>
                          <div style="font-size: 13px; font-weight: 600; line-height: 1.2;">${sampleData.title}</div>
                          <div style="font-size: 11px; color: #605e5c; line-height: 1.2;">${sampleData.email}</div>
                        </div>
                      </div>`;
            }
            break;
          case 'DateTime':
            if (format.id === 'datetime-relative') {
              return `<div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 14px;">🕒</span>
                        <span>2024/01/15 (3日前)</span>
                      </div>`;
            } else if (format.id === 'datetime-icon-date') {
              return `<div style="display: flex; align-items: center; gap: 8px; background-color: #f3f2f1; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #0078d4;">
                        <span style="font-size: 16px;">📅</span>
                        <span style="font-weight: 500;">2024/02/20</span>
                      </div>`;
            }
            break;
          case 'Choice':
            if (format.id === 'choice-color-pill') {
              const color = sampleData === '完了' ? '#107c10' : sampleData === '進行中' ? '#0078d4' : sampleData === '保留' ? '#ffaa44' : '#8a8886';
              return `<div style="background-color: ${color}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-align: center; display: inline-block;">${sampleData}</div>`;
            } else if (format.id === 'choice-icon-status') {
              const icon = sampleData === '完了' ? '✅' : sampleData === '進行中' ? '🔄' : sampleData === '保留' ? '⏸️' : '❓';
              return `<div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 14px;">${icon}</span>
                        <span style="font-weight: 500;">${sampleData}</span>
                      </div>`;
            }
            break;
          case 'Boolean':
            if (format.id === 'boolean-check-cross') {
              return `<div style="text-align: center; font-size: 16px;">${sampleData ? '✅' : '❌'}</div>`;
            } else if (format.id === 'boolean-status-badge') {
              const color = sampleData ? '#107c10' : '#d13438';
              const text = sampleData ? 'はい' : 'いいえ';
              return `<div style="background-color: ${color}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; text-align: center; display: inline-block;">${text}</div>`;
            }
            break;
          case 'Text':
            if (format.id === 'text-highlight') {
              return `<div style="background-color: #fff4ce; border-left: 3px solid #ffaa44; padding: 6px 8px; font-weight: 500;">${sampleData}</div>`;
            } else if (format.id === 'text-badge') {
              return `<div style="background-color: #0078d4; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; display: inline-block;">${sampleData}</div>`;
            }
            break;
        }

        return `<div style="padding: 8px; color: #605e5c;">プレビューを生成できませんでした</div>`;
      } catch (error) {
        return `<div style="padding: 8px; color: #d13438;">プレビューエラー: ${error.message}</div>`;
      }
    }
  }

  // =============================================================================
  // メインアプリケーションクラス
  // =============================================================================
  class ListsColumnFormatter {
    constructor() {
      this.siteInfo = Utils.getSiteInfo();
      this.formatManager = new ColumnFormatManager();

      if (!this.siteInfo) {
        alert('このページはSharePoint、OneDrive、またはMicrosoft Listsのページではありません。');
        return;
      }

      this.apiClient = new SharePointApiClient(this.siteInfo);
      this.uiManager = new UIManager(this.apiClient, this.formatManager);

      this.init();
    }

    init() {
      // パネルを作成して表示
      this.uiManager.createPanel();
      this.uiManager.showMainView();
    }
  }

  // =============================================================================
  // エントリーポイント
  // =============================================================================

  // 既存のパネルがあるかチェック
  if (document.getElementById(CONSTANTS.PANEL_ID)) {
    document.getElementById(CONSTANTS.PANEL_ID).remove();
    return;
  }

  // アプリケーションを開始
  new ListsColumnFormatter();
})();
