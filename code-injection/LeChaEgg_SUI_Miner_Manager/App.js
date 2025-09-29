const express = require('express');
const { exec } = require('child_process');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const server = require('http').createServer(app);
const { spawn } = require('child_process');
const http = require('http');
const socketIo = require('socket.io');
const schedule = require('node-schedule');
const io = socketIo(server);
const path = require('path');
// Get the user's home directory
const homeDir = process.env.HOME; 
const workingDir = path.join(homeDir, 'sui_meta'); // Construct the absolute path


// Listen for WebSocket connections
io.on('connection', (socket) => {
  console.log('A user connected');
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Middleware to parse JSON bodies
app.use(express.json());

// Initialize SQLite database (file-based for persistence)
const db = new sqlite3.Database('./phrases.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the SQLite database.');
});

// Create the phrases table if it doesn't exist
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS phrases (id INTEGER PRIMARY KEY, nickname TEXT, phrase TEXT)");
});

// Listen for connections
io.on('connection', (socket) => {
  console.log('A user connected');
  
  // Listen for disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Route to add phrases with nicknames
app.post('/add-phrases', (req, res) => {
  const phrases = req.body.phrases; // Array of {nickname, phrase} objects
  const stmt = db.prepare("INSERT INTO phrases (nickname, phrase) VALUES (?, ?)");

  phrases.forEach(({ nickname, phrase }) => {
    stmt.run(nickname, phrase);
  });

  stmt.finalize();
  res.json({ status: 'Phrases added' });
});

// Route to delete a phrase
app.post('/delete-phrase', (req, res) => {
  const { id } = req.body;  // Phrase ID to delete
  db.run("DELETE FROM phrases WHERE id = ?", id, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ status: 'Phrase deleted' });
  });
});

// Route to get all phrases
app.get('/phrases', (req, res) => {
  db.all("SELECT * FROM phrases", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});


let intervalId = null; // To store the interval ID

app.post('/stop-scripts', (req, res) => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;  // Reset the interval ID
    res.json({ message: "All scheduled scripts have been stopped." });
    io.emit('script-finish', "All scheduled scripts have been stopped.");
  } else {
    res.json({ message: "No scripts are currently scheduled." });
  }
});

app.post('/schedule', (req, res) => {
  const { phraseIds, hours, minutes, seconds } = req.body;
  const intervalInMilliseconds = (hours * 3600000) + (minutes * 60000) + (seconds * 1000);
  let activePhrases = [];

  db.all(`SELECT * FROM phrases WHERE id IN (${phraseIds.join(',')})`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    activePhrases = rows;  // Save the active phrases

    // Run the script immediately
    runMergeScripts(activePhrases);

    // Clear any existing interval before setting a new one
    if (intervalId) {
      clearInterval(intervalId);
    }

    // Set up recurring script runs at the specified interval
    intervalId = setInterval(() => {
      runMergeScripts(activePhrases);
    }, intervalInMilliseconds);

    res.json({ message: `Scripts scheduled to run every ${hours} hours, ${minutes} minutes, and ${seconds} seconds.` });
  });
});

function runMergeScripts(phrases) {
  phrases.forEach((phrase) => {
    const command = `node merge.js --fomo --chain=mainnet --phrase="${phrase.phrase}"`;
    const process = spawn(command, { shell: true, cwd: workingDir });

    process.stdout.on('data', (data) => {
      console.log(`Output from phrase ${phrase.phrase}: ${data.toString()}`);
      io.emit('script-output', `Output from phrase ${phrase.nickname}: ${data.toString()}`);
    });

    process.stderr.on('data', (data) => {
      console.error(`Error from phrase ${phrase.phrase}: ${data.toString()}`);
      io.emit('script-error', `Error from phrase ${phrase.nickname}: ${data.toString()}`);
    });

    process.on('close', (code) => {
      console.log(`Process for phrase ${phrase.phrase} exited with code ${code}`);
      io.emit('script-finish', `Process for phrase ${phrase.nickname} exited with code ${code}`);
    });
  });
}

let fomoProcesses = [];  // Store running FOMO script processes
let metaProcesses = [];  // Store running META script processes

// Function to run FOMO scripts
function runFomoScripts(phrase) {
  const command = `node mine.js --fomo --chain=mainnet --phrase="${phrase}"`;
  const fomoProcess = spawn(command, { shell: true, cwd: workingDir });
  fomoProcesses.push(fomoProcess);  // Track the running FOMO process

  fomoProcess.stdout.on('data', (data) => {
    console.log(`Output from FOMO script ${phrase}: ${data.toString()}`);
    io.emit('script-output', `Output from FOMO script: ${data.toString()}`);
  });

  fomoProcess.stderr.on('data', (data) => {
    console.error(`Error from FOMO script ${phrase}: ${data.toString()}`);
    io.emit('script-error', `Error from FOMO script: ${data.toString()}`);
  });

  fomoProcess.on('close', (code) => {
    console.log(`FOMO script for phrase ${phrase} exited with code ${code}`);
    io.emit('script-finish', `FOMO script for phrase exited with code ${code}`);
  });
}

// Function to run META scripts
function runMetaScripts(phrase) {
  const command = `node mine.js --meta --chain=mainnet --phrase="${phrase}"`;
  const metaProcess = spawn(command, { shell: true, cwd: workingDir });
  metaProcesses.push(metaProcess);  // Track the running META process

  metaProcess.stdout.on('data', (data) => {
    console.log(`Output from META script ${phrase}: ${data.toString()}`);
    io.emit('script-output', `Output from META script: ${data.toString()}`);
  });

  metaProcess.stderr.on('data', (data) => {
    console.error(`Error from META script ${phrase}: ${data.toString()}`);
    io.emit('script-error', `Error from META script: ${data.toString()}`);
  });

  metaProcess.on('close', (code) => {
    console.log(`META script for phrase ${phrase} exited with code ${code}`);
    io.emit('script-finish', `META script for phrase exited with code ${code}`);
  });
}

// Function to stop FOMO scripts
function stopFomoScripts() {
  fomoProcesses.forEach((process) => {
    if (process) {
      process.kill();  // Kill the FOMO process
    }
  });
  fomoProcesses = [];  // Clear the process array
  console.log('All FOMO scripts stopped.');
}

// Function to stop META scripts
function stopMetaScripts() {
  metaProcesses.forEach((process) => {
    if (process) {
      process.kill();  // Kill the META process
    }
  });
  metaProcesses = [];  // Clear the process array
  console.log('All META scripts stopped.');
}

// Endpoint to stop all running scripts (Merge, FOMO, META)
app.post('/stop-all-scripts', (req, res) => {
  try {
    // Stop merge scripts (this logic already exists)
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    
    // Stop FOMO and META scripts
    stopFomoScripts();
    stopMetaScripts();

    res.json({ message: "All running scripts stopped successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error stopping all scripts.", error });
  }
});

// Route to run FOMO script
app.post('/run-fomo', (req, res) => {
  const { phraseId } = req.body;  // Get the selected phrase ID
  db.get(`SELECT * FROM phrases WHERE id = ?`, [phraseId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    runFomoScripts(row.phrase);  // Run the FOMO script
    res.json({ message: `FOMO script started for phrase ${row.nickname}` });
  });
});

// Route to run META script
app.post('/run-meta', (req, res) => {
  const { phraseId } = req.body;  // Get the selected phrase ID
  db.get(`SELECT * FROM phrases WHERE id = ?`, [phraseId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    runMetaScripts(row.phrase);  // Run the META script
    res.json({ message: `META script started for phrase ${row.nickname}` });
  });
});

app.get('/', (req, res) => {
  db.all("SELECT * FROM phrases", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    let phraseList = rows.map(row => `
      <li>
        <input type="checkbox" value="${row.id}" /> ${row.nickname}: ${row.phrase}
        <button onclick="deletePhrase(${row.id})">Delete</button>
        <button onclick="runFomo(${row.id})">Run FOMO</button>
        <button onclick="runMeta(${row.id})">Run META</button>
      </li>
    `).join('');

    res.send(`
      <h1>Phrase Manager</h1>
      <form id="form">
        <label>New Phrases (Nickname and Phrase - separated by '='):</label><br>
        <textarea id="phrases" placeholder="nickname1=phrase1; nickname2=phrase2" rows="6" cols="60"></textarea><br>
        <button type="button" onclick="addPhrases()">Add Phrases</button>
      </form>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();

        // When the script starts running
        socket.on('script-start', (message) => {
          document.getElementById('output').innerHTML += '<p>' + message + '</p>';
        });

        // Receive script output from the server
        socket.on('script-output', (data) => {
          document.getElementById('output').innerHTML += '<p>' + data + '</p>';
        });

        // Receive any errors from the script
        socket.on('script-error', (error) => {
          document.getElementById('output').innerHTML += '<p style="color: red;">Error: ' + error + '</p>';
        });

        // When the script finishes running
        socket.on('script-finish', (message) => {
          document.getElementById('output').innerHTML += '<p><strong>' + message + '</strong></p>';
        });
      </script>

      <!-- Output area -->
      <h2>Script Output</h2>
      <div id="output" style="border: 1px solid black; padding: 10px; height: 300px; overflow-y: scroll;"></div>

      <h2>Stored Phrases</h2>
      <ul>
        ${phraseList}
      </ul>

      <label>Set Auto-Run Interval:</label><br>
      <input type="number" id="hours" min="0" placeholder="Hours" value="0" />
      <input type="number" id="minutes" min="0" placeholder="Minutes" value="30" />
      <input type="number" id="seconds" min="0" placeholder="Seconds" value="0" /><br>

      <button onclick="scheduleTasks()">Schedule Selected</button>

      <button onclick="stopScheduledTasks()">Stop All Scheduled Scripts</button>

      <button onclick="stopAllScripts()">Stop All Running Scripts</button>

      <script>
        function runFomo(id) {
          fetch('/run-fomo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phraseId: id })
          }).then(response => response.json())
            .then(data => alert(data.message));
        }

        function runMeta(id) {
          fetch('/run-meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phraseId: id })
          }).then(response => response.json())
            .then(data => alert(data.message));
        }

        function addPhrases() {
          const phrases = document.getElementById('phrases').value.split(';').map(p => {
            const [nickname, phrase] = p.split('='); // Use '=' to split nickname and phrase
            return { nickname: nickname.trim(), phrase: phrase.trim() };
          });
          
          fetch('/add-phrases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phrases })
          }).then(() => location.reload());
        }

        function deletePhrase(id) {
          fetch('/delete-phrase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          }).then(() => location.reload());
        }

        function scheduleTasks() {
          const checkedBoxes = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'));
          const phraseIds = checkedBoxes.map(box => box.value);
          const hours = document.getElementById('hours').value;
          const minutes = document.getElementById('minutes').value;
          const seconds = document.getElementById('seconds').value;

          fetch('/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phraseIds, hours, minutes, seconds })
          }).then(response => response.json())
            .then(data => alert('Tasks scheduled: ' + JSON.stringify(data)));
        }

        function stopScheduledTasks() {
          fetch('/stop-scripts', {
            method: 'POST'
          })
          .then(response => response.json())
          .then(data => alert(data.message));
        }
        function stopAllScripts() {
          fetch('/stop-all-scripts', {
            method: 'POST',
          })
          .then(response => response.json())
          .then(data => alert(data.message));
        }
      </script>
    `);
  });
});


// Start the server
const port = 3000;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
