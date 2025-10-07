/**
 * ⚠️  TESTING PURPOSES ONLY - FAKE VULNERABLE NODEJS API ⚠️
 * 🚫 FOR SECURITY SCANNER TESTING - NOT REAL PRODUCTION CODE 🚫
 * 🔍 CONTAINS INTENTIONALLY VULNERABLE CODE FOR DEMO/TESTING
 * 🛡️  ALL SECRETS AND APIS ARE FAKE/DUMMY VALUES FOR TESTING
 * 📝 GITHUB SCANNERS: THIS IS TEST DATA - NOT REAL CREDENTIALS
 * 🧪 USED FOR CODEFORGE SECURITY SCANNER DEMONSTRATION
 * Multi-Language Web Application - Node.js API
 * JavaScript/TypeScript Backend with Security Vulnerabilities for Testing
 */

const express = require('express');
const mysql = require('mysql2');
const crypto = require('crypto');
const fs = require('fs');
const { exec } = require('child_process');
const app = express();

// SECURITY ISSUE: Hardcoded credentials
const DATABASE_URL = "mysql://admin:password123@localhost:3306/webapp";
const API_SECRET_KEY = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
const GITHUB_TOKEN = "ghp_1234567890abcdefghijklmnopqrstuvwxyz123";
const SLACK_WEBHOOK = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX";
const TWILIO_AUTH_TOKEN = "1234567890abcdef1234567890abcdef";

// SECURITY ISSUE: Insecure configuration
app.use(express.json({ limit: '50mb' })); // No size limit validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Disable SSL verification

// SECURITY ISSUE: SQL Injection vulnerability
function getUserById(userId) {
    const connection = mysql.createConnection(DATABASE_URL);
    // SECURITY ISSUE: String concatenation in SQL
    const query = `SELECT * FROM users WHERE id = ${userId}`;
    return new Promise((resolve, reject) => {
        connection.query(query, (error, results) => {
            if (error) reject(error);
            else resolve(results[0]);
        });
    });
}

// SECURITY ISSUE: NoSQL Injection (MongoDB simulation)
app.post('/api/users/search', (req, res) => {
    const { username, role } = req.body;
    // SECURITY ISSUE: Direct object injection
    const query = { username: username, role: role };
    console.log('MongoDB Query:', JSON.stringify(query));
    res.json({ message: 'User search completed', query });
});

// SECURITY ISSUE: Command injection
app.post('/api/system/backup', (req, res) => {
    const { filename } = req.body;
    // SECURITY ISSUE: Unsanitized user input in command
    exec(`tar -czf backups/${filename}.tar.gz ./data`, (error, stdout, stderr) => {
        if (error) {
            console.error('Backup error:', error);
            return res.status(500).json({ error: error.message });
        }
        res.json({ message: 'Backup created', output: stdout });
    });
});

// SECURITY ISSUE: Path traversal
app.get('/api/files/:filename', (req, res) => {
    const { filename } = req.params;
    // SECURITY ISSUE: No path validation
    const filePath = `./uploads/${filename}`;
    
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).json({ error: 'File not found' });
        }
        res.json({ content: data });
    });
});

// SECURITY ISSUE: Weak cryptography
function encryptPassword(password) {
    // SECURITY ISSUE: Using MD5 for password hashing
    return crypto.createHash('md5').update(password).digest('hex');
}

// SECURITY ISSUE: Insecure random token generation
function generateApiToken() {
    // SECURITY ISSUE: Predictable random generation
    return Math.random().toString(36).substring(2, 15);
}

// SECURITY ISSUE: Information disclosure
app.get('/api/debug', (req, res) => {
    res.json({
        environment: process.env,
        secrets: {
            apiKey: API_SECRET_KEY,
            githubToken: GITHUB_TOKEN,
            slackWebhook: SLACK_WEBHOOK,
            twilioToken: TWILIO_AUTH_TOKEN
        },
        config: {
            nodeVersion: process.version,
            platform: process.platform,
            memory: process.memoryUsage()
        }
    });
});

// SECURITY ISSUE: LDAP Injection
app.post('/api/auth/ldap', (req, res) => {
    const { username, password } = req.body;
    // SECURITY ISSUE: Direct LDAP query construction
    const ldapQuery = `(&(uid=${username})(userPassword=${password}))`;
    console.log('LDAP Query:', ldapQuery);
    res.json({ message: 'LDAP authentication attempted', query: ldapQuery });
});

// SECURITY ISSUE: XXE vulnerability
app.post('/api/xml/parse', (req, res) => {
    const xml2js = require('xml2js');
    const { xmlData } = req.body;
    
    // SECURITY ISSUE: No XXE protection
    const parser = new xml2js.Parser({
        explicitArray: false,
        explicitRoot: false
    });
    
    parser.parseString(xmlData, (err, result) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json({ parsed: result });
    });
});

// SECURITY ISSUE: Prototype pollution
app.post('/api/config/update', (req, res) => {
    const config = {};
    const updates = req.body;
    
    // SECURITY ISSUE: Unsafe object merge
    for (const key in updates) {
        config[key] = updates[key];
    }
    
    res.json({ message: 'Configuration updated', config });
});

// SECURITY ISSUE: ReDoS (Regular Expression Denial of Service)
app.post('/api/validate/email', (req, res) => {
    const { email } = req.body;
    // SECURITY ISSUE: Vulnerable regex pattern
    const emailRegex = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    
    const isValid = emailRegex.test(email);
    res.json({ valid: isValid });
});

// SECURITY ISSUE: Insecure JWT implementation
const jwt = require('jsonwebtoken');
app.post('/api/auth/token', (req, res) => {
    const { userId } = req.body;
    // SECURITY ISSUE: Weak JWT secret
    const token = jwt.sign({ userId }, 'weak-secret', { expiresIn: '1y' });
    res.json({ token });
});

// SECURITY ISSUE: CSRF vulnerability (no protection)
app.post('/api/users/delete', (req, res) => {
    const { userId } = req.body;
    // SECURITY ISSUE: No CSRF protection
    console.log(`Deleting user: ${userId}`);
    res.json({ message: 'User deleted' });
});

// SECURITY ISSUE: Insecure direct object reference
app.get('/api/users/:id/profile', (req, res) => {
    const { id } = req.params;
    // SECURITY ISSUE: No authorization check
    const userProfile = {
        id,
        email: 'user@example.com',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111'
    };
    res.json(userProfile);
});

// SECURITY ISSUE: Logging sensitive data
function logUserActivity(userId, action, data) {
    console.log(`User ${userId} performed ${action}:`, JSON.stringify(data));
    console.log(`API Key used: ${API_SECRET_KEY}`);
    console.log(`GitHub Token: ${GITHUB_TOKEN}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database URL: ${DATABASE_URL}`);
    console.log(`API Secret: ${API_SECRET_KEY}`);
}); 