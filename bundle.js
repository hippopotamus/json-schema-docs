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
            var val = omittedSpecs[key]
            if (_.isArray(val)) {
                return '<strong>'+key+':</strong> '+val.join(', ')
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJicm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2pzb24tbWFya3VwL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2pzb24tcHRyL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGpzb25NYXJrdXAgPSByZXF1aXJlKCdqc29uLW1hcmt1cCcpXG52YXIgSnNvblBvaW50ZXIgPSByZXF1aXJlKCdqc29uLXB0cicpXG5cbmFuZ3VsYXIubW9kdWxlKCdhcHAnLCBbJ3VpLmJvb3RzdHJhcCcsICduZ1Nhbml0aXplJ10pLmNvbmZpZyhmdW5jdGlvbigkaHR0cFByb3ZpZGVyKXtcbiAgICAkaHR0cFByb3ZpZGVyLmRlZmF1bHRzLmhlYWRlcnMuY29tbW9uW1wiWC1SZXF1ZXN0ZWQtV2l0aFwiXSA9ICdYTUxIdHRwUmVxdWVzdCc7XG59KS5jb250cm9sbGVyKCdjb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCAkaHR0cCwgJHRpbWVvdXQpe1xuICAgICRodHRwLmdldCgnL3NjaGVtYScpLnRoZW4oZnVuY3Rpb24ocmVzKXtcbiAgICAgICAgJHNjb3BlLnNjaGVtYSA9IG1hcEpTT04ocmVzLmRhdGEpXG4gICAgfSlcblxuICAgIGZ1bmN0aW9uIG1hcEpTT04oc2NoZW1hKSB7XG4gICAgICAgIC8qIGkgY291bGQgb3B0aW1pemUgdGhpcyBwcmV0dHkgZWFzaWx5LiBpZiBpdCBlYXRzIHlvdXIgYnJvd3NlciwgbGV0IG1lIGtub3csIGFuZCBpJ2xsIG1ha2UgaXQgYmV0dGVyLi4uIGlmIHlvdSdyZSByZWFkaW5nIHRoaXMsIHlvdSBjb3VsZCBwcm9iYWJseSBkbyBpdCB0b28uXG4gICAgICAgIGkgd2lsbCBoYXBwaWx5IGRvIGl0IGZvciBzb21lb25lIHdobyBmb3VuZCB0aGlzIHVzZWZ1bC4gKi9cbiAgICAgICAgcmVwbGFjZVJlZnMoc2NoZW1hKVxuXG4gICAgICAgICRzY29wZS5yZXNvdXJjZXMgPSBbXVxuICAgICAgICBidWlsZEZsYXRSZXNvdXJjZXNMaXN0KHNjaGVtYSlcbiAgICAgICAgJHNjb3BlLnNpZGViYXJJdGVtcyA9IGJ1aWxkU2lkZWJhcigkc2NvcGUucmVzb3VyY2VzKVxuICAgICAgICBfLm1hcCgkc2NvcGUucmVzb3VyY2VzLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgIG1hcFJlcXVpcmVkT250b1Byb3BlcnRpZXMocmVzb3VyY2UpXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVwbGFjZVJlZnMgKHNjaGVtYSkge1xuICAgICAgICAvKiBUaGlzIGNyYXdscyB0aGUgSlNPTiBzY2hlbWEgZm9yIGFsbCAkcmVmcywgYW5kIHJlcGxhY2VzIHRoZW0gd2l0aCB0aGUgc2NoZW1hIHRoZXkncmUgcmVmZXJlbmNpbmcgKi9cbiAgICAgICAgLyogTWF5YmUgSSdtIG1pc3VuZGVyc3RhbmRpbmcgSlNPTiBwb2ludGVycy4gSSB3YXMgaG9waW5nIEkgdGhlcmUgd2FzIHNvbWUgbWFnaWMgSlNPTiBwdHIgYXBpIGZuIHRoYXQgcmVwbGFjZXMgYWxsICRyZWZzIHdpdGggdGhlIG9iaiB0aGV5IHJlZmVyZW5jZSAqL1xuICAgICAgICB2YXIgcHRyID0gSnNvblBvaW50ZXIubm9Db25mbGljdCgpXG4gICAgICAgIF8uZm9yRWFjaChfLmtleXMocHRyLmZsYXR0ZW4oc2NoZW1hKSksIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICAgdmFyIHBhdGhMaXN0ID0gcHRyLmRlY29kZShpdGVtKVxuICAgICAgICAgICAgIGlmIChwYXRoTGlzdFtwYXRoTGlzdC5sZW5ndGgtMV0gPT09ICckcmVmJykge1xuICAgICAgICAgICAgICAgIHZhciBvYmpQYXRoID0gJyMvJyArIF8uc2xpY2UocGF0aExpc3QsIDAsIHBhdGhMaXN0Lmxlbmd0aC0xKS5qb2luKCcvJykgLy8gYnVpbGRpbmcgYWJzIHBhdGggdG8gaXRlbSB3aXRoIGEgJHJlZlxuICAgICAgICAgICAgICAgIHB0ci5zZXQoc2NoZW1hLCBvYmpQYXRoLCBwdHIuZ2V0KHNjaGVtYSwgcHRyLmdldChzY2hlbWEsIGl0ZW0pKSkgLy8gc2V0IHRoYXQgaXRlbSB0byB0aGUgc2NoZW1hIHJlZmVyZW5jZWQgaW4gaXQncyAkcmVmXG4gICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1aWxkRmxhdFJlc291cmNlc0xpc3QgKHNjaGVtYSkge1xuICAgICAgICBfLmZvckVhY2goXy5rZXlzKHNjaGVtYSksIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHZhciBpdGVtID0gc2NoZW1hW2tleV1cbiAgICAgICAgICAgIGlmIChfLmlzT2JqZWN0KGl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgXy5mb3JFYWNoKF8ua2V5cyhpdGVtKSwgZnVuY3Rpb24gKGspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGsgPT09ICdyZXNvdXJjZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1aWxkRmxhdFJlc291cmNlc0xpc3QoaXRlbSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0gPSBfLm9taXQoaXRlbSwgaylcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoa2V5ID09PSAncmVzb3VyY2UnKSB7XG4gICAgICAgICAgICAgICAgJHNjb3BlLnJlc291cmNlcy5wdXNoKHNjaGVtYSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBidWlsZFNpZGViYXIgKHJlc291cmNlcykge1xuICAgICAgICByZXR1cm4gXy5tYXAocmVzb3VyY2VzLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBpdGVtLnJlc291cmNlLFxuICAgICAgICAgICAgICAgIHN1YlJlc291cmNlczogXy5jaGFpbihpdGVtKS5rZXlzKCkubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgLyogbWFwcGluZyB0aGUgbmFtZSBvZiB0aGUgcmVzb3VyY2UgYW5kIHRoZSB1cmkuIG5hbWUgZm9yIHRoZSB0aXRsZSBpbiBzaWRlYmFyLCBpZCAodXJpKSBpcyB1c2VkIGZvciBib29rbWFya2luZyB0aGUgaXRlbSAqL1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogaXRlbVtrZXldLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogaXRlbVtrZXldLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBpdGVtW2tleV0ubWV0aG9kLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSkuZmlsdGVyKCduYW1lJykudmFsdWUoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1hcFJlcXVpcmVkT250b1Byb3BlcnRpZXMgKHJlc291cmNlKSB7XG4gICAgICAgIHZhciBwcm9wZXJ0aWVzID0gXy5nZXQocmVzb3VyY2UsICdwcm9wZXJ0aWVzJylcbiAgICAgICAgdmFyIHJlcXVpcmVkUHJvcGVydGllcyA9IF8uZ2V0KHJlc291cmNlLCAncmVxdWlyZWQnKVxuICAgICAgICBpZiAocHJvcGVydGllcyAmJiByZXF1aXJlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIF8uZm9yRWFjaChyZXF1aXJlZFByb3BlcnRpZXMsIGZ1bmN0aW9uIChwcm9wZXJ0eU5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHkgPSBfLmdldChwcm9wZXJ0aWVzLCBwcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgaWYgKCFwcm9wZXJ0eSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiUHJvcGVydHkge3Byb3B9IGlzIGxpc3RlZCBhcyByZXF1aXJlZCBpbiByZXNvdXJjZSB7cmVzb3VyY2V9LCBidXQgaXMgbm90IGluIHRoZSBzY2hlbWFcIlxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoJ3twcm9wfScsIHByb3BlcnR5TmFtZSkucmVwbGFjZSgne3Jlc291cmNlfScsIF8uZ2V0KHJlc291cmNlLCAnbmFtZScpKVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgXy5tZXJnZShwcm9wZXJ0eSwgeyByZXF1aXJlZDogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgLyogaWYgdGhlcmUgaXMgYW4gb2JqZWN0LCByZWN1cnNlIG9udG8gaXQgKi9cbiAgICAgICAgXy5mb3JFYWNoKF8ua2V5cyhyZXNvdXJjZSksIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIC8qIGlmIGl0J3MgYW4gb2JqZWN0LCBnbyBkZWVwZXIgKi9cbiAgICAgICAgICAgIGlmIChfLmlzT2JqZWN0KHJlc291cmNlW2tleV0pKSB7XG4gICAgICAgICAgICAgICAgbWFwUmVxdWlyZWRPbnRvUHJvcGVydGllcyhyZXNvdXJjZVtrZXldKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGtleSA9PT0gJ2l0ZW1zJyAmJiBfLmlzQXJyYXkocmVzb3VyY2Vba2V5XSkpIHtcbiAgICAgICAgICAgICAgICAvKiBpdGVtcyBjYW4gaGF2ZSBhbiBhcnJheSBvZiBvYmplY3RzLCBzbyB0cmVlIHJlY3Vyc2lvbiBoZXJlIDopICovXG4gICAgICAgICAgICAgICAgXy5mb3JFYWNoKHJlc291cmNlW2tleV0sIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcFJlcXVpcmVkT250b1Byb3BlcnRpZXMocmVzb3VyY2Vba2V5XSlcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cblxuICAgICRzY29wZS5mb3JtYXRUeXBlID0gZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgdmFyIHR5cGUgPSBfLmdldChpdGVtLCAndHlwZScpXG4gICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZVxuICAgICAgICB9IGVsc2UgaWYgKF8uZ2V0KGl0ZW0sICdhbnlPZicpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2FueU9mJ1xuICAgICAgICB9IGVsc2UgaWYgKF8uZ2V0KGl0ZW0sICdhbGxPZicpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2FsbE9mJ1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAkc2NvcGUuZm9ybWF0U3BlY01ldGEgPSBmdW5jdGlvbiAoc3BlYykge1xuICAgICAgICB2YXIgYW55T2YgPSBfLmdldChzcGVjLCAnYW55T2YnKVxuICAgICAgICBpZiAoYW55T2YpIHtcbiAgICAgICAgICAgIHJldHVybiBmb3JtYXRBcnJheU1ldGEoYW55T2YpXG4gICAgICAgIH1cbiAgICAgICAgdmFyIGFsbE9mID0gXy5nZXQoc3BlYywgJ2FsbE9mJylcbiAgICAgICAgaWYgKGFsbE9mKSB7XG4gICAgICAgICAgICByZXR1cm4gZm9ybWF0QXJyYXlNZXRhKGFsbE9mKVxuICAgICAgICB9XG4gICAgICAgIGlmICghXy5pc09iamVjdChzcGVjKSkge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb21pdHRlZFNwZWNzID0gXy5vbWl0KHNwZWMsIFsndHlwZScsICdkZXNjcmlwdGlvbicsICckJGhhc2hLZXknLCAncmVxdWlyZWQnLCAnaXRlbXMnXSlcbiAgICAgICAgaWYgKCFfLmtleXMob21pdHRlZFNwZWNzKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF8ubWFwKF8ua2V5cyhvbWl0dGVkU3BlY3MpLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICB2YXIgdmFsID0gb21pdHRlZFNwZWNzW2tleV1cbiAgICAgICAgICAgIGlmIChfLmlzQXJyYXkodmFsKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nK2tleSsnOjwvc3Ryb25nPiAnK3ZhbC5qb2luKCcsICcpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gJzxzdHJvbmc+JytrZXkrJzo8L3N0cm9uZz4gJyt2YWxcbiAgICAgICAgfSkuam9pbignLCAnKVxuICAgIH1cblxuICAgICRzY29wZS5mb3JtYXROb25PYmpTcGVjTWV0YSA9IGZ1bmN0aW9uIChzcGVjKSB7XG4gICAgICAgIHZhciBvbWl0dGVkU3BlY3MgPSBfLm9taXQoc3BlYywgWyd0eXBlJywgJ2Rlc2NyaXB0aW9uJywgJyQkaGFzaEtleScsICdyZXF1aXJlZCcsICdzdGF0dXMnXSlcbiAgICAgICAgaWYgKCFfLmtleXMob21pdHRlZFNwZWNzKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF8ubWFwKF8ua2V5cyhvbWl0dGVkU3BlY3MpLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gJzxzdHJvbmc+JytrZXkrJzo8L3N0cm9uZz4gJytvbWl0dGVkU3BlY3Nba2V5XVxuICAgICAgICB9KS5qb2luKCcsICcpXG4gICAgfVxuXG4gICAgJHNjb3BlLmh0bWxpZnlKU09OID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4ganNvbk1hcmt1cChvYmopXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0QXJyYXlNZXRhIChpdGVtcykge1xuICAgICAgICByZXR1cm4gXy5tYXAoaXRlbXMsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3snICsgXy5tYXAoXy5rZXlzKGl0ZW0pLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICc8c3Ryb25nPicra2V5Kyc6PC9zdHJvbmc+ICcgKyBpdGVtW2tleV1cbiAgICAgICAgICAgIH0pLmpvaW4oJywgJylcbiAgICAgICAgfSkuam9pbignfSwgJykgKyAnfSdcbiAgICB9XG59KVxuIiwidmFyIElOREVOVCA9ICcgICAgJztcblxudmFyIHR5cGUgPSBmdW5jdGlvbihkb2MpIHtcblx0aWYgKGRvYyA9PT0gbnVsbCkgcmV0dXJuICdudWxsJztcblx0aWYgKEFycmF5LmlzQXJyYXkoZG9jKSkgcmV0dXJuICdhcnJheSc7XG5cdGlmICh0eXBlb2YgZG9jID09PSAnc3RyaW5nJyAmJiAvXmh0dHBzPzovLnRlc3QoZG9jKSkgcmV0dXJuICdsaW5rJztcblxuXHRyZXR1cm4gdHlwZW9mIGRvYztcbn07XG5cbnZhciBlc2NhcGUgPSBmdW5jdGlvbihzdHIpIHtcblx0cmV0dXJuIHN0ci5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvPi9nLCAnJmd0OycpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkb2MpIHtcblx0dmFyIGluZGVudCA9ICcnO1xuXG5cdHZhciBmb3JFYWNoID0gZnVuY3Rpb24obGlzdCwgc3RhcnQsIGVuZCwgZm4pIHtcblx0XHRpZiAoIWxpc3QubGVuZ3RoKSByZXR1cm4gc3RhcnQrJyAnK2VuZDtcblxuXHRcdHZhciBvdXQgPSBzdGFydCsnXFxuJztcblxuXHRcdGluZGVudCArPSBJTkRFTlQ7XG5cdFx0bGlzdC5mb3JFYWNoKGZ1bmN0aW9uKGtleSwgaSkge1xuXHRcdFx0b3V0ICs9IGluZGVudCtmbihrZXkpKyhpIDwgbGlzdC5sZW5ndGgtMSA/ICcsJyA6ICcnKSsnXFxuJztcblx0XHR9KTtcblx0XHRpbmRlbnQgPSBpbmRlbnQuc2xpY2UoMCwgLUlOREVOVC5sZW5ndGgpO1xuXG5cdFx0cmV0dXJuIG91dCArIGluZGVudCtlbmQ7XG5cdH07XG5cblx0dmFyIHZpc2l0ID0gZnVuY3Rpb24ob2JqKSB7XG5cdFx0aWYgKG9iaiA9PT0gdW5kZWZpbmVkKSByZXR1cm4gJyc7XG5cblx0XHRzd2l0Y2ggKHR5cGUob2JqKSkge1xuXHRcdFx0Y2FzZSAnYm9vbGVhbic6XG5cdFx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwianNvbi1tYXJrdXAtYm9vbFwiPicrb2JqKyc8L3NwYW4+JztcblxuXHRcdFx0Y2FzZSAnbnVtYmVyJzpcblx0XHRcdHJldHVybiAnPHNwYW4gY2xhc3M9XCJqc29uLW1hcmt1cC1udW1iZXJcIj4nK29iaisnPC9zcGFuPic7XG5cblx0XHRcdGNhc2UgJ251bGwnOlxuXHRcdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cImpzb24tbWFya3VwLW51bGxcIj5udWxsPC9zcGFuPic7XG5cblx0XHRcdGNhc2UgJ3N0cmluZyc6XG5cdFx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwianNvbi1tYXJrdXAtc3RyaW5nXCI+XCInK2VzY2FwZShvYmoucmVwbGFjZSgvXFxuL2csICdcXG4nK2luZGVudCkpKydcIjwvc3Bhbj4nO1xuXG5cdFx0XHRjYXNlICdsaW5rJzpcblx0XHRcdHJldHVybiAnPHNwYW4gY2xhc3M9XCJqc29uLW1hcmt1cC1zdHJpbmdcIj5cIjxhIGhyZWY9XCInK2VzY2FwZShvYmopKydcIj4nK2VzY2FwZShvYmopKyc8L2E+XCI8L3NwYW4+JztcblxuXHRcdFx0Y2FzZSAnYXJyYXknOlxuXHRcdFx0cmV0dXJuIGZvckVhY2gob2JqLCAnWycsICddJywgdmlzaXQpO1xuXG5cdFx0XHRjYXNlICdvYmplY3QnOlxuXHRcdFx0dmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopLmZpbHRlcihmdW5jdGlvbihrZXkpIHtcblx0XHRcdFx0cmV0dXJuIG9ialtrZXldICE9PSB1bmRlZmluZWQ7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIGZvckVhY2goa2V5cywgJ3snLCAnfScsIGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwianNvbi1tYXJrdXAta2V5XCI+JytrZXkgKyAnOjwvc3Bhbj4gJyt2aXNpdChvYmpba2V5XSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gJyc7XG5cdH07XG5cblx0cmV0dXJuICc8ZGl2IGNsYXNzPVwianNvbi1tYXJrdXBcIj4nK3Zpc2l0KGRvYykrJzwvZGl2Pic7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciByb290ID0gdGhpczsgLy8gZWl0aGVyIHRoZSBtb2R1bGUgb3IgdGhlIHdpbmRvdyAoaW4gYSBicm93c2VyKVxuICB2YXIgc2F2ZWRKc29uUG9pbnRlciA9IHJvb3QuSnNvblBvaW50ZXI7XG5cbiAgZnVuY3Rpb24gcmVwbGFjZShzdHIsIGZpbmQsIHJlcGwpIHtcbiAgICAvLyBtb2RpZmllZCBmcm9tIGh0dHA6Ly9qc3BlcmYuY29tL2phdmFzY3JpcHQtcmVwbGFjZS1hbGwvMTBcbiAgICB2YXIgb3JpZyA9IHN0ci50b1N0cmluZygpO1xuICAgIHZhciByZXMgPSAnJztcbiAgICB2YXIgcmVtID0gb3JpZztcbiAgICB2YXIgYmVnID0gMDtcbiAgICB2YXIgZW5kID0gLTE7XG4gICAgd2hpbGUgKChlbmQgPSByZW0uaW5kZXhPZihmaW5kKSkgPiAtMSkge1xuICAgICAgcmVzICs9IG9yaWcuc3Vic3RyaW5nKGJlZywgYmVnICsgZW5kKSArIHJlcGw7XG4gICAgICByZW0gPSByZW0uc3Vic3RyaW5nKGVuZCArIGZpbmQubGVuZ3RoLCByZW0ubGVuZ3RoKTtcbiAgICAgIGJlZyArPSBlbmQgKyBmaW5kLmxlbmd0aDtcbiAgICB9XG4gICAgaWYgKHJlbS5sZW5ndGggPiAwKSB7XG4gICAgICByZXMgKz0gb3JpZy5zdWJzdHJpbmcob3JpZy5sZW5ndGggLSByZW0ubGVuZ3RoLCBvcmlnLmxlbmd0aCk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBmdW5jdGlvbiBkZWNvZGVGcmFnbWVudFNlZ21lbnRzKHNlZ21lbnRzKSB7XG4gICAgdmFyIGkgPSAtMTtcbiAgICB2YXIgbGVuID0gc2VnbWVudHMubGVuZ3RoO1xuICAgIHZhciByZXMgPSBuZXcgQXJyYXkobGVuKTtcbiAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICByZXNbaV0gPSByZXBsYWNlKHJlcGxhY2UoZGVjb2RlVVJJQ29tcG9uZW50KCcnICsgc2VnbWVudHNbaV0pLCAnfjEnLCAnLycpLCAnfjAnLCAnficpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgZnVuY3Rpb24gZW5jb2RlRnJhZ21lbnRTZWdtZW50cyhzZWdtZW50cykge1xuICAgIHZhciBpID0gLTE7XG4gICAgdmFyIGxlbiA9IHNlZ21lbnRzLmxlbmd0aDtcbiAgICB2YXIgcmVzID0gbmV3IEFycmF5KGxlbik7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgaWYgKHR5cGVvZiBzZWdtZW50c1tpXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmVzW2ldID0gZW5jb2RlVVJJQ29tcG9uZW50KHJlcGxhY2UocmVwbGFjZShzZWdtZW50c1tpXSwgJ34nLCAnfjAnKSwgJy8nLCAnfjEnKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNbaV0gPSBzZWdtZW50c1tpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlY29kZVBvaW50ZXJTZWdtZW50cyhzZWdtZW50cykge1xuICAgIHZhciBpID0gLTE7XG4gICAgdmFyIGxlbiA9IHNlZ21lbnRzLmxlbmd0aDtcbiAgICB2YXIgcmVzID0gbmV3IEFycmF5KGxlbik7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgcmVzW2ldID0gcmVwbGFjZShyZXBsYWNlKHNlZ21lbnRzW2ldLCAnfjEnLCAnLycpLCAnfjAnLCAnficpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgZnVuY3Rpb24gZW5jb2RlUG9pbnRlclNlZ21lbnRzKHNlZ21lbnRzKSB7XG4gICAgdmFyIGkgPSAtMTtcbiAgICB2YXIgbGVuID0gc2VnbWVudHMubGVuZ3RoO1xuICAgIHZhciByZXMgPSBuZXcgQXJyYXkobGVuKTtcbiAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICBpZiAodHlwZW9mIHNlZ21lbnRzW2ldID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXNbaV0gPSByZXBsYWNlKHJlcGxhY2Uoc2VnbWVudHNbaV0sICd+JywgJ34wJyksICcvJywgJ34xJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNbaV0gPSBzZWdtZW50c1tpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlY29kZVBvaW50ZXIocHRyKSB7XG4gICAgaWYgKHR5cGVvZiBwdHIgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIHR5cGU6IEpTT04gUG9pbnRlcnMgYXJlIHJlcHJlc2VudGVkIGFzIHN0cmluZ3MuJyk7XG4gICAgfVxuICAgIGlmIChwdHIubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIGlmIChwdHJbMF0gIT09ICcvJykge1xuICAgICAgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKCdJbnZhbGlkIEpTT04gUG9pbnRlciBzeW50YXguIE5vbi1lbXB0eSBwb2ludGVyIG11c3QgYmVnaW4gd2l0aCBhIHNvbGlkdXMgYC9gLicpO1xuICAgIH1cbiAgICByZXR1cm4gZGVjb2RlUG9pbnRlclNlZ21lbnRzKHB0ci5zdWJzdHJpbmcoMSkuc3BsaXQoJy8nKSk7XG4gIH1cblxuICBmdW5jdGlvbiBlbmNvZGVQb2ludGVyKHBhdGgpIHtcbiAgICBpZiAocGF0aCAmJiAhQXJyYXkuaXNBcnJheShwYXRoKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCB0eXBlOiBwYXRoIG11c3QgYmUgYW4gYXJyYXkgb2Ygc2VnbWVudHMuJyk7XG4gICAgfVxuICAgIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICByZXR1cm4gJy8nLmNvbmNhdChlbmNvZGVQb2ludGVyU2VnbWVudHMocGF0aCkuam9pbignLycpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlY29kZVVyaUZyYWdtZW50SWRlbnRpZmllcihwdHIpIHtcbiAgICBpZiAodHlwZW9mIHB0ciAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgdHlwZTogSlNPTiBQb2ludGVycyBhcmUgcmVwcmVzZW50ZWQgYXMgc3RyaW5ncy4nKTtcbiAgICB9XG4gICAgaWYgKHB0ci5sZW5ndGggPT09IDAgfHwgcHRyWzBdICE9PSAnIycpIHtcbiAgICAgIHRocm93IG5ldyBSZWZlcmVuY2VFcnJvcignSW52YWxpZCBKU09OIFBvaW50ZXIgc3ludGF4OyBVUkkgZnJhZ21lbnQgaWRldGlmaWVycyBtdXN0IGJlZ2luIHdpdGggYSBoYXNoLicpO1xuICAgIH1cbiAgICBpZiAocHRyLmxlbmd0aCA9PT0gMSkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICBpZiAocHRyWzFdICE9PSAnLycpIHtcbiAgICAgIHRocm93IG5ldyBSZWZlcmVuY2VFcnJvcignSW52YWxpZCBKU09OIFBvaW50ZXIgc3ludGF4LicpO1xuICAgIH1cbiAgICByZXR1cm4gZGVjb2RlRnJhZ21lbnRTZWdtZW50cyhwdHIuc3Vic3RyaW5nKDIpLnNwbGl0KCcvJykpO1xuICB9XG5cbiAgZnVuY3Rpb24gZW5jb2RlVXJpRnJhZ21lbnRJZGVudGlmaWVyKHBhdGgpIHtcbiAgICBpZiAocGF0aCAmJiAhQXJyYXkuaXNBcnJheShwYXRoKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCB0eXBlOiBwYXRoIG11c3QgYmUgYW4gYXJyYXkgb2Ygc2VnbWVudHMuJyk7XG4gICAgfVxuICAgIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuICcjJztcbiAgICB9XG4gICAgcmV0dXJuICcjLycuY29uY2F0KGVuY29kZUZyYWdtZW50U2VnbWVudHMocGF0aCkuam9pbignLycpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvQXJyYXlJbmRleFJlZmVyZW5jZShhcnIsIGlkeCkge1xuICAgIHZhciBsZW4gPSBpZHgubGVuZ3RoO1xuICAgIHZhciBjdXJzb3IgPSAwO1xuICAgIGlmIChsZW4gPT09IDAgfHwgbGVuID4gMSAmJiBpZHhbMF0gPT09ICcwJykge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgICBpZiAobGVuID09PSAxICYmIGlkeFswXSA9PT0gJy0nKSB7XG4gICAgICByZXR1cm4gYXJyLmxlbmd0aDtcbiAgICB9XG5cbiAgICB3aGlsZSAoKytjdXJzb3IgPCBsZW4pIHtcbiAgICAgIGlmIChpZHhbY3Vyc29yXSA8ICcwJyB8fCBpZHhbY3Vyc29yXSA+ICc5Jykge1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwYXJzZUludChpZHgsIDEwKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhc1ZhbHVlQXRQYXRoKHRhcmdldCwgcGF0aCkge1xuICAgIHZhciBpdDtcbiAgICB2YXIgbGVuO1xuICAgIHZhciBjdXJzb3I7XG4gICAgdmFyIHN0ZXA7XG4gICAgdmFyIHA7XG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBpdCA9IHRhcmdldDtcbiAgICAgIGxlbiA9IHBhdGgubGVuZ3RoO1xuICAgICAgY3Vyc29yID0gLTE7XG4gICAgICBpZiAobGVuKSB7XG4gICAgICAgIHdoaWxlICgrK2N1cnNvciA8IGxlbiAmJiBpdCkge1xuICAgICAgICAgIHN0ZXAgPSBwYXRoW2N1cnNvcl07XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaXQpKSB7XG4gICAgICAgICAgICBpZiAoaXNOYU4oc3RlcCkgfHwgIWlzRmluaXRlKHN0ZXApKSB7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcCA9IHRvQXJyYXlJbmRleFJlZmVyZW5jZShpdCwgc3RlcCk7XG4gICAgICAgICAgICBpZiAoaXQubGVuZ3RoID4gcCkge1xuICAgICAgICAgICAgICBpdCA9IGl0W3BdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGl0ID0gaXRbc3RlcF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gY3Vyc29yID09PSBsZW4gJiYgdHlwZW9mIGl0ICE9PSAndW5kZWZpbmVkJztcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0VmFsdWVBdFBhdGgodGFyZ2V0LCBwYXRoKSB7XG4gICAgdmFyIGl0O1xuICAgIHZhciBsZW47XG4gICAgdmFyIGN1cnNvcjtcbiAgICB2YXIgc3RlcDtcbiAgICB2YXIgcDtcbiAgICB2YXIgbm9uZXhpc3RlbnQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBpdCA9IHRhcmdldDtcbiAgICAgIGxlbiA9IHBhdGgubGVuZ3RoO1xuICAgICAgY3Vyc29yID0gLTE7XG4gICAgICBpZiAobGVuKSB7XG4gICAgICAgIHdoaWxlICgrK2N1cnNvciA8IGxlbiAmJiBpdCkge1xuICAgICAgICAgIHN0ZXAgPSBwYXRoW2N1cnNvcl07XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaXQpKSB7XG4gICAgICAgICAgICBpZiAoaXNOYU4oc3RlcCkgfHwgIWlzRmluaXRlKHN0ZXApKSB7XG4gICAgICAgICAgICAgIHJldHVybiBub25leGlzdGVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHAgPSB0b0FycmF5SW5kZXhSZWZlcmVuY2UoaXQsIHN0ZXApO1xuICAgICAgICAgICAgaWYgKGl0Lmxlbmd0aCA+IHApIHtcbiAgICAgICAgICAgICAgaXQgPSBpdFtwXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBub25leGlzdGVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaXQgPSBpdFtzdGVwXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBpdDtcbiAgICB9XG4gICAgcmV0dXJuIG5vbmV4aXN0ZW50O1xuICB9XG5cbiAgZnVuY3Rpb24gY29tcGlsZVBvaW50ZXJEZXJlZmVyZW5jZShwYXRoKSB7XG4gICAgbGV0IGJvZHkgPSBgaWYgKHR5cGVvZihvYmopICE9PSAndW5kZWZpbmVkJ2A7XG4gICAgaWYgKHBhdGgubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24ocm9vdCkge1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICAgIH07XG4gICAgfVxuICAgIGJvZHkgPSBwYXRoLnJlZHVjZSgoYm9keSwgcCwgaSkgPT4ge1xuICAgICAgcmV0dXJuIGAke2JvZHl9ICYmXG4gICAgdHlwZW9mKChvYmogPSBvYmpbJyR7cmVwbGFjZShwYXRoW2ldLCAnXFxcXCcsICdcXFxcXFxcXCcpfSddKSkgIT09ICd1bmRlZmluZWQnYDtcbiAgICB9LCBgaWYgKHR5cGVvZihvYmopICE9PSAndW5kZWZpbmVkJ2ApO1xuICAgIGJvZHkgPSBgJHtib2R5fSkge1xuICByZXR1cm4gb2JqO1xufWA7XG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbihbJ29iaiddLCBib2R5KTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0VmFsdWVBdFBhdGgodGFyZ2V0LCB2YWwsIHBhdGgsIGZvcmNlKSB7XG4gICAgdmFyIGl0O1xuICAgIHZhciBsZW47XG4gICAgdmFyIGVuZDtcbiAgICB2YXIgY3Vyc29yO1xuICAgIHZhciBzdGVwO1xuICAgIHZhciBwO1xuICAgIHZhciByZW07XG4gICAgdmFyIG5vbmV4aXN0ZW50ID0gdW5kZWZpbmVkO1xuICAgIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3Qgc2V0IHRoZSByb290IG9iamVjdDsgYXNzaWduIGl0IGRpcmVjdGx5LicpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHRhcmdldCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IFR5cGVFcnJvcignQ2Fubm90IHNldCB2YWx1ZXMgb24gdW5kZWZpbmVkJyk7XG4gICAgfVxuICAgIGl0ID0gdGFyZ2V0O1xuICAgIGxlbiA9IHBhdGgubGVuZ3RoO1xuICAgIGVuZCA9IHBhdGgubGVuZ3RoIC0gMTtcbiAgICBjdXJzb3IgPSAtMTtcbiAgICBpZiAobGVuKSB7XG4gICAgICB3aGlsZSAoKytjdXJzb3IgPCBsZW4pIHtcbiAgICAgICAgc3RlcCA9IHBhdGhbY3Vyc29yXTtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaXQpKSB7XG4gICAgICAgICAgcCA9IHRvQXJyYXlJbmRleFJlZmVyZW5jZShpdCwgc3RlcCk7XG4gICAgICAgICAgaWYgKGl0Lmxlbmd0aCA+IHApIHtcbiAgICAgICAgICAgIGlmIChjdXJzb3IgPT09IGVuZCkge1xuICAgICAgICAgICAgICByZW0gPSBpdFtwXTtcbiAgICAgICAgICAgICAgaXRbcF0gPSB2YWw7XG4gICAgICAgICAgICAgIHJldHVybiByZW07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpdCA9IGl0W3BdO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaXQubGVuZ3RoID09PSBwKSB7XG4gICAgICAgICAgICBpdC5wdXNoKHZhbCk7XG4gICAgICAgICAgICByZXR1cm4gbm9uZXhpc3RlbnQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICh0eXBlb2YgaXRbc3RlcF0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAoZm9yY2UpIHtcbiAgICAgICAgICAgICAgaWYgKGN1cnNvciA9PT0gZW5kKSB7XG4gICAgICAgICAgICAgICAgaXRbc3RlcF0gPSB2YWw7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5vbmV4aXN0ZW50O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGl0ID0gaXRbc3RlcF0gPSB7fTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbm9uZXhpc3RlbnQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjdXJzb3IgPT09IGVuZCkge1xuICAgICAgICAgICAgcmVtID0gaXRbc3RlcF07XG4gICAgICAgICAgICBpdFtzdGVwXSA9IHZhbDtcbiAgICAgICAgICAgIHJldHVybiByZW07XG4gICAgICAgICAgfVxuICAgICAgICAgIGl0ID0gaXRbc3RlcF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGl0O1xuICB9XG5cbiAgZnVuY3Rpb24gbG9va3NMaWtlRnJhZ21lbnQocHRyKSB7XG4gICAgcmV0dXJuIHB0ciAmJiBwdHIubGVuZ3RoICYmIHB0clswXSA9PT0gJyMnO1xuICB9XG5cbiAgZnVuY3Rpb24gcGlja0RlY29kZXIocHRyKSB7XG4gICAgcmV0dXJuIChsb29rc0xpa2VGcmFnbWVudChwdHIpKSA/IGRlY29kZVVyaUZyYWdtZW50SWRlbnRpZmllciA6IGRlY29kZVBvaW50ZXI7XG4gIH1cblxuICBsZXQgJHBhdGggPSBTeW1ib2woKTtcbiAgbGV0ICRvcmlnID0gU3ltYm9sKCk7XG4gIGxldCAkcG9pbnRlciA9IFN5bWJvbCgpO1xuICBsZXQgJGZyYWdtZW50SWQgPSBTeW1ib2woKTtcblxuICBjbGFzcyBKc29uUG9pbnRlciB7XG5cbiAgICBjb25zdHJ1Y3RvcihwdHIpIHtcbiAgICAgIHRoaXNbJG9yaWddID0gcHRyO1xuICAgICAgdGhpc1skcGF0aF0gPSAoQXJyYXkuaXNBcnJheShwdHIpKSA/IHB0ciA6IHBpY2tEZWNvZGVyKHB0cikocHRyKTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnZ2V0Jywge1xuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICB2YWx1ZTogY29tcGlsZVBvaW50ZXJEZXJlZmVyZW5jZSh0aGlzLnBhdGgpXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXQgcGF0aCgpIHtcbiAgICAgIHJldHVybiB0aGlzWyRwYXRoXTtcbiAgICB9XG5cbiAgICBnZXQgcG9pbnRlcigpIHtcbiAgICAgIGlmICghdGhpc1skcG9pbnRlcl0pIHtcbiAgICAgICAgdGhpc1skcG9pbnRlcl0gPSBlbmNvZGVQb2ludGVyKHRoaXMucGF0aCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpc1skcG9pbnRlcl07XG4gICAgfVxuXG4gICAgZ2V0IHVyaUZyYWdtZW50SWRlbnRpZmllcigpIHtcbiAgICAgIGlmICghdGhpc1skZnJhZ21lbnRJZF0pIHtcbiAgICAgICAgdGhpc1skZnJhZ21lbnRJZF0gPSBlbmNvZGVVcmlGcmFnbWVudElkZW50aWZpZXIodGhpcy5wYXRoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzWyRmcmFnbWVudElkXTtcbiAgICB9XG5cbiAgICBoYXModGFyZ2V0KSB7XG4gICAgICByZXR1cm4gdHlwZW9mKHRoaXMuZ2V0KHRhcmdldCkpICE9ICd1bmRlZmluZWQnO1xuICAgIH1cblxuICB9XG5cbiAgY2xhc3MgSnNvblJlZmVyZW5jZSB7XG5cbiAgICBjb25zdHJ1Y3Rvcihwb2ludGVyKSB7XG4gICAgICB0aGlzWyRwb2ludGVyXSA9IHBvaW50ZXI7XG4gICAgfVxuXG4gICAgZ2V0ICRyZWYoKSB7XG4gICAgICByZXR1cm4gdGhpc1skcG9pbnRlcl0udXJpRnJhZ21lbnRJZGVudGlmaWVyO1xuICAgIH1cblxuICAgIHJlc29sdmUodGFyZ2V0KSB7XG4gICAgICByZXR1cm4gdGhpc1skcG9pbnRlcl0uZ2V0KHRhcmdldCk7XG4gICAgfVxuXG4gICAgdG9TdHJpbmcoKSB7XG4gICAgICByZXR1cm4gdGhpcy4kcmVmO1xuICAgIH1cblxuICB9XG5cbiAgSnNvblJlZmVyZW5jZS5pc1JlZmVyZW5jZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogJiYgb2JqIGluc3RhbmNlb2YgSnNvblJlZmVyZW5jZSB8fFxuICAgICAgKHR5cGVvZiBvYmouJHJlZiA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgdHlwZW9mIG9iai5yZXNvbHZlID09PSAnZnVuY3Rpb24nKTtcbiAgfTtcblxuICBmdW5jdGlvbiB2aXNpdCh0YXJnZXQsIHZpc2l0b3IsIGN5Y2xlKSB7XG4gICAgdmFyIGl0ZW1zLCBpLCBpbGVuLCBqLCBqbGVuLCBpdCwgcGF0aCwgY3Vyc29yLCB0eXBlVDtcbiAgICB2YXIgZGlzdGluY3RPYmplY3RzO1xuICAgIHZhciBxID0gbmV3IEFycmF5KCk7XG4gICAgdmFyIHFjdXJzb3IgPSAwO1xuICAgIHEucHVzaCh7XG4gICAgICBvYmo6IHRhcmdldCxcbiAgICAgIHBhdGg6IFtdXG4gICAgfSk7XG4gICAgaWYgKGN5Y2xlKSB7XG4gICAgICBkaXN0aW5jdE9iamVjdHMgPSBuZXcgTWFwKCk7XG4gICAgfVxuICAgIHZpc2l0b3IoZW5jb2RlUG9pbnRlcihbXSksIHRhcmdldCk7XG4gICAgd2hpbGUgKHFjdXJzb3IgPCBxLmxlbmd0aCkge1xuICAgICAgY3Vyc29yID0gcVtxY3Vyc29yKytdO1xuICAgICAgdHlwZVQgPSB0eXBlb2YgY3Vyc29yLm9iajtcbiAgICAgIGlmICh0eXBlVCA9PT0gJ29iamVjdCcgJiYgY3Vyc29yLm9iaiAhPT0gbnVsbCkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjdXJzb3Iub2JqKSkge1xuICAgICAgICAgIGogPSAtMTtcbiAgICAgICAgICBqbGVuID0gY3Vyc29yLm9iai5sZW5ndGg7XG4gICAgICAgICAgd2hpbGUgKCsraiA8IGpsZW4pIHtcbiAgICAgICAgICAgIGl0ID0gY3Vyc29yLm9ialtqXTtcbiAgICAgICAgICAgIHBhdGggPSBjdXJzb3IucGF0aC5jb25jYXQoaik7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGl0ID09PSAnb2JqZWN0JyAmJiBpdCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoY3ljbGUgJiYgZGlzdGluY3RPYmplY3RzLmhhcyhpdCkpIHtcbiAgICAgICAgICAgICAgICB2aXNpdG9yKGVuY29kZVBvaW50ZXIocGF0aCksIG5ldyBKc29uUmVmZXJlbmNlKGRpc3RpbmN0T2JqZWN0cy5nZXQoaXQpKSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcS5wdXNoKHtcbiAgICAgICAgICAgICAgICBvYmo6IGl0LFxuICAgICAgICAgICAgICAgIHBhdGg6IHBhdGhcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGlmIChjeWNsZSkge1xuICAgICAgICAgICAgICAgIGRpc3RpbmN0T2JqZWN0cy5zZXQoaXQsIG5ldyBKc29uUG9pbnRlcihlbmNvZGVVcmlGcmFnbWVudElkZW50aWZpZXIocGF0aCkpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmlzaXRvcihlbmNvZGVQb2ludGVyKHBhdGgpLCBpdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGl0ZW1zID0gT2JqZWN0LmtleXMoY3Vyc29yLm9iaik7XG4gICAgICAgICAgaWxlbiA9IGl0ZW1zLmxlbmd0aDtcbiAgICAgICAgICBpID0gLTE7XG4gICAgICAgICAgd2hpbGUgKCsraSA8IGlsZW4pIHtcbiAgICAgICAgICAgIGl0ID0gY3Vyc29yLm9ialtpdGVtc1tpXV07XG4gICAgICAgICAgICBwYXRoID0gY3Vyc29yLnBhdGguY29uY2F0KGl0ZW1zW2ldKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgaXQgPT09ICdvYmplY3QnICYmIGl0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChjeWNsZSAmJiBkaXN0aW5jdE9iamVjdHMuaGFzKGl0KSkge1xuICAgICAgICAgICAgICAgIHZpc2l0b3IoZW5jb2RlUG9pbnRlcihwYXRoKSwgbmV3IEpzb25SZWZlcmVuY2UoZGlzdGluY3RPYmplY3RzLmdldChpdCkpKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBxLnB1c2goe1xuICAgICAgICAgICAgICAgIG9iajogaXQsXG4gICAgICAgICAgICAgICAgcGF0aDogcGF0aFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgaWYgKGN5Y2xlKSB7XG4gICAgICAgICAgICAgICAgZGlzdGluY3RPYmplY3RzLnNldChpdCwgbmV3IEpzb25Qb2ludGVyKGVuY29kZVVyaUZyYWdtZW50SWRlbnRpZmllcihwYXRoKSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2aXNpdG9yKGVuY29kZVBvaW50ZXIocGF0aCksIGl0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBKc29uUG9pbnRlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24odGFyZ2V0LCB2YWx1ZSwgZm9yY2UpIHtcbiAgICByZXR1cm4gc2V0VmFsdWVBdFBhdGgodGFyZ2V0LCB2YWx1ZSwgdGhpcy5wYXRoLCBmb3JjZSk7XG4gIH07XG5cbiAgSnNvblBvaW50ZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMub3JpZ2luYWw7XG4gIH07XG5cbiAgSnNvblBvaW50ZXIuY3JlYXRlID0gZnVuY3Rpb24ocHRyKSB7XG4gICAgcmV0dXJuIG5ldyBKc29uUG9pbnRlcihwdHIpO1xuICB9O1xuXG4gIEpzb25Qb2ludGVyLmhhcyA9IGZ1bmN0aW9uKHRhcmdldCwgcHRyKSB7XG4gICAgcmV0dXJuIGhhc1ZhbHVlQXRQYXRoKHRhcmdldCwgcGlja0RlY29kZXIocHRyKShwdHIpKTtcbiAgfTtcblxuICBKc29uUG9pbnRlci5nZXQgPSBmdW5jdGlvbih0YXJnZXQsIHB0cikge1xuICAgIHJldHVybiBnZXRWYWx1ZUF0UGF0aCh0YXJnZXQsIHBpY2tEZWNvZGVyKHB0cikocHRyKSk7XG4gIH07XG5cbiAgSnNvblBvaW50ZXIuc2V0ID0gZnVuY3Rpb24odGFyZ2V0LCBwdHIsIHZhbCwgZm9yY2UpIHtcbiAgICByZXR1cm4gc2V0VmFsdWVBdFBhdGgodGFyZ2V0LCB2YWwsIHBpY2tEZWNvZGVyKHB0cikocHRyKSwgZm9yY2UpO1xuICB9O1xuXG4gIEpzb25Qb2ludGVyLmxpc3QgPSBmdW5jdGlvbih0YXJnZXQsIGZyYWdtZW50SWQpIHtcbiAgICB2YXIgcmVzID0gW107XG4gICAgdmFyIHZpc2l0b3IgPSAoZnJhZ21lbnRJZCkgP1xuICAgICAgZnVuY3Rpb24ocHRyLCB2YWwpIHtcbiAgICAgICAgcmVzLnB1c2goe1xuICAgICAgICAgIGZyYWdtZW50SWQ6IGVuY29kZVVyaUZyYWdtZW50SWRlbnRpZmllcihkZWNvZGVQb2ludGVyKHB0cikpLFxuICAgICAgICAgIHZhbHVlOiB2YWxcbiAgICAgICAgfSk7XG4gICAgICB9IDpcbiAgICAgIGZ1bmN0aW9uKHB0ciwgdmFsKSB7XG4gICAgICAgIHJlcy5wdXNoKHtcbiAgICAgICAgICBwb2ludGVyOiBwdHIsXG4gICAgICAgICAgdmFsdWU6IHZhbFxuICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgdmlzaXQodGFyZ2V0LCB2aXNpdG9yKTtcbiAgICByZXR1cm4gcmVzO1xuICB9O1xuXG4gIEpzb25Qb2ludGVyLmZsYXR0ZW4gPSBmdW5jdGlvbih0YXJnZXQsIGZyYWdtZW50SWQpIHtcbiAgICB2YXIgcmVzID0ge307XG4gICAgdmFyIHZpc2l0b3IgPSAoZnJhZ21lbnRJZCkgP1xuICAgICAgZnVuY3Rpb24ocHRyLCB2YWwpIHtcbiAgICAgICAgcmVzW2VuY29kZVVyaUZyYWdtZW50SWRlbnRpZmllcihkZWNvZGVQb2ludGVyKHB0cikpXSA9IHZhbDtcbiAgICAgIH0gOlxuICAgICAgZnVuY3Rpb24ocHRyLCB2YWwpIHtcbiAgICAgICAgcmVzW3B0cl0gPSB2YWw7XG4gICAgICB9O1xuICAgIHZpc2l0KHRhcmdldCwgdmlzaXRvcik7XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcblxuICBKc29uUG9pbnRlci5tYXAgPSBmdW5jdGlvbih0YXJnZXQsIGZyYWdtZW50SWQpIHtcbiAgICB2YXIgcmVzID0gbmV3IE1hcCgpO1xuICAgIHZhciB2aXNpdG9yID0gKGZyYWdtZW50SWQpID9cbiAgICAgIGZ1bmN0aW9uKHB0ciwgdmFsKSB7XG4gICAgICAgIHJlcy5zZXQoZW5jb2RlVXJpRnJhZ21lbnRJZGVudGlmaWVyKGRlY29kZVBvaW50ZXIocHRyKSksIHZhbCk7XG4gICAgICB9IDogcmVzLnNldC5iaW5kKHJlcyk7XG4gICAgdmlzaXQodGFyZ2V0LCB2aXNpdG9yKTtcbiAgICByZXR1cm4gcmVzO1xuICB9O1xuXG4gIEpzb25Qb2ludGVyLnZpc2l0ID0gdmlzaXQ7XG5cbiAgSnNvblBvaW50ZXIuZGVjb2RlID0gZnVuY3Rpb24ocHRyKSB7XG4gICAgcmV0dXJuIHBpY2tEZWNvZGVyKHB0cikocHRyKTtcbiAgfTtcblxuICBKc29uUG9pbnRlci5kZWNvZGVQb2ludGVyID0gZGVjb2RlUG9pbnRlcjtcbiAgSnNvblBvaW50ZXIuZW5jb2RlUG9pbnRlciA9IGVuY29kZVBvaW50ZXI7XG4gIEpzb25Qb2ludGVyLmRlY29kZVVyaUZyYWdtZW50SWRlbnRpZmllciA9IGRlY29kZVVyaUZyYWdtZW50SWRlbnRpZmllcjtcbiAgSnNvblBvaW50ZXIuZW5jb2RlVXJpRnJhZ21lbnRJZGVudGlmaWVyID0gZW5jb2RlVXJpRnJhZ21lbnRJZGVudGlmaWVyO1xuXG4gIEpzb25Qb2ludGVyLkpzb25SZWZlcmVuY2UgPSBKc29uUmVmZXJlbmNlO1xuICBKc29uUG9pbnRlci5pc1JlZmVyZW5jZSA9IEpzb25SZWZlcmVuY2UuaXNSZWZlcmVuY2U7XG5cbiAgSnNvblBvaW50ZXIubm9Db25mbGljdCA9IGZ1bmN0aW9uKCkge1xuICAgIHJvb3QuSnNvblBvaW50ZXIgPSBzYXZlZEpzb25Qb2ludGVyO1xuICAgIHJldHVybiBKc29uUG9pbnRlcjtcbiAgfTtcblxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBKc29uUG9pbnRlcjtcbiAgICB9XG4gICAgZXhwb3J0cy5Kc29uUG9pbnRlciA9IEpzb25Qb2ludGVyO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuSnNvblBvaW50ZXIgPSBKc29uUG9pbnRlcjtcbiAgfVxufSkuY2FsbCh0aGlzKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1pbnZhbGlkLXRoaXNcbiJdfQ==
