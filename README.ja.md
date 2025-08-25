# Miaoda - ユニバーサルAIサービス統合プラットフォーム

[简体中文](README.md) | [English](README.en.md) | **日本語** | [हिन्दी](README.hi.md)

## 🚀 概要

Miaodaは、元々Claude Code（claude.ai/code）向けに設計されたユニバーサルAIサービス統合プラットフォームで、現在は統一インターフェースで複数のAIサービスプロバイダーをサポートするようにアップグレードされています。Electronフレームワークで構築され、VSCodeスタイルのターミナル体験、インテリジェントなAPIフォーマット変換、動的ルーティング、ローカルモデルサポートを提供します。

## ✨ 主な機能

### 🤖 マルチサービスサポート
- **クラウドサービス**: OpenAI、Claude、Google Gemini、Groq Cloud、Perplexity AI
- **ローカルサービス**: Ollama、LM Studio、LocalAI
- **動的ルーティング**: URLパス経由でサービスとモデルを指定
- **フォーマット変換**: 異なるAIサービスAPIフォーマット間の自動変換

### 💻 ターミナル体験
- **VSCodeスタイルインターフェース**: 慣れ親しんだ開発環境
- **マルチセッション管理**: 複数のターミナルセッションを同時に処理
- **コマンド履歴**: localStorageでのローカル保存
- **クロスプラットフォーム**: macOSとWindowsをサポート

### 🔧 高度な機能
- **スマート分析** (v4.2.1): 使用状況の追跡と最適化の提案
- **自動更新** (v4.2.1): サイレントインストールによるバックグラウンド更新
- **設定ウィザード**: 4ステップのガイド付きセットアッププロセス
- **トークン統計**: リアルタイムのトークンカウントとコスト計算
- **エラー処理**: インテリジェントなエラー識別とソリューションヒント

## 📦 インストール

### ビルド済みリリースのダウンロード

[リリース](https://github.com/miounet11/claude-code-manager/releases)から最新バージョンをダウンロード:

- **macOS**: `Miaoda-5.0.1.dmg` (ユニバーサル - Intel & Apple Silicon)
- **Windows**: `Miaoda-Setup-5.0.1.exe` (x64)

### ソースからビルド

```bash
# リポジトリをクローン
git clone https://github.com/miounet11/claude-code-manager.git
cd claude-code-manager

# 依存関係をインストール
npm install

# 開発モード
npm run dev

# macOS用にビルド
npm run build

# Windows用にビルド
npm run build:windows
```

## 🎯 クイックスタート

### 1. 初期設定
1. Miaodaアプリケーションを起動
2. 4ステップの設定ウィザードに従う
3. 好みのAIサービスを設定（APIキー、エンドポイント）
4. 接続をテスト

### 2. 動的ルーティングの使用
統一URLで異なるAIサービスにアクセス:

```
http://localhost:8118/proxy/{service}/{model}/v1/chat/completions
```

例:
- OpenAI GPT-4: `/proxy/openai/gpt-4/v1/chat/completions`
- Claude Opus: `/proxy/claude/claude-3-opus/v1/messages`
- Ollama Llama2: `/proxy/ollama/llama2/api/chat`

### 3. ローカルモデルのセットアップ
1. ローカルサービスをインストール（Ollama/LM Studio）
2. ローカルモデルマネージャーで設定
3. 動的ルーティング経由でアクセス

## 🛠️ 開発

### プロジェクト構造
```
src/
├── main/                      # メインプロセス
│   ├── services/              # コアサービス
│   │   ├── proxy-server.js    # APIプロキシサーバー
│   │   ├── service-registry.js # AIサービスレジストリ
│   │   └── format-converter.js # APIフォーマットコンバーター
│   └── index.js               # アプリケーションエントリ
├── renderer/                  # レンダラープロセス
│   ├── components/            # UIコンポーネント
│   └── xterm-terminal.js      # ターミナルUI
└── preload/                   # プリロードスクリプト
```

### 一般的なコマンド
```bash
# 開発
npm run dev              # 開発モードで実行
npm run lint            # ESLintチェック
npm run test:core       # コアテストの実行

# ビルド
npm run build           # macOS用ビルド
npm run build:windows   # Windows用ビルド

# Git Flow
./scripts/git-flow-helper.sh help     # ヘルプを表示
./scripts/git-flow-helper.sh feature <name>  # 機能ブランチを作成
./scripts/git-flow-helper.sh release <version> # リリースブランチを作成
```

## 📝 設定

### 設定の保存場所
- **場所**: `~/Library/Application Support/miaoda/` (macOS)
- **暗号化**: electron-store暗号化を使用
- **バックアップ**: 更新前の自動バックアップ

### 環境変数
```bash
ANTHROPIC_API_URL=http://localhost:8118/proxy
ANTHROPIC_API_KEY=your-api-key
```

## 🔄 バージョン履歴

### v5.0.1 (2025-08-25)
- 多言語ドキュメントサポート
- パフォーマンスの最適化
- バグ修正と安定性の向上

### v4.2.1 (2024-01-28)
- スマート分析システム
- 自動更新機能
- 使用パターンに基づくパフォーマンス最適化

### v4.1.0 (2024-01-25)
- ユニバーサルブリッジアーキテクチャ
- ローカルモデルサポート
- 動的ルーティングシステム

## 🤝 貢献

貢献を歓迎します！プルリクエストをお気軽に提出してください。

1. リポジトリをフォーク
2. 機能ブランチを作成（`git checkout -b feature/AmazingFeature`）
3. 変更をコミット（`git commit -m 'Add some AmazingFeature'`）
4. ブランチにプッシュ（`git push origin feature/AmazingFeature`）
5. プルリクエストを開く

## 📄 ライセンス

このプロジェクトはMITライセンスの下でライセンスされています - 詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 🙏 謝辞

- クロスプラットフォームデスクトップアプリ用Electronフレームワーク
- ターミナルエミュレーション用xterm.js
- API提供のすべてのAIサービスプロバイダー
- 継続的なサポートのオープンソースコミュニティ

## 📞 サポート

- **Issues**: [GitHub Issues](https://github.com/miounet11/claude-code-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/miounet11/claude-code-manager/discussions)
- **Email**: support@miaoda.app

---

Miaoda Teamによって❤️をこめて作られました