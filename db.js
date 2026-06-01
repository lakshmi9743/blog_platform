const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SQLITE_DB_PATH = path.join(DATA_DIR, 'blog.db');
const JSON_DB_PATH = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance = null;
let useJsonFallback = false;

// Custom JSON Database Engine (Robust pure-JS fallback)
class JsonDatabase {
  constructor() {
    this.filePath = JSON_DB_PATH;
    this.data = {
      users: [],
      posts: [],
      comments: []
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(fileContent);
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error loading JSON DB, initializing fresh:', err);
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error writing to JSON DB:', err);
    }
  }

  // Users Collection
  users = {
    create: async (username, email, passwordHash, avatarColor) => {
      const newUser = {
        id: String(Date.now() + Math.random().toString(36).substr(2, 5)),
        username,
        email,
        password_hash: passwordHash,
        avatar_color: avatarColor,
        created_at: new Date().toISOString()
      };
      this.data.users.push(newUser);
      this.save();
      return newUser;
    },
    findByUsername: async (username) => {
      return this.data.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
    },
    findByEmail: async (email) => {
      return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    },
    findById: async (id) => {
      return this.data.users.find(u => u.id === String(id)) || null;
    }
  };

  // Posts Collection
  posts = {
    create: async (title, content, coverImage, authorId, authorName, tags, readTime) => {
      const newPost = {
        id: String(Date.now() + Math.random().toString(36).substr(2, 5)),
        title,
        content,
        cover_image: coverImage || '',
        author_id: String(authorId),
        author_name: authorName,
        tags: Array.isArray(tags) ? tags.join(',') : tags || '',
        read_time: parseInt(readTime) || 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.data.posts.push(newPost);
      this.save();
      return newPost;
    },
    findAll: async (searchQuery = '', tagFilter = '') => {
      let results = [...this.data.posts];
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        results = results.filter(p => 
          p.title.toLowerCase().includes(query) || 
          p.content.toLowerCase().includes(query) || 
          p.author_name.toLowerCase().includes(query)
        );
      }
      
      if (tagFilter) {
        const tag = tagFilter.toLowerCase();
        results = results.filter(p => {
          const pTags = p.tags ? p.tags.toLowerCase().split(',') : [];
          return pTags.includes(tag);
        });
      }

      // Sort by newest first
      return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    findById: async (id) => {
      return this.data.posts.find(p => p.id === String(id)) || null;
    },
    update: async (id, title, content, coverImage, tags, readTime) => {
      const idx = this.data.posts.findIndex(p => p.id === String(id));
      if (idx === -1) return null;
      
      this.data.posts[idx] = {
        ...this.data.posts[idx],
        title,
        content,
        cover_image: coverImage || '',
        tags: Array.isArray(tags) ? tags.join(',') : tags || '',
        read_time: parseInt(readTime) || 5,
        updated_at: new Date().toISOString()
      };
      this.save();
      return this.data.posts[idx];
    },
    delete: async (id) => {
      const idx = this.data.posts.findIndex(p => p.id === String(id));
      if (idx === -1) return false;
      this.data.posts.splice(idx, 1);
      // Cascade delete comments
      this.data.comments = this.data.comments.filter(c => c.post_id !== String(id));
      this.save();
      return true;
    }
  };

  // Comments Collection
  comments = {
    create: async (postId, authorId, authorName, content) => {
      const newComment = {
        id: String(Date.now() + Math.random().toString(36).substr(2, 5)),
        post_id: String(postId),
        author_id: String(authorId),
        author_name: authorName,
        content,
        created_at: new Date().toISOString()
      };
      this.data.comments.push(newComment);
      this.save();
      return newComment;
    },
    findByPostId: async (postId) => {
      const results = this.data.comments.filter(c => c.post_id === String(postId));
      // Sort oldest first
      return results.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    },
    findById: async (id) => {
      return this.data.comments.find(c => c.id === String(id)) || null;
    },
    delete: async (id) => {
      const idx = this.data.comments.findIndex(c => c.id === String(id));
      if (idx === -1) return false;
      this.data.comments.splice(idx, 1);
      this.save();
      return true;
    }
  };
}

// SQLite Database Engine
class SQLiteDatabase {
  constructor(sqlite3Lib) {
    this.sqlite3 = sqlite3Lib;
    this.db = new sqlite3Lib.Database(SQLITE_DB_PATH);
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Create Users Table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            avatar_color TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create Posts Table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            cover_image TEXT,
            author_id INTEGER NOT NULL,
            author_name TEXT NOT NULL,
            tags TEXT,
            read_time INTEGER DEFAULT 5,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(author_id) REFERENCES users(id)
          )
        `);

        // Create Comments Table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            author_id INTEGER NOT NULL,
            author_name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY(author_id) REFERENCES users(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  // Promise wrappers for basic sqlite operations
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // Users Collection
  users = {
    create: async (username, email, passwordHash, avatarColor) => {
      const result = await this.run(
        `INSERT INTO users (username, email, password_hash, avatar_color) VALUES (?, ?, ?, ?)`,
        [username, email, passwordHash, avatarColor]
      );
      return {
        id: result.lastID,
        username,
        email,
        password_hash: passwordHash,
        avatar_color: avatarColor
      };
    },
    findByUsername: async (username) => {
      return this.get(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`, [username]);
    },
    findByEmail: async (email) => {
      return this.get(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email]);
    },
    findById: async (id) => {
      return this.get(`SELECT * FROM users WHERE id = ?`, [id]);
    }
  };

  // Posts Collection
  posts = {
    create: async (title, content, coverImage, authorId, authorName, tags, readTime) => {
      const tagsStr = Array.isArray(tags) ? tags.join(',') : tags || '';
      const result = await this.run(
        `INSERT INTO posts (title, content, cover_image, author_id, author_name, tags, read_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, content, coverImage, authorId, authorName, tagsStr, parseInt(readTime) || 5]
      );
      return {
        id: result.lastID,
        title,
        content,
        cover_image: coverImage,
        author_id: authorId,
        author_name: authorName,
        tags: tagsStr,
        read_time: parseInt(readTime) || 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    },
    findAll: async (searchQuery = '', tagFilter = '') => {
      let sql = `SELECT * FROM posts`;
      const params = [];
      const conditions = [];

      if (searchQuery) {
        conditions.push(`(title LIKE ? OR content LIKE ? OR author_name LIKE ?)`);
        const searchPattern = `%${searchQuery}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (tagFilter) {
        conditions.push(`tags LIKE ?`);
        params.push(`%${tagFilter}%`);
      }

      if (conditions.length > 0) {
        sql += ` WHERE ` + conditions.join(' AND ');
      }

      sql += ` ORDER BY created_at DESC`;
      return this.all(sql, params);
    },
    findById: async (id) => {
      return this.get(`SELECT * FROM posts WHERE id = ?`, [id]);
    },
    update: async (id, title, content, coverImage, tags, readTime) => {
      const tagsStr = Array.isArray(tags) ? tags.join(',') : tags || '';
      await this.run(
        `UPDATE posts SET title = ?, content = ?, cover_image = ?, tags = ?, read_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [title, content, coverImage, tagsStr, parseInt(readTime) || 5, id]
      );
      return this.get(`SELECT * FROM posts WHERE id = ?`, [id]);
    },
    delete: async (id) => {
      // First delete comments associated with this post
      await this.run(`DELETE FROM comments WHERE post_id = ?`, [id]);
      const result = await this.run(`DELETE FROM posts WHERE id = ?`, [id]);
      return result.changes > 0;
    }
  };

  // Comments Collection
  comments = {
    create: async (postId, authorId, authorName, content) => {
      const result = await this.run(
        `INSERT INTO comments (post_id, author_id, author_name, content) VALUES (?, ?, ?, ?)`,
        [postId, authorId, authorName, content]
      );
      return {
        id: result.lastID,
        post_id: postId,
        author_id: authorId,
        author_name: authorName,
        content,
        created_at: new Date().toISOString()
      };
    },
    findByPostId: async (postId) => {
      return this.all(`SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC`, [postId]);
    },
    findById: async (id) => {
      return this.get(`SELECT * FROM comments WHERE id = ?`, [id]);
    },
    delete: async (id) => {
      const result = await this.run(`DELETE FROM comments WHERE id = ?`, [id]);
      return result.changes > 0;
    }
  };
}

// Factory to resolve database instance
try {
  const sqlite3 = require('sqlite3');
  const sqliteInstance = new SQLiteDatabase(sqlite3);
  
  // Test connection and initialize tables async
  sqliteInstance.init()
    .then(() => {
      console.log('Successfully connected to SQLite database: ' + SQLITE_DB_PATH);
      dbInstance = sqliteInstance;
    })
    .catch((err) => {
      console.error('Failed to initialize SQLite schemas, falling back to JSON storage:', err);
      useJsonFallback = true;
      dbInstance = new JsonDatabase();
    });
} catch (err) {
  console.warn('SQLite3 module not installed or failed to load. Falling back to JSON database storage.');
  useJsonFallback = true;
  dbInstance = new JsonDatabase();
}

// Export database operations, using dynamic proxy to database instance once ready
module.exports = {
  get isReady() {
    return dbInstance !== null;
  },
  get isJson() {
    return useJsonFallback;
  },
  users: {
    create: (...args) => dbInstance.users.create(...args),
    findByUsername: (...args) => dbInstance.users.findByUsername(...args),
    findByEmail: (...args) => dbInstance.users.findByEmail(...args),
    findById: (...args) => dbInstance.users.findById(...args)
  },
  posts: {
    create: (...args) => dbInstance.posts.create(...args),
    findAll: (...args) => dbInstance.posts.findAll(...args),
    findById: (...args) => dbInstance.posts.findById(...args),
    update: (...args) => dbInstance.posts.update(...args),
    delete: (...args) => dbInstance.posts.delete(...args)
  },
  comments: {
    create: (...args) => dbInstance.comments.create(...args),
    findByPostId: (...args) => dbInstance.comments.findByPostId(...args),
    findById: (...args) => dbInstance.comments.findById(...args),
    delete: (...args) => dbInstance.comments.delete(...args)
  }
};
