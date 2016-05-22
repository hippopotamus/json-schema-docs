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
                        id: item[key].id
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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJicm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2pzb24tbWFya3VwL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBqc29uTWFya3VwID0gcmVxdWlyZSgnanNvbi1tYXJrdXAnKVxuXG5hbmd1bGFyLm1vZHVsZSgnYXBwJywgWyd1aS5ib290c3RyYXAnLCAnbmdTYW5pdGl6ZSddKS5jb25maWcoZnVuY3Rpb24oJGh0dHBQcm92aWRlcil7XG4gICAgJGh0dHBQcm92aWRlci5kZWZhdWx0cy5oZWFkZXJzLmNvbW1vbltcIlgtUmVxdWVzdGVkLVdpdGhcIl0gPSAnWE1MSHR0cFJlcXVlc3QnO1xufSkuY29udHJvbGxlcignY29udHJvbGxlcicsIGZ1bmN0aW9uKCRzY29wZSwgJGh0dHAsICR0aW1lb3V0KXtcbiAgICAkaHR0cC5nZXQoJy9zY2hlbWEnKS50aGVuKGZ1bmN0aW9uKHJlcyl7XG4gICAgICAgICRzY29wZS5zY2hlbWEgPSBtYXBKU09OKHJlcy5kYXRhKVxuICAgIH0pXG5cbiAgICBmdW5jdGlvbiBtYXBKU09OKHNjaGVtYSkge1xuICAgICAgICByZXBsYWNlUmVmcyhzY2hlbWEpXG5cbiAgICAgICAgJHNjb3BlLnJlc291cmNlcyA9IFtdXG4gICAgICAgIGJ1aWxkRmxhdFJlc291cmNlc0xpc3Qoc2NoZW1hKVxuICAgICAgICAkc2NvcGUuc2lkZWJhckl0ZW1zID0gYnVpbGRTaWRlYmFyKCRzY29wZS5yZXNvdXJjZXMpXG4gICAgICAgIF8ubWFwKCRzY29wZS5yZXNvdXJjZXMsIGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgbWFwUmVxdWlyZWRPbnRvUHJvcGVydGllcyhyZXNvdXJjZSlcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXBsYWNlUmVmcyAoc2NoZW1hKSB7XG4gICAgICAgIC8qIFRoaXMgY3Jhd2xzIHRoZSBKU09OIHNjaGVtYSBmb3IgYWxsICRyZWZzLCBhbmQgcmVwbGFjZXMgdGhlbSB3aXRoIHRoZSBzY2hlbWEgdGhleSdyZSByZWZlcmVuY2luZyAqL1xuICAgICAgICAvKiBNYXliZSBJJ20gbWlzdW5kZXJzdGFuZGluZyBKU09OIHBvaW50ZXJzLiBJIHdhcyBob3BpbmcgSSB0aGVyZSB3YXMgc29tZSBtYWdpYyBKU09OIHB0ciBhcGkgZm4gdGhhdCByZXBsYWNlcyBhbGwgJHJlZnMgd2l0aCB0aGUgb2JqIHRoZXkgcmVmZXJlbmNlICovXG4gICAgICAgIHZhciBwdHIgPSBKc29uUG9pbnRlci5ub0NvbmZsaWN0KClcbiAgICAgICAgXy5mb3JFYWNoKF8ua2V5cyhwdHIuZmxhdHRlbihzY2hlbWEpKSwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgICAgICB2YXIgcGF0aExpc3QgPSBwdHIuZGVjb2RlKGl0ZW0pXG4gICAgICAgICAgICAgaWYgKHBhdGhMaXN0W3BhdGhMaXN0Lmxlbmd0aC0xXSA9PT0gJyRyZWYnKSB7XG4gICAgICAgICAgICAgICAgdmFyIG9ialBhdGggPSAnIy8nICsgXy5zbGljZShwYXRoTGlzdCwgMCwgcGF0aExpc3QubGVuZ3RoLTEpLmpvaW4oJy8nKSAvLyBidWlsZGluZyBhYnMgcGF0aCB0byBpdGVtIHdpdGggYSAkcmVmXG4gICAgICAgICAgICAgICAgcHRyLnNldChzY2hlbWEsIG9ialBhdGgsIHB0ci5nZXQoc2NoZW1hLCBwdHIuZ2V0KHNjaGVtYSwgaXRlbSkpKSAvLyBzZXQgdGhhdCBpdGVtIHRvIHRoZSBzY2hlbWEgcmVmZXJlbmNlZCBpbiBpdCdzICRyZWZcbiAgICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnVpbGRGbGF0UmVzb3VyY2VzTGlzdCAoc2NoZW1hKSB7XG4gICAgICAgIF8uZm9yRWFjaChfLmtleXMoc2NoZW1hKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgdmFyIGl0ZW0gPSBzY2hlbWFba2V5XVxuICAgICAgICAgICAgaWYgKF8uaXNPYmplY3QoaXRlbSkpIHtcbiAgICAgICAgICAgICAgICBfLmZvckVhY2goXy5rZXlzKGl0ZW0pLCBmdW5jdGlvbiAoaykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoayA9PT0gJ3Jlc291cmNlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVpbGRGbGF0UmVzb3VyY2VzTGlzdChpdGVtKVxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbSA9IF8ub21pdChpdGVtLCBrKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChrZXkgPT09ICdyZXNvdXJjZScpIHtcbiAgICAgICAgICAgICAgICAkc2NvcGUucmVzb3VyY2VzLnB1c2goc2NoZW1hKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1aWxkU2lkZWJhciAocmVzb3VyY2VzKSB7XG4gICAgICAgIHJldHVybiBfLm1hcChyZXNvdXJjZXMsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGl0ZW0ucmVzb3VyY2UsXG4gICAgICAgICAgICAgICAgc3ViUmVzb3VyY2VzOiBfLmNoYWluKGl0ZW0pLmtleXMoKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgICAgICAvKiBtYXBwaW5nIHRoZSBuYW1lIG9mIHRoZSByZXNvdXJjZSBhbmQgdGhlIHVyaS4gbmFtZSBmb3IgdGhlIHRpdGxlIGluIHNpZGViYXIsIGlkICh1cmkpIGlzIHVzZWQgZm9yIGJvb2ttYXJraW5nIHRoZSBpdGVtICovXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBpdGVtW2tleV0ubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBpdGVtW2tleV0uaWRcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pLmZpbHRlcignbmFtZScpLnZhbHVlKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYXBSZXF1aXJlZE9udG9Qcm9wZXJ0aWVzIChyZXNvdXJjZSkge1xuICAgICAgICB2YXIgcHJvcGVydGllcyA9IF8uZ2V0KHJlc291cmNlLCAncHJvcGVydGllcycpXG4gICAgICAgIHZhciByZXF1aXJlZFByb3BlcnRpZXMgPSBfLmdldChyZXNvdXJjZSwgJ3JlcXVpcmVkJylcbiAgICAgICAgaWYgKHByb3BlcnRpZXMgJiYgcmVxdWlyZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICBfLmZvckVhY2gocmVxdWlyZWRQcm9wZXJ0aWVzLCBmdW5jdGlvbiAocHJvcGVydHlOYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIHByb3BlcnR5ID0gXy5nZXQocHJvcGVydGllcywgcHJvcGVydHlOYW1lKVxuICAgICAgICAgICAgICAgIGlmICghcHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgICAgICAgICAgICBcIlByb3BlcnR5IHtwcm9wfSBpcyBsaXN0ZWQgYXMgcmVxdWlyZWQgaW4gcmVzb3VyY2Uge3Jlc291cmNlfSwgYnV0IGlzIG5vdCBpbiB0aGUgc2NoZW1hXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKCd7cHJvcH0nLCBwcm9wZXJ0eU5hbWUpLnJlcGxhY2UoJ3tyZXNvdXJjZX0nLCBfLmdldChyZXNvdXJjZSwgJ25hbWUnKSlcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIF8ubWVyZ2UocHJvcGVydHksIHsgcmVxdWlyZWQ6IHRydWUgfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIC8qIGlmIHRoZXJlIGlzIGFuIG9iamVjdCwgcmVjdXJzZSBvbnRvIGl0ICovXG4gICAgICAgIF8uZm9yRWFjaChfLmtleXMocmVzb3VyY2UpLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICAvKiBpZiBpdCdzIGFuIG9iamVjdCwgZ28gZGVlcGVyICovXG4gICAgICAgICAgICBpZiAoXy5pc09iamVjdChyZXNvdXJjZVtrZXldKSkge1xuICAgICAgICAgICAgICAgIG1hcFJlcXVpcmVkT250b1Byb3BlcnRpZXMocmVzb3VyY2Vba2V5XSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChrZXkgPT09ICdpdGVtcycgJiYgXy5pc0FycmF5KHJlc291cmNlW2tleV0pKSB7XG4gICAgICAgICAgICAgICAgLyogaXRlbXMgY2FuIGhhdmUgYW4gYXJyYXkgb2Ygb2JqZWN0cywgc28gdHJlZSByZWN1cnNpb24gaGVyZSA6KSAqL1xuICAgICAgICAgICAgICAgIF8uZm9yRWFjaChyZXNvdXJjZVtrZXldLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICBtYXBSZXF1aXJlZE9udG9Qcm9wZXJ0aWVzKHJlc291cmNlW2tleV0pXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICAkc2NvcGUuZm9ybWF0VHlwZSA9IGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIHZhciB0eXBlID0gXy5nZXQoaXRlbSwgJ3R5cGUnKVxuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVcbiAgICAgICAgfSBlbHNlIGlmIChfLmdldChpdGVtLCAnYW55T2YnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdhbnlPZidcbiAgICAgICAgfSBlbHNlIGlmIChfLmdldChpdGVtLCAnYWxsT2YnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdhbGxPZidcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgJHNjb3BlLmZvcm1hdFNwZWNNZXRhID0gZnVuY3Rpb24gKHNwZWMpIHtcbiAgICAgICAgdmFyIGFueU9mID0gXy5nZXQoc3BlYywgJ2FueU9mJylcbiAgICAgICAgaWYgKGFueU9mKSB7XG4gICAgICAgICAgICByZXR1cm4gZm9ybWF0QXJyYXlNZXRhKGFueU9mKVxuICAgICAgICB9XG4gICAgICAgIHZhciBhbGxPZiA9IF8uZ2V0KHNwZWMsICdhbGxPZicpXG4gICAgICAgIGlmIChhbGxPZikge1xuICAgICAgICAgICAgcmV0dXJuIGZvcm1hdEFycmF5TWV0YShhbGxPZilcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghXy5pc09iamVjdChzcGVjKSkge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb21pdHRlZFNwZWNzID0gXy5vbWl0KHNwZWMsIFsndHlwZScsICdkZXNjcmlwdGlvbicsICckJGhhc2hLZXknLCAncmVxdWlyZWQnLCAnaXRlbXMnXSlcbiAgICAgICAgaWYgKCFfLmtleXMob21pdHRlZFNwZWNzKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF8ubWFwKF8ua2V5cyhvbWl0dGVkU3BlY3MpLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gJzxzdHJvbmc+JytrZXkrJzo8L3N0cm9uZz4gJytvbWl0dGVkU3BlY3Nba2V5XVxuICAgICAgICB9KS5qb2luKCcsICcpXG4gICAgfVxuXG4gICAgJHNjb3BlLmh0bWxpZnlKU09OID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4ganNvbk1hcmt1cChvYmopXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0QXJyYXlNZXRhIChpdGVtcykge1xuICAgICAgICByZXR1cm4gXy5tYXAoaXRlbXMsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3snICsgXy5tYXAoXy5rZXlzKGl0ZW0pLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICc8c3Ryb25nPicra2V5Kyc6PC9zdHJvbmc+ICcgKyBpdGVtW2tleV1cbiAgICAgICAgICAgIH0pLmpvaW4oJywgJylcbiAgICAgICAgfSkuam9pbignfSwgJykgKyAnfSdcbiAgICB9XG59KTtcbiIsInZhciBJTkRFTlQgPSAnICAgICc7XG5cbnZhciB0eXBlID0gZnVuY3Rpb24oZG9jKSB7XG5cdGlmIChkb2MgPT09IG51bGwpIHJldHVybiAnbnVsbCc7XG5cdGlmIChBcnJheS5pc0FycmF5KGRvYykpIHJldHVybiAnYXJyYXknO1xuXHRpZiAodHlwZW9mIGRvYyA9PT0gJ3N0cmluZycgJiYgL15odHRwcz86Ly50ZXN0KGRvYykpIHJldHVybiAnbGluayc7XG5cblx0cmV0dXJuIHR5cGVvZiBkb2M7XG59O1xuXG52YXIgZXNjYXBlID0gZnVuY3Rpb24oc3RyKSB7XG5cdHJldHVybiBzdHIucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZG9jKSB7XG5cdHZhciBpbmRlbnQgPSAnJztcblxuXHR2YXIgZm9yRWFjaCA9IGZ1bmN0aW9uKGxpc3QsIHN0YXJ0LCBlbmQsIGZuKSB7XG5cdFx0aWYgKCFsaXN0Lmxlbmd0aCkgcmV0dXJuIHN0YXJ0KycgJytlbmQ7XG5cblx0XHR2YXIgb3V0ID0gc3RhcnQrJ1xcbic7XG5cblx0XHRpbmRlbnQgKz0gSU5ERU5UO1xuXHRcdGxpc3QuZm9yRWFjaChmdW5jdGlvbihrZXksIGkpIHtcblx0XHRcdG91dCArPSBpbmRlbnQrZm4oa2V5KSsoaSA8IGxpc3QubGVuZ3RoLTEgPyAnLCcgOiAnJykrJ1xcbic7XG5cdFx0fSk7XG5cdFx0aW5kZW50ID0gaW5kZW50LnNsaWNlKDAsIC1JTkRFTlQubGVuZ3RoKTtcblxuXHRcdHJldHVybiBvdXQgKyBpbmRlbnQrZW5kO1xuXHR9O1xuXG5cdHZhciB2aXNpdCA9IGZ1bmN0aW9uKG9iaikge1xuXHRcdGlmIChvYmogPT09IHVuZGVmaW5lZCkgcmV0dXJuICcnO1xuXG5cdFx0c3dpdGNoICh0eXBlKG9iaikpIHtcblx0XHRcdGNhc2UgJ2Jvb2xlYW4nOlxuXHRcdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cImpzb24tbWFya3VwLWJvb2xcIj4nK29iaisnPC9zcGFuPic7XG5cblx0XHRcdGNhc2UgJ251bWJlcic6XG5cdFx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwianNvbi1tYXJrdXAtbnVtYmVyXCI+JytvYmorJzwvc3Bhbj4nO1xuXG5cdFx0XHRjYXNlICdudWxsJzpcblx0XHRcdHJldHVybiAnPHNwYW4gY2xhc3M9XCJqc29uLW1hcmt1cC1udWxsXCI+bnVsbDwvc3Bhbj4nO1xuXG5cdFx0XHRjYXNlICdzdHJpbmcnOlxuXHRcdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cImpzb24tbWFya3VwLXN0cmluZ1wiPlwiJytlc2NhcGUob2JqLnJlcGxhY2UoL1xcbi9nLCAnXFxuJytpbmRlbnQpKSsnXCI8L3NwYW4+JztcblxuXHRcdFx0Y2FzZSAnbGluayc6XG5cdFx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwianNvbi1tYXJrdXAtc3RyaW5nXCI+XCI8YSBocmVmPVwiJytlc2NhcGUob2JqKSsnXCI+Jytlc2NhcGUob2JqKSsnPC9hPlwiPC9zcGFuPic7XG5cblx0XHRcdGNhc2UgJ2FycmF5Jzpcblx0XHRcdHJldHVybiBmb3JFYWNoKG9iaiwgJ1snLCAnXScsIHZpc2l0KTtcblxuXHRcdFx0Y2FzZSAnb2JqZWN0Jzpcblx0XHRcdHZhciBrZXlzID0gT2JqZWN0LmtleXMob2JqKS5maWx0ZXIoZnVuY3Rpb24oa2V5KSB7XG5cdFx0XHRcdHJldHVybiBvYmpba2V5XSAhPT0gdW5kZWZpbmVkO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiBmb3JFYWNoKGtleXMsICd7JywgJ30nLCBmdW5jdGlvbihrZXkpIHtcblx0XHRcdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cImpzb24tbWFya3VwLWtleVwiPicra2V5ICsgJzo8L3NwYW4+ICcrdmlzaXQob2JqW2tleV0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICcnO1xuXHR9O1xuXG5cdHJldHVybiAnPGRpdiBjbGFzcz1cImpzb24tbWFya3VwXCI+Jyt2aXNpdChkb2MpKyc8L2Rpdj4nO1xufTtcbiJdfQ==
