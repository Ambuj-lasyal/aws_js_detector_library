const express = require('express');
const mysql = require('mysql');
const fs = require('fs');
const xml2js = require('xml2js');
const app = express();
const { exec } = require('child_process');

app.use(express.urlencoded({ extended: true }));

// ---------------------------
// Real Vulnerable Endpoints
// ---------------------------

app.get('/sql_injection', (req, res) => {
    let userInput = req.query.username;
    let connection = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "rootPassword@123",
        database: "test"
    });

    let query = "SELECT * FROM users WHERE username = '" + userInput + "'";
    connection.query(query, (error, results) => {
        if (error) throw error;
        res.send(results);
    });
});

app.get('/secure_sql_query', (req, res) => {
    let userInput = req.query.username;
    let connection = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "rootPassword@123",
        database: "test"
    });

    let query = "SELECT * FROM users WHERE username = ?";
    connection.query(query, [userInput], (error, results) => {
        if (error) throw error;
        res.send(results);
    });
});

app.get('/broken_auth', (req, res) => {
    let username = req.query.username;
    let password = req.query.password;

    if (username === "adminuser" && password === "xchzdhkrltu") {
        res.send("Authenticated as admin");
    } else {
        res.send("Authentication failed");
    }
});

app.get('/store_sensitive_data', (req, res) => {
    fs.writeFileSync("passwords.txt", "admin:Passwo#d@&1957");
    res.send("Password stored in plaintext");
});

app.get('/parse_xml', (req, res) => {
    let xmlData = req.query.xml;
    xml2js.parseString(xmlData, { explicitArray: false }, (err, result) => {
        if (err) {
            res.send("Error parsing XML");
        } else {
            res.send(result);
        }
    });
});

app.get('/access_control', (req, res) => {
    let role = req.query.role;
    if (role === "admin") {
        res.send("Welcome Admin!");
    } else {
        res.send("Access Denied!");
    }
});

app.get('/security_misconfig', (req, res) => {
    res.setHeader("X-Powered-By", "Express");
    res.send("Security Misconfiguration Example");
});

app.get('/xss_vulnerability', (req, res) => {
    let userInput = req.query.input;
    res.send("<html><body>" + userInput + "</body></html>");
});

app.post('/insecure_deserialization', express.json(), (req, res) => {
    let obj = JSON.parse(req.body.data);
    res.send("Deserialized object: " + JSON.stringify(obj));
});

// ---------------------------
// Dead Code Vulnerabilities
// ---------------------------

// Dead SQL Injection
function deadSqlInjection() {
    let input = "' OR '1'='1";
    let connection = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "rootPassword@123",
        database: "test"
    });

    let query = "SELECT * FROM users WHERE username = '" + input + "'";
    connection.query(query, (error, results) => {
        if (error) throw error;
        console.log(results);
    });
}

// Dead Command Injection
function deadCommandInjection() {
    let userInput = "test; rm -rf /";
    exec("echo " + userInput, (error, stdout, stderr) => {
        console.log(stdout);
    });
}

// Dead Hardcoded Credentials
function deadCredentials() {
    const user = "admin";
    const pass = "deadSecretPassword!";
    if (user === "admin" && pass === "deadSecretPassword!") {
        return true;
    }
    return false;
}

// Dead XXE via xml2js (not secure by default)
function deadXXE() {
    const xmlData = `<?xml version="1.0"?>
    <!DOCTYPE foo [
    <!ELEMENT foo ANY >
    <!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
    <foo>&xxe;</foo>`;
    
    xml2js.parseString(xmlData, { explicitArray: false }, (err, result) => {
        console.log(result);
    });
}

// Dead Path Traversal
function deadPathTraversal() {
    let filename = "../../etc/passwd";
    fs.readFile(filename, 'utf8', (err, data) => {
        if (err) throw err;
        console.log(data);
    });
}

// Dead Insecure Deserialization (unsafe eval)
function deadInsecureEval() {
    let payload = "({admin: true})";
    let obj = eval(payload);  // vulnerable
    console.log(obj);
}

// ---------------------------
// Dummy secrets
// ---------------------------

const UNUSED_SECRET = "superSecretKey_12345";
const UNUSED_API_KEY = "AIzaDeadCodeAPIKEYEXAMPLE123456";

app.listen(3000, () => {
    console.log('Vulnerable Node.js app listening on port 3000');
});
