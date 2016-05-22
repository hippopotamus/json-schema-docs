(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var jsonMarkup = require('json-markup')
var JsonPointer = require('json-ptr')

angular.module('app', ['ui.bootstrap', 'ngSanitize']).config(function($httpProvider){
    $httpProvider.defaults.headers.common["X-Requested-With"] = 'XMLHttpRequest';
}).controller('controller', function($scope, $http, $timeout){
    $http.get('/schema').then(function(res){
        $scope.schema = mapJSON(res.data)
    })

    function mapJSON(schema) {
        /* i could optimize this pretty easily. if it eats your browser, let me know, and i'll make it better... if you're reading this, you could probably do it too.
        i will happily do it for someone who found this useful. */
        replaceRefs(schema)

        $scope.resources = []
        buildFlatResourcesList(schema)
        $scope.sidebarItems = buildSidebar($scope.resources)
        _.map($scope.resources, function (resource) {
            mapRequiredOntoProperties(resource)
        })
    }

    function replaceRefs (schema) {
        /* This crawls the JSON schema for all $refs, and replaces them with the schema they're referencing */
        /* Maybe I'm misunderstanding JSON pointers. I was hoping I there was some magic JSON ptr api fn that replaces all $refs with the obj they reference */
        var ptr = JsonPointer.noConflict()
        _.forEach(_.keys(ptr.flatten(schema)), function (item) {
             var pathList = ptr.decode(item)
             if (pathList[pathList.length-1] === '$ref') {
                var objPath = '#/' + _.slice(pathList, 0, pathList.length-1).join('/') // building abs path to item with a $ref
                ptr.set(schema, objPath, ptr.get(schema, ptr.get(schema, item))) // set that item to the schema referenced in it's $ref
             }
        })
    }

    function buildFlatResourcesList (schema) {
        _.forEach(_.keys(schema), function (key) {
            var item = schema[key]
            if (_.isObject(item)) {
                _.forEach(_.keys(item), function (k) {
                    if (k === 'resource') {
                        buildFlatResourcesList(item)
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
                    return {
                        name: item[key].name,
                        id: item[key].id,
                        method: item[key].method,
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
            return '<strong>'+key+':</strong> '+omittedSpecs[key]
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

},{"json-markup":2,"json-ptr":3}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
'use strict';

(function() {
  var root = this; // either the module or the window (in a browser)
  var savedJsonPointer = root.JsonPointer;

  function replace(str, find, repl) {
    // modified from http://jsperf.com/javascript-replace-all/10
    var orig = str.toString();
    var res = '';
    var rem = orig;
    var beg = 0;
    var end = -1;
    while ((end = rem.indexOf(find)) > -1) {
      res += orig.substring(beg, beg + end) + repl;
      rem = rem.substring(end + find.length, rem.length);
      beg += end + find.length;
    }
    if (rem.length > 0) {
      res += orig.substring(orig.length - rem.length, orig.length);
    }
    return res;
  }

  function decodeFragmentSegments(segments) {
    var i = -1;
    var len = segments.length;
    var res = new Array(len);
    while (++i < len) {
      res[i] = replace(replace(decodeURIComponent('' + segments[i]), '~1', '/'), '~0', '~');
    }
    return res;
  }

  function encodeFragmentSegments(segments) {
    var i = -1;
    var len = segments.length;
    var res = new Array(len);
    while (++i < len) {
      if (typeof segments[i] === 'string') {
        res[i] = encodeURIComponent(replace(replace(segments[i], '~', '~0'), '/', '~1'));
      } else {
        res[i] = segments[i];
      }
    }
    return res;
  }

  function decodePointerSegments(segments) {
    var i = -1;
    var len = segments.length;
    var res = new Array(len);
    while (++i < len) {
      res[i] = replace(replace(segments[i], '~1', '/'), '~0', '~');
    }
    return res;
  }

  function encodePointerSegments(segments) {
    var i = -1;
    var len = segments.length;
    var res = new Array(len);
    while (++i < len) {
      if (typeof segments[i] === 'string') {
        res[i] = replace(replace(segments[i], '~', '~0'), '/', '~1');
      } else {
        res[i] = segments[i];
      }
    }
    return res;
  }

  function decodePointer(ptr) {
    if (typeof ptr !== 'string') {
      throw new TypeError('Invalid type: JSON Pointers are represented as strings.');
    }
    if (ptr.length === 0) {
      return [];
    }
    if (ptr[0] !== '/') {
      throw new ReferenceError('Invalid JSON Pointer syntax. Non-empty pointer must begin with a solidus `/`.');
    }
    return decodePointerSegments(ptr.substring(1).split('/'));
  }

  function encodePointer(path) {
    if (path && !Array.isArray(path)) {
      throw new TypeError('Invalid type: path must be an array of segments.');
    }
    if (path.length === 0) {
      return '';
    }
    return '/'.concat(encodePointerSegments(path).join('/'));
  }

  function decodeUriFragmentIdentifier(ptr) {
    if (typeof ptr !== 'string') {
      throw new TypeError('Invalid type: JSON Pointers are represented as strings.');
    }
    if (ptr.length === 0 || ptr[0] !== '#') {
      throw new ReferenceError('Invalid JSON Pointer syntax; URI fragment idetifiers must begin with a hash.');
    }
    if (ptr.length === 1) {
      return [];
    }
    if (ptr[1] !== '/') {
      throw new ReferenceError('Invalid JSON Pointer syntax.');
    }
    return decodeFragmentSegments(ptr.substring(2).split('/'));
  }

  function encodeUriFragmentIdentifier(path) {
    if (path && !Array.isArray(path)) {
      throw new TypeError('Invalid type: path must be an array of segments.');
    }
    if (path.length === 0) {
      return '#';
    }
    return '#/'.concat(encodeFragmentSegments(path).join('/'));
  }

  function toArrayIndexReference(arr, idx) {
    var len = idx.length;
    var cursor = 0;
    if (len === 0 || len > 1 && idx[0] === '0') {
      return -1;
    }
    if (len === 1 && idx[0] === '-') {
      return arr.length;
    }

    while (++cursor < len) {
      if (idx[cursor] < '0' || idx[cursor] > '9') {
        return -1;
      }
    }
    return parseInt(idx, 10);
  }

  function hasValueAtPath(target, path) {
    var it;
    var len;
    var cursor;
    var step;
    var p;
    if (typeof target !== 'undefined') {
      it = target;
      len = path.length;
      cursor = -1;
      if (len) {
        while (++cursor < len && it) {
          step = path[cursor];
          if (Array.isArray(it)) {
            if (isNaN(step) || !isFinite(step)) {
              break;
            }
            p = toArrayIndexReference(it, step);
            if (it.length > p) {
              it = it[p];
            } else {
              break;
            }
          } else {
            it = it[step];
          }
        }
      }
      return cursor === len && typeof it !== 'undefined';
    }
    return false;
  }

  function getValueAtPath(target, path) {
    var it;
    var len;
    var cursor;
    var step;
    var p;
    var nonexistent = undefined;
    if (typeof target !== 'undefined') {
      it = target;
      len = path.length;
      cursor = -1;
      if (len) {
        while (++cursor < len && it) {
          step = path[cursor];
          if (Array.isArray(it)) {
            if (isNaN(step) || !isFinite(step)) {
              return nonexistent;
            }
            p = toArrayIndexReference(it, step);
            if (it.length > p) {
              it = it[p];
            } else {
              return nonexistent;
            }
          } else {
            it = it[step];
          }
        }
      }
      return it;
    }
    return nonexistent;
  }

  function compilePointerDereference(path) {
    let body = `if (typeof(obj) !== 'undefined'`;
    if (path.length === 0) {
      return function(root) {
        return root;
      };
    }
    body = path.reduce((body, p, i) => {
      return `${body} &&
    typeof((obj = obj['${replace(path[i], '\\', '\\\\')}'])) !== 'undefined'`;
    }, `if (typeof(obj) !== 'undefined'`);
    body = `${body}) {
  return obj;
}`;
    return new Function(['obj'], body); // eslint-disable-line no-new-func
  }

  function setValueAtPath(target, val, path, force) {
    var it;
    var len;
    var end;
    var cursor;
    var step;
    var p;
    var rem;
    var nonexistent = undefined;
    if (path.length === 0) {
      throw new Error('Cannot set the root object; assign it directly.');
    }
    if (typeof target === 'undefined') {
      throw TypeError('Cannot set values on undefined');
    }
    it = target;
    len = path.length;
    end = path.length - 1;
    cursor = -1;
    if (len) {
      while (++cursor < len) {
        step = path[cursor];
        if (Array.isArray(it)) {
          p = toArrayIndexReference(it, step);
          if (it.length > p) {
            if (cursor === end) {
              rem = it[p];
              it[p] = val;
              return rem;
            }
            it = it[p];
          } else if (it.length === p) {
            it.push(val);
            return nonexistent;
          }
        } else {
          if (typeof it[step] === 'undefined') {
            if (force) {
              if (cursor === end) {
                it[step] = val;
                return nonexistent;
              }
              it = it[step] = {};
              continue;
            }
            return nonexistent;
          }
          if (cursor === end) {
            rem = it[step];
            it[step] = val;
            return rem;
          }
          it = it[step];
        }
      }
    }
    return it;
  }

  function looksLikeFragment(ptr) {
    return ptr && ptr.length && ptr[0] === '#';
  }

  function pickDecoder(ptr) {
    return (looksLikeFragment(ptr)) ? decodeUriFragmentIdentifier : decodePointer;
  }

  let $path = Symbol();
  let $orig = Symbol();
  let $pointer = Symbol();
  let $fragmentId = Symbol();

  class JsonPointer {

    constructor(ptr) {
      this[$orig] = ptr;
      this[$path] = (Array.isArray(ptr)) ? ptr : pickDecoder(ptr)(ptr);
      Object.defineProperty(this, 'get', {
        enumerable: true,
        value: compilePointerDereference(this.path)
      });
    }

    get path() {
      return this[$path];
    }

    get pointer() {
      if (!this[$pointer]) {
        this[$pointer] = encodePointer(this.path);
      }
      return this[$pointer];
    }

    get uriFragmentIdentifier() {
      if (!this[$fragmentId]) {
        this[$fragmentId] = encodeUriFragmentIdentifier(this.path);
      }
      return this[$fragmentId];
    }

    has(target) {
      return typeof(this.get(target)) != 'undefined';
    }

  }

  class JsonReference {

    constructor(pointer) {
      this[$pointer] = pointer;
    }

    get $ref() {
      return this[$pointer].uriFragmentIdentifier;
    }

    resolve(target) {
      return this[$pointer].get(target);
    }

    toString() {
      return this.$ref;
    }

  }

  JsonReference.isReference = function(obj) {
    return obj && obj instanceof JsonReference ||
      (typeof obj.$ref === 'string' &&
        typeof obj.resolve === 'function');
  };

  function visit(target, visitor, cycle) {
    var items, i, ilen, j, jlen, it, path, cursor, typeT;
    var distinctObjects;
    var q = new Array();
    var qcursor = 0;
    q.push({
      obj: target,
      path: []
    });
    if (cycle) {
      distinctObjects = new Map();
    }
    visitor(encodePointer([]), target);
    while (qcursor < q.length) {
      cursor = q[qcursor++];
      typeT = typeof cursor.obj;
      if (typeT === 'object' && cursor.obj !== null) {
        if (Array.isArray(cursor.obj)) {
          j = -1;
          jlen = cursor.obj.length;
          while (++j < jlen) {
            it = cursor.obj[j];
            path = cursor.path.concat(j);
            if (typeof it === 'object' && it !== null) {
              if (cycle && distinctObjects.has(it)) {
                visitor(encodePointer(path), new JsonReference(distinctObjects.get(it)));
                continue;
              }
              q.push({
                obj: it,
                path: path
              });
              if (cycle) {
                distinctObjects.set(it, new JsonPointer(encodeUriFragmentIdentifier(path)));
              }
            }
            visitor(encodePointer(path), it);
          }
        } else {
          items = Object.keys(cursor.obj);
          ilen = items.length;
          i = -1;
          while (++i < ilen) {
            it = cursor.obj[items[i]];
            path = cursor.path.concat(items[i]);
            if (typeof it === 'object' && it !== null) {
              if (cycle && distinctObjects.has(it)) {
                visitor(encodePointer(path), new JsonReference(distinctObjects.get(it)));
                continue;
              }
              q.push({
                obj: it,
                path: path
              });
              if (cycle) {
                distinctObjects.set(it, new JsonPointer(encodeUriFragmentIdentifier(path)));
              }
            }
            visitor(encodePointer(path), it);
          }
        }
      }
    }
  }

  JsonPointer.prototype.set = function(target, value, force) {
    return setValueAtPath(target, value, this.path, force);
  };

  JsonPointer.prototype.toString = function() {
    return this.original;
  };

  JsonPointer.create = function(ptr) {
    return new JsonPointer(ptr);
  };

  JsonPointer.has = function(target, ptr) {
    return hasValueAtPath(target, pickDecoder(ptr)(ptr));
  };

  JsonPointer.get = function(target, ptr) {
    return getValueAtPath(target, pickDecoder(ptr)(ptr));
  };

  JsonPointer.set = function(target, ptr, val, force) {
    return setValueAtPath(target, val, pickDecoder(ptr)(ptr), force);
  };

  JsonPointer.list = function(target, fragmentId) {
    var res = [];
    var visitor = (fragmentId) ?
      function(ptr, val) {
        res.push({
          fragmentId: encodeUriFragmentIdentifier(decodePointer(ptr)),
          value: val
        });
      } :
      function(ptr, val) {
        res.push({
          pointer: ptr,
          value: val
        });
      };
    visit(target, visitor);
    return res;
  };

  JsonPointer.flatten = function(target, fragmentId) {
    var res = {};
    var visitor = (fragmentId) ?
      function(ptr, val) {
        res[encodeUriFragmentIdentifier(decodePointer(ptr))] = val;
      } :
      function(ptr, val) {
        res[ptr] = val;
      };
    visit(target, visitor);
    return res;
  };

  JsonPointer.map = function(target, fragmentId) {
    var res = new Map();
    var visitor = (fragmentId) ?
      function(ptr, val) {
        res.set(encodeUriFragmentIdentifier(decodePointer(ptr)), val);
      } : res.set.bind(res);
    visit(target, visitor);
    return res;
  };

  JsonPointer.visit = visit;

  JsonPointer.decode = function(ptr) {
    return pickDecoder(ptr)(ptr);
  };

  JsonPointer.decodePointer = decodePointer;
  JsonPointer.encodePointer = encodePointer;
  JsonPointer.decodeUriFragmentIdentifier = decodeUriFragmentIdentifier;
  JsonPointer.encodeUriFragmentIdentifier = encodeUriFragmentIdentifier;

  JsonPointer.JsonReference = JsonReference;
  JsonPointer.isReference = JsonReference.isReference;

  JsonPointer.noConflict = function() {
    root.JsonPointer = savedJsonPointer;
    return JsonPointer;
  };

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = JsonPointer;
    }
    exports.JsonPointer = JsonPointer;
  } else {
    root.JsonPointer = JsonPointer;
  }
}).call(this); // eslint-disable-line no-invalid-this

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJicm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2pzb24tbWFya3VwL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2pzb24tcHRyL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGpzb25NYXJrdXAgPSByZXF1aXJlKCdqc29uLW1hcmt1cCcpXG52YXIgSnNvblBvaW50ZXIgPSByZXF1aXJlKCdqc29uLXB0cicpXG5cbmFuZ3VsYXIubW9kdWxlKCdhcHAnLCBbJ3VpLmJvb3RzdHJhcCcsICduZ1Nhbml0aXplJ10pLmNvbmZpZyhmdW5jdGlvbigkaHR0cFByb3ZpZGVyKXtcbiAgICAkaHR0cFByb3ZpZGVyLmRlZmF1bHRzLmhlYWRlcnMuY29tbW9uW1wiWC1SZXF1ZXN0ZWQtV2l0aFwiXSA9ICdYTUxIdHRwUmVxdWVzdCc7XG59KS5jb250cm9sbGVyKCdjb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCAkaHR0cCwgJHRpbWVvdXQpe1xuICAgICRodHRwLmdldCgnL3NjaGVtYScpLnRoZW4oZnVuY3Rpb24ocmVzKXtcbiAgICAgICAgJHNjb3BlLnNjaGVtYSA9IG1hcEpTT04ocmVzLmRhdGEpXG4gICAgfSlcblxuICAgIGZ1bmN0aW9uIG1hcEpTT04oc2NoZW1hKSB7XG4gICAgICAgIC8qIGkgY291bGQgb3B0aW1pemUgdGhpcyBwcmV0dHkgZWFzaWx5LiBpZiBpdCBlYXRzIHlvdXIgYnJvd3NlciwgbGV0IG1lIGtub3csIGFuZCBpJ2xsIG1ha2UgaXQgYmV0dGVyLi4uIGlmIHlvdSdyZSByZWFkaW5nIHRoaXMsIHlvdSBjb3VsZCBwcm9iYWJseSBkbyBpdCB0b28uXG4gICAgICAgIGkgd2lsbCBoYXBwaWx5IGRvIGl0IGZvciBzb21lb25lIHdobyBmb3VuZCB0aGlzIHVzZWZ1bC4gKi9cbiAgICAgICAgcmVwbGFjZVJlZnMoc2NoZW1hKVxuXG4gICAgICAgICRzY29wZS5yZXNvdXJjZXMgPSBbXVxuICAgICAgICBidWlsZEZsYXRSZXNvdXJjZXNMaXN0KHNjaGVtYSlcbiAgICAgICAgJHNjb3BlLnNpZGViYXJJdGVtcyA9IGJ1aWxkU2lkZWJhcigkc2NvcGUucmVzb3VyY2VzKVxuICAgICAgICBfLm1hcCgkc2NvcGUucmVzb3VyY2VzLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgIG1hcFJlcXVpcmVkT250b1Byb3BlcnRpZXMocmVzb3VyY2UpXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVwbGFjZVJlZnMgKHNjaGVtYSkge1xuICAgICAgICAvKiBUaGlzIGNyYXdscyB0aGUgSlNPTiBzY2hlbWEgZm9yIGFsbCAkcmVmcywgYW5kIHJlcGxhY2VzIHRoZW0gd2l0aCB0aGUgc2NoZW1hIHRoZXkncmUgcmVmZXJlbmNpbmcgKi9cbiAgICAgICAgLyogTWF5YmUgSSdtIG1pc3VuZGVyc3RhbmRpbmcgSlNPTiBwb2ludGVycy4gSSB3YXMgaG9waW5nIEkgdGhlcmUgd2FzIHNvbWUgbWFnaWMgSlNPTiBwdHIgYXBpIGZuIHRoYXQgcmVwbGFjZXMgYWxsICRyZWZzIHdpdGggdGhlIG9iaiB0aGV5IHJlZmVyZW5jZSAqL1xuICAgICAgICB2YXIgcHRyID0gSnNvblBvaW50ZXIubm9Db25mbGljdCgpXG4gICAgICAgIF8uZm9yRWFjaChfLmtleXMocHRyLmZsYXR0ZW4oc2NoZW1hKSksIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICAgdmFyIHBhdGhMaXN0ID0gcHRyLmRlY29kZShpdGVtKVxuICAgICAgICAgICAgIGlmIChwYXRoTGlzdFtwYXRoTGlzdC5sZW5ndGgtMV0gPT09ICckcmVmJykge1xuICAgICAgICAgICAgICAgIHZhciBvYmpQYXRoID0gJyMvJyArIF8uc2xpY2UocGF0aExpc3QsIDAsIHBhdGhMaXN0Lmxlbmd0aC0xKS5qb2luKCcvJykgLy8gYnVpbGRpbmcgYWJzIHBhdGggdG8gaXRlbSB3aXRoIGEgJHJlZlxuICAgICAgICAgICAgICAgIHB0ci5zZXQoc2NoZW1hLCBvYmpQYXRoLCBwdHIuZ2V0KHNjaGVtYSwgcHRyLmdldChzY2hlbWEsIGl0ZW0pKSkgLy8gc2V0IHRoYXQgaXRlbSB0byB0aGUgc2NoZW1hIHJlZmVyZW5jZWQgaW4gaXQncyAkcmVmXG4gICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1aWxkRmxhdFJlc291cmNlc0xpc3QgKHNjaGVtYSkge1xuICAgICAgICBfLmZvckVhY2goXy5rZXlzKHNjaGVtYSksIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHZhciBpdGVtID0gc2NoZW1hW2tleV1cbiAgICAgICAgICAgIGlmIChfLmlzT2JqZWN0KGl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgXy5mb3JFYWNoKF8ua2V5cyhpdGVtKSwgZnVuY3Rpb24gKGspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGsgPT09ICdyZXNvdXJjZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1aWxkRmxhdFJlc291cmNlc0xpc3QoaXRlbSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0gPSBfLm9taXQoaXRlbSwgaylcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoa2V5ID09PSAncmVzb3VyY2UnKSB7XG4gICAgICAgICAgICAgICAgJHNjb3BlLnJlc291cmNlcy5wdXNoKHNjaGVtYSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBidWlsZFNpZGViYXIgKHJlc291cmNlcykge1xuICAgICAgICByZXR1cm4gXy5tYXAocmVzb3VyY2VzLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBpdGVtLnJlc291cmNlLFxuICAgICAgICAgICAgICAgIHN1YlJlc291cmNlczogXy5jaGFpbihpdGVtKS5rZXlzKCkubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgLyogbWFwcGluZyB0aGUgbmFtZSBvZiB0aGUgcmVzb3VyY2UgYW5kIHRoZSB1cmkuIG5hbWUgZm9yIHRoZSB0aXRsZSBpbiBzaWRlYmFyLCBpZCAodXJpKSBpcyB1c2VkIGZvciBib29rbWFya2luZyB0aGUgaXRlbSAqL1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogaXRlbVtrZXldLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogaXRlbVtrZXldLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBpdGVtW2tleV0ubWV0aG9kLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSkuZmlsdGVyKCduYW1lJykudmFsdWUoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1hcFJlcXVpcmVkT250b1Byb3BlcnRpZXMgKHJlc291cmNlKSB7XG4gICAgICAgIHZhciBwcm9wZXJ0aWVzID0gXy5nZXQocmVzb3VyY2UsICdwcm9wZXJ0aWVzJylcbiAgICAgICAgdmFyIHJlcXVpcmVkUHJvcGVydGllcyA9IF8uZ2V0KHJlc291cmNlLCAncmVxdWlyZWQnKVxuICAgICAgICBpZiAocHJvcGVydGllcyAmJiByZXF1aXJlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIF8uZm9yRWFjaChyZXF1aXJlZFByb3BlcnRpZXMsIGZ1bmN0aW9uIChwcm9wZXJ0eU5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHkgPSBfLmdldChwcm9wZXJ0aWVzLCBwcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgaWYgKCFwcm9wZXJ0eSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiUHJvcGVydHkge3Byb3B9IGlzIGxpc3RlZCBhcyByZXF1aXJlZCBpbiByZXNvdXJjZSB7cmVzb3VyY2V9LCBidXQgaXMgbm90IGluIHRoZSBzY2hlbWFcIlxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoJ3twcm9wfScsIHByb3BlcnR5TmFtZSkucmVwbGFjZSgne3Jlc291cmNlfScsIF8uZ2V0KHJlc291cmNlLCAnbmFtZScpKVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgXy5tZXJnZShwcm9wZXJ0eSwgeyByZXF1aXJlZDogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgLyogaWYgdGhlcmUgaXMgYW4gb2JqZWN0LCByZWN1cnNlIG9udG8gaXQgKi9cbiAgICAgICAgXy5mb3JFYWNoKF8ua2V5cyhyZXNvdXJjZSksIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIC8qIGlmIGl0J3MgYW4gb2JqZWN0LCBnbyBkZWVwZXIgKi9cbiAgICAgICAgICAgIGlmIChfLmlzT2JqZWN0KHJlc291cmNlW2tleV0pKSB7XG4gICAgICAgICAgICAgICAgbWFwUmVxdWlyZWRPbnRvUHJvcGVydGllcyhyZXNvdXJjZVtrZXldKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGtleSA9PT0gJ2l0ZW1zJyAmJiBfLmlzQXJyYXkocmVzb3VyY2Vba2V5XSkpIHtcbiAgICAgICAgICAgICAgICAvKiBpdGVtcyBjYW4gaGF2ZSBhbiBhcnJheSBvZiBvYmplY3RzLCBzbyB0cmVlIHJlY3Vyc2lvbiBoZXJlIDopICovXG4gICAgICAgICAgICAgICAgXy5mb3JFYWNoKHJlc291cmNlW2tleV0sIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcFJlcXVpcmVkT250b1Byb3BlcnRpZXMocmVzb3VyY2Vba2V5XSlcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cblxuICAgICRzY29wZS5mb3JtYXRUeXBlID0gZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgdmFyIHR5cGUgPSBfLmdldChpdGVtLCAndHlwZScpXG4gICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZVxuICAgICAgICB9IGVsc2UgaWYgKF8uZ2V0KGl0ZW0sICdhbnlPZicpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2FueU9mJ1xuICAgICAgICB9IGVsc2UgaWYgKF8uZ2V0KGl0ZW0sICdhbGxPZicpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2FsbE9mJ1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAkc2NvcGUuZm9ybWF0U3BlY01ldGEgPSBmdW5jdGlvbiAoc3BlYykge1xuICAgICAgICB2YXIgYW55T2YgPSBfLmdldChzcGVjLCAnYW55T2YnKVxuICAgICAgICBpZiAoYW55T2YpIHtcbiAgICAgICAgICAgIHJldHVybiBmb3JtYXRBcnJheU1ldGEoYW55T2YpXG4gICAgICAgIH1cbiAgICAgICAgdmFyIGFsbE9mID0gXy5nZXQoc3BlYywgJ2FsbE9mJylcbiAgICAgICAgaWYgKGFsbE9mKSB7XG4gICAgICAgICAgICByZXR1cm4gZm9ybWF0QXJyYXlNZXRhKGFsbE9mKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFfLmlzT2JqZWN0KHNwZWMpKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBvbWl0dGVkU3BlY3MgPSBfLm9taXQoc3BlYywgWyd0eXBlJywgJ2Rlc2NyaXB0aW9uJywgJyQkaGFzaEtleScsICdyZXF1aXJlZCcsICdpdGVtcyddKVxuICAgICAgICBpZiAoIV8ua2V5cyhvbWl0dGVkU3BlY3MpLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gXy5tYXAoXy5rZXlzKG9taXR0ZWRTcGVjcyksIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nK2tleSsnOjwvc3Ryb25nPiAnK29taXR0ZWRTcGVjc1trZXldXG4gICAgICAgIH0pLmpvaW4oJywgJylcbiAgICB9XG5cbiAgICAkc2NvcGUuZm9ybWF0Tm9uT2JqU3BlY01ldGEgPSBmdW5jdGlvbiAoc3BlYykge1xuICAgICAgICB2YXIgb21pdHRlZFNwZWNzID0gXy5vbWl0KHNwZWMsIFsndHlwZScsICdkZXNjcmlwdGlvbicsICckJGhhc2hLZXknLCAncmVxdWlyZWQnLCAnc3RhdHVzJ10pXG4gICAgICAgIGlmICghXy5rZXlzKG9taXR0ZWRTcGVjcykubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfLm1hcChfLmtleXMob21pdHRlZFNwZWNzKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuICc8c3Ryb25nPicra2V5Kyc6PC9zdHJvbmc+ICcrb21pdHRlZFNwZWNzW2tleV1cbiAgICAgICAgfSkuam9pbignLCAnKVxuICAgIH1cblxuICAgICRzY29wZS5odG1saWZ5SlNPTiA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIGpzb25NYXJrdXAob2JqKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZvcm1hdEFycmF5TWV0YSAoaXRlbXMpIHtcbiAgICAgICAgcmV0dXJuIF8ubWFwKGl0ZW1zLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgcmV0dXJuICd7JyArIF8ubWFwKF8ua2V5cyhpdGVtKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nK2tleSsnOjwvc3Ryb25nPiAnICsgaXRlbVtrZXldXG4gICAgICAgICAgICB9KS5qb2luKCcsICcpXG4gICAgICAgIH0pLmpvaW4oJ30sICcpICsgJ30nXG4gICAgfVxufSlcbiIsInZhciBJTkRFTlQgPSAnICAgICc7XG5cbnZhciB0eXBlID0gZnVuY3Rpb24oZG9jKSB7XG5cdGlmIChkb2MgPT09IG51bGwpIHJldHVybiAnbnVsbCc7XG5cdGlmIChBcnJheS5pc0FycmF5KGRvYykpIHJldHVybiAnYXJyYXknO1xuXHRpZiAodHlwZW9mIGRvYyA9PT0gJ3N0cmluZycgJiYgL15odHRwcz86Ly50ZXN0KGRvYykpIHJldHVybiAnbGluayc7XG5cblx0cmV0dXJuIHR5cGVvZiBkb2M7XG59O1xuXG52YXIgZXNjYXBlID0gZnVuY3Rpb24oc3RyKSB7XG5cdHJldHVybiBzdHIucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZG9jKSB7XG5cdHZhciBpbmRlbnQgPSAnJztcblxuXHR2YXIgZm9yRWFjaCA9IGZ1bmN0aW9uKGxpc3QsIHN0YXJ0LCBlbmQsIGZuKSB7XG5cdFx0aWYgKCFsaXN0Lmxlbmd0aCkgcmV0dXJuIHN0YXJ0KycgJytlbmQ7XG5cblx0XHR2YXIgb3V0ID0gc3RhcnQrJ1xcbic7XG5cblx0XHRpbmRlbnQgKz0gSU5ERU5UO1xuXHRcdGxpc3QuZm9yRWFjaChmdW5jdGlvbihrZXksIGkpIHtcblx0XHRcdG91dCArPSBpbmRlbnQrZm4oa2V5KSsoaSA8IGxpc3QubGVuZ3RoLTEgPyAnLCcgOiAnJykrJ1xcbic7XG5cdFx0fSk7XG5cdFx0aW5kZW50ID0gaW5kZW50LnNsaWNlKDAsIC1JTkRFTlQubGVuZ3RoKTtcblxuXHRcdHJldHVybiBvdXQgKyBpbmRlbnQrZW5kO1xuXHR9O1xuXG5cdHZhciB2aXNpdCA9IGZ1bmN0aW9uKG9iaikge1xuXHRcdGlmIChvYmogPT09IHVuZGVmaW5lZCkgcmV0dXJuICcnO1xuXG5cdFx0c3dpdGNoICh0eXBlKG9iaikpIHtcblx0XHRcdGNhc2UgJ2Jvb2xlYW4nOlxuXHRcdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cImpzb24tbWFya3VwLWJvb2xcIj4nK29iaisnPC9zcGFuPic7XG5cblx0XHRcdGNhc2UgJ251bWJlcic6XG5cdFx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwianNvbi1tYXJrdXAtbnVtYmVyXCI+JytvYmorJzwvc3Bhbj4nO1xuXG5cdFx0XHRjYXNlICdudWxsJzpcblx0XHRcdHJldHVybiAnPHNwYW4gY2xhc3M9XCJqc29uLW1hcmt1cC1udWxsXCI+bnVsbDwvc3Bhbj4nO1xuXG5cdFx0XHRjYXNlICdzdHJpbmcnOlxuXHRcdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cImpzb24tbWFya3VwLXN0cmluZ1wiPlwiJytlc2NhcGUob2JqLnJlcGxhY2UoL1xcbi9nLCAnXFxuJytpbmRlbnQpKSsnXCI8L3NwYW4+JztcblxuXHRcdFx0Y2FzZSAnbGluayc6XG5cdFx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwianNvbi1tYXJrdXAtc3RyaW5nXCI+XCI8YSBocmVmPVwiJytlc2NhcGUob2JqKSsnXCI+Jytlc2NhcGUob2JqKSsnPC9hPlwiPC9zcGFuPic7XG5cblx0XHRcdGNhc2UgJ2FycmF5Jzpcblx0XHRcdHJldHVybiBmb3JFYWNoKG9iaiwgJ1snLCAnXScsIHZpc2l0KTtcblxuXHRcdFx0Y2FzZSAnb2JqZWN0Jzpcblx0XHRcdHZhciBrZXlzID0gT2JqZWN0LmtleXMob2JqKS5maWx0ZXIoZnVuY3Rpb24oa2V5KSB7XG5cdFx0XHRcdHJldHVybiBvYmpba2V5XSAhPT0gdW5kZWZpbmVkO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiBmb3JFYWNoKGtleXMsICd7JywgJ30nLCBmdW5jdGlvbihrZXkpIHtcblx0XHRcdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cImpzb24tbWFya3VwLWtleVwiPicra2V5ICsgJzo8L3NwYW4+ICcrdmlzaXQob2JqW2tleV0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICcnO1xuXHR9O1xuXG5cdHJldHVybiAnPGRpdiBjbGFzcz1cImpzb24tbWFya3VwXCI+Jyt2aXNpdChkb2MpKyc8L2Rpdj4nO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuKGZ1bmN0aW9uKCkge1xuICB2YXIgcm9vdCA9IHRoaXM7IC8vIGVpdGhlciB0aGUgbW9kdWxlIG9yIHRoZSB3aW5kb3cgKGluIGEgYnJvd3NlcilcbiAgdmFyIHNhdmVkSnNvblBvaW50ZXIgPSByb290Lkpzb25Qb2ludGVyO1xuXG4gIGZ1bmN0aW9uIHJlcGxhY2Uoc3RyLCBmaW5kLCByZXBsKSB7XG4gICAgLy8gbW9kaWZpZWQgZnJvbSBodHRwOi8vanNwZXJmLmNvbS9qYXZhc2NyaXB0LXJlcGxhY2UtYWxsLzEwXG4gICAgdmFyIG9yaWcgPSBzdHIudG9TdHJpbmcoKTtcbiAgICB2YXIgcmVzID0gJyc7XG4gICAgdmFyIHJlbSA9IG9yaWc7XG4gICAgdmFyIGJlZyA9IDA7XG4gICAgdmFyIGVuZCA9IC0xO1xuICAgIHdoaWxlICgoZW5kID0gcmVtLmluZGV4T2YoZmluZCkpID4gLTEpIHtcbiAgICAgIHJlcyArPSBvcmlnLnN1YnN0cmluZyhiZWcsIGJlZyArIGVuZCkgKyByZXBsO1xuICAgICAgcmVtID0gcmVtLnN1YnN0cmluZyhlbmQgKyBmaW5kLmxlbmd0aCwgcmVtLmxlbmd0aCk7XG4gICAgICBiZWcgKz0gZW5kICsgZmluZC5sZW5ndGg7XG4gICAgfVxuICAgIGlmIChyZW0ubGVuZ3RoID4gMCkge1xuICAgICAgcmVzICs9IG9yaWcuc3Vic3RyaW5nKG9yaWcubGVuZ3RoIC0gcmVtLmxlbmd0aCwgb3JpZy5sZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVjb2RlRnJhZ21lbnRTZWdtZW50cyhzZWdtZW50cykge1xuICAgIHZhciBpID0gLTE7XG4gICAgdmFyIGxlbiA9IHNlZ21lbnRzLmxlbmd0aDtcbiAgICB2YXIgcmVzID0gbmV3IEFycmF5KGxlbik7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgcmVzW2ldID0gcmVwbGFjZShyZXBsYWNlKGRlY29kZVVSSUNvbXBvbmVudCgnJyArIHNlZ21lbnRzW2ldKSwgJ34xJywgJy8nKSwgJ34wJywgJ34nKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuY29kZUZyYWdtZW50U2VnbWVudHMoc2VnbWVudHMpIHtcbiAgICB2YXIgaSA9IC0xO1xuICAgIHZhciBsZW4gPSBzZWdtZW50cy5sZW5ndGg7XG4gICAgdmFyIHJlcyA9IG5ldyBBcnJheShsZW4pO1xuICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgIGlmICh0eXBlb2Ygc2VnbWVudHNbaV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJlc1tpXSA9IGVuY29kZVVSSUNvbXBvbmVudChyZXBsYWNlKHJlcGxhY2Uoc2VnbWVudHNbaV0sICd+JywgJ34wJyksICcvJywgJ34xJykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzW2ldID0gc2VnbWVudHNbaV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBmdW5jdGlvbiBkZWNvZGVQb2ludGVyU2VnbWVudHMoc2VnbWVudHMpIHtcbiAgICB2YXIgaSA9IC0xO1xuICAgIHZhciBsZW4gPSBzZWdtZW50cy5sZW5ndGg7XG4gICAgdmFyIHJlcyA9IG5ldyBBcnJheShsZW4pO1xuICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgIHJlc1tpXSA9IHJlcGxhY2UocmVwbGFjZShzZWdtZW50c1tpXSwgJ34xJywgJy8nKSwgJ34wJywgJ34nKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuY29kZVBvaW50ZXJTZWdtZW50cyhzZWdtZW50cykge1xuICAgIHZhciBpID0gLTE7XG4gICAgdmFyIGxlbiA9IHNlZ21lbnRzLmxlbmd0aDtcbiAgICB2YXIgcmVzID0gbmV3IEFycmF5KGxlbik7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgaWYgKHR5cGVvZiBzZWdtZW50c1tpXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmVzW2ldID0gcmVwbGFjZShyZXBsYWNlKHNlZ21lbnRzW2ldLCAnficsICd+MCcpLCAnLycsICd+MScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzW2ldID0gc2VnbWVudHNbaV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBmdW5jdGlvbiBkZWNvZGVQb2ludGVyKHB0cikge1xuICAgIGlmICh0eXBlb2YgcHRyICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCB0eXBlOiBKU09OIFBvaW50ZXJzIGFyZSByZXByZXNlbnRlZCBhcyBzdHJpbmdzLicpO1xuICAgIH1cbiAgICBpZiAocHRyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICBpZiAocHRyWzBdICE9PSAnLycpIHtcbiAgICAgIHRocm93IG5ldyBSZWZlcmVuY2VFcnJvcignSW52YWxpZCBKU09OIFBvaW50ZXIgc3ludGF4LiBOb24tZW1wdHkgcG9pbnRlciBtdXN0IGJlZ2luIHdpdGggYSBzb2xpZHVzIGAvYC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlY29kZVBvaW50ZXJTZWdtZW50cyhwdHIuc3Vic3RyaW5nKDEpLnNwbGl0KCcvJykpO1xuICB9XG5cbiAgZnVuY3Rpb24gZW5jb2RlUG9pbnRlcihwYXRoKSB7XG4gICAgaWYgKHBhdGggJiYgIUFycmF5LmlzQXJyYXkocGF0aCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgdHlwZTogcGF0aCBtdXN0IGJlIGFuIGFycmF5IG9mIHNlZ21lbnRzLicpO1xuICAgIH1cbiAgICBpZiAocGF0aC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gICAgcmV0dXJuICcvJy5jb25jYXQoZW5jb2RlUG9pbnRlclNlZ21lbnRzKHBhdGgpLmpvaW4oJy8nKSk7XG4gIH1cblxuICBmdW5jdGlvbiBkZWNvZGVVcmlGcmFnbWVudElkZW50aWZpZXIocHRyKSB7XG4gICAgaWYgKHR5cGVvZiBwdHIgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIHR5cGU6IEpTT04gUG9pbnRlcnMgYXJlIHJlcHJlc2VudGVkIGFzIHN0cmluZ3MuJyk7XG4gICAgfVxuICAgIGlmIChwdHIubGVuZ3RoID09PSAwIHx8IHB0clswXSAhPT0gJyMnKSB7XG4gICAgICB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoJ0ludmFsaWQgSlNPTiBQb2ludGVyIHN5bnRheDsgVVJJIGZyYWdtZW50IGlkZXRpZmllcnMgbXVzdCBiZWdpbiB3aXRoIGEgaGFzaC4nKTtcbiAgICB9XG4gICAgaWYgKHB0ci5sZW5ndGggPT09IDEpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgaWYgKHB0clsxXSAhPT0gJy8nKSB7XG4gICAgICB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoJ0ludmFsaWQgSlNPTiBQb2ludGVyIHN5bnRheC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlY29kZUZyYWdtZW50U2VnbWVudHMocHRyLnN1YnN0cmluZygyKS5zcGxpdCgnLycpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuY29kZVVyaUZyYWdtZW50SWRlbnRpZmllcihwYXRoKSB7XG4gICAgaWYgKHBhdGggJiYgIUFycmF5LmlzQXJyYXkocGF0aCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgdHlwZTogcGF0aCBtdXN0IGJlIGFuIGFycmF5IG9mIHNlZ21lbnRzLicpO1xuICAgIH1cbiAgICBpZiAocGF0aC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAnIyc7XG4gICAgfVxuICAgIHJldHVybiAnIy8nLmNvbmNhdChlbmNvZGVGcmFnbWVudFNlZ21lbnRzKHBhdGgpLmpvaW4oJy8nKSk7XG4gIH1cblxuICBmdW5jdGlvbiB0b0FycmF5SW5kZXhSZWZlcmVuY2UoYXJyLCBpZHgpIHtcbiAgICB2YXIgbGVuID0gaWR4Lmxlbmd0aDtcbiAgICB2YXIgY3Vyc29yID0gMDtcbiAgICBpZiAobGVuID09PSAwIHx8IGxlbiA+IDEgJiYgaWR4WzBdID09PSAnMCcpIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG4gICAgaWYgKGxlbiA9PT0gMSAmJiBpZHhbMF0gPT09ICctJykge1xuICAgICAgcmV0dXJuIGFyci5sZW5ndGg7XG4gICAgfVxuXG4gICAgd2hpbGUgKCsrY3Vyc29yIDwgbGVuKSB7XG4gICAgICBpZiAoaWR4W2N1cnNvcl0gPCAnMCcgfHwgaWR4W2N1cnNvcl0gPiAnOScpIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcGFyc2VJbnQoaWR4LCAxMCk7XG4gIH1cblxuICBmdW5jdGlvbiBoYXNWYWx1ZUF0UGF0aCh0YXJnZXQsIHBhdGgpIHtcbiAgICB2YXIgaXQ7XG4gICAgdmFyIGxlbjtcbiAgICB2YXIgY3Vyc29yO1xuICAgIHZhciBzdGVwO1xuICAgIHZhciBwO1xuICAgIGlmICh0eXBlb2YgdGFyZ2V0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgaXQgPSB0YXJnZXQ7XG4gICAgICBsZW4gPSBwYXRoLmxlbmd0aDtcbiAgICAgIGN1cnNvciA9IC0xO1xuICAgICAgaWYgKGxlbikge1xuICAgICAgICB3aGlsZSAoKytjdXJzb3IgPCBsZW4gJiYgaXQpIHtcbiAgICAgICAgICBzdGVwID0gcGF0aFtjdXJzb3JdO1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGl0KSkge1xuICAgICAgICAgICAgaWYgKGlzTmFOKHN0ZXApIHx8ICFpc0Zpbml0ZShzdGVwKSkge1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHAgPSB0b0FycmF5SW5kZXhSZWZlcmVuY2UoaXQsIHN0ZXApO1xuICAgICAgICAgICAgaWYgKGl0Lmxlbmd0aCA+IHApIHtcbiAgICAgICAgICAgICAgaXQgPSBpdFtwXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpdCA9IGl0W3N0ZXBdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGN1cnNvciA9PT0gbGVuICYmIHR5cGVvZiBpdCAhPT0gJ3VuZGVmaW5lZCc7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFZhbHVlQXRQYXRoKHRhcmdldCwgcGF0aCkge1xuICAgIHZhciBpdDtcbiAgICB2YXIgbGVuO1xuICAgIHZhciBjdXJzb3I7XG4gICAgdmFyIHN0ZXA7XG4gICAgdmFyIHA7XG4gICAgdmFyIG5vbmV4aXN0ZW50ID0gdW5kZWZpbmVkO1xuICAgIGlmICh0eXBlb2YgdGFyZ2V0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgaXQgPSB0YXJnZXQ7XG4gICAgICBsZW4gPSBwYXRoLmxlbmd0aDtcbiAgICAgIGN1cnNvciA9IC0xO1xuICAgICAgaWYgKGxlbikge1xuICAgICAgICB3aGlsZSAoKytjdXJzb3IgPCBsZW4gJiYgaXQpIHtcbiAgICAgICAgICBzdGVwID0gcGF0aFtjdXJzb3JdO1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGl0KSkge1xuICAgICAgICAgICAgaWYgKGlzTmFOKHN0ZXApIHx8ICFpc0Zpbml0ZShzdGVwKSkge1xuICAgICAgICAgICAgICByZXR1cm4gbm9uZXhpc3RlbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwID0gdG9BcnJheUluZGV4UmVmZXJlbmNlKGl0LCBzdGVwKTtcbiAgICAgICAgICAgIGlmIChpdC5sZW5ndGggPiBwKSB7XG4gICAgICAgICAgICAgIGl0ID0gaXRbcF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gbm9uZXhpc3RlbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGl0ID0gaXRbc3RlcF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gaXQ7XG4gICAgfVxuICAgIHJldHVybiBub25leGlzdGVudDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbXBpbGVQb2ludGVyRGVyZWZlcmVuY2UocGF0aCkge1xuICAgIGxldCBib2R5ID0gYGlmICh0eXBlb2Yob2JqKSAhPT0gJ3VuZGVmaW5lZCdgO1xuICAgIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJvb3QpIHtcbiAgICAgICAgcmV0dXJuIHJvb3Q7XG4gICAgICB9O1xuICAgIH1cbiAgICBib2R5ID0gcGF0aC5yZWR1Y2UoKGJvZHksIHAsIGkpID0+IHtcbiAgICAgIHJldHVybiBgJHtib2R5fSAmJlxuICAgIHR5cGVvZigob2JqID0gb2JqWycke3JlcGxhY2UocGF0aFtpXSwgJ1xcXFwnLCAnXFxcXFxcXFwnKX0nXSkpICE9PSAndW5kZWZpbmVkJ2A7XG4gICAgfSwgYGlmICh0eXBlb2Yob2JqKSAhPT0gJ3VuZGVmaW5lZCdgKTtcbiAgICBib2R5ID0gYCR7Ym9keX0pIHtcbiAgcmV0dXJuIG9iajtcbn1gO1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oWydvYmonXSwgYm9keSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldFZhbHVlQXRQYXRoKHRhcmdldCwgdmFsLCBwYXRoLCBmb3JjZSkge1xuICAgIHZhciBpdDtcbiAgICB2YXIgbGVuO1xuICAgIHZhciBlbmQ7XG4gICAgdmFyIGN1cnNvcjtcbiAgICB2YXIgc3RlcDtcbiAgICB2YXIgcDtcbiAgICB2YXIgcmVtO1xuICAgIHZhciBub25leGlzdGVudCA9IHVuZGVmaW5lZDtcbiAgICBpZiAocGF0aC5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHNldCB0aGUgcm9vdCBvYmplY3Q7IGFzc2lnbiBpdCBkaXJlY3RseS4nKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ0Nhbm5vdCBzZXQgdmFsdWVzIG9uIHVuZGVmaW5lZCcpO1xuICAgIH1cbiAgICBpdCA9IHRhcmdldDtcbiAgICBsZW4gPSBwYXRoLmxlbmd0aDtcbiAgICBlbmQgPSBwYXRoLmxlbmd0aCAtIDE7XG4gICAgY3Vyc29yID0gLTE7XG4gICAgaWYgKGxlbikge1xuICAgICAgd2hpbGUgKCsrY3Vyc29yIDwgbGVuKSB7XG4gICAgICAgIHN0ZXAgPSBwYXRoW2N1cnNvcl07XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGl0KSkge1xuICAgICAgICAgIHAgPSB0b0FycmF5SW5kZXhSZWZlcmVuY2UoaXQsIHN0ZXApO1xuICAgICAgICAgIGlmIChpdC5sZW5ndGggPiBwKSB7XG4gICAgICAgICAgICBpZiAoY3Vyc29yID09PSBlbmQpIHtcbiAgICAgICAgICAgICAgcmVtID0gaXRbcF07XG4gICAgICAgICAgICAgIGl0W3BdID0gdmFsO1xuICAgICAgICAgICAgICByZXR1cm4gcmVtO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaXQgPSBpdFtwXTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGl0Lmxlbmd0aCA9PT0gcCkge1xuICAgICAgICAgICAgaXQucHVzaCh2YWwpO1xuICAgICAgICAgICAgcmV0dXJuIG5vbmV4aXN0ZW50O1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGl0W3N0ZXBdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKGZvcmNlKSB7XG4gICAgICAgICAgICAgIGlmIChjdXJzb3IgPT09IGVuZCkge1xuICAgICAgICAgICAgICAgIGl0W3N0ZXBdID0gdmFsO1xuICAgICAgICAgICAgICAgIHJldHVybiBub25leGlzdGVudDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpdCA9IGl0W3N0ZXBdID0ge307XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5vbmV4aXN0ZW50O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoY3Vyc29yID09PSBlbmQpIHtcbiAgICAgICAgICAgIHJlbSA9IGl0W3N0ZXBdO1xuICAgICAgICAgICAgaXRbc3RlcF0gPSB2YWw7XG4gICAgICAgICAgICByZXR1cm4gcmVtO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpdCA9IGl0W3N0ZXBdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGxvb2tzTGlrZUZyYWdtZW50KHB0cikge1xuICAgIHJldHVybiBwdHIgJiYgcHRyLmxlbmd0aCAmJiBwdHJbMF0gPT09ICcjJztcbiAgfVxuXG4gIGZ1bmN0aW9uIHBpY2tEZWNvZGVyKHB0cikge1xuICAgIHJldHVybiAobG9va3NMaWtlRnJhZ21lbnQocHRyKSkgPyBkZWNvZGVVcmlGcmFnbWVudElkZW50aWZpZXIgOiBkZWNvZGVQb2ludGVyO1xuICB9XG5cbiAgbGV0ICRwYXRoID0gU3ltYm9sKCk7XG4gIGxldCAkb3JpZyA9IFN5bWJvbCgpO1xuICBsZXQgJHBvaW50ZXIgPSBTeW1ib2woKTtcbiAgbGV0ICRmcmFnbWVudElkID0gU3ltYm9sKCk7XG5cbiAgY2xhc3MgSnNvblBvaW50ZXIge1xuXG4gICAgY29uc3RydWN0b3IocHRyKSB7XG4gICAgICB0aGlzWyRvcmlnXSA9IHB0cjtcbiAgICAgIHRoaXNbJHBhdGhdID0gKEFycmF5LmlzQXJyYXkocHRyKSkgPyBwdHIgOiBwaWNrRGVjb2RlcihwdHIpKHB0cik7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2dldCcsIHtcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgdmFsdWU6IGNvbXBpbGVQb2ludGVyRGVyZWZlcmVuY2UodGhpcy5wYXRoKVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0IHBhdGgoKSB7XG4gICAgICByZXR1cm4gdGhpc1skcGF0aF07XG4gICAgfVxuXG4gICAgZ2V0IHBvaW50ZXIoKSB7XG4gICAgICBpZiAoIXRoaXNbJHBvaW50ZXJdKSB7XG4gICAgICAgIHRoaXNbJHBvaW50ZXJdID0gZW5jb2RlUG9pbnRlcih0aGlzLnBhdGgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXNbJHBvaW50ZXJdO1xuICAgIH1cblxuICAgIGdldCB1cmlGcmFnbWVudElkZW50aWZpZXIoKSB7XG4gICAgICBpZiAoIXRoaXNbJGZyYWdtZW50SWRdKSB7XG4gICAgICAgIHRoaXNbJGZyYWdtZW50SWRdID0gZW5jb2RlVXJpRnJhZ21lbnRJZGVudGlmaWVyKHRoaXMucGF0aCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpc1skZnJhZ21lbnRJZF07XG4gICAgfVxuXG4gICAgaGFzKHRhcmdldCkge1xuICAgICAgcmV0dXJuIHR5cGVvZih0aGlzLmdldCh0YXJnZXQpKSAhPSAndW5kZWZpbmVkJztcbiAgICB9XG5cbiAgfVxuXG4gIGNsYXNzIEpzb25SZWZlcmVuY2Uge1xuXG4gICAgY29uc3RydWN0b3IocG9pbnRlcikge1xuICAgICAgdGhpc1skcG9pbnRlcl0gPSBwb2ludGVyO1xuICAgIH1cblxuICAgIGdldCAkcmVmKCkge1xuICAgICAgcmV0dXJuIHRoaXNbJHBvaW50ZXJdLnVyaUZyYWdtZW50SWRlbnRpZmllcjtcbiAgICB9XG5cbiAgICByZXNvbHZlKHRhcmdldCkge1xuICAgICAgcmV0dXJuIHRoaXNbJHBvaW50ZXJdLmdldCh0YXJnZXQpO1xuICAgIH1cblxuICAgIHRvU3RyaW5nKCkge1xuICAgICAgcmV0dXJuIHRoaXMuJHJlZjtcbiAgICB9XG5cbiAgfVxuXG4gIEpzb25SZWZlcmVuY2UuaXNSZWZlcmVuY2UgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqICYmIG9iaiBpbnN0YW5jZW9mIEpzb25SZWZlcmVuY2UgfHxcbiAgICAgICh0eXBlb2Ygb2JqLiRyZWYgPT09ICdzdHJpbmcnICYmXG4gICAgICAgIHR5cGVvZiBvYmoucmVzb2x2ZSA9PT0gJ2Z1bmN0aW9uJyk7XG4gIH07XG5cbiAgZnVuY3Rpb24gdmlzaXQodGFyZ2V0LCB2aXNpdG9yLCBjeWNsZSkge1xuICAgIHZhciBpdGVtcywgaSwgaWxlbiwgaiwgamxlbiwgaXQsIHBhdGgsIGN1cnNvciwgdHlwZVQ7XG4gICAgdmFyIGRpc3RpbmN0T2JqZWN0cztcbiAgICB2YXIgcSA9IG5ldyBBcnJheSgpO1xuICAgIHZhciBxY3Vyc29yID0gMDtcbiAgICBxLnB1c2goe1xuICAgICAgb2JqOiB0YXJnZXQsXG4gICAgICBwYXRoOiBbXVxuICAgIH0pO1xuICAgIGlmIChjeWNsZSkge1xuICAgICAgZGlzdGluY3RPYmplY3RzID0gbmV3IE1hcCgpO1xuICAgIH1cbiAgICB2aXNpdG9yKGVuY29kZVBvaW50ZXIoW10pLCB0YXJnZXQpO1xuICAgIHdoaWxlIChxY3Vyc29yIDwgcS5sZW5ndGgpIHtcbiAgICAgIGN1cnNvciA9IHFbcWN1cnNvcisrXTtcbiAgICAgIHR5cGVUID0gdHlwZW9mIGN1cnNvci5vYmo7XG4gICAgICBpZiAodHlwZVQgPT09ICdvYmplY3QnICYmIGN1cnNvci5vYmogIT09IG51bGwpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY3Vyc29yLm9iaikpIHtcbiAgICAgICAgICBqID0gLTE7XG4gICAgICAgICAgamxlbiA9IGN1cnNvci5vYmoubGVuZ3RoO1xuICAgICAgICAgIHdoaWxlICgrK2ogPCBqbGVuKSB7XG4gICAgICAgICAgICBpdCA9IGN1cnNvci5vYmpbal07XG4gICAgICAgICAgICBwYXRoID0gY3Vyc29yLnBhdGguY29uY2F0KGopO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBpdCA9PT0gJ29iamVjdCcgJiYgaXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgaWYgKGN5Y2xlICYmIGRpc3RpbmN0T2JqZWN0cy5oYXMoaXQpKSB7XG4gICAgICAgICAgICAgICAgdmlzaXRvcihlbmNvZGVQb2ludGVyKHBhdGgpLCBuZXcgSnNvblJlZmVyZW5jZShkaXN0aW5jdE9iamVjdHMuZ2V0KGl0KSkpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHEucHVzaCh7XG4gICAgICAgICAgICAgICAgb2JqOiBpdCxcbiAgICAgICAgICAgICAgICBwYXRoOiBwYXRoXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBpZiAoY3ljbGUpIHtcbiAgICAgICAgICAgICAgICBkaXN0aW5jdE9iamVjdHMuc2V0KGl0LCBuZXcgSnNvblBvaW50ZXIoZW5jb2RlVXJpRnJhZ21lbnRJZGVudGlmaWVyKHBhdGgpKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZpc2l0b3IoZW5jb2RlUG9pbnRlcihwYXRoKSwgaXQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpdGVtcyA9IE9iamVjdC5rZXlzKGN1cnNvci5vYmopO1xuICAgICAgICAgIGlsZW4gPSBpdGVtcy5sZW5ndGg7XG4gICAgICAgICAgaSA9IC0xO1xuICAgICAgICAgIHdoaWxlICgrK2kgPCBpbGVuKSB7XG4gICAgICAgICAgICBpdCA9IGN1cnNvci5vYmpbaXRlbXNbaV1dO1xuICAgICAgICAgICAgcGF0aCA9IGN1cnNvci5wYXRoLmNvbmNhdChpdGVtc1tpXSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGl0ID09PSAnb2JqZWN0JyAmJiBpdCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoY3ljbGUgJiYgZGlzdGluY3RPYmplY3RzLmhhcyhpdCkpIHtcbiAgICAgICAgICAgICAgICB2aXNpdG9yKGVuY29kZVBvaW50ZXIocGF0aCksIG5ldyBKc29uUmVmZXJlbmNlKGRpc3RpbmN0T2JqZWN0cy5nZXQoaXQpKSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcS5wdXNoKHtcbiAgICAgICAgICAgICAgICBvYmo6IGl0LFxuICAgICAgICAgICAgICAgIHBhdGg6IHBhdGhcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGlmIChjeWNsZSkge1xuICAgICAgICAgICAgICAgIGRpc3RpbmN0T2JqZWN0cy5zZXQoaXQsIG5ldyBKc29uUG9pbnRlcihlbmNvZGVVcmlGcmFnbWVudElkZW50aWZpZXIocGF0aCkpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmlzaXRvcihlbmNvZGVQb2ludGVyKHBhdGgpLCBpdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgSnNvblBvaW50ZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKHRhcmdldCwgdmFsdWUsIGZvcmNlKSB7XG4gICAgcmV0dXJuIHNldFZhbHVlQXRQYXRoKHRhcmdldCwgdmFsdWUsIHRoaXMucGF0aCwgZm9yY2UpO1xuICB9O1xuXG4gIEpzb25Qb2ludGVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLm9yaWdpbmFsO1xuICB9O1xuXG4gIEpzb25Qb2ludGVyLmNyZWF0ZSA9IGZ1bmN0aW9uKHB0cikge1xuICAgIHJldHVybiBuZXcgSnNvblBvaW50ZXIocHRyKTtcbiAgfTtcblxuICBKc29uUG9pbnRlci5oYXMgPSBmdW5jdGlvbih0YXJnZXQsIHB0cikge1xuICAgIHJldHVybiBoYXNWYWx1ZUF0UGF0aCh0YXJnZXQsIHBpY2tEZWNvZGVyKHB0cikocHRyKSk7XG4gIH07XG5cbiAgSnNvblBvaW50ZXIuZ2V0ID0gZnVuY3Rpb24odGFyZ2V0LCBwdHIpIHtcbiAgICByZXR1cm4gZ2V0VmFsdWVBdFBhdGgodGFyZ2V0LCBwaWNrRGVjb2RlcihwdHIpKHB0cikpO1xuICB9O1xuXG4gIEpzb25Qb2ludGVyLnNldCA9IGZ1bmN0aW9uKHRhcmdldCwgcHRyLCB2YWwsIGZvcmNlKSB7XG4gICAgcmV0dXJuIHNldFZhbHVlQXRQYXRoKHRhcmdldCwgdmFsLCBwaWNrRGVjb2RlcihwdHIpKHB0ciksIGZvcmNlKTtcbiAgfTtcblxuICBKc29uUG9pbnRlci5saXN0ID0gZnVuY3Rpb24odGFyZ2V0LCBmcmFnbWVudElkKSB7XG4gICAgdmFyIHJlcyA9IFtdO1xuICAgIHZhciB2aXNpdG9yID0gKGZyYWdtZW50SWQpID9cbiAgICAgIGZ1bmN0aW9uKHB0ciwgdmFsKSB7XG4gICAgICAgIHJlcy5wdXNoKHtcbiAgICAgICAgICBmcmFnbWVudElkOiBlbmNvZGVVcmlGcmFnbWVudElkZW50aWZpZXIoZGVjb2RlUG9pbnRlcihwdHIpKSxcbiAgICAgICAgICB2YWx1ZTogdmFsXG4gICAgICAgIH0pO1xuICAgICAgfSA6XG4gICAgICBmdW5jdGlvbihwdHIsIHZhbCkge1xuICAgICAgICByZXMucHVzaCh7XG4gICAgICAgICAgcG9pbnRlcjogcHRyLFxuICAgICAgICAgIHZhbHVlOiB2YWxcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgIHZpc2l0KHRhcmdldCwgdmlzaXRvcik7XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcblxuICBKc29uUG9pbnRlci5mbGF0dGVuID0gZnVuY3Rpb24odGFyZ2V0LCBmcmFnbWVudElkKSB7XG4gICAgdmFyIHJlcyA9IHt9O1xuICAgIHZhciB2aXNpdG9yID0gKGZyYWdtZW50SWQpID9cbiAgICAgIGZ1bmN0aW9uKHB0ciwgdmFsKSB7XG4gICAgICAgIHJlc1tlbmNvZGVVcmlGcmFnbWVudElkZW50aWZpZXIoZGVjb2RlUG9pbnRlcihwdHIpKV0gPSB2YWw7XG4gICAgICB9IDpcbiAgICAgIGZ1bmN0aW9uKHB0ciwgdmFsKSB7XG4gICAgICAgIHJlc1twdHJdID0gdmFsO1xuICAgICAgfTtcbiAgICB2aXNpdCh0YXJnZXQsIHZpc2l0b3IpO1xuICAgIHJldHVybiByZXM7XG4gIH07XG5cbiAgSnNvblBvaW50ZXIubWFwID0gZnVuY3Rpb24odGFyZ2V0LCBmcmFnbWVudElkKSB7XG4gICAgdmFyIHJlcyA9IG5ldyBNYXAoKTtcbiAgICB2YXIgdmlzaXRvciA9IChmcmFnbWVudElkKSA/XG4gICAgICBmdW5jdGlvbihwdHIsIHZhbCkge1xuICAgICAgICByZXMuc2V0KGVuY29kZVVyaUZyYWdtZW50SWRlbnRpZmllcihkZWNvZGVQb2ludGVyKHB0cikpLCB2YWwpO1xuICAgICAgfSA6IHJlcy5zZXQuYmluZChyZXMpO1xuICAgIHZpc2l0KHRhcmdldCwgdmlzaXRvcik7XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcblxuICBKc29uUG9pbnRlci52aXNpdCA9IHZpc2l0O1xuXG4gIEpzb25Qb2ludGVyLmRlY29kZSA9IGZ1bmN0aW9uKHB0cikge1xuICAgIHJldHVybiBwaWNrRGVjb2RlcihwdHIpKHB0cik7XG4gIH07XG5cbiAgSnNvblBvaW50ZXIuZGVjb2RlUG9pbnRlciA9IGRlY29kZVBvaW50ZXI7XG4gIEpzb25Qb2ludGVyLmVuY29kZVBvaW50ZXIgPSBlbmNvZGVQb2ludGVyO1xuICBKc29uUG9pbnRlci5kZWNvZGVVcmlGcmFnbWVudElkZW50aWZpZXIgPSBkZWNvZGVVcmlGcmFnbWVudElkZW50aWZpZXI7XG4gIEpzb25Qb2ludGVyLmVuY29kZVVyaUZyYWdtZW50SWRlbnRpZmllciA9IGVuY29kZVVyaUZyYWdtZW50SWRlbnRpZmllcjtcblxuICBKc29uUG9pbnRlci5Kc29uUmVmZXJlbmNlID0gSnNvblJlZmVyZW5jZTtcbiAgSnNvblBvaW50ZXIuaXNSZWZlcmVuY2UgPSBKc29uUmVmZXJlbmNlLmlzUmVmZXJlbmNlO1xuXG4gIEpzb25Qb2ludGVyLm5vQ29uZmxpY3QgPSBmdW5jdGlvbigpIHtcbiAgICByb290Lkpzb25Qb2ludGVyID0gc2F2ZWRKc29uUG9pbnRlcjtcbiAgICByZXR1cm4gSnNvblBvaW50ZXI7XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gSnNvblBvaW50ZXI7XG4gICAgfVxuICAgIGV4cG9ydHMuSnNvblBvaW50ZXIgPSBKc29uUG9pbnRlcjtcbiAgfSBlbHNlIHtcbiAgICByb290Lkpzb25Qb2ludGVyID0gSnNvblBvaW50ZXI7XG4gIH1cbn0pLmNhbGwodGhpcyk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8taW52YWxpZC10aGlzXG4iXX0=
