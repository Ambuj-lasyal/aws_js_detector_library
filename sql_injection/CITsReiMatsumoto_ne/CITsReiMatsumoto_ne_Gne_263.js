//ライブラリ利用宣言
const express = require("express");
const app = express();

//データベース初期化
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('dataNE');       //dataNE = 作成データ

app.set('view engine', 'ejs');
app.use("/public", express.static(__dirname + "/public"));

//データGneの取得
app.get("/db", (req, res) => {
    db.serialize( () => {
        db.all("select name, kind, mw, ld, from Gne;", (error, row) => {
            if( error ) {
                res.render('show', {mes:"EROOR"});
            }
            res.render('select', {data:row});
        })
    })
})

//取得データの出力
app.get("/top", (req, res) => {
    let desc = "";
    if( req.query.desc ) desc = " desc";
    let sql = "select name, kind, mw, ld from Gne" + req.query.pop + ";";
    db.serialize( () => {
        db.all(sql, (error, data) => {
            if( error ) {
                res.render('show', {mes:"EROOR"});
            }
            res.render('select', {data:data});
        })
    })
})

//未発見時の表記
app.use(function(req, res, next) {
  res.status(404).send('No page');
});

//終
app.listen(8080, () => console.log("Example app listening on port 8080!"));
