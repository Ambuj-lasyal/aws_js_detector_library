const express = require("express");
const multer = require("multer");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const fileUpload = require("express-fileupload");
const upload = multer({ dest: "uploads/" });
const fs = require("fs");

const os = require("os");
const path = require("path");

const { spawn } = require("child_process");

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(fileUpload());
require("dotenv").config();

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Mysql#7",
  database: "iamneo",
  port: 3306,
});

connection.connect();

// const upload = multer({ dest: "uploads/" });

// app.post("/api/upload/:userid", (req, res) => {
//   const userId = req.params.userid;
//   const video = req.body.video;

//   const query = `INSERT INTO uploadcloud (video, userid) VALUES ('${video}', '${userId}');`;

//   connection.query(query, (err, result) => {
//     is (err) {
//       console.error(err);
//       res.status(500).send({ message: "Internal server error" });
//     } else {
//       res.status(200).send({ message: "Video stored successfully" });
//     }
//   });
// });

// const s3Client = new S3Client({ region: "ap-south-1" });

// app.get("/process-video/:userId", (req, res) => {
//   const userId = req.params.userId;

//   // Retrieve the video from the database based on the user ID
//   const query = "SELECT video FROM uploadcloud WHERE userId = ?";
//   connection.query(query, [userId], (error, results) => {
//     if (error) {
//       console.error("Error retrieving video from the database:", error);
//       res.status(500).send("Error retrieving video from the database.");
//     } else if (results.length === 0) {
//       res.status(404).send("Video not found for the user ID.");
//     } else {
//       const videoBuffer = results[0].video;

//       const params = {
//         Bucket: "vidzupload",
//         Key: `videos/${userId}.mp4`,
//         Body: videoBuffer,
//         ACL: "public-read", // Set public access
//       };

//       // Upload the video file to the cloud storage
//       const uploadCommand = new PutObjectCommand(params);
//       s3Client
//         .send(uploadCommand)
//         .then((data) => {
//           const responseHeaders =
//             data.$metadata.httpHeaders || data.$metadata.headers;
//           const uploadedFileSize = parseInt(
//             responseHeaders["content-length"],
//             10
//           ); // Size of the uploaded file in bytes
//           // Size of the uploaded file in bytes
//           console.log("Video uploaded to S3:", data.Location);
//           console.log("Uploaded file size:", uploadedFileSize, "bytes");

//           if (videoBuffer.length === uploadedFileSize) {
//             console.log("Video fully uploaded.");
//           } else {
//             console.log("Video upload incomplete.");
//             console.log("Upload response:", data);
//           }

//           res.status(200).send("Video uploaded successfully to S3.");
//         })
//         .catch((err) => {
//           console.error("Error uploading video to S3:", err);
//           res.status(500).send("Error uploading video to S3.");
//         });
//     }
//   });
// });

app.post("/minus/:userId", (req, res) => {
  const userId = req.params.userId;
  const facedetectminus = req.body.facedetectminus;
  const voicedetectminus = req.body.voicedetectminus;
  const notlookcameraminus = req.body.notlookcameraminus;
  const gramminus = req.body.gramminus;

  const query = `INSERT INTO minusmarks (facedetectminus, voicedetectminus, notlookcameraminus, gramminus,userId)
                 VALUES (?, ?, ?, ?, ?)`;

  connection.query(
    query,
    [facedetectminus, voicedetectminus, notlookcameraminus, gramminus, userId],
    (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send({ message: "Internal server error" });
      } else {
        res.status(200).send({ message: "Data inserted successfully" });
      }
    }
  );
});

app.get("/userdetails/:userId", (req, res) => {
  const { userId } = req.params;
  const query = `SELECT * FROM userdetails where userId = '${userId}'`;
  connection.query(query, (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

app.get("/userprofile/:stuid", (req, res) => {
  const { stuid } = req.params;
  const query = `Select * from sturegistration where email='${stuid}@gmail.com'`;
  connection.query(query, (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

app.post("/userdetails/:stuId/:userId", (req, res) => {
  // Extract parameters and data from the request
  const stuId = req.params.stuId;
  const aptiscore = req.body.aptiscore;
  const fluency = req.body.fluency;
  const userId = req.params.userId;
  const facedetections = req.body.facedetections;
  const notlook = req.body.notlook;
  const voice = req.body.voice;
  const gram = req.body.gram;
  const spell = req.body.spell;
  const totalmarks = req.body.totalmarks;

  // Construct the SQL query
  const query = `INSERT INTO userdetails (stuid, aptiscore, fluency, userId, totalmarks, facedetections, notlook, voice, gram,spell) 
                 VALUES ('${stuId}', '${aptiscore}', '${fluency}', '${userId}', '${totalmarks}', '-${facedetections}', '-${notlook}', '-${voice}', '-${gram}','-${spell}')`;

  // Execute the SQL query
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error inserting user details:", err);
      res.status(500).json({ error: "Error inserting user details" });
      return;
    }
    res.json(results);
  });
});

app.get("/api/challenges/:userId", (req, res) => {
  const { userId } = req.params;
  const query = `SELECT * FROM challenges where comp_id = '${userId}'`;
  connection.query(query, (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

app.get("/challenges/:challengeId", (req, res) => {
  const { challengeId } = req.params;
  const query = `select * from challenges where challenge_id= '${challengeId}'`;
  connection.query(query, (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

app.get("/getinformation", (req, res) => {
  const query = "select * from informations";
  connection.query(query, (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

app.delete("/api/challenges/:challenge_id", (req, res) => {
  const { challenge_id } = req.params;
  const query = `DELETE FROM challenges WHERE challenge_id = ${challenge_id}`;
  connection.query(query, (error, results) => {
    if (error) throw error;
    res.send(results);
  });
});

app.post("/api/register", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const confirmPassword = req.body.confirmPassword;

    if (password !== confirmPassword) {
      res.send({ message: "Password does not match" });
      return;
    }

    // Extract the institution name from the email
    const userid = email.split("@")[0].trim(); // Extracting the first part before '@'
    const Inst_name = userid;

    // Use parameterized query to prevent SQL injection
    const checkEmailSql = "SELECT * FROM inst_register WHERE email = ?";
    const checkEmailValues = [email];

    connection.query(checkEmailSql, checkEmailValues, async (error, result) => {
      if (error) {
        res.send({ message: error });
      } else if (result.length > 0) {
        // Email already exists
        res.send({ message: "Email already exists" });
      } else {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the new user
        const insertSql =
          "INSERT INTO inst_register (email, Inst_name, password, userid) VALUES (?, ?, ?, ?)";
        const insertValues = [email, Inst_name, hashedPassword, userid];

        connection.query(insertSql, insertValues, (error, result) => {
          if (error) {
            res.send({ message: error });
          } else {
            res.send({ message: "Registration success" });
          }
        });
      }
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.sendStatus(500);
  }
});
app.post("/api/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  // Use parameterized query to prevent SQL injection
  const sql = "SELECT * FROM inst_register WHERE email = ?";
  connection.query(sql, [email], async (error, result) => {
    if (error) {
      // Handle the error case
      console.error(error);
      res.status(500).send({ message: "Internal server error" });
    } else if (result.length === 0) {
      // Handle the case where no user is found
      res.status(401).send({ message: "Invalid credentials" });
    } else {
      const hashedPassword = result[0].password;

      // Compare the user's input with the stored hashed password
      const passwordMatch = await bcrypt.compare(password, hashedPassword);

      if (passwordMatch) {
        // Handle the case where the password matches
        res.send({ message: "Login successful" });
      } else {
        // Handle the case where the password does not match
        res.status(401).send({ message: "Invalid credentials" });
      }
    }
  });
});

app.post("/api/update/:taskId", (req, res) => {
  const Institute = req.body.Institute;
  const AptbeginTime = req.body.AptbeginTime;
  const AptendTime = req.body.AptendTime;
  const no_ofReasoning = req.body.no_ofReasoning;
  const no_ofEnglish = req.body.no_ofEnglish;
  const no_ofmajor = req.body.no_ofmajor;
  const reasoningmark = req.body.reasoningmark;
  const englishmark = req.body.englishmark;
  const majormark = req.body.majormark;
  const comp_id = req.params.taskId;

  const reasontotal = no_ofReasoning * reasoningmark;
  const englishtotal = no_ofEnglish * englishmark;
  const majortotal = no_ofmajor * majormark;
  const total = no_ofReasoning + no_ofEnglish + no_ofmajor;
  const totalmarks = reasontotal + englishtotal + majortotal;

  const sql = `INSERT INTO challenges 
    (Institute, AptbeginTime, AptendTime, no_ofReasoning, no_ofEnglish, no_ofmajor, reasoningmark, englishmark, majormark, total, totalmarks, comp_id) 
      VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?)`;
  const values = [
    Institute,
    AptbeginTime,
    AptendTime,
    no_ofReasoning,
    no_ofEnglish,
    no_ofmajor,
    reasoningmark,
    englishmark,
    majormark,
    total,
    totalmarks,
    comp_id,
  ];

  connection.query(sql, values, (error, result) => {
    if (error) {
      console.log(error);
      res.send({ message: error });
    } else {
      res.send({ message: "Insertion Success" });
    }
  });
});

app.put("/api/challenges/:challenge_id", (req, res) => {
  const challenge_id = req.params.challenge_id;
  const task = req.body;

  // Calculate the total marks
  const reasontotal = task.no_ofReasoning * task.reasoningmark;
  const englishtotal = task.no_ofEnglish * task.englishmark;
  const majortotal = task.no_ofmajor * task.majormark;
  const total = task.no_ofReasoning + task.no_ofEnglish + task.no_ofmajor;
  const totalmarks = reasontotal + englishtotal + majortotal;

  // Update the task in the database
  connection.query(
    "UPDATE challenges SET ? WHERE challenge_id = ?",
    [task, challenge_id],
    (err, result) => {
      if (err) {
        console.log("Error updating task:", err);
        res.status(500).send("Error updating task");
      } else if (result.affectedRows === 0) {
        console.log(`Task with challenge_id ${challenge_id} not found`);
        res
          .status(404)
          .send(`Task with challenge_id ${challenge_id} not found`);
      } else {
        console.log(
          `Task with challenge_id ${challenge_id} updated successfully`
        );
        res.status(200).send({
          message: `Task with challenge_id ${challenge_id} updated successfully`,
        });
      }
    }
  );
});

app.get("/transcribe/:textid", (req, res) => {
  const textid = req.params.textid;
  const sql = `SELECT * FROM text WHERE textid = ${textid}`;
  connection.query(sql, (err, results) => {
    if (err) throw err;
    res.json(results[0]);
  });
});

app.get("/getminus/:userId", (req, res) => {
  const userId = req.params.userId;

  const sql = `SELECT * FROM minusmarks WHERE userId = '${userId}' ORDER BY id DESC LIMIT 1;
  `;

  connection.query(sql, (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

//----------------__________________________Studetent_Database_________________________-----------------//

// ...

app.post("/api/updatePhoto", upload.single("photo"), async (req, res) => {
  try {
    const email = req.body.email;
    const photo = req.file ? req.file.filename : "";

    // Update the user's photo in the database
    const updateSql = "UPDATE inst_register SET photo = ? WHERE email = ?";
    const updateValues = [photo, email];

    connection.query(updateSql, updateValues, (error, result) => {
      if (error) {
        res.send({ message: error });
      } else {
        res.send({ message: "Photo updated successfully" });
      }
    });
  } catch (error) {
    console.error("Error updating photo:", error);
    res.sendStatus(500);
  }
});

// ...

app.post("/api/stulogin", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  // Use parameterized query to prevent SQL injection
  const sql = "SELECT * FROM sturegistration WHERE email = ? AND password = ?";
  connection.query(sql, [email, password], (error, result) => {
    if (error) {
      // Handle the error case
      console.error(error);
      res.status(500).send({ message: "Internal server error" });
    } else if (result.length === 0) {
      // Handle the case where no user is found
      res.status(401).send({ message: "Invalid credentials" });
    } else {
      // Handle the case where a user is found

      res.send({ message: "Login successful" });
    }
  });
});

app.post("/api/sturegister", (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const gender = req.body.gender;
  const phone = req.body.phone;
  const password = req.body.password;
  const confirmpassword = req.body.confirmpassword;

  // Insert registration data into database
  const query = `INSERT INTO sturegistration (name, email, gender, phone, password, confirmpassword) VALUES (?, ?, ?, ?, ?, ?)`;
  connection.query(
    query,
    [name, email, gender, phone, password, confirmpassword],
    (err, result) => {
      if (err) {
        console.error("Error inserting data into MySQL database: ", err);
        res.status(500).json({ message: "Error registering student" });
        return;
      }
      console.log(
        "Successfully registered new student with ID: ",
        result.insertId
      );
      res.status(200).json({ message: "Successfully registered student" });
    }
  );
});

app.get("/api/challenges", (req, res) => {
  const query = `SELECT * FROM challenges`;
  connection.query(query, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send({ message: "Internal server error" });
    } else {
      res.json(results);
    }
  });
});

app.get("/transcribe-video/:stuid", async (req, res) => {
  try {
    // Retrieve audio URL from the database
    const stuid = req.params.stuid;
    const sql = `SELECT gitlink FROM upload WHERE stuid = '${stuid}'`;

    connection.query(sql, (err, result) => {
      if (err) {
        console.error("Error retrieving audio URL from the database:", err);
        res.sendStatus(500);
      } else if (result && result.length > 0) {
        const audioUrl = result[0].gitlink;

        // Execute Python script
        const pythonScript = spawn("python", ["py.py", audioUrl]);

        // Capture output from Python script
        let transcriptionText = "";
        pythonScript.stdout.on("data", (data) => {
          transcriptionText += data.toString();
        });

        pythonScript.on("close", (code) => {
          if (code === 0) {
            console.log("Python script executed successfully");
            console.log("Transcription:", transcriptionText);
            // Handle the output as needed
            const response = {
              transcription: transcriptionText,
            };
            res.status(200).json(response);
          } else {
            console.error("Python script execution failed");
            // Handle the failure case
            res.sendStatus(500);
          }
        });

        pythonScript.on("error", (error) => {
          console.error("Error executing Python script:", error);
          res.sendStatus(500);
        });
      } else {
        console.error("No audio URL found in the database");
        res.sendStatus(500);
      }
    });
  } catch (error) {
    console.error("Error retrieving audio URL from the database:", error);
    res.sendStatus(500);
  }
});

// app.get("/results/:stuid", (req, res) => {
//   try {
//     const stuid = req.params.stuid;
//     const sql = `SELECT gitlink FROM upload WHERE stuid = '${stuid}'`;

//     connection.query(sql, (err, result) => {
//       if (err) {
//         console.error("Error retrieving audio URL from the database:", err);
//         res.sendStatus(500);
//       } else if (result && result.length > 0) {
//         const videoUrl = result[0].gitlink;

//         // Execute the first Python script
//         const pythonScript1 = spawn("python", ["facedetect.py", videoUrl]);
//         let facedetectCount = "";

//         // Capture output from the first Python script
//         pythonScript1.stdout.on("data", (data) => {
//           facedetectCount += data.toString();
//           console.log("Face Detection Count:", facedetectCount);
//         });

//         // Execute the second Python script
//         const pythonScript2 = spawn("python", ["notlook.py", videoUrl]);
//         let notLookingCount = "";

//         // Capture output from the second Python script
//         pythonScript2.stdout.on("data", (data) => {
//           notLookingCount += data.toString();
//           console.log("Not Looking Count:", notLookingCount);
//         });

//         const pythonScript3 = spawn("python", ["voice_detection.py", videoUrl]);
//         let noofvoices = "";

//         pythonScript3.stdout.on("data", (data) => {
//           noofvoices += data.toString();
//           console.log("No of voices detected: ", noofvoices);
//         });

//         const pythonScript4 = spawn("python", ["fluency.py", videoUrl]);
//         let fluency = "";

//         pythonScript4.stdout.on("data", (data) => {
//           fluency += data.toString();
//           console.log("Fluency Percentage: ", fluency, "%");
//         });

//         //         const pythonScript5 = spawn('python', ['mistakes.py', videoUrl]);
//         // let spell = '';
//         // let grammer = '';
//         // pythonScript5.stdout.on('data', (data) => {
//         //   const output = data.toString();
//         //   const lines = output.split('\n');

//         //   if (lines[0].startsWith('Spelling Errors:')) {
//         //     spell = lines.slice(1).join('\n');
//         //   }

//         //   // Check if the line contains grammatical errors
//         //   if (lines[0].startsWith('Grammatical Errors:')) {
//         //     grammer = lines.slice(1).join('\n');
//         //   }
//         // });

//         // Handle script completion for all Python scripts
//         const handleScriptCompletion = () => {
//           if (
//             facedetectCount !== "" &&
//             notLookingCount !== "" &&
//             fluency !== "" &&
//             noofvoices !== ""
//             // &&
//             // spell !== '' &&
//             // grammer !== ''
//           ) {
//             console.log("All Python scripts executed successfully");
//             const response = {
//               facedetectCount,
//               notLookingCount,
//               noofvoices,
//               fluency,
//               // mistakes,
//               // spell,
//               // grammer
//             };
//             // Send the response containing all outputs as JSON
//             res.status(200).json(response);
//           }
//         };

//         // Handle script errors for all Python scripts
//         // const handleScriptError = () => {
//         //   console.error('Python script execution failed');
//         //   // Handle the failure case
//         //   res.sendStatus(500);
//         // };

//         // Handle script completion for the first Python script
//         pythonScript1.on("close", (code) => {
//           if (code === 0) {
//             console.log("Face detection Python script executed successfully");
//             handleScriptCompletion();
//           } else {
//             // handleScriptError();
//           }
//         });

//         // Handle script completion for the second Python script
//         pythonScript2.on("close", (code) => {
//           if (code === 0) {
//             console.log("Not looking Python script executed successfully");
//             handleScriptCompletion();
//           } else {
//             // handleScriptError();
//           }
//         });

//         // Handle script completion for the third Python script
//         pythonScript3.on("close", (code) => {
//           if (code === 0) {
//             console.log("Voice detection Python script executed successfully");
//             handleScriptCompletion();
//           } else {
//             // handleScriptError();
//           }
//         });

//         // Handle script completion for the fourth Python script
//         pythonScript4.on("close", (code) => {
//           if (code === 0) {
//             console.log("Fluency check Python script executed successfully");
//             handleScriptCompletion();
//           } else {
//             // handleScriptError();
//           }
//         });

//         // Handle script completion for the fifth Python script
//         // pythonScript5.on('close', (code) => {
//         //   if (code === 0) {
//         //     console.log('Mistakes Python script successfully executed');
//         //     handleScriptCompletion();
//         //   } else {
//         //     handleScriptError();
//         //   }
//         // });

//         // Handle script errors for all Python scripts
//         // pythonScript1.on('error', handleScriptError);
//         // pythonScript2.on('error', handleScriptError);
//         // pythonScript3.on('error', handleScriptError);
//         // pythonScript4.on('error', handleScriptError);
//         // pythonScript5.on('error',handleScriptError);
//       } else {
//         console.error("No video URL found in the database");
//         res.sendStatus(500);
//       }
//     });
//   } catch (error) {
//     console.error("Error retrieving video URL from the database:", error);
//     res.sendStatus(500);
//   }
// });

//-----------------------------------ADMIN DATA-------------------------------------------------//

app.post("/postinfo", (req, res) => {
  const headertopic = req.body.headertopic;
  const header = req.body.header;
  const content = req.body.content;
  const link = req.body.link;

  // Insert registration data into database
  const query = `INSERT INTO informations (headertopic,header,content,link) VALUES (?,?, ?, ?)`;
  connection.query(
    query,
    [headertopic, header, content, link],
    (err, result) => {
      if (err) {
        console.error("Error inserting data into MySQL database: ", err);
        res.status(500).json({ message: "Error registering information" });
        return;
      }
      console.log("Successfully information registered ", result.insertId);
      res.status(200).json({ message: "Successfully registered information" });
    }
  );
});

app.delete("/deleteinfo/:id", (req, res) => {
  const { id } = req.params;
  const query = `DELETE FROM informations WHERE id = ${id}`;
  connection.query(query, (error, results) => {
    if (error) throw error;
    res.send(results);
  });
});

//----------------------------------------cloud---------------------------------------------//
app.post("/postaccess", (req, res) => {
  const bucket = req.body.bucket_name;
  const access_key = req.body.access_key;
  const secret_access_key = req.body.secret_access_key;
  const region = req.body.region;
  const sql = `insert into cloudaccess (bucket_name,access_key,secret_access_key,region) values ('${bucket}','${access_key}','${secret_access_key}','${region}')`;

  connection.query(sql, (err, result) => {
    if (result) {
      res.json(result);
      console.log(result);
    } else if (err) {
      console.log(err);
    }
  });
});

app.get("/getaccess", (req, res) => {
  const sql = `select * from cloudaccess order by id desc limit 1`;
  connection.query(sql, (err, result) => {
    if (result) {
      console.log(result);
      res.json(result);
    } else if (err) {
      console.log(err);
    }
  });
});

var bucketname, accessKeyId, secretAccesskey;
var s3Client;
const sql = `SELECT * FROM cloudaccess ORDER BY id DESC LIMIT 1`;
connection.query(sql, (err, result) => {
  if (err) {
    console.log(err);
    return;
  }

  bucketname = result[0].bucket_name;
  accessKeyId = result[0].access_key;
  secretAccesskey = result[0].secret_access_key;

  s3Client = new S3Client({
    region: "ap-south-1",
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccesskey,
    },
  });

  app.post("/upload/:stuid", async (req, res) => {
    try {
      const videoName = req.body.videoName;
      const desktopPath = path.join(os.homedir(), "Desktop");
      const videoPath = path.join(desktopPath, `${videoName}.mp4`);
      const stuid = req.params.stuid;

      const fileData = fs.readFileSync(videoPath);

      const uploadParams = {
        Bucket: bucketname,
        Key: `${stuid}.mp4`,
        Body: fileData,
        ACL: "public-read",
      };

      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);

      console.log("Uploaded successfully");
      res.json({ message: "File uploaded successfully!" });
    } catch (error) {
      console.error("Error uploading file:", error);
      res
        .status(500)
        .json({ error: "An error occurred while uploading the file." });
    }
  });
});

app.get("/cloudresult/:userid", async (req, res) => {
  try {
    const userid = req.params.userid;
    const videoKey = `${userid}.mp4`;
    const getObjectParams = {
      Bucket: bucketname,
      Key: videoKey,
    };

    const command = new GetObjectCommand(getObjectParams);
    const data = await s3Client.send(command);

    // Assuming you have a public-read ACL set for the video object in S3,
    // you can construct the public URL using the S3 bucket URL and the video key
    const videoUrl = `https://vidzupload.s3.ap-south-1.amazonaws.com/${videoKey}`;

    // Execute the first Python script
    const pythonScript1 = spawn("python", ["facedetect.py", videoUrl]);
    let facedetectCount = "";

    // Capture output from the first Python script
    pythonScript1.stdout.on("data", (data) => {
      facedetectCount += data.toString();
      console.log("Face Detection Count:", facedetectCount);
    });

    // Execute the second Python script
    const pythonScript2 = spawn("python", ["notlook.py", videoUrl]);
    let notLookingCount = "";

    // Capture output from the second Python script
    pythonScript2.stdout.on("data", (data) => {
      notLookingCount += data.toString();
      console.log("Not Looking Count:", notLookingCount);
    });

    // Execute the third Python script
    const pythonScript3 = spawn("python", ["voice_detection.py", videoUrl]);
    let noofvoices = "";

    pythonScript3.stdout.on("data", (data) => {
      noofvoices += data.toString();
      console.log("No of voices detected:", noofvoices);
    });

    // Execute the fourth Python script
    const pythonScript4 = spawn("python", ["fluency.py", videoUrl]);
    let fluency = "";

    pythonScript4.stdout.on("data", (data) => {
      fluency += data.toString();
      console.log("Fluency Percentage:", fluency, "%");
    });

    // Handle script completion for all Python scripts
    const handleScriptCompletion = () => {
      if (
        facedetectCount !== "" &&
        notLookingCount !== "" &&
        fluency !== "" &&
        noofvoices !== ""
      ) {
        console.log("All Python scripts executed successfully");
        const response = {
          facedetectCount,
          notLookingCount,
          noofvoices,
          fluency,
        };
        // Send the response containing all outputs as JSON
        res.status(200).json(response);
      }
    };

    // Handle script completion for the first Python script
    pythonScript1.on("close", (code) => {
      if (code === 0) {
        console.log("Face detection Python script executed successfully");
        handleScriptCompletion();
      }
    });

    // Handle script completion for the second Python script
    pythonScript2.on("close", (code) => {
      if (code === 0) {
        console.log("Not looking Python script executed successfully");
        handleScriptCompletion();
      }
    });

    // Handle script completion for the third Python script
    pythonScript3.on("close", (code) => {
      if (code === 0) {
        console.log("Voice detection Python script executed successfully");
        handleScriptCompletion();
      }
    });

    // Handle script completion for the fourth Python script
    pythonScript4.on("close", (code) => {
      if (code === 0) {
        console.log("Fluency check Python script executed successfully");
        handleScriptCompletion();
      }
    });
  } catch (error) {
    console.error("Error retrieving video URL:", error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving the video URL." });
  }
});

app.post("/profile/:stuid", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const stuid = req.params.stuid;

    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const params = {
      Bucket: "vidzupload",
      Key: `${stuid}.jpg`,
      Body: fs.readFileSync(file.path),
      ACL: "public-read",
      ContentType: file.mimetype,
    };

    await s3.upload(params).promise();

    console.log("Uploaded successfully");
    res.json({ message: "File uploaded successfully!" });
  } catch (error) {
    console.error("Error uploading file:", error);
    res
      .status(500)
      .json({ error: "An error occurred while uploading the file." });
  }
});

const port = process.env.port || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
