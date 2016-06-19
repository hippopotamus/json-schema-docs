'use strict'
let express = require('express');
let app = express();

let schemaDocs = require('./index')
var docs = schemaDocs({ title: "My Api Docs", schema: require('./schemas') })

app.use(express.static(__dirname))
let router = express.Router();
router.get('/docs', function (req, res) {
    res.send(docs)
})

router.get('/schema', function (req, res) {
    res.json(schema)
})

app.use('/', router)

app.set('port', '4000')

require('http').createServer(app).listen('4000')
