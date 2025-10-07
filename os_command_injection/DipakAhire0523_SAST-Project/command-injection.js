// Command Injection Vulnerabilities
const { exec, spawn } = require('child_process');
const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());

// VULNERABLE: Command Injection via exec
app.post('/ping', (req, res) => {
  const host = req.body.host;
  
  // BAD: User input directly in shell command
  exec(`ping -c 4 ${host}`, (error, stdout, stderr) => {
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ output: stdout });
  });
});

// VULNERABLE: File path injection
app.get('/file/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // BAD: User input directly in file path
  const filePath = `./uploads/${filename}`;
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.json({ content: data });
  });
});

// VULNERABLE: Directory traversal
app.get('/download', (req, res) => {
  const file = req.query.file;
  
  // BAD: No path validation allows directory traversal
  const fullPath = `./public/${file}`;
  
  res.download(fullPath);
});

// VULNERABLE: Code injection via eval
app.post('/calculate', (req, res) => {
  const expression = req.body.expression;
  
  try {
    // BAD: Using eval with user input
    const result = eval(expression);
    res.json({ result });
  } catch (error) {
    res.status(400).json({ error: 'Invalid expression' });
  }
});

// VULNERABLE: Template injection
app.post('/template', (req, res) => {
  const template = req.body.template;
  const data = req.body.data;
  
  // BAD: Dynamic code execution
  const compiledTemplate = new Function('data', `return \`${template}\``);
  
  try {
    const result = compiledTemplate(data);
    res.json({ rendered: result });
  } catch (error) {
    res.status(400).json({ error: 'Template error' });
  }
});

module.exports = app;