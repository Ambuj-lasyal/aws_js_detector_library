import express from "express";
import fs from "fs";
import { createClient } from "webdav";
const app = express();
const webDavClient = createClient("https://webdav.yandex.ru", {username: "kate.syatkovskaya", password: "oqlwjvthodqfnrzi"});

app.get('/', (req, res) => {res.sendFile("D:/универ/Пскп/лаба/28/1.html");});

app.post("/md/:folder", (req, res) => {
    webDavClient.exists(`/${req.params.folder}`).then((exist) => {
        if (exist) {
            res.status(408);
            return { error: "Directory exists" };
        } else {
            return webDavClient.createDirectory(`/${req.params.folder}`)
            .then(() => ({ message: `Directory created` }));
        }
    })
    .then((message) => res.json(message))
    .catch((err) => res.status(400).json({ error: err.message }));
});

app.post("/rd/:folder", (req, res) => {
    webDavClient.exists(`/${req.params.folder}`).then((exist) => {
        if (exist) {
            return webDavClient.deleteFile(`/${req.params.folder}`)
            .then(() => ({ message: `Directory removed` }));
        } else {
            res.status(404);
            return { error: "Directory is not exists" };
        }
    })
    .then((message) => res.json(message))
    .catch((err) => res.status(400).json({ custom: true, error: err.message }));
});

app.post("/up/:file", (req, res) => {
    let rs = fs.createReadStream(`./${req.params.file}`);
    let ws = webDavClient.createWriteStream(req.params.file);
    rs.on("error", (err) => {res.status(408).json({ error: "Failed to read file" });});
    ws.on("error", (err) => {res.status(408).json({ error: "Failed to upload file" });});
    rs.pipe(ws);
    rs.on("end", () => {res.json({ message: "File has been uploaded" });});
});

app.post("/down/:file", (req, res) => {
    webDavClient.exists(`/${req.params.file}`).then((exist) => {
        if (exist) {
            let writeStream = fs.createWriteStream(`D:/универ/Пскп/лаба/28/files/${req.params.file}`);
            webDavClient.createReadStream(`/${req.params.file}`).pipe(writeStream);
            res.json({ message: "File was been downloaded" });
        } else {
            res.status(404);
            return { error: "File is not exists" };
        }
    })
    .then((message) => {return (message ? res.json(message) : null)})
    .catch((err) => res.status(400).json({ error: err.message }));
});

app.post("/del/:file", (req, res) => {
    webDavClient.exists(`/${req.params.file}`).then((exist) => {
        if (exist) {
            return webDavClient.deleteFile(`/${req.params.file}`).then(() => ({ message: `File removed` }));
        } else {
            res.status(404);
            return { error: "File is not exists" };
        }
    })
    .then((message) => res.json(message))
    .catch((err) => res.status(400).json({ error: err.message }));
});

app.post("/copy/:file1/:file2", (req, res) => {
    const file1Exists = webDavClient.exists(`/${req.params.file1}`);
    const file2Exists = webDavClient.exists(`/${req.params.file2}`);

    Promise.all([file1Exists, file2Exists]).then(([file1Exists, file2Exists]) => {
        if (file1Exists && file2Exists) {
            return webDavClient.copyFile(`/${req.params.file1}`, `/${req.params.file2}`).then(() => ({ message: `File copied` }));
        } else {
            res.status(408);
            return { error: "One or both files do not exist" };
        }
    })
    .then((message) => res.json(message))
    .catch((err) => res.status(400).json({ error: err.message }));
});

app.post("/move/:file1/:file2", (req, res) => {
    const file1Exists = webDavClient.exists(`/${req.params.file1}`);
    const file2Exists = webDavClient.exists(`/${req.params.file2}`);

    Promise.all([file1Exists, file2Exists]).then(([file1Exists, file2Exists]) => {
        if (file1Exists && file2Exists) {
            try {
                return webDavClient.moveFile(`/${req.params.file1}`, `/${req.params.file2}`)
                .then(() => ({ message: `File moved` }));
            } catch (err) {
                res.status(404);
                return { error: "File cannot be moved" };
            }
        } else {
            res.status(408);
            return { error: "One or both files do not exist" };
        }
    })
    .then((message) => res.json(message))
    .catch((err) => res.status(400).json({ error: err.message }));
});

app.use(function (req, res) {res.sendStatus(404);});
app.listen(3000);