const express = require("express");
const router = express.Router();

const db = require("./db");

router.post("/:sid", async (req, res) => {
  if (req.session.uname) {
    sid = req.params.sid;
    var seats = req.body.seatno;
    console.log("Selected seat : " + seats);
    var costSearch =
      "select t_cost from Theater where t_id in (select t_id from Shows where s_id='" +
      req.params.sid +
      "')";
    await db.query(costSearch, async function (error, result) {
      if (!!error) console.log(error);
      else {
        var ticketPrice = result[0].t_cost * seats;

        var bookQuery =
          "select * from  Shows where s_id='" + req.params.sid + "'";
        await db.query(bookQuery, async function (error, result) {
          if (error) console.log(error);
          else {
            var userQuery =
              "select * from Users where username='" + req.session.uname + "'";
            await db.query(userQuery, async function (error, result) {
              if (error) console.log(error);
              else {
                u_id = result[0].u_id;
                console.log("uid : " + u_id);
                var rand = Math.floor(Math.random() * 9999);
                //   var sb_id =
                //     "" + u_id + result[0].t_id + result[0].m_id + sid + rand;
                var b_id = u_id * sid;
                console.log("bid : " + b_id);
                console.log("type bid : " + typeof b_id);
                var b_status = "Booked";
                var bookInsert =
                  "insert into Book values('" +
                  b_id +
                  "','" +
                  b_status +
                  "','" +
                  seats +
                  "','" +
                  req.params.sid +
                  "','" +
                  u_id +
                  "','" +
                  ticketPrice +
                  "')";
                await db.query(bookInsert, async function (error, result) {
                  if (!!error) console.log(error);
                  else {
                    var seatdecQuery =
                      "update Shows set rem_seat=rem_seat-" +
                      seats +
                      " where s_id='" +
                      req.params.sid +
                      "'";
                    await db.query(
                      seatdecQuery,
                      async function (error, result) {
                        if (!!error) console.log(error);
                        else {
                          console.log("Successfully booked");
                          res.redirect("/ticket/" + sid + "/" + b_id);
                        }
                      }
                    );
                  }
                });
              }
            });
          }
        });
      }
    });
  }else
  {
    res.redirect('/login/page')
  }
});

module.exports = router;
