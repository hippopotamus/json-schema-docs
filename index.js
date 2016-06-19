var fs = require('fs')
var jade = require('jade')

module.exports = function (locals) {
    if (typeof locals.title !== 'string') {
        throw "`title` must be a string."
    }
    locals.schema = JSON.stringify(locals.schema)
    /* injecting js inline, so that it only requires serving 1 file */
    var template = jade.compileFile(__dirname+'/docs.jade')(locals).replace(' src="bundle.js">', '>'+fs.readFileSync(__dirname+'/bundle.js'))
    template = template.slice(0, template.indexOf('//# sourceMappingURL'))+'</script></body></html>' // quick hack removing browserify sourcemaps
    return template
}
