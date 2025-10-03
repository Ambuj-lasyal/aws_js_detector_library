const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const HTMLBeautifier = require('js-beautify').html;

app.use(bodyParser.text( { type: 'text/html' } ));

app.use(express.static(path.join(__dirname, '/website')));

app.post('/data', (req, res) => {
    fs.writeFile(path.join(__dirname, '/website', '/index.html'), HTMLBeautifier(`<!DOCTYPE html>${req.body}`, { preserve_newlines: false }), {}, (error) => {
        if (error) {
            console.log(error);
            return res.send({
                'message': error,
                'success': false
            });
        } else {
            return res.send({
                'message': 'Updated the file successfully',
                'success': true
            });
        }
    });
});

app.listen(1234);