[![Release](https://github.com/n1lsqn/kintai-fe/actions/workflows/Release.yml/badge.svg)](https://github.com/n1lsqn/kintai-fe/actions/workflows/Release.yml)

# Kintai Frontend

作業管理アプリ「Kintai」のフロントエンド (GUI) アプリケーションです。
**Tauri v2 + React v19 + Tailwind CSS v4** で構築されており、デスクトップネイティブアプリとして動作します。

## 🛠 技術スタック

*   **Core**: [Tauri v2](https://v2.tauri.app/) (Rust)
*   **UI Library**: [React v19](https://react.dev/)
*   **Bundler**: [Vite v7](https://vitejs.dev/)
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)

## 🚀 セットアップと起動

### 前提条件

*   Node.js (v20以上推奨)
*   Rust (Tauriアプリのビルドに必要)
*   バックエンドAPIが起動していること (開発時は `http://localhost:9394`)

### インストール

```bash
npm install
```

### 開発モード (Development)

**1. Webブラウザモード**
TauriのAPI（ウィンドウ操作やシステムトレイ等）を使わない純粋なUI/ロジックの確認用です。高速に動作します。

```bash
npm run dev
```
アクセス: `http://localhost:5173`

**2. デスクトップアプリモード (Tauri)**
実際のアプリケーションとして起動します。

```bash
npm run tauri dev
```

## 🏗 ビルド (Production)

配布用のインストーラーを生成します。

```bash
npm run tauri build
```
生成物は `src-tauri/target/release/bundle/` 配下に出力されます（プラットフォームにより異なります）。

## ⚙️ 環境変数設定

APIの接続先は `VITE_API_BASE` で制御されます。

| 環境 | ファイル | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| **開発** | `.env.development` | `http://localhost:9394` | Docker上の開発用APIに接続 |
| **本番** | `.env.production` | `https://api.n1l.dev` | 本番運用APIに接続 |

## 📖 フロントエンド詳細仕様

### 1. ステータス定義 (UI vs API)

UI上の表示ラベルと、バックエンドAPIで管理される内部ステータスIDの対応関係です。

| UI表示 (Label) | 内部ID (`currentStatus`) | 色分け (Theme) | 説明 |
| :--- | :--- | :--- | :--- |
| **オフライン** | `unregistered` | Gray | 作業開始前、または退勤後の状態。 |
| **集中タイム** | `working` | Green | 作業中の状態。出勤中。 |
| **リラックス** | `on_break` | Yellow | 休憩中の状態。 |

### 2. ログ種別定義

履歴リストに表示されるログ種別の対応関係です。

| UI表示 (Label) | 内部ID (`type`) | 説明 |
| :--- | :--- | :--- |
| **ログイン** | `work_start` | 作業を開始（出勤）しました。 |
| **ログアウト** | `work_end` | 作業を終了（退勤）しました。 |
| **AFK** | `break_start` | 休憩または離席を開始しました。 |
| **復帰** | `break_end` | 休憩から戻り、作業を再開しました。 |

### 3. 操作フロー

アプリはメイン画面 (`App.tsx`) 一枚で構成されています。

1.  **初期ロード (`useEffect`)**:
    *   起動時に `GET /status` を叩き、現在のユーザー状態とログを取得して画面を復元します。
    *   APIサーバーがダウンしている場合はロード画面で待機、またはエラーログを出力します。

2.  **左ボタン (Primary Action)**:
    *   現在の状態に応じてラベルと機能が変わるトグルボタンです。
    *   エンドポイント: `POST /stamp`
    *   遷移: **開始** (`unregistered`) → **休憩開始** (`working`) → **休憩終了** (`on_break`) → **休憩開始** ...

3.  **右ボタン (Secondary Action)**:
    *   **終了** ボタン。
    *   エンドポイント: `POST /clock_out`
    *   `unregistered` (オフライン) 状態のときは無効化されます。
    *   押下すると、現在の状態に関わらず `unregistered` (オフライン) に戻り、退勤ログが記録されます。

## 📁 ディレクトリ構造

*   `src/`: React アプリケーションのソースコード
    *   `App.tsx`: メイン画面コンポーネント。API通信ロジックもここに集約されています。
    *   `App.css`, `index.css`: Tailwind CSS のディレクティブ定義。
*   `src-tauri/`: Rust バックエンド (Tauri設定)
    *   `tauri.conf.json`: ウィンドウサイズ、権限、バンドル設定など。
*   `dist/`: Webビルドの出力先