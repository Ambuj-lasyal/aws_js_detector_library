const express = require("express");
const app = express();
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const port = 3000;
const checkToken= require('./src/back/middleware/checktoken')
// jwt
const jwt = require('jsonwebtoken');
const dotenv= require('dotenv').config();

const secretKey= process.env.SECRET_KEY;


app.use(express.json());

const connection = mysql.createConnection({
  host: "localhost",
  user: "admin",
  password: "abcde",
  database: "fil_rouge",
});

connection.connect(function (error) {
  if (error) {
    throw error;
  } else {
    console.log("connecté");
  }
});

app.use(checkToken); //utilise middeleware checktoken

app.get("/hello", (req, res) => {
  res.send("Hello World!");
});

app.post("/auth", (req, res) => {
  let login= req.body.login;
  let password= req.body.password;
  let requete = `SELECT * FROM utilisateurs WHERE pseudo = '${login}' AND mdp = '${password}'`;
  connection.query(requete, (err, rows, fields) => {
    if (err) {
      res.status(403).json({ error: "utilisateur inconnu" });
      return;
    }
    console.log(rows);

if(rows.length == 0) {
      res.status(403).json({ error: "utilisateur inconnu" });
      return;
    }

    // jwt
    let id = rows[0]["id"];
    let nom = rows[0]["nom"]

    // generate token
    // const token= jwt.sign({id, nom}, secretKey, { algorithm: 'RS256', expiresIn: '48h' })
    const token = jwt.sign({ id,nom}, secretKey, { expiresIn: '24h' }, { algorithm: 'RS256' });
      res.status(200).json({
        token : token
      });


  });
});

//Appelle les routes
//Route univers(qui inclue personnages)
app.use('/univers', require('./src/back/router/univerrouter'));

//Route utilisateurs(qui inclue messages)
app.use('/utilisateurs', require('./src/back/router/userroute'));


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
