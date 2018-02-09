'use strict';

const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rfs = require('rotating-file-stream');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
// const upload = multer({dist: 'uploads/'});

var logDirectory = path.join(__dirname, 'logs');

// create a rotating write stream
var accessLogStream = rfs('access.log', {
  interval: '1d', // rotate daily
  maxFiles: 30,
  path: logDirectory
});

//logger
var logger = morgan('common', {stream: accessLogStream});

const app = express();

// ejsを使用するための設定
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('json spaces', 4);

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());



// logging

// :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
app.use((req, res, next) => {
    accessLogStream.write('\n-----------------------\n');
    logger(req, res, next);
});

app.get('/favicon*', (req, res) => {
    res.status = 200;
    res.end();
});

app.post('/rawform', (req, res, next) => {
    let res_body = {
        Request: {
            Header: req.headers,
            Body: req.body
        }
    };

    res.status = 200;
    res.json(res_body);

    accessLogStream.write(JSON.stringify({
        RequestBody: req.body
    }, null, 4));

    next();
});

app.post('/multipartform', upload.any(), (req, res, next) => {

    let res_body = {
        Request: {
            Header: req.headers,
            Body: req.body,
            Files: req.files,
        }
    };
    res.status = 200;
    res.json(res_body);
    res.end();

    let files = JSON.parse(JSON.stringify(req.files));
    files.forEach(f => {
        if(f.buffer) {
            delete f.buffer;
        }
    });

    accessLogStream.write(JSON.stringify({
        RequestBody: {
            body: req.body,
            files: files
        }
    }, null, 4));

    next();
});

app.get('/', requestHandler);

app.use(function(req, res) {
    res.on('finish', function() {
        accessLogStream.write(JSON.stringify({
            Header: {
                Request: req.headers,
                Response: res.getHeaders()
            }
        }, null, 4));
    });
});

app.listen(58000);


/*
 * functions
 */

function requestHandler(req, res, next) {
    const req_headers = req.headers;
    const res_headers = res.getHeaders();
    res.render('index', {
        req_headers : JSON.stringify(req_headers, null, 4),
        res_headers : JSON.stringify(res_headers, null, 4)
    });
    next();
}
