const { exec, spawn, fork } = require('child_process');

app.get('/ping', (req, res) => {
    const ip = req.query.ip;
    exec(`ping ${ip}`, (err, stdout) => res.send(stdout)); // Vulnerable
});

app.get('/backup', (req, res) => {
    const folder = req.query.folder;
    spawn('tar', ['-czf', 'backup.tar.gz', folder]); // Vulnerable
});

app.get('/run-task', (req, res) => {
    const task = req.query.task;
    fork(task); // Vulnerable
});

const childProcess = require('child_process');

app.get('/delete', (req, res) => {
    const file = req.query.file;
    childProcess.exec(`rm ${file}`, (err) => res.send('Deleted')); // Vulnerable
});

app.get('/archive', (req, res) => {
    const dir = req.query.dir;
    require('child_process').spawn('zip', ['-r', 'archive.zip', dir]); // Vulnerable
});

app.get('/eval-code', (req, res) => {
    const code = req.query.code;
    eval(code); // Vulnerable
});

app.get('/run-dynamic', (req, res) => {
    const code = req.query.code;
    const dynamicFunction = new Function(code);
    dynamicFunction(); // Vulnerable
});

process.env.PATH = process.env.PATH + ':/malicious/path'; // Vulnerable

const { exec } = require('child_process');
exec('echo "Injected Command"'); // Vulnerable due to PATH manipulation

const { exec } = require('child_process');

app.get('/list-files', (req, res) => {
    const command = `ls ${req.query.path}`;
    exec(command, (err, stdout) => res.send(stdout)); // Vulnerable
});

app.get('/dynamic-import', (req, res) => {
    const moduleName = req.query.module;
    const importedModule = require(moduleName); // Vulnerable
    res.send(`Module: ${importedModule}`);
});

const { exec } = require('child_process');

app.get('/execute-powershell', (req, res) => {
    const command = `powershell.exe -Command "${req.query.cmd}"`;
    exec(command, (err, stdout) => res.send(stdout)); // Vulnerable
});

app.get('/execute-bash', (req, res) => {
    const command = `bash -c "${req.query.script}"`;
    exec(command, (err, stdout) => res.send(stdout)); // Vulnerable
});
