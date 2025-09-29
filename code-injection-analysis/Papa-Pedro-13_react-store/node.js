const express = require('express');
const app = express();


//SSRF
app.get('/fetch', async (req, res) => {
  const url = req.query.url;
  var url2 = url;
  let response = await fetch(url2);

  const url3 = req.query.url.includes("http") ? req.query.url : '';
  let response2 = await fetch(url3);

  res.send(response.data);
});


//Eval
app.get('/execute', (req, res) => {
  const code = req.query.script;
  eval('console.log(123)'); // Опасный вызов
  const dynamicFunc = new Function('param', req.body.code); // Будет обнаружено
});

//SQL-injections
app.get('/user', (req, res) => {
  pool.query(`SELECT * FROM users WHERE id = ${req.query.id}`);

  const userName = req.body.name;
  db.query("UPDATE users SET name = '" + userName + "'");

  const search = req.query.filter;
  client.query(`SELECT * FROM products WHERE ${search} AND available = true`);

  const search2 = req.query.filter;
  client.query(`SELECT * FROM products WHERE ${search} AND available = true`);



  //HTML Injection
  document.write("<div>" + req.query.userContent + "</div>");
  element.innerHTML = window.location.hash.substring(1);
  $('#container').html(localStorage.getItem('untrustedContent'));
});


app.listen(3000);