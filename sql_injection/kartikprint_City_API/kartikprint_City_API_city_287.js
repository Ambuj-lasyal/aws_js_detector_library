const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();

app.use(express.json()); // Middleware to parse JSON bodies

const dbPath = path.join(__dirname, "city.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.error("DB Error:", error.message);
    process.exit(1);
  }
};

initializeDBAndServer();

// Add City API
app.post("/cities", async (req, res) => {
  try {
    const { name, population, country, latitude, longitude } = req.body;

    if (!name || !population || !country || !latitude || !longitude) {
      return res.status(400).send({ error: "Missing required fields" });
    }

    const addCityQuery = `
      INSERT INTO city (name, population, country, latitude, longitude)
      VALUES (?, ?, ?, ?, ?);
    `;
    await db.run(addCityQuery, [
      name,
      population,
      country,
      latitude,
      longitude,
    ]);
    res
      .status(201)
      .send({ message: "City added successfully", city: req.body });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(400).send({ error: "Invalid JSON or other error" });
  }
});

// Update City API
app.put("/cities/:id", async (req, res) => {
  const { id } = req.params;
  const { name, population, country, latitude, longitude } = req.body;

  try {
    const updateCityQuery = `
      UPDATE city
      SET name = ?, population = ?, country = ?, latitude = ?, longitude = ?
      WHERE id = ?;
    `;
    const result = await db.run(updateCityQuery, [
      name,
      population,
      country,
      latitude,
      longitude,
      id,
    ]);

    if (result.changes) {
      res.send({ message: "City updated successfully", city: req.body });
    } else {
      res.status(404).send({ error: "City not found" });
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(400).send({ error: "Invalid JSON or other error" });
  }
});

// Delete City API
app.delete("/cities/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deleteCityQuery = `DELETE FROM city WHERE id = ?;`;
    const result = await db.run(deleteCityQuery, [id]);

    if (result.changes) {
      res.send({ message: "City deleted successfully" });
    } else {
      res.status(404).send({ error: "City not found" });
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(400).send({ error: "Invalid request or other error" });
  }
});

// Get Cities API
app.get("/", async (req, res) => {
  const { page = 1, limit = 10, filter, sort, search, projection } = req.query;

  let whereClause = filter ? `WHERE ${filter}` : "";
  let searchClause = search ? `WHERE name LIKE '%${search}%'` : "";
  let orderClause = sort ? `ORDER BY ${sort}` : "";
  let selectClause = projection ? projection : "*";

  const getCitiesQuery = `
    SELECT ${selectClause} FROM city
    ${whereClause} ${searchClause} ${orderClause}
    LIMIT ${limit} OFFSET ${(page - 1) * limit};
  `;

  try {
    const cities = await db.all(getCitiesQuery);

    const totalCitiesQuery = `SELECT COUNT(*) as total FROM city ${whereClause} ${searchClause};`;
    const { total } = await db.get(totalCitiesQuery);

    res.send({ cities, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(400).send({ error: "Error fetching cities" });
  }
});
