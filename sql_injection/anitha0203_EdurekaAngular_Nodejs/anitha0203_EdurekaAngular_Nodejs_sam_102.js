const bodyParser = require('body-parser');
var express = require('express')
var app = express()
let mysql = require('mysql');
let config = require('./config.js');
var fs = require('fs')

app.get('/',function(req,res) {
    res.json("Hi welcome")
})

//////////////////////////////////////////////////////////////////////////////
var multer = require('multer');

const Storage = multer.diskStorage({
  destination: (req, file, callBack) => {

    callBack(null, 'uploads')
  },
  filename: (req, file, callBack) => {
      console.log(file)
      callBack(null,file.originalname)
  }

});

// Decliere Images Function
const upload = multer({ storage: Storage });

app.get('/getUser', function(req,res) {

  let connection = mysql.createConnection(config);
  let sql = `SELECT * FROM edureka.dataaa`;
  connection.query(sql, (error, results, fields) => {
      if (error) {
        res.json("1");
        return console.error(error.message);
      }
      else if(results.length>0)
      {
        res.json(results)
      }
      else
      {
        res.json("2");
      }
  });
  connection.end();
})

app.post('/addUser', function(req,res) {
    
  let todo = [req.body.firstname,req.body.lastname,req.body.email,req.body.password];
  console.log(todo)
  
  let connection = mysql.createConnection(config);

  let stmt = `Insert into edureka.user(firstname, lastname, email, password)
              values(?,?,?,?)`;

  connection.query(stmt, todo, (err, results, fields) => {
    if (err) {
      res.json("0");
      return console.error(err.message);
      
    }
    res.json('Details are submitted')
  });
  connection.end();
});


app.post('/file',upload.single('file'), function(req,res,next) {

   const file = req.file
    console.log(file);
    if(!file){
        const error = new Error('No file')
        res.json(error)
        console.log(error)
        return
    }
    var dataaa = "data:image/gif;base64,"+fs.readFileSync(file.path, 'base64');

    console.log('dcdvfd   ',dataaa)
    res.send(file)

    let connection = mysql.createConnection(config);
    let sql = `insert into edureka.dataaa(src) values('`+ dataaa + `');`;

  connection.query(sql, (error, results, fields) => {
    if (error){
        res.json('Error')
        return console.error(error.message);
     }
  },(results) =>
  {
    console.log(results)
    res.json('Success')
  });
  connection.end();
}) 

///////////////////////////////////////////////////////////////////////////////////////////////////


app.listen(4000)