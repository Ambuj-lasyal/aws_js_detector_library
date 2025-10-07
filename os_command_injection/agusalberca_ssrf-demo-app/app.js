const express = require('express');
const { exec } = require('child_process');
const app = express();

app.use(express.static('public'));
app.use(express.json());

app.get('/ping', (req, res) => {
    const { host } = req.query;

    if (!host) {
        return res.status(400).send('Host is required');
    }

    // Execute the command
    exec(`ping -c 4 ${host}`, (error, stdout, stderr) => { 
        // Handle errors
        if (error) {
            console.error(`Execution error: ${error}`);
            return res.status(500).send(`Error: ${error.message}\nStderr: ${stderr}`);
        }
        if (stderr) {
            console.error(`Standard error: ${stderr}`);
            return res.status(500).send(`Stderr: ${stderr}`);
        }
        // Send output
        res.send(`${stdout}`);
    });
});


app.listen(3000, () => {
    console.log('Vulnerable command injection demo app with UI listening on port 3000');
});
