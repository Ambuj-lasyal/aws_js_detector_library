const express = require("express");
const app = express();
let db = [
  {
    id: 1,
    name: "Marcus Dev",
    email: "marcus@salt.dev",
  },
  {
    id: 2,
    name: "Beatrice Dev",
    email: "bea@salt.dev",
  },
];

app.use(express.json());

app.get("/", (req, res) => {
  res.status(201).setHeader("location", `/api/developers/1`).json(db[0]);
});

app.get("/api/developers/", (req, res) => {
  res.json(db);
});

app.get("/api/developers/:id", (req, res) => {
  if (!idExistInDb(req.params.id)) {
    res.status(404).send("Not Found");
  } else {
    const dev = getUserById(req.params.id);
    return dev ? res.json(dev) : res.status(404).end();
  }
});

app.post("/api/developers/", (req, res) => {
  const newDeveloper = {
    id: db.length + 1,
    name: req.body.name,
    email: req.body.email,
  };

  db.push(newDeveloper);

  res
    .status(201)
    .setHeader("location", `/api/developers/${newDeveloper.id}`)
    .json(newDeveloper);
});

app.delete("/api/developers/:id", (req, res) => {
  if (!idExistInDb(req.params.id)) {
    res.status(404).send("Not Found");
  } else {
    db = db.filter((data) => data.id != req.params.id);
    res.status(204).send("No content");
  }
});

app.patch("/api/developers/:id", (req, res) => {
  if (!idExistInDb(req.params.id)) {
    res.status(404).send("Not Found");
  } else {
    const name = req.body.name;
    const email = req.body.email;
    if (
      (name !== undefined && name !== null) ||
      (email !== undefined && email !== null)
    ) {
      let usr = getUserById(req.params.id);
      if (name !== undefined && name !== null) usr.name = name;
      if (email !== undefined && email !== null) usr.email = email;
      res.status(200).json(usr);
    } else {
      res.status(400).send("Bad request");
    }
  }
});

function getUserById(id) {
  return db.find((dev) => dev.id == id);
}

function idExistInDb(id) {
  const dev = getUserById(id);
  return dev ? true : false;
}

module.exports = {
  app,
};
