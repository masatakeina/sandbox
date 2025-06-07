const express = require('express');
const fs = require('fs');
const path = require('path');
const dbService = require('./db/database'); // Modified to get the service object
const { getUserById, createUser, getCardsByReceiverId, createCard, getAllUsers } = dbService; // Destructure functions

const app = express();
const PORT = process.env.PORT || 3000;

// 静的ファイル (画像など) を public ディレクトリから提供する
app.use(express.static(path.join(__dirname, 'public')));
// POSTリクエストのボディを解析するためのミドルウェア
app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
  // TODO: LINE WORKS WOFFの正式なユーザーID取得方法については、
  //別途公式ドキュメント (https://developers.worksmobile.com/) を参照し、必要に応じて修正してください。
  //現在は 'x-user-id' ヘッダーまたは 'userId' クエリパラメータから仮取得しています。
  let userId = req.header('x-user-id') || req.query.userId;

  if (!userId) {
    // ユーザーIDがない場合は、main_page.html をベースにエラーメッセージを表示
    try {
      const templateHtml = fs.readFileSync(path.join(__dirname, 'views', 'main_page.html'), 'utf-8');
      const placeholder = /const serverData = \{\s*userId: '', \/\/ サーバーからユーザーIDをセット\s*cards: \[\]   \/\/ サーバーからカードのリストをセット\s*\};/;
      const errorReplacement = `const serverData = {
            userId: null,
            cards: [],
            error: "ユーザーIDが指定されていません。"
        };`;
      const finalHtml = templateHtml.replace(placeholder, errorReplacement).replace(
        '<h1>受信カード</h1>',
        '<h1>エラー</h1><p>ユーザーIDが指定されていません。</p><h1>受信カード</h1>'
      );
      return res.status(400).send(finalHtml);
    } catch (error) {
      console.error('Error reading main_page.html for error display:', error);
      return res.status(500).send('<h1>サーバーエラー</h1>');
    }
  }

  try {
    let user = await getUserById(userId);

    if (!user) {
      await createUser(userId);
      // 新規ユーザーの場合、カードはまだないので空のリストを渡す
    }

    const cards = await getCardsByReceiverId(userId);
    const mainPagePath = path.join(__dirname, 'views', 'main_page.html');

    fs.readFile(mainPagePath, 'utf-8', (err, html) => {
      if (err) {
        console.error('Error reading main_page.html:', err);
        return res.status(500).send('<h1>エラー</h1><p>ページの読み込みに失敗しました。</p>');
      }

      // HTMLテンプレートにカードデータとユーザーIDを埋め込む
      // 注意: この方法はXSSのリスクを考慮する必要があります。実際のアプリケーションではテンプレートエンジンを使用すべきです。
      const placeholder = /const serverData = \{\s*userId: '', \/\/ サーバーからユーザーIDをセット\s*cards: \[\]   \/\/ サーバーからカードのリストをセット\s*\};/;
      const replacement = `const serverData = {
            userId: "${userId.replace(/"/g, '\\"')}",
            cards: ${JSON.stringify(cards).replace(/</g, '\\u003c')}
        };`;
      const finalHtml = html.replace(placeholder, replacement);
      res.send(finalHtml);
    });

  } catch (error) {
    console.error('Error processing request:', error);
    // エラーが発生した場合もmain_page.htmlをベースにエラーメッセージを表示
     try {
      const templateHtml = fs.readFileSync(path.join(__dirname, 'views', 'main_page.html'), 'utf-8');
      const placeholder = /const serverData = \{\s*userId: '', \/\/ サーバーからユーザーIDをセット\s*cards: \[\]   \/\/ サーバーからカードのリストをセット\s*\};/;
      const errorReplacement = `const serverData = {
            userId: ${userId ? `"${userId.replace(/"/g, '\\"')}"` : null},
            cards: [],
            error: "サーバー内部でエラーが発生しました。"
        };`;
      const finalHtml = templateHtml.replace(placeholder, errorReplacement).replace(
        '<h1>受信カード</h1>',
        '<h1>エラー</h1><p>サーバー内部でエラーが発生しました。</p><h1>受信カード</h1>'
      );
      return res.status(500).send(finalHtml);
    } catch (readError) {
      console.error('Error reading main_page.html for error display:', readError);
      return res.status(500).send('<h1>サーバーエラー</h1>');
    }
  }
});

// Initialize DB and start server
async function startServer() {
  try {
    await dbService.createTables(); // Ensure tables are created before starting
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT} with ${dbService.dbType} database.`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  if (dbService.dbType === 'sqlite') {
    dbService.closeSQLite(); // Close SQLite connection
  } else if (dbService.dbType === 'postgres' && dbService.db) {
    // For PostgreSQL, pool.end() will close all connections in the pool
    dbService.db.end().then(() => console.log('PostgreSQL pool has ended'));
  }
  process.exit(0);
});

// カード作成ページ表示
app.get('/create', async (req, res) => {
  // TODO: LINE WORKS WOFFの正式なユーザーID取得方法については、
  //別途公式ドキュメント (https://developers.worksmobile.com/) を参照し、必要に応じて修正してください。
  //現在は 'x-user-id' ヘッダーまたは 'userId' クエリパラメータから仮取得しています。
  let currentUserId = req.header('x-user-id') || req.query.userId;

  if (!currentUserId) {
    // ユーザーIDがない場合はエラーページやログインページにリダイレクトするなどの処理
    return res.status(400).send('<h1>エラー</h1><p>カード作成にはユーザーIDが必要です。</p><a href="/">戻る</a>');
  }

  try {
    const allUsers = await getAllUsers();
    const createPagePath = path.join(__dirname, 'views', 'create_card.html');

    fs.readFile(createPagePath, 'utf-8', (err, html) => {
      if (err) {
        console.error('Error reading create_card.html:', err);
        return res.status(500).send('<h1>エラー</h1><p>ページの読み込みに失敗しました。</p>');
      }

      const placeholder = /const serverData = \{\s*currentUserId: '', \/\/ 例: 'user1'\s*allUsers: \[\]    \/\/ 例: \['user1', 'user2', 'user3'\]\s*\};/;
      const replacement = `const serverData = {
            currentUserId: "${currentUserId.replace(/"/g, '\\"')}",
            allUsers: ${JSON.stringify(allUsers.filter(u => u !== currentUserId))}
        };`;
      const finalHtml = html.replace(placeholder, replacement);
      res.send(finalHtml);
    });
  } catch (error) {
    console.error('Error getting data for /create page:', error);
    res.status(500).send('<h1>サーバーエラー</h1><p>データの取得に失敗しました。</p>');
  }
});

// カード作成処理
app.post('/send_card', async (req, res) => {
  const { sender_id, receiver_id, design_id, message } = req.body;

  if (!sender_id || !receiver_id || !design_id) {
    return res.status(400).send('<h1>エラー</h1><p>必要な情報が不足しています。</p><a href="/create">作成画面に戻る</a>');
  }

  try {
    await createCard(sender_id, receiver_id, design_id, message || '');
    res.redirect(`/?userId=${sender_id}&message=CardSent`); // 送信者のIDでメインページにリダイレクト
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).send('<h1>サーバーエラー</h1><p>カードの作成に失敗しました。</p><a href="/create">作成画面に戻る</a>');
  }
});
