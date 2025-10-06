import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import crypto from 'crypto';
const db = new sqlite3.Database('./bot_data.db')
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS captcha (date INTEGER PRIMARY KEY, captcha_id INTEGER, status INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS flag (flag TEXT)");
    db.run("INSERT OR IGNORE INTO flag (flag) VALUES ('flag{w3bh00k_b0t_1s_n0t_s3cur3_4t_4ll}')"); // h4x0r flag
});

const admin_id = 8034366278; // 管理员 ID
const BOT_TOKEN = 'YOUR_BOT_TOKEN';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Admin route middleware
const isAdmin = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(403).send('Access Denied: You do not have admin privileges');
    }
};

const app = express();
app.use(bodyParser.json());

// 配置 session
app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));


// Serve static files from 'public' directory
app.use(express.static('public'));

app.get('/', (_req, res) => {
    res.sendFile('index.html', { root: './public' });
});

// Admin dashboard route
app.get('/admin', isAdmin, (_req, res) => {
    res.sendFile('admin.html', { root: './public' });
});


app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/gen_captcha', async (req, res) => {
    const timestamp = Date.now();
    const captcha_id = Math.floor(Math.random() * 900000) + 100000;

    db.run("INSERT INTO captcha (date, captcha_id, status) VALUES (?, ?, ?)", [timestamp, captcha_id, 0], function (err) {
        if (err) {
            console.error('插入验证码出错:', err);
            return res.status(500).send('Error generating captcha');
        }
        res.json({ captcha_id });
    });
});
app.get('/is_valid_login', async (req, res) => {
    const { captcha_id } = req.query;
    const currentTime = Date.now();

    db.get("SELECT * FROM captcha WHERE captcha_id = ?", [captcha_id], (err, row) => {
        if (err) {
            console.error('数据库查询出错:', err);
            return res.status(500).send('Error checking login status');
        }

        if (!row) {
            return res.json({ is_valid: false });
        }

        const { date, status } = row;
        if (status === 1) {
            // 当登录有效时，设置用户的session为admin
            req.session.isAdmin = true;
            req.session.loggedIn = true;
            return res.json({ is_valid: true });
        } else if (currentTime - date > 60000) { // 超过60秒
            return res.json({ is_valid: false });
        } else {
            return res.json({ is_valid: false });
        }
    });
});



app.post('/webhook', async (req, res) => {
    const update = req.body;

    if (update.message) {
        const userId = update.message.from.id;
        const username = update.message.from.username || update.message.from.first_name;
        const text = update.message.text
        console.log(`收到消息: ${text} 来自用户 ${username}（ID: ${userId})`);

        if (text.startsWith('/login ')) {
            // Only process if the message is from admin
            if (userId === admin_id) {
                const captchaInput = text.split('/login ')[1].trim();
                
                // Verify the captcha
                db.get("SELECT * FROM captcha WHERE captcha_id = ? AND status = 0 AND date > ?", 
                    [captchaInput, Date.now() - 60000], // Only check captchas created within the last minute
                    async (err, row) => {
                        if (err) {
                            console.error('验证码验证出错:', err);
                            console.log(userId, "验证失败，系统错误");
                            return;
                        }
                        
                        if (row) {
                            db.run("UPDATE captcha SET status = 1 WHERE captcha_id = ?", [row.captcha_id]);
                            console.log(userId, "验证成功，已授权登录");
                        } else {
                            console.log(userId, "验证失败，验证码无效或已过期");
                        }
                    });
            } else {
                console.log(userId, "抱歉，只有管理员可以使用此命令");
            }
        }

        // // Helper function to send messages
        // async function sendMessage(chatId, text) {
        //     try {
        //         await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        //             method: 'POST',
        //             headers: { 'Content-Type': 'application/json' },
        //             body: JSON.stringify({
        //                 chat_id: chatId,
        //                 text: text
        //             })
        //         });
        //     } catch (error) {
        //         console.error('发送消息失败:', error);
        //     }
        // }
       
        res.sendStatus(200);  // 返回成功状态码
    }
});

// Admin API route for captcha records
app.get('/api/admin/captcha-records', isAdmin, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const captchaId = req.query.captcha_id;
    const status = req.query.status;

    // 构建查询条件
    let whereClause = "";
    if (captchaId) {
        whereClause += ` AND captcha_id = '${captchaId}'`;
    }
    if (status !== undefined && status !== '') {
        whereClause += ` AND status = ${status}`;
    }

    // 移除开头的 AND
    if (whereClause) {
        whereClause = " WHERE " + whereClause.substring(5);
    }

    // 构建查询
    const query = `SELECT * FROM captcha${whereClause} ORDER BY date DESC LIMIT ${limit} OFFSET ${offset}`;
    console.log(query);
    const countQuery = `SELECT COUNT(*) as total FROM captcha${whereClause}`;

    // 获取总记录数
    db.get(countQuery, (err, countResult) => {
        if (err) {
            console.error('Error getting total count:', err);
            countResult = { total: 0 };
            //return res.status(500).json({ error: 'Database error' }); 防止注入语句导致不能计数
        }

        // 获取记录
        db.all(query, (err, records) => {
            if (err) {
                console.error('Error getting records:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({
                records: records,
                total: countResult.total
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
