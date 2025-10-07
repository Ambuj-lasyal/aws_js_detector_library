// VULNERABLE CODE - DO NOT USE IN PRODUCTION

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());

// Vulnerability 1: SQL Injection
app.get('/users', (req, res) => {
  const userId = req.query.id;
  const query = `SELECT * FROM users WHERE id = ${userId}`;
  // Execute query directly without sanitization
  db.query(query, (err, result) => {
    if (err) throw err;
    res.json(result);
  });
});

// Vulnerability 2: Cross-Site Scripting (XSS)
app.get('/search', (req, res) => {
  const searchTerm = req.query.q;
  res.send(`<h1>Search Results</h1><p>You searched for: ${searchTerm}</p>`);
});

// Vulnerability 3: Path Traversal
app.get('/download', (req, res) => {
  const filename = req.query.file;
  const filePath = path.join(__dirname, 'files', filename);
  res.download(filePath);
});

// Vulnerability 4: Hardcoded credentials
const API_KEY = "sk-1234567890abcdef";
const DB_PASSWORD = "admin123";

// Vulnerability 5: Insecure random values
function generateToken() {
  return Math.random().toString(36).substring(2);
}

// Vulnerability 6: Command injection
app.post('/ping', (req, res) => {
  const host = req.body.host;
  const { exec } = require('child_process');
  exec(`ping -c 4 ${host}`, (error, stdout) => {
    res.send(stdout);
  });
});

// Vulnerability 7: No input validation
app.post('/user', (req, res) => {
  const user = req.body;
  // Directly save without validation
  users.push(user);
  res.status(201).send(user);
});

// Vulnerability 8: Sensitive data exposure
app.get('/config', (req, res) => {
  res.json({
    database: {
      host: "localhost",
      user: "root",
      password: DB_PASSWORD,
      database: "production_db"
    },
    apiKeys: {
      payment: API_KEY
    }
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});