const express = require("express");
const app = express();
app.use(express.json());
const main = require("./db");
const user = require("./user");
const validation = require("./validate");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
app.use(cookieParser());
const jwt = require("jsonwebtoken");

main()
  .then(() => {
    console.log("DB connected");

    app.listen(3000, () => {
      console.log("at port 3000");
    });

    app.post("/reg",async(req,res)=>{
      try {
        validation(req.body);
        req.body.password = await bcrypt.hash(req.body.password,10);
        await user.create(req.body);
        res.send("Added");
      } catch (error) {
        res.send(error.message)
      }
    });

    app.post("/log",async(req,res)=>{
      try {
       const people = await user.findOne({email:req.body.email});
       if(!req.body.email === people.email){
        throw new Error("Invalid login");
       }
       const pass = await bcrypt.compare(req.body.password,people.password);
       if(!pass){
        throw new Error("Invalid login");
       }
       else{
       const token = jwt.sign({_id:people._id,email:people.email},"aaa");
       res.cookie("token",token);
       res.send("Login sucessfully");
       }
      } catch (error) {
        res.send(error.message);
      }
    });

    app.get("/user",async(req,res)=>{
      try {
       const payload = jwt.verify(req.cookies.token,"aaa");
       const ans = await user.findById(payload._id);
       res.send(ans);
      } catch (error) {
        res.send(error.message);
      }
    });

    app.put("/user",async(req,res)=>{
      try {
        const payload = jwt.verify(req.cookies.token,"aaa");
        const ans = await user.findByIdAndUpdate(payload._id,
                    {$set:{name:req.body.name,age:req.body.age}}  
        );
        if(ans){
          res.send("updated");
        }
        else{
          res.send("Not found");
        }
      } catch (error) {
        res.send(error.message);
      }
    });

    app.delete("/user",async(req,res)=>{
      try {
       const payload = jwt.verify(req.cookies.token,"aaa");
       const ans = await user.findByIdAndDelete(payload._id);
       if(ans){
        res.send("Deleted");
       }
       else{
        res.send("Not found");
       }
      } catch (error) {
        res.send(error.message);
      }
    });

  })
  .catch((err) => console.log(err));
