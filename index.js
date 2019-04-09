'use strict';

const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rfs = require('rotating-file-stream');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
// const upload = multer({dist: 'uploads/'}); // ローカルにマルチパートアップロードのファイルを保存する

const port = 8000;

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

/*
 *  事前設定部
 */

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

// favicon には200を返す
app.get('/favicon*', (req, res) => {
    res.status = 200;
    res.end();
});



/*
 *  レスポンス生成部
 */

// HTMLのフォームの動作確認用
app.post('/post/rawform', rawformHandler);

// フロントエンドの JavaScript からの multipart でのフォームの動作確認用
app.post('/post/multipart', upload.any(), multipartHandler);

// POST API
app.post('/post', postHandler);

// GET API
app.get('/get', getHandler);

// TEST API
app.get('/test/*', testHandler);
app.get('/test', testHandler);

// 任意のステータスを返す API
app.use('/status/:statusCode([0-9]{3})', statusHandler)

// トップページ
app.get('/', rootHandler);


const staticfunc = express.static(__dirname + '/public', {
    maxAge: 600000
})
app.use('/static', (req, res, next) => {
    staticfunc(req, res, next)
    accessLogStream.write(JSON.stringify({
        Header: {
            Request: req.headers,
            Response: res.getHeaders()
        }
    }, null, 4));
});


/*
 *  ログ出力部
 */

app.use((req, res) => {
    res.on('finish', () => {
        accessLogStream.write(JSON.stringify({
            Header: {
                Request: req.headers,
                Response: res.getHeaders()
            }
        }, null, 4));
    });
});

app.listen(port);
console.log(`listening in ${port} ...`);


/*
 *  関数部
 */

function rootHandler(req, res, next) {

    res.setHeader('Set-Cookie', 'foo=bar'); // サンプル

    const req_headers = req.headers;
    const res_headers = res.getHeaders();
    res.status(200);
    res.render('index', {
        req_headers : JSON.stringify(req_headers, null, 4),
        res_headers : JSON.stringify(res_headers, null, 4),
        req_body : ''
    });
    next();
}

function getHandler(req, res, next) {
    let res_body = {
        Request: {
            Header: req.headers,
            Query: req.query
        }
    };

    res.status(200);
    res.json(res_body);

    next();
}

function postHandler(req, res, next) {
    let res_body = {
        Request: {
            Header: req.headers,
            Body: req.body
        }
    };

    res.status(200);
    res.json(res_body);

    accessLogStream.write(JSON.stringify({
        RequestBody: req.body
    }, null, 4));

    next();
}

function multipartHandler(req, res, next) {
    let files = JSON.parse(JSON.stringify(req.files));
    files.forEach(f => {
        if(f.buffer) {
            delete f.buffer;
        }
    });

    let res_body = {
        Request: {
            Header: req.headers,
            Body: req.body,
            Files: files,
        }
    };
    res.status(200);
    res.json(res_body);
    res.end();

    accessLogStream.write(JSON.stringify({
        RequestBody: {
            body: req.body,
            files: files
        }
    }, null, 4));

    next();
}

function rawformHandler(req, res, next) {
    const req_headers = req.headers;
    const res_headers = res.getHeaders();
    const req_body = req.body;
    res.status(200);
    res.render('index', {
        req_headers : JSON.stringify(req_headers, null, 4),
        res_headers : JSON.stringify(res_headers, null, 4),
        req_body : JSON.stringify(req_body, null, 4)
    });

    accessLogStream.write(JSON.stringify({
        RequestBody: req.body
    }, null, 4));

    next();
}

function statusHandler(req, res, next) {
  res.status(req.params.statusCode);
  let res_body = {
        Request: {
            Header: req.headers,
            Query: req.query
        }
    };

    res.json(res_body);

    next();
}

function testHandler(req, res, next) {
  setTimeout(function() {
    // res.setHeader('Pragma', 'no-cache'); // サンプル
    let res_body = {
        Request: {
            Header: req.headers,
            Query: req.query
        }
    };

    res.status(200);
    res.json(res_body);

    next();
  }, 20000);
}
