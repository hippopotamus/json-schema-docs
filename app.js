'use strict'
let express = require('express');
let app = express();

app.use(express.static(__dirname))
let router = express.Router();
router.get('/docs', function (req, res) {
    res.sendFile('docs.html', { root: __dirname })
})

router.get('/schema', function (req, res) {
    res.json(require('./schema'))
})

app.use('/', router)

app.set('port', '4000')

require('http').createServer(app).listen('4000')
