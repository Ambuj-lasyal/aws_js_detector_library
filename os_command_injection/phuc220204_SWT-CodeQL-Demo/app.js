// Vulnerable JavaScript Application for CodeQL Demo
// This file contains various security vulnerabilities for educational purposes

const express = require("express");
const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "test",
});

// ========================================
// 1. SQL INJECTION VULNERABILITIES
// ========================================

// SQL Injection - Direct string concatenation
app.get("/user/:id", (req, res) => {
  const userId = req.params.id;
  // VULNERABLE: Direct string concatenation
  const query = "SELECT * FROM users WHERE id = " + userId;

  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send("Database error");
      return;
    }
    res.json(results);
  });
});

// SQL Injection - Template literals
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  // VULNERABLE: Template literal without parameterization
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;

  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send("Database error");
      return;
    }
    if (results.length > 0) {
      res.json({ success: true, user: results[0] });
    } else {
      res.status(401).json({ success: false });
    }
  });
});

// SQL Injection - Dynamic query building
app.get("/search", (req, res) => {
  const { category, name, price } = req.query;
  let query = "SELECT * FROM products WHERE 1=1";

  // VULNERABLE: Building query dynamically without proper escaping
  if (category) {
    query += " AND category = '" + category + "'";
  }
  if (name) {
    query += " AND name LIKE '%" + name + "%'";
  }
  if (price) {
    query += " AND price <= " + price;
  }

  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send("Database error");
      return;
    }
    res.json(results);
  });
});

// ========================================
// 2. CROSS-SITE SCRIPTING (XSS) VULNERABILITIES
// ========================================

// Reflected XSS
app.get("/welcome", (req, res) => {
  const name = req.query.name;
  // VULNERABLE: Direct output without encoding
  res.send(`<h1>Welcome ${name}!</h1>`);
});

// Stored XSS simulation
let comments = [];
app.post("/comment", (req, res) => {
  const { comment, author } = req.body;
  // VULNERABLE: Storing user input without sanitization
  comments.push({ comment, author, timestamp: new Date() });
  res.json({ success: true });
});

app.get("/comments", (req, res) => {
  let html = "<h2>Comments:</h2>";
  comments.forEach((c) => {
    // VULNERABLE: Outputting stored data without encoding
    html += `<div><strong>${c.author}</strong>: ${c.comment}</div>`;
  });
  res.send(html);
});

// ========================================
// 3. PATH TRAVERSAL VULNERABILITIES
// ========================================

// Path Traversal - File serving
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  // VULNERABLE: No path validation
  const filePath = path.join(__dirname, "uploads", filename);

  res.download(filePath, (err) => {
    if (err) {
      res.status(404).send("File not found");
    }
  });
});

// Path Traversal - File reading
app.get("/view-file", (req, res) => {
  const filename = req.query.file;
  // VULNERABLE: Direct file access without validation
  const filePath = "./public/" + filename;

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      res.status(404).send("File not found");
      return;
    }
    res.send(`<pre>${data}</pre>`);
  });
});

// ========================================
// 4. COMMAND INJECTION VULNERABILITIES
// ========================================

// Command Injection - ping utility
app.get("/ping", (req, res) => {
  const host = req.query.host;
  // VULNERABLE: Direct command execution
  exec(`ping -c 4 ${host}`, (error, stdout, stderr) => {
    if (error) {
      res.status(500).send("Command failed");
      return;
    }
    res.send(`<pre>${stdout}</pre>`);
  });
});

// Command Injection - file operations
app.post("/backup", (req, res) => {
  const { filename, destination } = req.body;
  // VULNERABLE: Unsanitized input in command
  const command = `cp ${filename} ${destination}`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      res.status(500).send("Backup failed");
      return;
    }
    res.json({ success: true, message: "Backup completed" });
  });
});

// ========================================
// 5. INSECURE DIRECT OBJECT REFERENCES
// ========================================

// IDOR - User profile access
app.get("/profile/:userId", (req, res) => {
  const userId = req.params.userId;
  // VULNERABLE: No authorization check
  const query = "SELECT * FROM user_profiles WHERE id = ?";

  db.query(query, [userId], (err, results) => {
    if (err) {
      res.status(500).send("Database error");
      return;
    }
    res.json(results[0]);
  });
});

// ========================================
// 6. HARDCODED CREDENTIALS
// ========================================

// Hardcoded API keys and credentials
const API_KEY = "sk-1234567890abcdef";
const SECRET_TOKEN = "super_secret_token_123";
const DB_PASSWORD = "admin123";

function authenticateAdmin(token) {
  // VULNERABLE: Hardcoded admin token
  return token === "admin_secret_key_2023";
}

// ========================================
// 7. INSUFFICIENT INPUT VALIDATION
// ========================================

// Integer overflow potential
app.post("/calculate", (req, res) => {
  const { num1, num2, operation } = req.body;
  // VULNERABLE: No input validation
  let result;

  switch (operation) {
    case "add":
      result = num1 + num2;
      break;
    case "multiply":
      result = num1 * num2;
      break;
    default:
      result = "Invalid operation";
  }

  res.json({ result });
});

// ========================================
// 8. REGEX INJECTION (ReDoS)
// ========================================

app.post("/validate-email", (req, res) => {
  const { email, pattern } = req.body;
  // VULNERABLE: User-controlled regex pattern
  const regex = new RegExp(pattern);
  const isValid = regex.test(email);

  res.json({ email, valid: isValid });
});

// ========================================
// 9. PROTOTYPE POLLUTION
// ========================================

function merge(target, source) {
  for (let key in source) {
    // VULNERABLE: No prototype pollution protection
    if (typeof target[key] === "object" && typeof source[key] === "object") {
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

app.post("/merge-config", (req, res) => {
  const config = {};
  // VULNERABLE: Merging user input without protection
  merge(config, req.body);
  res.json({ success: true, config });
});

// ========================================
// 10. DENIAL OF SERVICE (DoS)
// ========================================

// CPU-intensive operation without limits
app.post("/generate-hash", (req, res) => {
  const { input, iterations } = req.body;
  // VULNERABLE: No limit on iterations
  let hash = input;

  for (let i = 0; i < iterations; i++) {
    hash = require("crypto").createHash("sha256").update(hash).digest("hex");
  }

  res.json({ hash });
});

// Server setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Vulnerable app running on port ${PORT}`);
  console.log(
    "WARNING: This application contains intentional security vulnerabilities!"
  );
  console.log("Do not deploy to production!");
});
