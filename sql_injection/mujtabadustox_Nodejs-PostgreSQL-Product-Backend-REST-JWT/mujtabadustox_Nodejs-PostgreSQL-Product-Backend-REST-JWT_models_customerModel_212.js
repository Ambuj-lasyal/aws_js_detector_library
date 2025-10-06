const knex = require("../db/knex.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const login = async (req, res) => {
  const { email, password } = req.body;

  const data = await knex.raw(`SELECT * FROM "customer"
    WHERE "email" = '${email}' ;`);

  if (data.rows.length === 0) {
    return res.status(401).json({ message: "Invalid Email or Password" });
  }

  const dataOfUser = data.rows[0];

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const passwordMatch = await bcrypt.compare(password, dataOfUser.password);

  if (!passwordMatch) {
    res.status(401).json({ message: "Invalid Password" });
  }

  const token = jwt.sign(
    { id: dataOfUser.customer_id, email: dataOfUser.email },
    process.env.SECRET_KEY,
    { expiresIn: "1h" }
  );

  res.json({ token });
};

const listAllCustomers = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    const data = await knex.raw(`SELECT * FROM "customer";`);
    return data.rows;
  } catch (err) {
    throw new Error("Invalid");
  }
};

module.exports = {
  listAllCustomers,
  login,
};
