const { urlencoded } = require("express");
const express = require("express");
const sqlconnection = require("../connection/sql_connect");
const Router = express.Router();



Router.get("/", (req, res) => {
  res.render("r");
});

Router.post("/", (req, res) => {
  const pid = req.body.id;
 
  const planeno = req.body.number;
  const packagename= req.body.packagename;
  const from_city= req.body.from;
  const to_city = req.body.to;
  const cost= req.body.cost;
  console.log(pid,planeno,packagename,from_city,to_city,cost);
   sqlconnection.query(` insert into package values(${parseInt(pid)},${parseInt(planeno)},'${packagename}','${from_city}','${to_city}',${parseInt(cost)})`)
  console.log(req.body);
  res.redirect("payment");
});

module.exports = Router;