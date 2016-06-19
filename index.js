var fs = require('fs')
var jade = require('jade')

module.exports = function (locals) {
    if (typeof locals.title !== 'string') {
        throw "`title` must be a string."
    }
    if (typeof locals.schemaUrl !== 'string') {
        throw "`schemaUrl` must be a string."
    }
    console.log(locals)
    /* injecting js inline, so that it only requires serving 1 file */
    var template = jade.compileFile('docs.jade')(locals).replace(' src="bundle.js">', '>'+fs.readFileSync('./bundle.js'))
    template = template.slice(0, template.indexOf('//# sourceMappingURL'))+'</script></body></html>' // quick hack removing browserify sourcemaps
    return template
}
