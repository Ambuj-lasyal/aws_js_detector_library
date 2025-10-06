var express = require('express')
var app = express()
var mysql = require('mysql')
var bodyParser = require('body-parser');
app.use(bodyParser.json());

var db = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'password',
  database : 'test'
})
db.connect()

app.get('/:table/:id', function (req, res) {
  var table = req.params.table
  var id = req.params.id

  db.query('SELECT * FROM ' + table + ' WHERE id = ?', [id], function(err, data) {
    if (err) {
      res.sendStatus(500)
    } else {
    	output = JSON.stringify(data)
    	output = output.substring(1, output .length-1)
    	output = output.replace(/\"/g,'')
      res.json('Status GET ' + output)
    }
  })

})

app.post('/:table/', function (req, res) {
  var table = req.params.table
  var insert = req.body

  db.query('INSERT INTO '+ table +' SET ?', [insert], function (err, data) {
    if (err) {
      res.sendStatus(500)
    } else {
      console.log(req.body)
      res.send("Inserted")
    }
  })

})

app.delete('/:table/:id', function (req, res) {
  var table = req.params.table
  var id = req.params.id

  db.query('DELETE FROM '+ table +' WHERE id = '+ id, function (err, data) {
    if (err) {
      res.sendStatus(500)
    } else {
      console.log("Deleted")
      res.send("Deleted")
    }
  })

})

app.listen(3000, function () {
  console.log('API Server Running on Port 3000')
})
