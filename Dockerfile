# Node.jsの公式イメージを使用 (バージョンはプロジェクトに合わせて調整)
FROM node:18-alpine

# アプリケーションディレクトリを作成
WORKDIR /usr/src/app

# アプリケーションの依存関係をインストール
# package.json と package-lock.json (または yarn.lock) をコピー
COPY package*.json ./

# sqlite3のビルドに必要なパッケージをインストール (alpineの場合)
# pgもネイティブモジュールを持つことがあるので、pythonやmakeが必要な場合がある
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm install \
    && apk del .build-deps

# 本番用にビルドする場合 (例: フロントエンドのアセットビルドなど)
# RUN npm run build

# アプリケーションのソースコードをバンドル
COPY . .

# アプリケーションがリッスンするポートを公開
# process.env.PORTが設定されていればそれが使われる
EXPOSE 3000

# アプリケーションを起動
CMD [ "node", "index.js" ]
