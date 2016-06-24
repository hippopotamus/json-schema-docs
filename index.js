var fs = require('fs')
var jade = require('jade')
var _ = require('lodash')

function throwIfValNotObj (obj) {
    _.forEach(_.keys(obj), function (key) {
        if (!_.isObject(obj[key])) {
            throw "`{key}` must be an object. You can specify these parameters: {params}".replace('{key}', key).replace(_.keys(params[key]))
        }
    })
}

var configurableStyles = {
    code: {
        color: "#FFF",
        backgroundColor: "#042A48",
    },
    thead: {
        th: {
            color: "#FFF",
            backgroundColor: "#042A48",
        },
    },
    th: {
        color: "#FFF",
        backgroundColor: "#91A0AC",
    },
    td: {
        color: "#FFF",
        backgroundColor: "#C3C6C8",
    },
    jsonMarkup: {
        color: "#C3C6C8",
        backgroundColor: "#042A48",
        boolean: {
            color: "#A8573D",
        },
        string: {
            color: "#AA8C3D",
        },
        null: {
            color: "#CFCFCF",
        },
        number: {
            color: "#92B076",
        },
    },
}

/*  such shitty hacking,
    but writing API docs
    is more mind numbing */
module.exports = function (params) {
    if (!_.isString(params.title)) {
        throw "`title` must be a string."
    }
    var locals = _.merge({}, configurableStyles, params)
    locals.schema = JSON.stringify(params.schema) // obv, this will fail, if your schema sucks

    throwIfValNotObj(_.omit(locals, ['title', 'schema']))
    throwIfValNotObj(_.omit(locals.jsonMarkup, ['color', 'backgroundColor']))
    throwIfValNotObj(locals.thead)

    /* injecting js inline, so that it only requires serving 1 file */
    var template = jade.compileFile(__dirname+'/docs.jade')(locals).replace(' src="bundle.js">', '>'+fs.readFileSync(__dirname+'/bundle.js'))
    template = template.slice(0, template.indexOf('//# sourceMappingURL'))+'</script></body></html>' // quick hack removing browserify sourcemaps
    return template
}
