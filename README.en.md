# Miaoda - Universal AI Service Aggregation Platform

[简体中文](README.md) | **English** | [日本語](README.ja.md) | [हिन्दी](README.hi.md)

## 🚀 Overview

Miaoda is a universal AI service aggregation platform, originally designed for Claude Code (claude.ai/code), now upgraded to support multiple AI service providers with a unified interface. Built with Electron framework, it provides a VSCode-style terminal experience, intelligent API format conversion, dynamic routing, and local model support.

## ✨ Key Features

### 🤖 Multi-Service Support
- **Cloud Services**: OpenAI, Claude, Google Gemini, Groq Cloud, Perplexity AI
- **Local Services**: Ollama, LM Studio, LocalAI
- **Dynamic Routing**: Specify service and model via URL path
- **Format Conversion**: Automatic conversion between different AI service API formats

### 💻 Terminal Experience
- **VSCode-style Interface**: Familiar development environment
- **Multi-session Management**: Handle multiple terminal sessions simultaneously
- **Command History**: Local storage in localStorage
- **Cross-platform**: Support for macOS and Windows

### 🔧 Advanced Features
- **Smart Analytics** (v4.2.1): Usage tracking and optimization suggestions
- **Auto Update** (v4.2.1): Background updates with silent installation
- **Configuration Wizard**: 4-step guided setup process
- **Token Statistics**: Real-time token counting and cost calculation
- **Error Handling**: Intelligent error identification and solution hints

## 📦 Installation

### Download Pre-built Releases

Download the latest version from [Releases](https://github.com/miounet11/claude-code-manager/releases):

- **macOS**: `Miaoda-5.0.1.dmg` (Universal - Intel & Apple Silicon)
- **Windows**: `Miaoda-Setup-5.0.1.exe` (x64)

### Build from Source

```bash
# Clone repository
git clone https://github.com/miounet11/claude-code-manager.git
cd claude-code-manager

# Install dependencies
npm install

# Development mode
npm run dev

# Build for macOS
npm run build

# Build for Windows
npm run build:windows
```

## 🎯 Quick Start

### 1. Initial Setup
1. Launch Miaoda application
2. Follow the 4-step configuration wizard
3. Configure your preferred AI service (API key, endpoint)
4. Test the connection

### 2. Using Dynamic Routing
Access different AI services through unified URLs:

```
http://localhost:8118/proxy/{service}/{model}/v1/chat/completions
```

Examples:
- OpenAI GPT-4: `/proxy/openai/gpt-4/v1/chat/completions`
- Claude Opus: `/proxy/claude/claude-3-opus/v1/messages`
- Ollama Llama2: `/proxy/ollama/llama2/api/chat`

### 3. Local Model Setup
1. Install local service (Ollama/LM Studio)
2. Configure in Local Model Manager
3. Access via dynamic routing

## 🛠️ Development

### Project Structure
```
src/
├── main/                      # Main process
│   ├── services/              # Core services
│   │   ├── proxy-server.js    # API proxy server
│   │   ├── service-registry.js # AI service registry
│   │   └── format-converter.js # API format converter
│   └── index.js               # Application entry
├── renderer/                  # Renderer process
│   ├── components/            # UI components
│   └── xterm-terminal.js      # Terminal UI
└── preload/                   # Preload scripts
```

### Common Commands
```bash
# Development
npm run dev              # Run in development mode
npm run lint            # ESLint check
npm run test:core       # Run core tests

# Building
npm run build           # Build for macOS
npm run build:windows   # Build for Windows

# Git Flow
./scripts/git-flow-helper.sh help     # Show help
./scripts/git-flow-helper.sh feature <name>  # Create feature branch
./scripts/git-flow-helper.sh release <version> # Create release branch
```

## 📝 Configuration

### Configuration Storage
- **Location**: `~/Library/Application Support/miaoda/` (macOS)
- **Encryption**: Using electron-store encryption
- **Backup**: Automatic backup before updates

### Environment Variables
```bash
ANTHROPIC_API_URL=http://localhost:8118/proxy
ANTHROPIC_API_KEY=your-api-key
```

## 🔄 Version History

### v5.0.1 (2025-08-25)
- Multi-language documentation support
- Performance optimizations
- Bug fixes and stability improvements

### v4.2.1 (2024-01-28)
- Smart analytics system
- Auto-update functionality
- Performance optimization based on usage patterns

### v4.1.0 (2024-01-25)
- Universal Bridge architecture
- Local model support
- Dynamic routing system

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Electron framework for cross-platform desktop apps
- xterm.js for terminal emulation
- All AI service providers for their APIs
- The open-source community for continuous support

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/miounet11/claude-code-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/miounet11/claude-code-manager/discussions)
- **Email**: support@miaoda.app

---

Made with ❤️ by Miaoda Team