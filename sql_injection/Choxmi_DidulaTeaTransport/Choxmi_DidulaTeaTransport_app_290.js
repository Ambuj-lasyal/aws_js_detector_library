const express = require("express");
const app = express();
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const publicPath = path.resolve(__dirname, "public");
const { BrowserWindow } = require('electron');
var bodyParser = require('body-parser');
const fs = require('fs');
var printer = require("pdf-to-printer");
app.use(express.static('css'));
app.use(express.static('img'));
app.use(express.static('js'));
app.set('views', __dirname + '/views');
app.set('view engine', 'hbs');
app.use(express.static(publicPath));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
 
const db = new sqlite3.Database(__dirname + '/didula_db.db');

db.run('CREATE TABLE IF NOT EXISTS users(nic VARCHAR(20) PRIMARY KEY NOT NULL, name VARCHAR(100), mobile INT, account VARCHAR(50), address VARCHAR(500))');
db.run(`CREATE TABLE IF NOT EXISTS transactions(
    year INTEGER,
    month INTEGER,
    date INTEGER,
    nic VARCHAR(20),
    username VARCHAR(100),
    grossWeight INTEGER DEFAULT 0,
    add0_amount INTEGER DEFAULT 0,
    add1_units INTEGER DEFAULT 0,
    add1_unit_price INTEGER DEFAULT 0,
    add1_amount INTEGER DEFAULT 0,
    add2_units INTEGER DEFAULT 0,
    add2_unit_price INTEGER DEFAULT 0,
    add2_amount INTEGER DEFAULT 0,
    add3_units INTEGER DEFAULT 0,
    add3_unit_price INTEGER DEFAULT 0,
    add3_amount INTEGER DEFAULT 0,
    add4_units INTEGER DEFAULT 0,
    add4_unit_price INTEGER DEFAULT 0,
    add4_amount INTEGER DEFAULT 0,
    add5_amount INTEGER DEFAULT 0,
    add5_comments TEXT  DEFAULT NULL,
    PRIMARY KEY(nic,date,month,year)
)`);
db.run('CREATE TABLE IF NOT EXISTS rates(year INT, month INT, price REAL, stamp REAL, transport REAL, PRIMARY KEY(year,month))');
db.run('CREATE TABLE IF NOT EXISTS summary(year INT, month INT, uid INT, name VARCHAR(100), kilos INT, amount REAL, PRIMARY KEY(year,month,uid))');

app.get('/', function (req, res) {
    res.render("index", {});
});

app.get('/addTransaction', (req, res) => {
    var query = "INSERT INTO transactions(year,month,date,id,username,grossweight";
    if ((req.query.additionals)) {
        (req.query.additionals).forEach(additional => {
            if (additional.index === "0") {
                query += (",add0_amount");
            } else if (additional.index === "5") {
                query += (",add5_amount");
                query += (",add5_comments");
            } else {
                query += (",add" + additional.index + "_units");
                query += (",add" + additional.index + "_unit_price");
                query += (",add" + additional.index + "_amount");
            }
        });
    }
    query += (") VALUES (");
    query += "?,?,?,?,?,?";
    if (req.query.additionals !== undefined) {
        (req.query.additionals).forEach(additional => {
            if (additional.index === "0") {
                query += ",?";
            } else if (additional.index === "5") {
                query += ",?,?";
            } else {
                query += (",?,?,?");
            }
        });
    }
    query += ")";

    var params = [];
    params.push(parseInt(req.query.year));
    params.push(parseInt(req.query.month));
    params.push(parseInt(req.query.date));
    params.push(req.query.memberId);
    params.push(req.query.username);
    params.push(req.query.grossweight);
    if (req.query.additionals !== undefined) {
        (req.query.additionals).forEach(additional => {
            if (additional.index === "0") {
                params.push(additional.col2);
            } else if (additional.index === "5") {
                params.push(additional.col2);
                params.push(additional.col3);
            } else {
                params.push(additional.col2);
                params.push(additional.col3);
                params.push(parseInt(additional.col2) * parseInt(additional.col3));
            }
        });
    }
    console.log(query);


    db.run(query, params, function (err) {
        if (err) {
            if (err.errno === 19) {
                res.status(406).send("Record Exist");
                return;
            }
            res.status(500).send("Failed");
            return console.log(err);
        }
        console.log(`A row has been inserted with rowid ${this.lastID}`);
        res.status(200).send({ "res": "Success" });
    });
});

app.get('/updateTransaction', (req, res) => {
    let query = "UPDATE transactions SET grossWeight = ?, add0_amount = ?, add1_units = ?, add1_unit_price = ?, add1_amount = ?, add2_units = ?, add2_unit_price = ?, add2_amount = ?, add3_units = ?, add3_unit_price = ?, add3_amount = ?, add4_units = ?, add4_unit_price = ?, add4_amount = ?, add5_amount = ?, add5_comments = ? WHERE year = ? AND month = ? AND date = ? AND id = ?";
    let params = [req.query.grossWeight,req.query.add0_amount,req.query.add1_units,req.query.add1_unit_price,req.query.add1_amount,req.query.add2_units,req.query.add2_unit_price,req.query.add2_amount,req.query.add3_units,req.query.add3_unit_price,req.query.add3_amount,req.query.add4_units,req.query.add4_unit_price,req.query.add4_amount,req.query.add5_amount,req.query.add5_comments,req.query.year,req.query.month,req.query.date,req.query.id];
    db.run(query, params, function (err) {
        if (err) {
            if (err.errno === 19) {
                res.status(406).send("Record Exist");
                return;
            }
            res.status(500).send("Failed");
            return console.log(err);
        }
        console.log(`Record Updated`);
        res.status(200).send({ "res": "Success" });
    });
});

app.get('/updatePast', (req, res) => {
    let query = "insert or replace into transactions(past,year,month,date,id) VALUES(?,?,?,?,?)";
    let params = [req.query.past,req.query.year,req.query.month,req.query.date,req.query.id];
    db.run(query, params, function (err) {
        if (err) {
            if (err.errno === 19) {
                res.status(406).send("Record Exist");
                return;
            }
            res.status(500).send("Failed");
            return console.log(err);
        }
        console.log(`Record Updated`);
        res.status(200).send({ "res": "Success" });
    });
});

app.get('/deleteTransaction', (req, res) => {
    let query = "DELETE FROM transactions WHERE year = ? AND month = ? AND date = ? AND id = ?";
    let params = [req.query.year,req.query.month,req.query.date,req.query.id];
    db.run(query, params, function (err) {
        if (err) {
            if (err.errno === 19) {
                res.status(406).send("Record Exist");
                return;
            }
            res.status(500).send("Failed");
            return console.log(err);
        }
        console.log(`Record Updated`);
        res.status(200).send({ "res": "Success" });
    });
});

app.get('/addUser', (req, res) => {
    db.run(`INSERT INTO users(id,nic,name,mobile,bank,account,address) VALUES(?,?,?,?,?,?,?) ON conflict(id) DO UPDATE SET nic = ? , name = ? , mobile = ? , bank = ? , account = ? , address = ?`,
        [req.query.id, req.query.nic, req.query.name, req.query.mobile, (req.query.bank === "") ? null : parseInt(req.query.bank), (req.query.account === "") ? null : parseInt(req.query.account), req.query.address, req.query.nic, req.query.name, req.query.mobile, (req.query.bank === "") ? null : parseInt(req.query.bank), (req.query.account === "") ? null : parseInt(req.query.account), req.query.address], function (err) {
            if (err) {
                if (err.errno === 19) {
                    res.status(406).send("User Exist");
                    return;
                }
                res.status(500).send("Failed");
                return console.log(err);
            }
            console.log(`A row has been inserted with rowid ${this.lastID}`);
            res.status(200).send({ "res": "Success" });
        });
});

app.get('/listUsers', (req, res) => {
    let sql = `SELECT * FROM users`;
    var userData = [];
    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        }
        rows.forEach((row) => {
            userData.push(row);
        });
        res.send(userData);
    });
});

app.get('/listTransactions', (req, res) => {
    let sql = `SELECT * FROM transactions WHERE year = ? AND month = ?`;
    var transactions = [];
    console.log(parseInt(req.query.year), parseInt(req.query.month));

    db.all(sql, [parseInt(req.query.year), parseInt(req.query.month)], (err, rows) => {
        if (err) {
            throw err;
        }
        rows.forEach((row) => {
            transactions.push(row);
        });
        res.send(transactions);
    });
});

app.get('/listTransactionsPerUser', (req, res) => {
    let sql = `SELECT * FROM transactions WHERE year = ? AND month = ? AND id = ?`;
    var transactions = [];
    console.log(parseInt(req.query.year), parseInt(req.query.month), parseInt(req.query.id));

    db.all(sql, [parseInt(req.query.year), parseInt(req.query.month), parseInt(req.query.id)], (err, rows) => {
        if (err) {
            throw err;
        }
        rows.forEach((row) => {
            transactions.push(row);
        });
        res.send(transactions);
    });
});

app.get('/saveRates', (req, res) => {
    let sql = "INSERT OR REPLACE INTO rates(year,month,price,stamp,transport) VALUES(?,?,?,?,?)";
    let params = [req.query.year, req.query.month, req.query.price, req.query.stamp, req.query.transport];
    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).send("Failed");
            return console.log(err);
        }
        console.log(`A row has been inserted with rowid ${this.lastID}`);
        res.status(200).send({ "res": "Success" });
    });
});

app.get('/saveSummary', (req, res) => {
    let sql = "INSERT OR REPLACE INTO summary(year,month,uid,name,kilos,amount) VALUES(?,?,?,?,?,?)";
    let params = [req.query.year, req.query.month, req.query.uid, req.query.name, req.query.kilos, req.query.amount];
    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).send("Failed");
            return console.log(err);
        }
        console.log(`A row has been inserted with rowid ${this.lastID}`);
        res.status(200).send({ "res": "Success" });
    });
});

app.get('/getSummary', (req, res) => {
    let sql = "SELECT * FROM summary WHERE year = ? AND month = ?";
    let params = [req.query.year, req.query.month];
    db.all(sql, params, (err, row) => {
        if (err) {
            return;
        }
        res.status(200).send(row);
    });
});

app.get('/printSummary',(req,res) => {
    var fullUrl = req.protocol + '://' + req.get('host') + '/generateSummary?data=' + JSON.stringify(req.query);
    let window_to_PDF = new BrowserWindow({});//to just open the browser in background
    window_to_PDF.loadURL(fullUrl); //give the file link you want to display

    function pdfSettings() {
        var paperSizeArray = ["A4", "A5"];
        var MICRONS_PER_IN = 254000;
        var w = 3.5;
        var h = 1.1
        var option = {
            landscape: true,
            marginsType: 0,
            printBackground: false,
            printSelectionOnly: false,
        };
        return option;
    }
    window_to_PDF.webContents.on('did-finish-load', () => {
        window_to_PDF.webContents.printToPDF(pdfSettings(), function (err, data) {
            if (err) {
                console.log(err);
                return;
            }
            try {
                if (!fs.existsSync('./Summary')) {
                    fs.mkdirSync('./Summary');
                }
                fs.writeFileSync('./Summary/' + req.query.year + '_' + req.query.month + '.pdf', data);
                window_to_PDF.close();
                res.status(200).send();
            } catch (err) {
                console.log(err);
                return;
            }

        })
    });
});

app.get('/getRates', (req, res) => {
    let sql = "SELECT * FROM rates WHERE year = ? AND month = ?";
    let params = [req.query.year, req.query.month];
    db.get(sql, params, (err, row) => {
        if (err) {
            return;
        }
        res.status(200).send(row);
    });
});

app.get('/getTransactionPerUser', (req, res) => {
    let sql = "SELECT sum(grossWeight) as weight, sum(add0_amount) as advance, sum(add1_amount) as fertilizer, sum(add2_amount) as poison, sum(add3_amount) as dolomite, sum(add4_amount) as tea, sum(add5_amount) as other, sum(past) as past FROM transactions where year = ? AND month = ? AND id = ?;";
    console.log("QUERY",req.query);
    let params = [req.query.year, req.query.month, req.query.id];
    db.get(sql, params, (err, row) => {
        if (err) {
            return;
        }
        res.status(200).send(row);
    });
});

app.get('/getOtherExpenses', (req, res) => {
    let sql = "SELECT add5_amount, add5_comments FROM transactions where year = ? AND month = ? AND id = ? AND add5_amount > 0;";
    let params = [req.query.year, req.query.month, req.query.id];
    db.all(sql, params, (err, row) => {
        if (err) {
            return;
        }
        res.status(200).send(row);
    });
});

app.get('/generateReport', (req, res) => {
    res.render("report", JSON.parse(req.query.data));
});

app.get('/generateDebtReport', (req, res) => {
    console.log("GENERATE DEBT REPORT",JSON.parse(req.query.data));
    res.render("debt", JSON.parse(req.query.data));
});

app.get('/generateBankReport', (req, res) => {
    console.log("GENERATE BANK REPORT",JSON.parse(req.query.data));
    res.render("banks", JSON.parse(req.query.data));
});

app.get('/generateSummary', (req, res) => {
    res.render("summary", JSON.parse(req.query.data));
});

app.get('/generatePDF', (req, res) => {
    var fullUrl = req.protocol + '://' + req.get('host') + '/generateReport?data=' + JSON.stringify(req.query);
    let window_to_PDF = new BrowserWindow({});//to just open the browser in background
    window_to_PDF.loadURL(fullUrl); //give the file link you want to display

    function pdfSettings() {
        var paperSizeArray = ["A4", "A5"];
        var MICRONS_PER_IN = 254000;
        var w = 3.5;
        var h = 1.1
        var option = {
            landscape: true,
            marginsType: 0,
            printBackground: false,
            printSelectionOnly: false,
        };
        return option;
    }
    window_to_PDF.webContents.on('did-finish-load', () => {
        window_to_PDF.webContents.printToPDF(pdfSettings(), function (err, data) {
            if (err) {
                console.log(err);
                return;
            }
            try {
                if (!fs.existsSync('./MonthlyReports')) {
                    fs.mkdirSync('./MonthlyReports');
                }
                if (!fs.existsSync('./MonthlyReports/' + req.query.month_string)) {
                    fs.mkdirSync('./MonthlyReports/' + req.query.month_string);
                }
                fs.writeFileSync('./MonthlyReports/' + req.query.month_string + '/' + req.query.uid + '_' + req.query.name + '.pdf', data);
                window_to_PDF.close();
                res.status(200).send();
            } catch (err) {
                console.log(err);
                return;
            }

        })
    });
});

app.get('/generateDebts', (req, res) => {
    var fullUrl = req.protocol + '://' + req.get('host') + '/generateDebtReport?data=' + JSON.stringify(req.query);
    let window_to_PDF = new BrowserWindow({});//to just open the browser in background
    window_to_PDF.loadURL(fullUrl); //give the file link you want to display

    function pdfSettings() {
        var paperSizeArray = ["A4", "A5"];
        var MICRONS_PER_IN = 254000;
        var w = 35;
        var h = 11
        var option = {
            landscape: false,
            marginsType: 0,
            printBackground: false,
            printSelectionOnly: false,
        };
        return option;
    }
    window_to_PDF.webContents.on('did-finish-load', () => {
        window_to_PDF.webContents.printToPDF(pdfSettings(), function (err, data) {
            if (err) {
                console.log(err);
                return;
            }
            try {
                if (!fs.existsSync('./Debts')) {
                    fs.mkdirSync('./Debts');
                }
                fs.writeFileSync('./Debts/' + req.query.month_string + '.pdf', data);
                window_to_PDF.close();
                res.status(200).send();
            } catch (err) {
                console.log(err);
                return;
            }

        })
    });
});

app.get('/generateBanks', (req, res) => {
    console.log("BANK PRINT",req.query.bank);
    var fullUrl = req.protocol + '://' + req.get('host') + '/generateBankReport?data=' + JSON.stringify(req.query);
    let window_to_PDF = new BrowserWindow({});//to just open the browser in background
    window_to_PDF.loadURL(fullUrl); //give the file link you want to display

    function pdfSettings() {
        var paperSizeArray = ["A4", "A5"];
        var MICRONS_PER_IN = 254000;
        var w = 35;
        var h = 11
        var option = {
            landscape: false,
            marginsType: 0,
            printBackground: false,
            printSelectionOnly: false,
        };
        return option;
    }
    window_to_PDF.webContents.on('did-finish-load', () => {
        window_to_PDF.webContents.printToPDF(pdfSettings(), function (err, data) {
            if (err) {
                console.log(err);
                return;
            }
            try {
                if (!fs.existsSync('./Banks')) {
                    fs.mkdirSync('./Banks');
                }
                fs.writeFileSync('./Banks/' + req.query.month_string + '_'+ req.query.bank +'.pdf', data);
                window_to_PDF.close();
                res.status(200).send();
            } catch (err) {
                console.log(err);
                return;
            }

        })
    });
});

app.get('/getUser', (req, res) => {
    let sql = "SELECT * FROM users WHERE id = ?";
    let params = [req.query.nic];
    console.log("GetUser Param",params);

    db.get(sql, params, (err, row) => {
        if (err) {
            return;
        }
        console.log("UserGet DB",row);

        res.status(200).send(row);
    });
});

app.get('/printAllPDF', (req, res) => {
    var dirname = './MonthlyReports/' + req.query.folder + '/'
    console.log(dirname);

    fs.readdir(dirname, function (err, filenames) {
        if (err) {
            onError(err);
            return;
        }
        filenames.forEach(function (filename) {
            var file_loc = dirname + filename;
            console.log(file_loc);
            printer
                .print(file_loc)
                .then(console.log)
                .catch(console.error);
        });
    });
    res.status(200).send();
});

app.get('/printPDF', (req, res) => {
    var dirname = './MonthlyReports/' + req.query.folder + '/' + req.query.file
    console.log(dirname);
    printer
        .print(dirname)
        .then(console.log)
        .catch(console.error);
    res.status(200).send();
});

app.listen(3000)