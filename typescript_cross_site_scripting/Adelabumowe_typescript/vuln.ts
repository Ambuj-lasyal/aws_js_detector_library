import * as mysql from 'mysql';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as fs from 'fs';

const app = express();
app.use(bodyParser.json());

// Hardcoded sensitive information
const dbPassword = 'password123';
const secretKey = 'supersecretkey';

// Insecure database connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: dbPassword,
    database: 'test'
});

connection.connect();

// SQL Injection vulnerability
app.get('/user/:id', (req, res) => {
    const userId = req.params.id;
    const query = `SELECT * FROM users WHERE id = '${userId}'`;
    connection.query(query, (error, results) => {
        if (error) throw error;
        res.send(results);
    });
});

// XSS vulnerability
app.post('/comment', (req, res) => {
    const comment = req.body.comment;
    res.send(`<p>${comment}</p>`);
});

// Insecure deserialization
app.post('/deserialize', (req, res) => {
    const data = req.body.data;
    const obj = JSON.parse(data);
    res.send(obj);
});

// Using deprecated function
const unsafeEval = (code: string) => {
    eval(code);
};

// Command Injection vulnerability
app.get('/exec', (req, res) => {
    const command = req.query.command;
    require('child_process').exec(command, (error: any, stdout: any, stderr: any) => {
        if (error) {
            res.send(`Error: ${stderr}`);
        } else {
            res.send(`Output: ${stdout}`);
        }
    });
});

// Insecure use of fs.readFile
app.get('/readfile', (req, res) => {
    const filePath = req.query.path;
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.send(`Error: ${err.message}`);
        } else {
            res.send(data);
        }
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
