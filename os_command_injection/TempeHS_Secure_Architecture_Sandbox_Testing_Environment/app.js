/**
 * UNSECURE NODE.JS APPLICATION - FOR EDUCATIONAL PURPOSES ONLY
 * 
 * This application contains intentional security vulnerabilities
 * for cybersecurity education and testing purposes.
 * 
 * DO NOT USE IN PRODUCTION!
 * 
 * Common vulnerabilities included:
 * - SQL Injection
 * - Cross-Site Scripting (XSS)
 * - Command Injection
 * - Path Traversal
 * - Insecure Direct Object References
 * - Missing Authentication/Authorization
 * - Weak Session Management
 * - Information Disclosure
 * - Insecure File Upload
 * - Server-Side Request Forgery (SSRF)
 */

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const ejs = require('ejs');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// VULNERABILITY: Weak session configuration
app.use(session({
    secret: 'weak-secret-key', // VULNERABILITY: Weak secret
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // VULNERABILITY: Should be true in production
        httpOnly: false, // VULNERABILITY: Should be true
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Initialize SQLite database
const db = new sqlite3.Database('./vulnerable_app.db');

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'user',
        api_key TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        owner TEXT NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default users with weak passwords
    const adminHash = bcrypt.hashSync('admin123', 10);
    const userHash = bcrypt.hashSync('user123', 10);

    db.run(`INSERT OR IGNORE INTO users (username, password, email, role, api_key) 
            VALUES (?, ?, ?, ?, ?)`,
        ['admin', adminHash, 'admin@vulnerable-app.com', 'admin', 'admin_api_key_12345']);

    db.run(`INSERT OR IGNORE INTO users (username, password, email, role, api_key) 
            VALUES (?, ?, ?, ?, ?)`,
        ['user', userHash, 'user@vulnerable-app.com', 'user', 'user_api_key_67890']);

    // Insert sample posts
    db.run(`INSERT OR IGNORE INTO posts (title, content, author) 
            VALUES (?, ?, ?)`,
        ['Welcome Post', 'Welcome to our vulnerable Node.js application!', 'admin']);

    db.run(`INSERT OR IGNORE INTO posts (title, content, author) 
            VALUES (?, ?, ?)`,
        ['XSS Demo', '<script>alert("This is stored XSS!")</script>', 'user']);
});

// Home page
app.get('/', (req, res) => {
    res.render('index', {
        user: req.session.user,
        title: '🚨 Vulnerable Node.js Demo'
    });
});

// VULNERABILITY: SQL Injection in login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // VULNERABILITY: String concatenation allows SQL injection
    const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;

    console.log('Executing query:', query); // VULNERABILITY: Information disclosure

    db.get(query, (err, user) => {
        if (err) {
            // VULNERABILITY: Detailed error messages
            return res.json({ error: `Database error: ${err.message}` });
        }

        if (user) {
            req.session.user = user;
            res.json({ success: true, message: 'Login successful', redirect: '/dashboard' });
        } else {
            res.json({ error: 'Invalid credentials' });
        }
    });
});

// VULNERABILITY: SQL Injection in search
app.get('/search', (req, res) => {
    const { q } = req.query;

    if (!q) {
        return res.json({ error: 'No search query provided' });
    }

    // VULNERABILITY: Direct string formatting allows SQL injection
    const sql = `SELECT username, email FROM users WHERE username LIKE '%${q}%'`;

    db.all(sql, (err, results) => {
        if (err) {
            return res.json({ error: err.message });
        }

        res.json({
            query: sql, // VULNERABILITY: Exposing SQL query
            results: results
        });
    });
});

// Dashboard (requires login)
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    db.all('SELECT * FROM posts ORDER BY created_at DESC', (err, posts) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        res.render('dashboard', {
            user: req.session.user,
            posts: posts,
            title: 'Dashboard'
        });
    });
});

// VULNERABILITY: XSS in post creation
app.post('/posts', (req, res) => {
    const { title, content } = req.body;
    const author = req.session.user ? req.session.user.username : 'anonymous';

    db.run('INSERT INTO posts (title, content, author) VALUES (?, ?, ?)',
        [title, content, author], (err) => {
            if (err) {
                return res.json({ error: err.message });
            }
            res.json({ success: true });
        });
});

// VULNERABILITY: Command Injection
app.post('/ping', (req, res) => {
    const { host } = req.body;

    // VULNERABILITY: Direct command execution without sanitization
    exec(`ping -c 3 ${host}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ error: error.message, stderr: stderr });
        }

        res.json({
            output: stdout,
            command: `ping -c 3 ${host}` // VULNERABILITY: Exposing executed command
        });
    });
});

// VULNERABILITY: Path Traversal
app.get('/files/:filename', (req, res) => {
    const { filename } = req.params;

    // VULNERABILITY: No path validation - allows directory traversal
    const filePath = path.join(__dirname, 'uploads', filename);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).json({ error: `File not found: ${err.message}` });
        }

        res.json({
            filename: filename,
            content: data,
            path: filePath // VULNERABILITY: Exposing file paths
        });
    });
});

// VULNERABILITY: Insecure file upload
app.post('/upload', (req, res) => {
    const { filename, content } = req.body;

    if (!filename || !content) {
        return res.json({ error: 'Filename and content required' });
    }

    // VULNERABILITY: No file type validation
    const uploadPath = path.join(__dirname, 'uploads', filename);

    fs.writeFile(uploadPath, content, (err) => {
        if (err) {
            return res.json({ error: err.message });
        }

        const owner = req.session.user ? req.session.user.username : 'anonymous';

        db.run('INSERT INTO files (filename, filepath, owner) VALUES (?, ?, ?)',
            [filename, uploadPath, owner], (err) => {
                if (err) {
                    return res.json({ error: err.message });
                }

                res.json({
                    success: true,
                    message: 'File uploaded successfully',
                    path: uploadPath // VULNERABILITY: Exposing file paths
                });
            });
    });
});

// VULNERABILITY: Server-Side Request Forgery (SSRF)
app.post('/fetch-url', (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.json({ error: 'URL required' });
    }

    // VULNERABILITY: No URL validation - allows SSRF
    const client = url.startsWith('https://') ? https : http;

    client.get(url, (response) => {
        let data = '';

        response.on('data', (chunk) => {
            data += chunk;
        });

        response.on('end', () => {
            res.json({
                url: url,
                status: response.statusCode,
                headers: response.headers, // VULNERABILITY: Exposing response headers
                content: data.substring(0, 1000) // Limit response size
            });
        });
    }).on('error', (err) => {
        res.json({ error: err.message });
    });
});

// VULNERABILITY: Missing authorization - admin panel accessible to anyone
app.get('/admin', (req, res) => {
    // Should check for admin role, but doesn't!
    db.all('SELECT id, username, email, role FROM users', (err, users) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        res.render('admin', {
            users: users,
            user: req.session.user,
            title: 'Admin Panel'
        });
    });
});

// VULNERABILITY: Information disclosure via API
app.get('/api/users', (req, res) => {
    db.all('SELECT id, username, email, role, api_key FROM users', (err, users) => {
        if (err) {
            return res.json({ error: err.message });
        }

        // VULNERABILITY: Exposing sensitive data including API keys
        res.json(users);
    });
});

// VULNERABILITY: Insecure Direct Object Reference
app.get('/user/:id', (req, res) => {
    const { id } = req.params;

    // VULNERABILITY: No authorization check - anyone can view any user
    db.get('SELECT username, email, role FROM users WHERE id = ?', [id], (err, user) => {
        if (err) {
            return res.json({ error: err.message });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    });
});

// VULNERABILITY: Debug endpoint exposing sensitive information
app.get('/debug', (req, res) => {
    res.json({
        environment: process.env,
        session: req.session,
        headers: req.headers,
        cookies: req.cookies,
        database_path: './vulnerable_app.db'
    });
});

// Logout
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Create sample file for path traversal testing
fs.writeFileSync('./uploads/sample.txt', 'This is a sample file for path traversal testing.');

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚨 VULNERABLE Node.js app starting...');
    console.log('⚠️  WARNING: This app contains intentional security vulnerabilities!');
    console.log('📚 For educational purposes only - DO NOT USE IN PRODUCTION!');
    console.log(`🌐 Server running on http://0.0.0.0:${PORT}`);
    console.log('');
    console.log('📋 Test Credentials:');
    console.log('   Admin: admin / admin123');
    console.log('   User:  user / user123');
    console.log('');
    console.log('🎯 Vulnerability Examples:');
    console.log('   SQL Injection: admin\' OR \'1\'=\'1\' --');
    console.log('   Command Injection: 127.0.0.1; ls -la');
    console.log('   Path Traversal: ../../../etc/passwd');
    console.log('   XSS: <script>alert(\'XSS\')</script>');
});

module.exports = app;