(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var jsonMarkup = require('json-markup')
var path = require('path')

angular.module('app', ['ui.bootstrap', 'ngSanitize']).config(function($httpProvider){
    $httpProvider.defaults.headers.common["X-Requested-With"] = 'XMLHttpRequest';
}).controller('controller', function($scope, $http, $timeout){
    $http.get('/schema').then(function(res){
        $scope.schema = mapJSON(res.data)
    })

    function mapJSON(schema) {
        $scope.resources = []
        buildFlatResourcesList(schema, "")
        $scope.sidebarItems = buildSidebar($scope.resources)
        _.map($scope.resources, function (resource) {
            mapRequiredOntoProperties(resource)
        })
    }

    function buildFlatResourcesList (schema, root) {
        _.forEach(_.keys(schema), function (key) {
            var item = schema[key]
            if (_.isObject(item)) {
                _.forEach(_.keys(item), function (k) {
                    if (k === 'id') {
                        item[k] = path.join(root, item[k])
                        console.log(item[k])
                    }
                    if (k === 'resource') {
                        root = path.join(root, item.root)
                        buildFlatResourcesList(item, root)
                        item = _.omit(item, k)
                    }
                })
            }
            if (key === 'resource') {
                $scope.resources.push(schema)
            }
        })
    }

    function buildSidebar (resources) {
        return _.map(resources, function (item) {
            return {
                name: item.resource,
                subResources: _.chain(item).keys().map(function (key) {
                    /* mapping the name of the resource and the uri. name for the title in sidebar, id (uri) is used for bookmarking the item */
                    if (item[key].id) {
                        return {
                            name: item[key].name,
                            id: item[key].id,
                            method: item[key].method,
                        }

                    }
                }).filter('name').value()
            }
        })
    }

    function mapRequiredOntoProperties (resource) {
        var properties = _.get(resource, 'properties')
        var requiredProperties = _.get(resource, 'required')
        if (properties && requiredProperties) {
            _.forEach(requiredProperties, function (propertyName) {
                var property = _.get(properties, propertyName)
                if (!property) {
                    console.log(
                        "Property {prop} is listed as required in resource {resource}, but is not in the schema"
                        .replace('{prop}', propertyName).replace('{resource}', _.get(resource, 'name'))
                    )
                } else {
                    _.merge(property, { required: true })
                }
            })
        }
        /* if there is an object, recurse onto it */
        _.forEach(_.keys(resource), function (key) {
            /* if it's an object, go deeper */
            if (_.isObject(resource[key])) {
                mapRequiredOntoProperties(resource[key])
            }
            if (key === 'items' && _.isArray(resource[key])) {
                /* items can have an array of objects, so tree recursion here :) */
                _.forEach(resource[key], function (item) {
                    mapRequiredOntoProperties(resource[key])
                })
            }
        })
    }

    $scope.formatType = function (item) {
        var type = _.get(item, 'type')
        if (type) {
            return type
        } else if (_.get(item, 'anyOf')) {
            return 'anyOf'
        } else if (_.get(item, 'allOf')) {
            return 'allOf'
        } else {
            return
        }
    }

    $scope.formatSpecMeta = function (spec) {
        var anyOf = _.get(spec, 'anyOf')
        if (anyOf) {
            return formatArrayMeta(anyOf)
        }
        var allOf = _.get(spec, 'allOf')
        if (allOf) {
            return formatArrayMeta(allOf)
        }
        if (!_.isObject(spec)) {
            return
        }

        var omittedSpecs = _.omit(spec, ['type', 'description', '$$hashKey', 'required', 'items'])
        if (!_.keys(omittedSpecs).length) {
            return
        }

        return _.map(_.keys(omittedSpecs), function (key) {
            var val = omittedSpecs[key]
            if (_.isArray(val)) {
                return '<strong>'+key+':</strong> '+val.join(', ')
            } else if (key === 'pattern') {
                return '<strong>'+key+':</strong> '+'/val/'.replace('val', val)
            }
            return '<strong>'+key+':</strong> '+val
        }).join(', ')
    }

    $scope.formatNonObjSpecMeta = function (spec) {
        var omittedSpecs = _.omit(spec, ['type', 'description', '$$hashKey', 'required', 'status'])
        if (!_.keys(omittedSpecs).length) {
            return
        }

        return _.map(_.keys(omittedSpecs), function (key) {
            return '<strong>'+key+':</strong> '+omittedSpecs[key]
        }).join(', ')
    }

    $scope.htmlifyJSON = function (obj) {
        return jsonMarkup(obj)
    }

    function formatArrayMeta (items) {
        return _.map(items, function (item) {
            return '{' + _.map(_.keys(item), function (key) {
                return '<strong>'+key+':</strong> ' + item[key]
            }).join(', ')
        }).join('}, ') + '}'
    }
})

},{"json-markup":4,"path":2}],2:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))

},{"_process":3}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
var INDENT = '    ';

var type = function(doc) {
	if (doc === null) return 'null';
	if (Array.isArray(doc)) return 'array';
	if (typeof doc === 'string' && /^https?:/.test(doc)) return 'link';

	return typeof doc;
};

var escape = function(str) {
	return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

module.exports = function(doc) {
	var indent = '';

	var forEach = function(list, start, end, fn) {
		if (!list.length) return start+' '+end;

		var out = start+'\n';

		indent += INDENT;
		list.forEach(function(key, i) {
			out += indent+fn(key)+(i < list.length-1 ? ',' : '')+'\n';
		});
		indent = indent.slice(0, -INDENT.length);

		return out + indent+end;
	};

	var visit = function(obj) {
		if (obj === undefined) return '';

		switch (type(obj)) {
			case 'boolean':
			return '<span class="json-markup-bool">'+obj+'</span>';

			case 'number':
			return '<span class="json-markup-number">'+obj+'</span>';

			case 'null':
			return '<span class="json-markup-null">null</span>';

			case 'string':
			return '<span class="json-markup-string">"'+escape(obj.replace(/\n/g, '\n'+indent))+'"</span>';

			case 'link':
			return '<span class="json-markup-string">"<a href="'+escape(obj)+'">'+escape(obj)+'</a>"</span>';

			case 'array':
			return forEach(obj, '[', ']', visit);

			case 'object':
			var keys = Object.keys(obj).filter(function(key) {
				return obj[key] !== undefined;
			});

			return forEach(keys, '{', '}', function(key) {
				return '<span class="json-markup-key">'+key + ':</span> '+visit(obj[key]);
			});
		}

		return '';
	};

	return '<div class="json-markup">'+visit(doc)+'</div>';
};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJicm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3BhdGgtYnJvd3NlcmlmeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvanNvbi1tYXJrdXAvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDNUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGpzb25NYXJrdXAgPSByZXF1aXJlKCdqc29uLW1hcmt1cCcpXG52YXIgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKVxuXG5hbmd1bGFyLm1vZHVsZSgnYXBwJywgWyd1aS5ib290c3RyYXAnLCAnbmdTYW5pdGl6ZSddKS5jb25maWcoZnVuY3Rpb24oJGh0dHBQcm92aWRlcil7XG4gICAgJGh0dHBQcm92aWRlci5kZWZhdWx0cy5oZWFkZXJzLmNvbW1vbltcIlgtUmVxdWVzdGVkLVdpdGhcIl0gPSAnWE1MSHR0cFJlcXVlc3QnO1xufSkuY29udHJvbGxlcignY29udHJvbGxlcicsIGZ1bmN0aW9uKCRzY29wZSwgJGh0dHAsICR0aW1lb3V0KXtcbiAgICAkaHR0cC5nZXQoJy9zY2hlbWEnKS50aGVuKGZ1bmN0aW9uKHJlcyl7XG4gICAgICAgICRzY29wZS5zY2hlbWEgPSBtYXBKU09OKHJlcy5kYXRhKVxuICAgIH0pXG5cbiAgICBmdW5jdGlvbiBtYXBKU09OKHNjaGVtYSkge1xuICAgICAgICAkc2NvcGUucmVzb3VyY2VzID0gW11cbiAgICAgICAgYnVpbGRGbGF0UmVzb3VyY2VzTGlzdChzY2hlbWEsIFwiXCIpXG4gICAgICAgICRzY29wZS5zaWRlYmFySXRlbXMgPSBidWlsZFNpZGViYXIoJHNjb3BlLnJlc291cmNlcylcbiAgICAgICAgXy5tYXAoJHNjb3BlLnJlc291cmNlcywgZnVuY3Rpb24gKHJlc291cmNlKSB7XG4gICAgICAgICAgICBtYXBSZXF1aXJlZE9udG9Qcm9wZXJ0aWVzKHJlc291cmNlKVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1aWxkRmxhdFJlc291cmNlc0xpc3QgKHNjaGVtYSwgcm9vdCkge1xuICAgICAgICBfLmZvckVhY2goXy5rZXlzKHNjaGVtYSksIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHZhciBpdGVtID0gc2NoZW1hW2tleV1cbiAgICAgICAgICAgIGlmIChfLmlzT2JqZWN0KGl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgXy5mb3JFYWNoKF8ua2V5cyhpdGVtKSwgZnVuY3Rpb24gKGspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGsgPT09ICdpZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1ba10gPSBwYXRoLmpvaW4ocm9vdCwgaXRlbVtrXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGl0ZW1ba10pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGsgPT09ICdyZXNvdXJjZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvb3QgPSBwYXRoLmpvaW4ocm9vdCwgaXRlbS5yb290KVxuICAgICAgICAgICAgICAgICAgICAgICAgYnVpbGRGbGF0UmVzb3VyY2VzTGlzdChpdGVtLCByb290KVxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbSA9IF8ub21pdChpdGVtLCBrKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChrZXkgPT09ICdyZXNvdXJjZScpIHtcbiAgICAgICAgICAgICAgICAkc2NvcGUucmVzb3VyY2VzLnB1c2goc2NoZW1hKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1aWxkU2lkZWJhciAocmVzb3VyY2VzKSB7XG4gICAgICAgIHJldHVybiBfLm1hcChyZXNvdXJjZXMsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGl0ZW0ucmVzb3VyY2UsXG4gICAgICAgICAgICAgICAgc3ViUmVzb3VyY2VzOiBfLmNoYWluKGl0ZW0pLmtleXMoKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgICAgICAvKiBtYXBwaW5nIHRoZSBuYW1lIG9mIHRoZSByZXNvdXJjZSBhbmQgdGhlIHVyaS4gbmFtZSBmb3IgdGhlIHRpdGxlIGluIHNpZGViYXIsIGlkICh1cmkpIGlzIHVzZWQgZm9yIGJvb2ttYXJraW5nIHRoZSBpdGVtICovXG4gICAgICAgICAgICAgICAgICAgIGlmIChpdGVtW2tleV0uaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogaXRlbVtrZXldLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGl0ZW1ba2V5XS5pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IGl0ZW1ba2V5XS5tZXRob2QsXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pLmZpbHRlcignbmFtZScpLnZhbHVlKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYXBSZXF1aXJlZE9udG9Qcm9wZXJ0aWVzIChyZXNvdXJjZSkge1xuICAgICAgICB2YXIgcHJvcGVydGllcyA9IF8uZ2V0KHJlc291cmNlLCAncHJvcGVydGllcycpXG4gICAgICAgIHZhciByZXF1aXJlZFByb3BlcnRpZXMgPSBfLmdldChyZXNvdXJjZSwgJ3JlcXVpcmVkJylcbiAgICAgICAgaWYgKHByb3BlcnRpZXMgJiYgcmVxdWlyZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICBfLmZvckVhY2gocmVxdWlyZWRQcm9wZXJ0aWVzLCBmdW5jdGlvbiAocHJvcGVydHlOYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIHByb3BlcnR5ID0gXy5nZXQocHJvcGVydGllcywgcHJvcGVydHlOYW1lKVxuICAgICAgICAgICAgICAgIGlmICghcHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgICAgICAgICAgICBcIlByb3BlcnR5IHtwcm9wfSBpcyBsaXN0ZWQgYXMgcmVxdWlyZWQgaW4gcmVzb3VyY2Uge3Jlc291cmNlfSwgYnV0IGlzIG5vdCBpbiB0aGUgc2NoZW1hXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKCd7cHJvcH0nLCBwcm9wZXJ0eU5hbWUpLnJlcGxhY2UoJ3tyZXNvdXJjZX0nLCBfLmdldChyZXNvdXJjZSwgJ25hbWUnKSlcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIF8ubWVyZ2UocHJvcGVydHksIHsgcmVxdWlyZWQ6IHRydWUgfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIC8qIGlmIHRoZXJlIGlzIGFuIG9iamVjdCwgcmVjdXJzZSBvbnRvIGl0ICovXG4gICAgICAgIF8uZm9yRWFjaChfLmtleXMocmVzb3VyY2UpLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICAvKiBpZiBpdCdzIGFuIG9iamVjdCwgZ28gZGVlcGVyICovXG4gICAgICAgICAgICBpZiAoXy5pc09iamVjdChyZXNvdXJjZVtrZXldKSkge1xuICAgICAgICAgICAgICAgIG1hcFJlcXVpcmVkT250b1Byb3BlcnRpZXMocmVzb3VyY2Vba2V5XSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChrZXkgPT09ICdpdGVtcycgJiYgXy5pc0FycmF5KHJlc291cmNlW2tleV0pKSB7XG4gICAgICAgICAgICAgICAgLyogaXRlbXMgY2FuIGhhdmUgYW4gYXJyYXkgb2Ygb2JqZWN0cywgc28gdHJlZSByZWN1cnNpb24gaGVyZSA6KSAqL1xuICAgICAgICAgICAgICAgIF8uZm9yRWFjaChyZXNvdXJjZVtrZXldLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICBtYXBSZXF1aXJlZE9udG9Qcm9wZXJ0aWVzKHJlc291cmNlW2tleV0pXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICAkc2NvcGUuZm9ybWF0VHlwZSA9IGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIHZhciB0eXBlID0gXy5nZXQoaXRlbSwgJ3R5cGUnKVxuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVcbiAgICAgICAgfSBlbHNlIGlmIChfLmdldChpdGVtLCAnYW55T2YnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdhbnlPZidcbiAgICAgICAgfSBlbHNlIGlmIChfLmdldChpdGVtLCAnYWxsT2YnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdhbGxPZidcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgJHNjb3BlLmZvcm1hdFNwZWNNZXRhID0gZnVuY3Rpb24gKHNwZWMpIHtcbiAgICAgICAgdmFyIGFueU9mID0gXy5nZXQoc3BlYywgJ2FueU9mJylcbiAgICAgICAgaWYgKGFueU9mKSB7XG4gICAgICAgICAgICByZXR1cm4gZm9ybWF0QXJyYXlNZXRhKGFueU9mKVxuICAgICAgICB9XG4gICAgICAgIHZhciBhbGxPZiA9IF8uZ2V0KHNwZWMsICdhbGxPZicpXG4gICAgICAgIGlmIChhbGxPZikge1xuICAgICAgICAgICAgcmV0dXJuIGZvcm1hdEFycmF5TWV0YShhbGxPZilcbiAgICAgICAgfVxuICAgICAgICBpZiAoIV8uaXNPYmplY3Qoc3BlYykpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG9taXR0ZWRTcGVjcyA9IF8ub21pdChzcGVjLCBbJ3R5cGUnLCAnZGVzY3JpcHRpb24nLCAnJCRoYXNoS2V5JywgJ3JlcXVpcmVkJywgJ2l0ZW1zJ10pXG4gICAgICAgIGlmICghXy5rZXlzKG9taXR0ZWRTcGVjcykubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfLm1hcChfLmtleXMob21pdHRlZFNwZWNzKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IG9taXR0ZWRTcGVjc1trZXldXG4gICAgICAgICAgICBpZiAoXy5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJzxzdHJvbmc+JytrZXkrJzo8L3N0cm9uZz4gJyt2YWwuam9pbignLCAnKVxuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXkgPT09ICdwYXR0ZXJuJykge1xuICAgICAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nK2tleSsnOjwvc3Ryb25nPiAnKycvdmFsLycucmVwbGFjZSgndmFsJywgdmFsKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICc8c3Ryb25nPicra2V5Kyc6PC9zdHJvbmc+ICcrdmFsXG4gICAgICAgIH0pLmpvaW4oJywgJylcbiAgICB9XG5cbiAgICAkc2NvcGUuZm9ybWF0Tm9uT2JqU3BlY01ldGEgPSBmdW5jdGlvbiAoc3BlYykge1xuICAgICAgICB2YXIgb21pdHRlZFNwZWNzID0gXy5vbWl0KHNwZWMsIFsndHlwZScsICdkZXNjcmlwdGlvbicsICckJGhhc2hLZXknLCAncmVxdWlyZWQnLCAnc3RhdHVzJ10pXG4gICAgICAgIGlmICghXy5rZXlzKG9taXR0ZWRTcGVjcykubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfLm1hcChfLmtleXMob21pdHRlZFNwZWNzKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuICc8c3Ryb25nPicra2V5Kyc6PC9zdHJvbmc+ICcrb21pdHRlZFNwZWNzW2tleV1cbiAgICAgICAgfSkuam9pbignLCAnKVxuICAgIH1cblxuICAgICRzY29wZS5odG1saWZ5SlNPTiA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIGpzb25NYXJrdXAob2JqKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZvcm1hdEFycmF5TWV0YSAoaXRlbXMpIHtcbiAgICAgICAgcmV0dXJuIF8ubWFwKGl0ZW1zLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgcmV0dXJuICd7JyArIF8ubWFwKF8ua2V5cyhpdGVtKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nK2tleSsnOjwvc3Ryb25nPiAnICsgaXRlbVtrZXldXG4gICAgICAgICAgICB9KS5qb2luKCcsICcpXG4gICAgICAgIH0pLmpvaW4oJ30sICcpICsgJ30nXG4gICAgfVxufSlcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyByZXNvbHZlcyAuIGFuZCAuLiBlbGVtZW50cyBpbiBhIHBhdGggYXJyYXkgd2l0aCBkaXJlY3RvcnkgbmFtZXMgdGhlcmVcbi8vIG11c3QgYmUgbm8gc2xhc2hlcywgZW1wdHkgZWxlbWVudHMsIG9yIGRldmljZSBuYW1lcyAoYzpcXCkgaW4gdGhlIGFycmF5XG4vLyAoc28gYWxzbyBubyBsZWFkaW5nIGFuZCB0cmFpbGluZyBzbGFzaGVzIC0gaXQgZG9lcyBub3QgZGlzdGluZ3Vpc2hcbi8vIHJlbGF0aXZlIGFuZCBhYnNvbHV0ZSBwYXRocylcbmZ1bmN0aW9uIG5vcm1hbGl6ZUFycmF5KHBhcnRzLCBhbGxvd0Fib3ZlUm9vdCkge1xuICAvLyBpZiB0aGUgcGF0aCB0cmllcyB0byBnbyBhYm92ZSB0aGUgcm9vdCwgYHVwYCBlbmRzIHVwID4gMFxuICB2YXIgdXAgPSAwO1xuICBmb3IgKHZhciBpID0gcGFydHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICB2YXIgbGFzdCA9IHBhcnRzW2ldO1xuICAgIGlmIChsYXN0ID09PSAnLicpIHtcbiAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICB9IGVsc2UgaWYgKGxhc3QgPT09ICcuLicpIHtcbiAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICAgIHVwKys7XG4gICAgfSBlbHNlIGlmICh1cCkge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgICAgdXAtLTtcbiAgICB9XG4gIH1cblxuICAvLyBpZiB0aGUgcGF0aCBpcyBhbGxvd2VkIHRvIGdvIGFib3ZlIHRoZSByb290LCByZXN0b3JlIGxlYWRpbmcgLi5zXG4gIGlmIChhbGxvd0Fib3ZlUm9vdCkge1xuICAgIGZvciAoOyB1cC0tOyB1cCkge1xuICAgICAgcGFydHMudW5zaGlmdCgnLi4nKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGFydHM7XG59XG5cbi8vIFNwbGl0IGEgZmlsZW5hbWUgaW50byBbcm9vdCwgZGlyLCBiYXNlbmFtZSwgZXh0XSwgdW5peCB2ZXJzaW9uXG4vLyAncm9vdCcgaXMganVzdCBhIHNsYXNoLCBvciBub3RoaW5nLlxudmFyIHNwbGl0UGF0aFJlID1cbiAgICAvXihcXC8/fCkoW1xcc1xcU10qPykoKD86XFwuezEsMn18W15cXC9dKz98KShcXC5bXi5cXC9dKnwpKSg/OltcXC9dKikkLztcbnZhciBzcGxpdFBhdGggPSBmdW5jdGlvbihmaWxlbmFtZSkge1xuICByZXR1cm4gc3BsaXRQYXRoUmUuZXhlYyhmaWxlbmFtZSkuc2xpY2UoMSk7XG59O1xuXG4vLyBwYXRoLnJlc29sdmUoW2Zyb20gLi4uXSwgdG8pXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLnJlc29sdmUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHJlc29sdmVkUGF0aCA9ICcnLFxuICAgICAgcmVzb2x2ZWRBYnNvbHV0ZSA9IGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTsgaSA+PSAtMSAmJiAhcmVzb2x2ZWRBYnNvbHV0ZTsgaS0tKSB7XG4gICAgdmFyIHBhdGggPSAoaSA+PSAwKSA/IGFyZ3VtZW50c1tpXSA6IHByb2Nlc3MuY3dkKCk7XG5cbiAgICAvLyBTa2lwIGVtcHR5IGFuZCBpbnZhbGlkIGVudHJpZXNcbiAgICBpZiAodHlwZW9mIHBhdGggIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgdG8gcGF0aC5yZXNvbHZlIG11c3QgYmUgc3RyaW5ncycpO1xuICAgIH0gZWxzZSBpZiAoIXBhdGgpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHJlc29sdmVkUGF0aCA9IHBhdGggKyAnLycgKyByZXNvbHZlZFBhdGg7XG4gICAgcmVzb2x2ZWRBYnNvbHV0ZSA9IHBhdGguY2hhckF0KDApID09PSAnLyc7XG4gIH1cblxuICAvLyBBdCB0aGlzIHBvaW50IHRoZSBwYXRoIHNob3VsZCBiZSByZXNvbHZlZCB0byBhIGZ1bGwgYWJzb2x1dGUgcGF0aCwgYnV0XG4gIC8vIGhhbmRsZSByZWxhdGl2ZSBwYXRocyB0byBiZSBzYWZlIChtaWdodCBoYXBwZW4gd2hlbiBwcm9jZXNzLmN3ZCgpIGZhaWxzKVxuXG4gIC8vIE5vcm1hbGl6ZSB0aGUgcGF0aFxuICByZXNvbHZlZFBhdGggPSBub3JtYWxpemVBcnJheShmaWx0ZXIocmVzb2x2ZWRQYXRoLnNwbGl0KCcvJyksIGZ1bmN0aW9uKHApIHtcbiAgICByZXR1cm4gISFwO1xuICB9KSwgIXJlc29sdmVkQWJzb2x1dGUpLmpvaW4oJy8nKTtcblxuICByZXR1cm4gKChyZXNvbHZlZEFic29sdXRlID8gJy8nIDogJycpICsgcmVzb2x2ZWRQYXRoKSB8fCAnLic7XG59O1xuXG4vLyBwYXRoLm5vcm1hbGl6ZShwYXRoKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5ub3JtYWxpemUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHZhciBpc0Fic29sdXRlID0gZXhwb3J0cy5pc0Fic29sdXRlKHBhdGgpLFxuICAgICAgdHJhaWxpbmdTbGFzaCA9IHN1YnN0cihwYXRoLCAtMSkgPT09ICcvJztcblxuICAvLyBOb3JtYWxpemUgdGhlIHBhdGhcbiAgcGF0aCA9IG5vcm1hbGl6ZUFycmF5KGZpbHRlcihwYXRoLnNwbGl0KCcvJyksIGZ1bmN0aW9uKHApIHtcbiAgICByZXR1cm4gISFwO1xuICB9KSwgIWlzQWJzb2x1dGUpLmpvaW4oJy8nKTtcblxuICBpZiAoIXBhdGggJiYgIWlzQWJzb2x1dGUpIHtcbiAgICBwYXRoID0gJy4nO1xuICB9XG4gIGlmIChwYXRoICYmIHRyYWlsaW5nU2xhc2gpIHtcbiAgICBwYXRoICs9ICcvJztcbiAgfVxuXG4gIHJldHVybiAoaXNBYnNvbHV0ZSA/ICcvJyA6ICcnKSArIHBhdGg7XG59O1xuXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLmlzQWJzb2x1dGUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHJldHVybiBwYXRoLmNoYXJBdCgwKSA9PT0gJy8nO1xufTtcblxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5qb2luID0gZnVuY3Rpb24oKSB7XG4gIHZhciBwYXRocyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG4gIHJldHVybiBleHBvcnRzLm5vcm1hbGl6ZShmaWx0ZXIocGF0aHMsIGZ1bmN0aW9uKHAsIGluZGV4KSB7XG4gICAgaWYgKHR5cGVvZiBwICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIHRvIHBhdGguam9pbiBtdXN0IGJlIHN0cmluZ3MnKTtcbiAgICB9XG4gICAgcmV0dXJuIHA7XG4gIH0pLmpvaW4oJy8nKSk7XG59O1xuXG5cbi8vIHBhdGgucmVsYXRpdmUoZnJvbSwgdG8pXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLnJlbGF0aXZlID0gZnVuY3Rpb24oZnJvbSwgdG8pIHtcbiAgZnJvbSA9IGV4cG9ydHMucmVzb2x2ZShmcm9tKS5zdWJzdHIoMSk7XG4gIHRvID0gZXhwb3J0cy5yZXNvbHZlKHRvKS5zdWJzdHIoMSk7XG5cbiAgZnVuY3Rpb24gdHJpbShhcnIpIHtcbiAgICB2YXIgc3RhcnQgPSAwO1xuICAgIGZvciAoOyBzdGFydCA8IGFyci5sZW5ndGg7IHN0YXJ0KyspIHtcbiAgICAgIGlmIChhcnJbc3RhcnRdICE9PSAnJykgYnJlYWs7XG4gICAgfVxuXG4gICAgdmFyIGVuZCA9IGFyci5sZW5ndGggLSAxO1xuICAgIGZvciAoOyBlbmQgPj0gMDsgZW5kLS0pIHtcbiAgICAgIGlmIChhcnJbZW5kXSAhPT0gJycpIGJyZWFrO1xuICAgIH1cblxuICAgIGlmIChzdGFydCA+IGVuZCkgcmV0dXJuIFtdO1xuICAgIHJldHVybiBhcnIuc2xpY2Uoc3RhcnQsIGVuZCAtIHN0YXJ0ICsgMSk7XG4gIH1cblxuICB2YXIgZnJvbVBhcnRzID0gdHJpbShmcm9tLnNwbGl0KCcvJykpO1xuICB2YXIgdG9QYXJ0cyA9IHRyaW0odG8uc3BsaXQoJy8nKSk7XG5cbiAgdmFyIGxlbmd0aCA9IE1hdGgubWluKGZyb21QYXJ0cy5sZW5ndGgsIHRvUGFydHMubGVuZ3RoKTtcbiAgdmFyIHNhbWVQYXJ0c0xlbmd0aCA9IGxlbmd0aDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmIChmcm9tUGFydHNbaV0gIT09IHRvUGFydHNbaV0pIHtcbiAgICAgIHNhbWVQYXJ0c0xlbmd0aCA9IGk7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICB2YXIgb3V0cHV0UGFydHMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IHNhbWVQYXJ0c0xlbmd0aDsgaSA8IGZyb21QYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgIG91dHB1dFBhcnRzLnB1c2goJy4uJyk7XG4gIH1cblxuICBvdXRwdXRQYXJ0cyA9IG91dHB1dFBhcnRzLmNvbmNhdCh0b1BhcnRzLnNsaWNlKHNhbWVQYXJ0c0xlbmd0aCkpO1xuXG4gIHJldHVybiBvdXRwdXRQYXJ0cy5qb2luKCcvJyk7XG59O1xuXG5leHBvcnRzLnNlcCA9ICcvJztcbmV4cG9ydHMuZGVsaW1pdGVyID0gJzonO1xuXG5leHBvcnRzLmRpcm5hbWUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHZhciByZXN1bHQgPSBzcGxpdFBhdGgocGF0aCksXG4gICAgICByb290ID0gcmVzdWx0WzBdLFxuICAgICAgZGlyID0gcmVzdWx0WzFdO1xuXG4gIGlmICghcm9vdCAmJiAhZGlyKSB7XG4gICAgLy8gTm8gZGlybmFtZSB3aGF0c29ldmVyXG4gICAgcmV0dXJuICcuJztcbiAgfVxuXG4gIGlmIChkaXIpIHtcbiAgICAvLyBJdCBoYXMgYSBkaXJuYW1lLCBzdHJpcCB0cmFpbGluZyBzbGFzaFxuICAgIGRpciA9IGRpci5zdWJzdHIoMCwgZGlyLmxlbmd0aCAtIDEpO1xuICB9XG5cbiAgcmV0dXJuIHJvb3QgKyBkaXI7XG59O1xuXG5cbmV4cG9ydHMuYmFzZW5hbWUgPSBmdW5jdGlvbihwYXRoLCBleHQpIHtcbiAgdmFyIGYgPSBzcGxpdFBhdGgocGF0aClbMl07XG4gIC8vIFRPRE86IG1ha2UgdGhpcyBjb21wYXJpc29uIGNhc2UtaW5zZW5zaXRpdmUgb24gd2luZG93cz9cbiAgaWYgKGV4dCAmJiBmLnN1YnN0cigtMSAqIGV4dC5sZW5ndGgpID09PSBleHQpIHtcbiAgICBmID0gZi5zdWJzdHIoMCwgZi5sZW5ndGggLSBleHQubGVuZ3RoKTtcbiAgfVxuICByZXR1cm4gZjtcbn07XG5cblxuZXhwb3J0cy5leHRuYW1lID0gZnVuY3Rpb24ocGF0aCkge1xuICByZXR1cm4gc3BsaXRQYXRoKHBhdGgpWzNdO1xufTtcblxuZnVuY3Rpb24gZmlsdGVyICh4cywgZikge1xuICAgIGlmICh4cy5maWx0ZXIpIHJldHVybiB4cy5maWx0ZXIoZik7XG4gICAgdmFyIHJlcyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGYoeHNbaV0sIGksIHhzKSkgcmVzLnB1c2goeHNbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xufVxuXG4vLyBTdHJpbmcucHJvdG90eXBlLnN1YnN0ciAtIG5lZ2F0aXZlIGluZGV4IGRvbid0IHdvcmsgaW4gSUU4XG52YXIgc3Vic3RyID0gJ2FiJy5zdWJzdHIoLTEpID09PSAnYidcbiAgICA/IGZ1bmN0aW9uIChzdHIsIHN0YXJ0LCBsZW4pIHsgcmV0dXJuIHN0ci5zdWJzdHIoc3RhcnQsIGxlbikgfVxuICAgIDogZnVuY3Rpb24gKHN0ciwgc3RhcnQsIGxlbikge1xuICAgICAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IHN0ci5sZW5ndGggKyBzdGFydDtcbiAgICAgICAgcmV0dXJuIHN0ci5zdWJzdHIoc3RhcnQsIGxlbik7XG4gICAgfVxuO1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJ2YXIgSU5ERU5UID0gJyAgICAnO1xuXG52YXIgdHlwZSA9IGZ1bmN0aW9uKGRvYykge1xuXHRpZiAoZG9jID09PSBudWxsKSByZXR1cm4gJ251bGwnO1xuXHRpZiAoQXJyYXkuaXNBcnJheShkb2MpKSByZXR1cm4gJ2FycmF5Jztcblx0aWYgKHR5cGVvZiBkb2MgPT09ICdzdHJpbmcnICYmIC9eaHR0cHM/Oi8udGVzdChkb2MpKSByZXR1cm4gJ2xpbmsnO1xuXG5cdHJldHVybiB0eXBlb2YgZG9jO1xufTtcblxudmFyIGVzY2FwZSA9IGZ1bmN0aW9uKHN0cikge1xuXHRyZXR1cm4gc3RyLnJlcGxhY2UoLzwvZywgJyZsdDsnKS5yZXBsYWNlKC8+L2csICcmZ3Q7Jyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGRvYykge1xuXHR2YXIgaW5kZW50ID0gJyc7XG5cblx0dmFyIGZvckVhY2ggPSBmdW5jdGlvbihsaXN0LCBzdGFydCwgZW5kLCBmbikge1xuXHRcdGlmICghbGlzdC5sZW5ndGgpIHJldHVybiBzdGFydCsnICcrZW5kO1xuXG5cdFx0dmFyIG91dCA9IHN0YXJ0KydcXG4nO1xuXG5cdFx0aW5kZW50ICs9IElOREVOVDtcblx0XHRsaXN0LmZvckVhY2goZnVuY3Rpb24oa2V5LCBpKSB7XG5cdFx0XHRvdXQgKz0gaW5kZW50K2ZuKGtleSkrKGkgPCBsaXN0Lmxlbmd0aC0xID8gJywnIDogJycpKydcXG4nO1xuXHRcdH0pO1xuXHRcdGluZGVudCA9IGluZGVudC5zbGljZSgwLCAtSU5ERU5ULmxlbmd0aCk7XG5cblx0XHRyZXR1cm4gb3V0ICsgaW5kZW50K2VuZDtcblx0fTtcblxuXHR2YXIgdmlzaXQgPSBmdW5jdGlvbihvYmopIHtcblx0XHRpZiAob2JqID09PSB1bmRlZmluZWQpIHJldHVybiAnJztcblxuXHRcdHN3aXRjaCAodHlwZShvYmopKSB7XG5cdFx0XHRjYXNlICdib29sZWFuJzpcblx0XHRcdHJldHVybiAnPHNwYW4gY2xhc3M9XCJqc29uLW1hcmt1cC1ib29sXCI+JytvYmorJzwvc3Bhbj4nO1xuXG5cdFx0XHRjYXNlICdudW1iZXInOlxuXHRcdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cImpzb24tbWFya3VwLW51bWJlclwiPicrb2JqKyc8L3NwYW4+JztcblxuXHRcdFx0Y2FzZSAnbnVsbCc6XG5cdFx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwianNvbi1tYXJrdXAtbnVsbFwiPm51bGw8L3NwYW4+JztcblxuXHRcdFx0Y2FzZSAnc3RyaW5nJzpcblx0XHRcdHJldHVybiAnPHNwYW4gY2xhc3M9XCJqc29uLW1hcmt1cC1zdHJpbmdcIj5cIicrZXNjYXBlKG9iai5yZXBsYWNlKC9cXG4vZywgJ1xcbicraW5kZW50KSkrJ1wiPC9zcGFuPic7XG5cblx0XHRcdGNhc2UgJ2xpbmsnOlxuXHRcdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cImpzb24tbWFya3VwLXN0cmluZ1wiPlwiPGEgaHJlZj1cIicrZXNjYXBlKG9iaikrJ1wiPicrZXNjYXBlKG9iaikrJzwvYT5cIjwvc3Bhbj4nO1xuXG5cdFx0XHRjYXNlICdhcnJheSc6XG5cdFx0XHRyZXR1cm4gZm9yRWFjaChvYmosICdbJywgJ10nLCB2aXNpdCk7XG5cblx0XHRcdGNhc2UgJ29iamVjdCc6XG5cdFx0XHR2YXIga2V5cyA9IE9iamVjdC5rZXlzKG9iaikuZmlsdGVyKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0XHRyZXR1cm4gb2JqW2tleV0gIT09IHVuZGVmaW5lZDtcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gZm9yRWFjaChrZXlzLCAneycsICd9JywgZnVuY3Rpb24oa2V5KSB7XG5cdFx0XHRcdHJldHVybiAnPHNwYW4gY2xhc3M9XCJqc29uLW1hcmt1cC1rZXlcIj4nK2tleSArICc6PC9zcGFuPiAnK3Zpc2l0KG9ialtrZXldKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiAnJztcblx0fTtcblxuXHRyZXR1cm4gJzxkaXYgY2xhc3M9XCJqc29uLW1hcmt1cFwiPicrdmlzaXQoZG9jKSsnPC9kaXY+Jztcbn07XG4iXX0=
