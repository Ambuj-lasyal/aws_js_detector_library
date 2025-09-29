const express = require("express");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const multer = require("multer");
const fs = require("fs");
const path = require("path");

var flash = require("connect-flash");
const app = express();

// Set up session and passport middleware
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(flash());
app.use(express.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static("public"));
// Configure passport to use the local strategy for authentication
passport.use(
  new LocalStrategy((username, password, done) => {
    // Here, you should implement your own logic for user authentication
    const users = getUsersFromJson();
    const user = users.find((u) => u.username === username);
    if (!user || user.password !== password) {
      return done(null, false);
    }
    return done(null, user);
  })
);

// Serialize and deserialize user objects
passport.serializeUser((user, done) => {
  done(null, user.username);
});

passport.deserializeUser((username, done) => {
  const users = getUsersFromJson();
  const user = users.find((u) => u.username === username);
  if (user) {
    done(null, user);
  } else {
    done(new Error("User not found"));
  }
});

// Set up storage for uploaded files using multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userFolder = path.join("uploads", req.user.username);
    fs.mkdirSync(userFolder, { recursive: true });
    cb(null, userFolder);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// Utility function to read user data from JSON file
const getUsersFromJson = () => {
  const usersFile = path.join(__dirname, "users.json");
  const jsonData = fs.readFileSync(usersFile, "utf8");
  return JSON.parse(jsonData).users;
};

// Utility function to write user data to JSON file
const saveUsersToJson = (users) => {
  const usersFile = path.join(__dirname, "users.json");
  const jsonData = JSON.stringify({ users }, null, 2);
  fs.writeFileSync(usersFile, jsonData, "utf8");
};

// Utility function to check if a user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
};

// Home route
app.get("/", isAuthenticated, (req, res) => {
  const user = req.user;
  // check if user folder exists
  if (!fs.existsSync(path.join("uploads", user.username))) {
    fs.mkdirSync(path.join("uploads", user.username));
  }

  const userFolders = getUserFolders(user);

  const selectedFolder = req.query.folder || "."; // Get the selected folder from query parameter
  const filesInFolder = getFilesInFolder(user, selectedFolder);

  let changesOccurred = false; // Flag to track changes
  let addedFiles = [];
  let deletedFiles = [];

  // Check for changes in the user's files
  const folderpath = path.join("uploads", req.user.username, selectedFolder);
  const files = fs.readdirSync(folderpath);
  const filesInDB = user.files.map((file) => file.name);
  files.forEach((file, index) => {
    if (fs.statSync(path.join(folderpath, file)).isDirectory()) {
      files.splice(index, 1);
    }
  });
  // Check for new files
  files.forEach((file) => {
    if (!filesInDB.includes(file)) {
      let mimetype = "application/octet-stream";
      switch (file.split(".").pop()) {
        case "txt":
          mimetype = "text/plain";
          break;
        case "pdf":
          mimetype = "application/pdf";
          break;
        case "png":
          mimetype = "image/png";
          break;
        case "jpg":
          mimetype = "image/jpg";
          break;
        case "jpeg":
          mimetype = "image/jpeg";
          break;
        case "gif":
          mimetype = "image/gif";
          break;
        case "mp4":
          mimetype = "video/mp4";
          break;
        case "webm":
          mimetype = "video/webm";
          break;
        default:
          mimetype = "application/octet-stream";
          break;
      }

      const stats = fs.statSync(path.join(folderpath, file));
      const newFile = {
        name: file,
        size: stats.size,
        mimetype: mimetype,
        timestamp: new Date().toISOString(),
        folder: selectedFolder,
      };
      user.files.push(newFile);
      changesOccurred = true;
      addedFiles.push(file);
    }
  });
  // Check for changes in the user's files
  if (changesOccurred) {
    saveUsersToJson(getUsersFromJson());
  }

  // check if all the files are in their folders

  // From the user.json data file get the deletionConfirmation
  let deletionConfirmation = false;
  if (req.user.deletionConfirmation) {
    deletionConfirmation = true;
  }
  res.render("index", {
    user,
    userFolders,
    selectedFolder,
    filesInFolder,
    deletionConfirmation,
  });
});

// Utility function to get all unique folders from user's files
const getUserFolders = (user) => {
  const folders = new Set();
  user.files.forEach((file) => {
    folders.add(file.folder);
  });
  return Array.from(folders);
};

// Utility function to get files in a specific folder
const getFilesInFolder = (user, folder) => {
  return user.files.filter((file) => file.folder === folder);
};
// Login route
app.get("/login", (req, res) => {
  req.flash("error", "Wrong credentials!");
  var message = req.flash("error")[0];
  res.render("login", { asdasd: message });
});

const methodOverride = require("method-override");
app.use(methodOverride("_method"));

app.delete("/delete/:filename", isAuthenticated, (req, res) => {
  const { filename } = req.params;
  const user = req.user;

  // check if the user has deletionConfirmation set to true
  if (user.deletionConfirmation) {
    if (req.body.deletePassword !== user.deletionConfirmationPassword) {
      res.redirect("/");
      return;
    }
  }
  // Find the index of the file in the user's files array
  const fileIndex = user.files.findIndex((file) => file.name === filename);
  const fileDir = user.files[fileIndex].folder;

  if (fileIndex !== -1) {
    // Remove the file from the user's files array
    user.files.splice(fileIndex, 1);

    // Update the user data in the JSON file
    const users = getUsersFromJson();
    const index = users.findIndex((u) => u.username === user.username);
    users[index] = user;
    saveUsersToJson(users);

    // Delete the file from the filesystem
    const filePath = path.join("uploads", user.username, fileDir + filename);
    fs.unlinkSync(filePath);

    res.redirect("/");
  } else {
    res.status(404).send("File not found");
  }
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);
app.get("/preview/:file", (req, res) => {
  const { file } = req.params;
  const user = req.user;

  var users = getUsersFromJson();
  var index = users.findIndex((u) => u.username === user.username);
  let mimetype = users[index].files.find((f) => f.name === file).mimetype;
  let pth = users[index].files.find((f) => f.name === file).folder;
  const filePath = path.join("uploads", user.username, pth + "/" + file);
  const fileData = fs.readFileSync(filePath);
  if (mimetype === "application/octet-stream") {
    switch (file.split(".").pop()) {
      case "txt":
        mimetype = "text/plain";
        break;
      case "pdf":
        mimetype = "application/pdf";
        break;
      case "png":
        mimetype = "image/png";
        break;
      case "jpg":
        mimetype = "image/jpg";
        break;
      case "jpeg":
        mimetype = "image/jpeg";
        break;
      case "gif":
        mimetype = "image/gif";
        break;
      case "mp4":
        mimetype = "video/mp4";
        break;
      case "webm":
        mimetype = "video/webm";
        break;
      default:
        mimetype = "application/octet-stream";
    }
  }

  res.setHeader("Content-Type", mimetype);

  res.send(fileData);
});

// Logout route
app.post("/logout", (req, res) => {
  req.logout((err) => console.log(err));
  res.redirect("/login");
});

// Upload route
const uploadFiles = (files, folder, user) => {
  const uploadedFiles = [];
  for (const file of files) {
    const { filename } = file;
    const uploadedFile = {
      name: filename,
      size: file.size,
      mimetype: file.mimetype,
      timestamp: new Date().toISOString(),
      folder: folder,
    };
    uploadedFiles.push(uploadedFile);
  }
  user.files.push(...uploadedFiles);

  const users = getUsersFromJson();
  const index = users.findIndex((u) => u.username === user.username);
  users[index] = user;
  saveUsersToJson(users);

  uploadedFiles.forEach((file) => {
    const sourceFilePath = path.join("uploads", user.username, file.name);
    const destinationFolderPath = path.join(
      "uploads",
      user.username,
      file.folder
    );

    if (sourceFilePath !== path.join(destinationFolderPath, file.name)) {
      fs.renameSync(
        sourceFilePath,
        path.join(destinationFolderPath, file.name)
      );
    }
  });
};
app.post("/upload", isAuthenticated, upload.array("files"), (req, res) => {
  const files = req.files;
  let folder = req.body.folder;
  const user = req.user;

  if (!folder) folder = "./";

  if (folder.slice(-1) !== "/") folder = folder + "/";

  try {
    path.resolve(folder);
  } catch (err) {
    return res.status(400).json({
      message: "Invalid folder path",
    });
  }

  try {
    path.relative(path.join("uploads", user.username), folder);
  } catch (err) {
    return res.status(400).json({
      message: "Invalid folder path",
    });
  }

  const userFolder = path.join("uploads", user.username, folder);
  fs.mkdirSync(userFolder, { recursive: true });

  uploadFiles(files, folder, user);

  res.redirect("/");
});

// Download route
app.get("/download/:filename", isAuthenticated, (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(
    "uploads",
    req.user.username,
    getUsersFromJson()
      .find((u) => u.username === req.user.username)
      .files.find((F) => F.name === filename).folder,
    filename
  );
  res.download(filePath, (err) => {
    if (err) {
      res.status(404).send("File not found");
    }
  });
});

// Set the view engine to EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
