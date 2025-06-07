const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

let db;
let dbType;

const dbPath = path.resolve(__dirname, 'database.sqlite');

if (process.env.DATABASE_URL) {
  dbType = 'postgres';
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    // SSL設定は環境に応じて追加 (例: Heroku)
    // ssl: { rejectUnauthorized: false }
  });
  console.log('Connected to PostgreSQL database.');
  // PostgreSQL Poolは接続テストを自動では行わないため、必要ならクエリを発行
  db.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('PostgreSQL connection test query failed:', err);
    } else {
      console.log('PostgreSQL connection test query successful, current time:', res.rows[0].now);
    }
  });
} else {
  dbType = 'sqlite';
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('SQLite connection error:', err.message);
    } else {
      console.log('Connected to the SQLite database.');
    }
  });
}

async function createTables() {
  console.log(`Creating tables for ${dbType}...`);
  if (dbType === 'postgres') {
    // PostgreSQLは一つのquery内で複数ステートメントを直接実行できない場合がある(ドライバや設定による)
    // 安全のため、個別のクエリとして実行
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        registered_at TIMESTAMPTZ DEFAULT NOW()
      );`;
    const createCardsTableQuery = `
      CREATE TABLE IF NOT EXISTS cards (
        id SERIAL PRIMARY KEY,
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        design_id TEXT NOT NULL,
        message TEXT,
        sent_at TIMESTAMPTZ DEFAULT NOW()
      );`;
    // sqlite_sequenceテーブルはPostgreSQLでは不要（SERIALが内部シーケンスを使用）

    const client = await db.connect();
    try {
      await client.query(createUsersTableQuery);
      console.log("Users table checked/created for PostgreSQL.");
      await client.query(createCardsTableQuery);
      console.log("Cards table checked/created for PostgreSQL.");
    } catch (err) {
        console.error("Error creating tables for PostgreSQL:", err.message, err.stack);
        throw err; // Rethrow to indicate failure
    } finally {
      client.release();
    }
  } else { // sqlite
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          registered_at TEXT
        )`, (err) => {
          if (err) {
            console.error("Error creating users table (SQLite):", err.message);
            return reject(err);
          }
          console.log("Users table checked/created for SQLite.");
        });
        db.run(`CREATE TABLE IF NOT EXISTS cards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_id TEXT NOT NULL,
          receiver_id TEXT NOT NULL,
          design_id TEXT NOT NULL,
          message TEXT,
          sent_at TEXT NOT NULL,
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
        )`, (err) => {
          if (err) {
            console.error("Error creating cards table (SQLite):", err.message);
            return reject(err);
          }
          console.log("Cards table checked/created for SQLite.");
          resolve();
        });
      });
    });
  }
}

async function getUserById(userId) {
  if (dbType === 'postgres') {
    const res = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    return res.rows[0] || null;
  } else {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }
}

async function createUser(userId) {
  const registeredAt = new Date().toISOString();
  if (dbType === 'postgres') {
    // registered_at は DEFAULT NOW() を使うので、明示的に挿入しない場合はカラムリストから外す
    // もし明示的に指定したい場合は、NOW() ではなく $2 を使う
    await db.query('INSERT INTO users (id, registered_at) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [userId, registeredAt]);
  } else {
    return new Promise((resolve, reject) => {
      db.run('INSERT OR IGNORE INTO users (id, registered_at) VALUES (?, ?)', [userId, registeredAt], function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}

async function getCardsByReceiverId(receiverId) {
  if (dbType === 'postgres') {
    const res = await db.query('SELECT sender_id, design_id, message, sent_at FROM cards WHERE receiver_id = $1 ORDER BY sent_at DESC', [receiverId]);
    return res.rows;
  } else {
    return new Promise((resolve, reject) => {
      db.all('SELECT sender_id, design_id, message, sent_at FROM cards WHERE receiver_id = ? ORDER BY sent_at DESC', [receiverId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
}

async function createCard(senderId, receiverId, designId, message) {
  const sentAt = new Date().toISOString(); // JSのISOStringはPostgreSQLのTIMESTAMPTZと互換性あり
  if (dbType === 'postgres') {
    // sent_at は DEFAULT NOW() を使うので、明示的に挿入しない場合はカラムリストから外す
    // もし明示的に指定したい場合は、$5 を使う
    await db.query(
      'INSERT INTO cards (sender_id, receiver_id, design_id, message, sent_at) VALUES ($1, $2, $3, $4, $5)',
      [senderId, receiverId, designId, message, sentAt]
    );
  } else {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO cards (sender_id, receiver_id, design_id, message, sent_at) VALUES (?, ?, ?, ?, ?)',
        [senderId, receiverId, designId, message, sentAt],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }
}

async function getAllUsers() {
  if (dbType === 'postgres') {
    const res = await db.query('SELECT id FROM users');
    return res.rows.map(row => row.id);
  } else {
    return new Promise((resolve, reject) => {
      db.all('SELECT id FROM users', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => row.id));
      });
    });
  }
}

// Graceful shutdown for SQLite
function closeSQLite() {
  if (dbType === 'sqlite' && db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing SQLite database', err.message);
      } else {
        console.log('SQLite database connection closed.');
      }
    });
  }
}
// For PostgreSQL, the pool will manage connections. client.release() is used per query.
// Pool can be ended by db.end() if needed on app shutdown.

module.exports = {
  db, // Exposing db might be useful for specific cases or testing.
  dbType,
  createTables,
  getUserById,
  createUser,
  getCardsByReceiverId,
  createCard,
  getAllUsers,
  closeSQLite // Export for graceful shutdown in index.js
};
