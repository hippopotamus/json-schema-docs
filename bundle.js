(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var jsonMarkup = require('json-markup')

angular.module('app', ['ui.bootstrap', 'ngSanitize']).config(function($httpProvider){
    $httpProvider.defaults.headers.common["X-Requested-With"] = 'XMLHttpRequest';
}).controller('controller', function($scope, $http, $timeout){
    $http.get('/schema').then(function(res){
        $scope.schema = mapJSON(res.data)
    })

    function mapJSON(schema) {
        replaceRefs(schema)

        $scope.resources = []
        buildFlatResourcesList(schema)
        $scope.sidebarItems = buildSidebar($scope.resources)
        console.log($scope.sidebarItems)
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
            return 'anyOf'
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
});

},{"json-markup":2}],2:[function(require,module,exports){
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

},{}]},{},[1]);
