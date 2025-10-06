/*
     irc.js V1.0 - Sentiment Analysis, Paginated Logs, Per-User History, Date Filtering

     by nitestryker
*/

// Load required modules
const http = require('http');
const irc = require('irc');
const moment = require('moment');
const winston = require('winston');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const fs = require('fs');
const fastcsv = require('fast-csv');
const Sentiment = require('sentiment');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const sentiment = new Sentiment();

// Setup Winston Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'irc.log', maxsize: 5242880, maxFiles: 5 }) // 5MB log rotation
    ]
});

// Setup SQLite3 Database
const db = new sqlite3.Database('./irc_logs.db', (err) => {
    if (err) {
        logger.error("Database connection failed: " + err.message);
    } else {
        logger.info("Connected to SQLite database (irc_logs.db)");
    }
});

// Create `messages` table if it doesn't exist
db.run(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user TEXT,
        channel TEXT,
        message TEXT,
        timestamp TEXT,
        sentiment TEXT
    )
`, (err) => {
    if (err) {
        logger.error("Error creating messages table: " + err.message);
    } else {
        logger.info("Table 'messages' ready");
    }
});

// Active users tracking
let activeUsers = new Set();

// New IRC Client
const client = new irc.Client('irc.libera.chat', 'pyuuugyen', {
    userName: 'nodebot',
    realName: 'node.JS IRC Bot',
    port: 6667,
    debug: false,
    showErrors: true,
    autoRejoin: true,
    autoConnect: true,
    channels: ['#coolbeans', '##programming', '##rust'],
    secure: false,
    selfSigned: false,
    certExpired: false,
    floodProtection: true, 
    floodProtectionDelay: 1000, 
    sasl: false,
    stripColors: false,
    channelPrefixes: "&#",
    messageSplit: 512
});

// ✅ Fetch current users in the channel when the bot joins
client.addListener("names", function (channel, users) {
    Object.keys(users).forEach(user => activeUsers.add(user));
    logger.info(`📌 Active Users in ${channel}: ${Array.from(activeUsers).join(', ')}`);
    io.emit('updateUsers', Array.from(activeUsers));
});

// ✅ Track users joining the channel
client.addListener("join", function (channel, who) {
    activeUsers.add(who);
    logger.info(`${who} joined ${channel}`);
    io.emit('updateUsers', Array.from(activeUsers));
});

// ✅ Track users leaving the channel
client.addListener("part", function (channel, who) {
    activeUsers.delete(who);
    logger.info(`${who} left ${channel}`);
    io.emit('updateUsers', Array.from(activeUsers));
});

// ✅ Track users quitting IRC
client.addListener("quit", function (nick) {
    activeUsers.delete(nick);
    logger.info(`${nick} quit`);
    io.emit('updateUsers', Array.from(activeUsers));
});

// 🚀 **Store Messages with Sentiment Analysis**
client.addListener('message', function (from, to, text) {
    let timestamp = moment().format('YYYY-MM-DD HH:mm:ss');

    // Analyze sentiment
    let sentimentResult = sentiment.analyze(text);
    let sentimentScore = sentimentResult.score;
    let sentimentLabel = sentimentScore > 0 ? "Positive" : sentimentScore < 0 ? "Negative" : "Neutral";

    logger.info(`${timestamp} ${from} in ${to}: ${text} [Sentiment: ${sentimentLabel}]`);

    db.run(`INSERT INTO messages (user, channel, message, timestamp, sentiment) VALUES (?, ?, ?, ?, ?)`, 
        [from, to, text, timestamp, sentimentLabel]);

    io.emit('newMessage', { timestamp, user: from, channel: to, message: text, sentiment: sentimentLabel });
});

// 🚀 **EXPRESS WEB SERVER FOR DASHBOARD** 🚀
app.set('view engine', 'ejs');
app.use(express.static('public'));

// **Route: Display Chat Logs with Sentiment Stats, Pagination, Date Filtering, and Word Cloud**
app.get('/logs', (req, res) => {
    let page = parseInt(req.query.page) || 1;
    let limit = 10;
    let offset = (page - 1) * limit;
    
    let searchQuery = req.query.search ? `%${req.query.search}%` : null;
    let sentimentFilter = req.query.sentiment || null;
    let startDate = req.query.start ? req.query.start + " 00:00:00" : null;
    let endDate = req.query.end ? req.query.end + " 23:59:59" : null;

    let query = `SELECT * FROM messages`;
    let queryParams = [];

    if (searchQuery || sentimentFilter || (startDate && endDate)) {
        query += ` WHERE`;
        let conditions = [];

        if (searchQuery) {
            conditions.push(`message LIKE ?`);
            queryParams.push(searchQuery);
        }
        if (sentimentFilter) {
            conditions.push(`sentiment = ?`);
            queryParams.push(sentimentFilter);
        }
        if (startDate && endDate) {
            conditions.push(`timestamp BETWEEN ? AND ?`);
            queryParams.push(startDate, endDate);
        }

        query += ` ` + conditions.join(" AND ");
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    // Fetch chat logs
    db.all(query, queryParams, (err, logs) => {
        if (err) {
            logger.error("Error fetching logs: " + err.message);
            return res.status(500).send("Error fetching logs");
        }

        // Fetch total messages count
        db.get(`SELECT COUNT(*) as totalMessages FROM messages`, (err, total) => {
            if (err) {
                logger.error("Error fetching total messages: " + err.message);
                return res.status(500).send("Error fetching total messages");
            }

            // Fetch top 5 active users
            db.all(`SELECT user, COUNT(*) as count FROM messages GROUP BY user ORDER BY count DESC LIMIT 5`, (err, topUsers) => {
                if (err) {
                    logger.error("Error fetching top users: " + err.message);
                    return res.status(500).send("Error fetching top users");
                }

                // Fetch sentiment statistics
                db.all(`SELECT sentiment, COUNT(*) as count FROM messages GROUP BY sentiment`, (err, sentimentStats) => {
                    if (err) {
                        logger.error("Error fetching sentiment stats: " + err.message);
                        return res.status(500).send("Error fetching sentiment stats");
                    }

                    // Fetch most used words for the word cloud
                    db.all(`SELECT message FROM messages`, (err, allMessages) => {
                        if (err) {
                            logger.error("Error fetching messages for word cloud: " + err.message);
                            return res.status(500).send("Error fetching word cloud data");
                        }

                        let wordCounts = {};
                        allMessages.forEach(row => {
                            row.message.split(/\s+/).forEach(word => {
                                word = word.toLowerCase().replace(/[^\w]/g, ''); // Clean word
                                if (word.length > 3) { // Ignore short words
                                    wordCounts[word] = (wordCounts[word] || 0) + 1;
                                }
                            });
                        });

                        let wordCloudData = Object.keys(wordCounts).map(word => ({
                            text: word,
                            size: wordCounts[word] * 10 // Scale sizes
                        }));

                        // Fetch total message count for pagination
                        db.get(`SELECT COUNT(*) as totalCount FROM messages`, (err, totalCount) => {
                            if (err) {
                                logger.error("Error fetching total count: " + err.message);
                                return res.status(500).send("Error fetching total count");
                            }

                            res.render('logs', {
                                logs,
                                activeUsers: Array.from(activeUsers),
                                page,
                                searchQuery: req.query.search || "",
                                sentimentFilter,
                                totalMessages: total.totalMessages || 0,
                                totalPages: Math.ceil(totalCount.totalCount / limit),
                                topUsers: topUsers || [],
                                sentimentStats: sentimentStats || [],
                                startDate: req.query.start || "",
                                endDate: req.query.end || "",
                                wordCloudData: JSON.stringify(wordCloudData) // Fix JSON data for frontend
                            });
                        });
                    });
                });
            });
        });
    });
});



// **Route: Show Per-User Chat History**
app.get('/user/:username', (req, res) => {
    let username = req.params.username;

    db.all(`SELECT * FROM messages WHERE user = ? ORDER BY id DESC`, [username], (err, logs) => {
        if (err) {
            logger.error("Error fetching user logs: " + err.message);
            return res.status(500).send("Error fetching user logs");
        }

        res.render('user_logs', { username, logs });
    });
});

// **Route: Export Chat Logs as CSV**
app.get('/export/csv', (req, res) => {
    db.all(`SELECT * FROM messages ORDER BY timestamp DESC`, (err, rows) => {
        if (err) {
            logger.error("Error exporting logs: " + err.message);
            return res.status(500).send("Error exporting logs");
        }

        res.setHeader("Content-Disposition", "attachment; filename=chat_logs.csv");
        res.setHeader("Content-Type", "text/csv");

        const csvStream = fastcsv.format({ headers: true });
        csvStream.pipe(res);
        rows.forEach(row => csvStream.write(row));
        csvStream.end();
    });
});

// **Route: Export Chat Logs as JSON**
app.get('/export/json', (req, res) => {
    db.all(`SELECT * FROM messages ORDER BY timestamp DESC`, (err, rows) => {
        if (err) {
            logger.error("Error exporting logs: " + err.message);
            return res.status(500).send("Error exporting logs");
        }
        res.json(rows);
    });
});

// Start Server
const PORT = 3000;
server.listen(PORT, () => {
    logger.info(`Web dashboard running at http://localhost:${PORT}/logs`);
});
