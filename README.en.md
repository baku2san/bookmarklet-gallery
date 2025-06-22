# 🔖 Bookmarklet Gallery

_[日本語](README.md) | [English](README.en.md)_

[![🚀 Deploy to GitHub Pages](https://github.com/baku2san/bookmarklet-gallery/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/baku2san/bookmarklet-gallery/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Interactive gallery of useful bookmarklets including SharePoint Navigator, API tools, and other productivity utilities.

## 🌐 Live Demo

**GitHub Pages**: [https://baku2san.github.io/bookmarklet-gallery](https://baku2san.github.io/bookmarklet-gallery)

## 📦 Available Bookmarklets

### 🎯 Productivity Tools

- **🐛 Debug Test** - Bookmarklet debugging and diagnostic tool
- **🧪 Simple Test** - Simple test bookmarklet
- **📊 Page Analyzer** - Page structure and metadata analysis tool
- **🧭 SharePoint Navigator** - SharePoint site navigation tool

### 🛠️ Development Tools

- **🎨 CSS Inspector** - CSS development and debugging tool
- **🔌 API Tester** - API endpoint testing tool
- **🔗 SharePoint API Navigator** - SharePoint REST API exploration and testing tool

## 🚀 Quick Start

1. **Access the Gallery**: Open the [GitHub Pages URL]
2. **Select a Bookmarklet**: Click on the tool you want to use
3. **Drag to Bookmark Bar**: Drag the bookmarklet to your browser's bookmark bar
4. **Execute**: Click the bookmarklet on any page to run it

## 🔧 Development

### Prerequisites

- Node.js 18+
- npm
- PowerShell (Windows) / pwsh (Linux/macOS)

### Quick Setup

```bash
# New environment setup (recommended)
.\scripts\setup.ps1 -Build

# Or traditional method
cd bookmarklets
npm install
npm run build
```

### Build

```bash
npm run build          # Production build
npm run dev           # Development build + preview
npm run watch         # File watch mode
```

### Local Preview

```bash
npm run build
# Open bookmarklets/dist/install.html in your browser
```

## 📁 Project Structure

```tree
bookmarklets/
├── src/
│   ├── development/      # Development tool bookmarklets
│   ├── productivity/     # Productivity enhancement tool bookmarklets
│   └── gallery.yml       # Gallery configuration file
├── dist/
│   ├── install.html      # Production gallery page (auto-generated)
│   └── dev.html          # Developer page (auto-generated)
├── build-production.js   # Build script
└── package.json         # Node.js configuration

scripts/                  # Project operation scripts
├── setup.ps1            # New environment setup
├── diagnose.ps1         # Environment diagnosis & troubleshooting
├── update-deps.ps1      # Dependency management & security audit
└── README.md            # Script usage instructions
```

## 🛠️ Maintenance & Troubleshooting

### 🔍 Environment Diagnosis

```powershell
# Diagnose issues
.\scripts\diagnose.ps1

# Detailed diagnostic information
.\scripts\diagnose.ps1 -Detailed

# Attempt automatic repair
.\scripts\diagnose.ps1 -Fix
```

### 🔒 Security & Dependency Management

```powershell
# Check dependencies
.\scripts\update-deps.ps1 -Check

# Security audit
.\scripts\update-deps.ps1 -Audit

# Interactive maintenance
.\scripts\update-deps.ps1 -All
```

### 🎯 VS Code Tasks

Available via `Ctrl+Shift+P` → `Tasks: Run Task`:

- **🚀 New Environment Setup** - Complete setup
- **🔍 Environment Diagnosis** - Detailed diagnosis
- **🔧 Environment Auto Repair** - Automatic problem fixing
- **🔨 Build Bookmarklets** - Production build
- **👀 Development Mode (Watch)** - File watching
- **🔒 Security Audit** - Security check

## 🔄 Auto-Deployment

Automatically deploys to GitHub Pages on push/merge to the main branch.

### Deployment Process

1. 📥 Checkout code
2. 🟢 Setup Node.js environment
3. 📦 Install dependencies
4. 🔨 Build bookmarklets
5. 📁 Prepare GitHub Pages content
6. 🌐 Deploy to GitHub Pages

## 📚 Documentation

- 📖 [Setup Guide](./docs/SETUP.md)
- 🌐 [GitHub Pages Deployment](./docs/GITHUB_PAGES_SETUP.md)
- 🤝 [Contributing Guidelines](./docs/CONTRIBUTING.md)
- 🔧 [Script Usage](./scripts/README.md)

## 🤝 Contributing

We welcome contributions to this project! Please see our [Contributing Guidelines](./docs/CONTRIBUTING.md) for details.

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - See the [LICENSE](LICENSE) file for details.

---

**⭐ Please star this repository if it helped you!**
