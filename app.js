'use strict'
let express = require('express');
let app = express();

let schemaDocs = require('./index')

app.use(express.static(__dirname))
let router = express.Router();

router.get('/docs', function (req, res) {
    var docs = schemaDocs({
        title: "My Api Docs",
        schema: require('./schemas'),
    })

    res.send(docs)
})

router.get('/schema', function (req, res) {
    res.json(schema)
})

app.use('/', router)

app.set('port', '4000')

require('http').createServer(app).listen('4000')
