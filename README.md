# グリーティングカードアプリ

LINE WORKS WOFF (With OIDC For Front-end) として動作することを想定したシンプルなグリーティングカード送受信アプリケーションです。

## 機能

*   ユーザー登録（初回アクセス時）
*   メッセージカードの作成と送信
    *   送信相手の選択
    *   カードデザインの選択
    *   メッセージの入力
*   受信カードの一覧表示

## 技術スタック

*   Node.js
*   Express.js
*   SQLite (ローカル開発用)
*   PostgreSQL (本番環境用)

## ローカルでの実行方法

1.  **依存関係のインストール:**
    ```bash
    npm install
    ```

2.  **アプリケーションの起動:**
    ```bash
    npm start
    ```
    デフォルトでは SQLite を使用し、`http://localhost:3000` で起動します。

## デプロイ

このアプリケーションは、Dockerコンテナとしてデプロイすることを想定しています。

### 環境変数

デプロイ環境では以下の環境変数を設定する必要があります。

*   `PORT`: アプリケーションがリッスンするポート番号。指定しない場合は `3000` が使用されます。
*   `DATABASE_URL`: 本番環境のPostgreSQLデータベース接続URL。
    *   形式: `postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE_NAME>`
    *   この環境変数が設定されている場合、アプリケーションはPostgreSQLを使用します。設定されていない場合は、ローカルの `db/database.sqlite` ファイルを使用します。

### データベース

*   ローカル開発: SQLite (`db/database.sqlite`) - このファイルは `.gitignore` に含まれており、リポジトリにはコミットされません。
*   本番環境: PostgreSQL (上記 `DATABASE_URL` で指定)

### Docker

Dockerfile を使用してコンテナイメージをビルドし、実行することができます。

1.  **Dockerイメージのビルド:**
    ```bash
    docker build -t greeting-card-app .
    ```

2.  **Dockerコンテナの実行 (ローカルでテストする場合):**
    *   SQLite を使用する場合:
        ```bash
        docker run -p 3000:3000 -v $(pwd)/db:/usr/src/app/db greeting-card-app
        ```
        上記コマンドは、ホストの `./db` ディレクトリをコンテナ内の `/usr/src/app/db` にマウントし、SQLiteデータベースファイルを永続化します。初回起動時や `db/database.sqlite` がない場合は、アプリケーションが自動的に作成します。

    *   外部のPostgreSQLデータベースを使用する場合:
        ```bash
        docker run -p 3000:3000 -e PORT=3000 -e DATABASE_URL="your_postgresql_connection_string" greeting-card-app
        ```

## LINE WORKS WOFF連携について

ユーザーIDの取得は、現在 `x-user-id` ヘッダーまたは `userId` クエリパラメータから仮取得しています。
LINE WORKS WOFF環境で正式に利用する場合は、LINE WORKSの公式ドキュメント (https://developers.worksmobile.com/) を参照し、適切なユーザーID取得方法およびOIDC連携を実装する必要があります。該当箇所には `TODO`コメントが付与されています。

---
この `README.md` は基本的な情報を提供します。プロジェクトの進捗や詳細機能に応じて適宜更新してください。
