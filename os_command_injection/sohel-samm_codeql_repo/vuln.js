const express = require("express");
const app = express();
const fs = require("fs");
const { exec } = require("child_process");

// 1. Hardcoded secret (CWE-798)
const API_KEY = "12345-SECRET-KEY";

// 2. SQL Injection (CWE-89)
app.get("/user", (req, res) => {
  let username = req.query.username;
  let query = "SELECT * FROM users WHERE name = '" + username + "'"; // ❌ vulnerable
  res.send("Running query: " + query);
});

// 3. Command Injection (CWE-78)
app.get("/ping", (req, res) => {
  let host = req.query.host;
  exec("ping -c 1 " + host, (err, stdout, stderr) => { // ❌ vulnerable
    if (err) res.send(stderr);
    else res.send(stdout);
  });
});

// 4. Path Traversal (CWE-22)
app.get("/read", (req, res) => {
  let file = req.query.file;
  fs.readFile(file, "utf8", (err, data) => { // ❌ vulnerable
    if (err) res.send("Error reading file");
    else res.send(data);
  });
});

// 5. Cross-Site Scripting (XSS) (CWE-79)
app.get("/greet", (req, res) => {
  let name = req.query.name;
  res.send("<h1>Hello " + name + "</h1>"); // ❌ unsanitized output
});

// 6. Insecure Deserialization (CWE-502)
app.post("/deserialize", (req, res) => {
  let data = req.query.data;
  let obj = eval("(" + data + ")"); // ❌ using eval for deserialization
  res.send("Object: " + JSON.stringify(obj));
});

// 7. Open Redirect (CWE-601)
app.get("/redirect", (req, res) => {
  let url = req.query.url;
  res.redirect(url); // ❌ no validation
});

// 8. Information Disclosure (CWE-200)
app.get("/debug", (req, res) => {
  res.send(process.env); // ❌ leaks environment variables
});

app.listen(3000, () => {
  console.log("Vulnerable app running on http://localhost:3000");
});
