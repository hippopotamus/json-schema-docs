(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var jsonMarkup = require('json-markup')

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJicm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2pzb24tbWFya3VwL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIganNvbk1hcmt1cCA9IHJlcXVpcmUoJ2pzb24tbWFya3VwJylcblxuYW5ndWxhci5tb2R1bGUoJ2FwcCcsIFsndWkuYm9vdHN0cmFwJywgJ25nU2FuaXRpemUnXSkuY29uZmlnKGZ1bmN0aW9uKCRodHRwUHJvdmlkZXIpe1xuICAgICRodHRwUHJvdmlkZXIuZGVmYXVsdHMuaGVhZGVycy5jb21tb25bXCJYLVJlcXVlc3RlZC1XaXRoXCJdID0gJ1hNTEh0dHBSZXF1ZXN0Jztcbn0pLmNvbnRyb2xsZXIoJ2NvbnRyb2xsZXInLCBmdW5jdGlvbigkc2NvcGUsICRodHRwLCAkdGltZW91dCl7XG4gICAgJGh0dHAuZ2V0KCcvc2NoZW1hJykudGhlbihmdW5jdGlvbihyZXMpe1xuICAgICAgICAkc2NvcGUuc2NoZW1hID0gbWFwSlNPTihyZXMuZGF0YSlcbiAgICB9KVxuXG4gICAgZnVuY3Rpb24gbWFwSlNPTihzY2hlbWEpIHtcbiAgICAgICAgLyogaSBjb3VsZCBvcHRpbWl6ZSB0aGlzIHByZXR0eSBlYXNpbHkuIGlmIGl0IGVhdHMgeW91ciBicm93c2VyLCBsZXQgbWUga25vdywgYW5kIGknbGwgbWFrZSBpdCBiZXR0ZXIuLi4gaWYgeW91J3JlIHJlYWRpbmcgdGhpcywgeW91IGNvdWxkIHByb2JhYmx5IGRvIGl0IHRvby5cbiAgICAgICAgaSB3aWxsIGhhcHBpbHkgZG8gaXQgZm9yIHNvbWVvbmUgd2hvIGZvdW5kIHRoaXMgdXNlZnVsLiAqL1xuICAgICAgICByZXBsYWNlUmVmcyhzY2hlbWEpXG5cbiAgICAgICAgJHNjb3BlLnJlc291cmNlcyA9IFtdXG4gICAgICAgIGJ1aWxkRmxhdFJlc291cmNlc0xpc3Qoc2NoZW1hKVxuICAgICAgICAkc2NvcGUuc2lkZWJhckl0ZW1zID0gYnVpbGRTaWRlYmFyKCRzY29wZS5yZXNvdXJjZXMpXG4gICAgICAgIF8ubWFwKCRzY29wZS5yZXNvdXJjZXMsIGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgbWFwUmVxdWlyZWRPbnRvUHJvcGVydGllcyhyZXNvdXJjZSlcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXBsYWNlUmVmcyAoc2NoZW1hKSB7XG4gICAgICAgIC8qIFRoaXMgY3Jhd2xzIHRoZSBKU09OIHNjaGVtYSBmb3IgYWxsICRyZWZzLCBhbmQgcmVwbGFjZXMgdGhlbSB3aXRoIHRoZSBzY2hlbWEgdGhleSdyZSByZWZlcmVuY2luZyAqL1xuICAgICAgICAvKiBNYXliZSBJJ20gbWlzdW5kZXJzdGFuZGluZyBKU09OIHBvaW50ZXJzLiBJIHdhcyBob3BpbmcgSSB0aGVyZSB3YXMgc29tZSBtYWdpYyBKU09OIHB0ciBhcGkgZm4gdGhhdCByZXBsYWNlcyBhbGwgJHJlZnMgd2l0aCB0aGUgb2JqIHRoZXkgcmVmZXJlbmNlICovXG4gICAgICAgIHZhciBwdHIgPSBKc29uUG9pbnRlci5ub0NvbmZsaWN0KClcbiAgICAgICAgXy5mb3JFYWNoKF8ua2V5cyhwdHIuZmxhdHRlbihzY2hlbWEpKSwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgICAgICB2YXIgcGF0aExpc3QgPSBwdHIuZGVjb2RlKGl0ZW0pXG4gICAgICAgICAgICAgaWYgKHBhdGhMaXN0W3BhdGhMaXN0Lmxlbmd0aC0xXSA9PT0gJyRyZWYnKSB7XG4gICAgICAgICAgICAgICAgdmFyIG9ialBhdGggPSAnIy8nICsgXy5zbGljZShwYXRoTGlzdCwgMCwgcGF0aExpc3QubGVuZ3RoLTEpLmpvaW4oJy8nKSAvLyBidWlsZGluZyBhYnMgcGF0aCB0byBpdGVtIHdpdGggYSAkcmVmXG4gICAgICAgICAgICAgICAgcHRyLnNldChzY2hlbWEsIG9ialBhdGgsIHB0ci5nZXQoc2NoZW1hLCBwdHIuZ2V0KHNjaGVtYSwgaXRlbSkpKSAvLyBzZXQgdGhhdCBpdGVtIHRvIHRoZSBzY2hlbWEgcmVmZXJlbmNlZCBpbiBpdCdzICRyZWZcbiAgICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnVpbGRGbGF0UmVzb3VyY2VzTGlzdCAoc2NoZW1hKSB7XG4gICAgICAgIF8uZm9yRWFjaChfLmtleXMoc2NoZW1hKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgdmFyIGl0ZW0gPSBzY2hlbWFba2V5XVxuICAgICAgICAgICAgaWYgKF8uaXNPYmplY3QoaXRlbSkpIHtcbiAgICAgICAgICAgICAgICBfLmZvckVhY2goXy5rZXlzKGl0ZW0pLCBmdW5jdGlvbiAoaykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoayA9PT0gJ3Jlc291cmNlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVpbGRGbGF0UmVzb3VyY2VzTGlzdChpdGVtKVxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbSA9IF8ub21pdChpdGVtLCBrKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChrZXkgPT09ICdyZXNvdXJjZScpIHtcbiAgICAgICAgICAgICAgICAkc2NvcGUucmVzb3VyY2VzLnB1c2goc2NoZW1hKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1aWxkU2lkZWJhciAocmVzb3VyY2VzKSB7XG4gICAgICAgIHJldHVybiBfLm1hcChyZXNvdXJjZXMsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGl0ZW0ucmVzb3VyY2UsXG4gICAgICAgICAgICAgICAgc3ViUmVzb3VyY2VzOiBfLmNoYWluKGl0ZW0pLmtleXMoKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgICAgICAvKiBtYXBwaW5nIHRoZSBuYW1lIG9mIHRoZSByZXNvdXJjZSBhbmQgdGhlIHVyaS4gbmFtZSBmb3IgdGhlIHRpdGxlIGluIHNpZGViYXIsIGlkICh1cmkpIGlzIHVzZWQgZm9yIGJvb2ttYXJraW5nIHRoZSBpdGVtICovXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBpdGVtW2tleV0ubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBpdGVtW2tleV0uaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IGl0ZW1ba2V5XS5tZXRob2QsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KS5maWx0ZXIoJ25hbWUnKS52YWx1ZSgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFwUmVxdWlyZWRPbnRvUHJvcGVydGllcyAocmVzb3VyY2UpIHtcbiAgICAgICAgdmFyIHByb3BlcnRpZXMgPSBfLmdldChyZXNvdXJjZSwgJ3Byb3BlcnRpZXMnKVxuICAgICAgICB2YXIgcmVxdWlyZWRQcm9wZXJ0aWVzID0gXy5nZXQocmVzb3VyY2UsICdyZXF1aXJlZCcpXG4gICAgICAgIGlmIChwcm9wZXJ0aWVzICYmIHJlcXVpcmVkUHJvcGVydGllcykge1xuICAgICAgICAgICAgXy5mb3JFYWNoKHJlcXVpcmVkUHJvcGVydGllcywgZnVuY3Rpb24gKHByb3BlcnR5TmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBwcm9wZXJ0eSA9IF8uZ2V0KHByb3BlcnRpZXMsIHByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICBpZiAoIXByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJQcm9wZXJ0eSB7cHJvcH0gaXMgbGlzdGVkIGFzIHJlcXVpcmVkIGluIHJlc291cmNlIHtyZXNvdXJjZX0sIGJ1dCBpcyBub3QgaW4gdGhlIHNjaGVtYVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgne3Byb3B9JywgcHJvcGVydHlOYW1lKS5yZXBsYWNlKCd7cmVzb3VyY2V9JywgXy5nZXQocmVzb3VyY2UsICduYW1lJykpXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBfLm1lcmdlKHByb3BlcnR5LCB7IHJlcXVpcmVkOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICAvKiBpZiB0aGVyZSBpcyBhbiBvYmplY3QsIHJlY3Vyc2Ugb250byBpdCAqL1xuICAgICAgICBfLmZvckVhY2goXy5rZXlzKHJlc291cmNlKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgLyogaWYgaXQncyBhbiBvYmplY3QsIGdvIGRlZXBlciAqL1xuICAgICAgICAgICAgaWYgKF8uaXNPYmplY3QocmVzb3VyY2Vba2V5XSkpIHtcbiAgICAgICAgICAgICAgICBtYXBSZXF1aXJlZE9udG9Qcm9wZXJ0aWVzKHJlc291cmNlW2tleV0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoa2V5ID09PSAnaXRlbXMnICYmIF8uaXNBcnJheShyZXNvdXJjZVtrZXldKSkge1xuICAgICAgICAgICAgICAgIC8qIGl0ZW1zIGNhbiBoYXZlIGFuIGFycmF5IG9mIG9iamVjdHMsIHNvIHRyZWUgcmVjdXJzaW9uIGhlcmUgOikgKi9cbiAgICAgICAgICAgICAgICBfLmZvckVhY2gocmVzb3VyY2Vba2V5XSwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgbWFwUmVxdWlyZWRPbnRvUHJvcGVydGllcyhyZXNvdXJjZVtrZXldKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgJHNjb3BlLmZvcm1hdFR5cGUgPSBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICB2YXIgdHlwZSA9IF8uZ2V0KGl0ZW0sICd0eXBlJylcbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiB0eXBlXG4gICAgICAgIH0gZWxzZSBpZiAoXy5nZXQoaXRlbSwgJ2FueU9mJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnYW55T2YnXG4gICAgICAgIH0gZWxzZSBpZiAoXy5nZXQoaXRlbSwgJ2FsbE9mJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnYWxsT2YnXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgIH1cblxuICAgICRzY29wZS5mb3JtYXRTcGVjTWV0YSA9IGZ1bmN0aW9uIChzcGVjKSB7XG4gICAgICAgIHZhciBhbnlPZiA9IF8uZ2V0KHNwZWMsICdhbnlPZicpXG4gICAgICAgIGlmIChhbnlPZikge1xuICAgICAgICAgICAgcmV0dXJuIGZvcm1hdEFycmF5TWV0YShhbnlPZilcbiAgICAgICAgfVxuICAgICAgICB2YXIgYWxsT2YgPSBfLmdldChzcGVjLCAnYWxsT2YnKVxuICAgICAgICBpZiAoYWxsT2YpIHtcbiAgICAgICAgICAgIHJldHVybiBmb3JtYXRBcnJheU1ldGEoYWxsT2YpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIV8uaXNPYmplY3Qoc3BlYykpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG9taXR0ZWRTcGVjcyA9IF8ub21pdChzcGVjLCBbJ3R5cGUnLCAnZGVzY3JpcHRpb24nLCAnJCRoYXNoS2V5JywgJ3JlcXVpcmVkJywgJ2l0ZW1zJ10pXG4gICAgICAgIGlmICghXy5rZXlzKG9taXR0ZWRTcGVjcykubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfLm1hcChfLmtleXMob21pdHRlZFNwZWNzKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuICc8c3Ryb25nPicra2V5Kyc6PC9zdHJvbmc+ICcrb21pdHRlZFNwZWNzW2tleV1cbiAgICAgICAgfSkuam9pbignLCAnKVxuICAgIH1cblxuICAgICRzY29wZS5mb3JtYXROb25PYmpTcGVjTWV0YSA9IGZ1bmN0aW9uIChzcGVjKSB7XG4gICAgICAgIHZhciBvbWl0dGVkU3BlY3MgPSBfLm9taXQoc3BlYywgWyd0eXBlJywgJ2Rlc2NyaXB0aW9uJywgJyQkaGFzaEtleScsICdyZXF1aXJlZCcsICdzdGF0dXMnXSlcbiAgICAgICAgaWYgKCFfLmtleXMob21pdHRlZFNwZWNzKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF8ubWFwKF8ua2V5cyhvbWl0dGVkU3BlY3MpLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gJzxzdHJvbmc+JytrZXkrJzo8L3N0cm9uZz4gJytvbWl0dGVkU3BlY3Nba2V5XVxuICAgICAgICB9KS5qb2luKCcsICcpXG4gICAgfVxuXG4gICAgJHNjb3BlLmh0bWxpZnlKU09OID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4ganNvbk1hcmt1cChvYmopXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0QXJyYXlNZXRhIChpdGVtcykge1xuICAgICAgICByZXR1cm4gXy5tYXAoaXRlbXMsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3snICsgXy5tYXAoXy5rZXlzKGl0ZW0pLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICc8c3Ryb25nPicra2V5Kyc6PC9zdHJvbmc+ICcgKyBpdGVtW2tleV1cbiAgICAgICAgICAgIH0pLmpvaW4oJywgJylcbiAgICAgICAgfSkuam9pbignfSwgJykgKyAnfSdcbiAgICB9XG59KVxuIiwidmFyIElOREVOVCA9ICcgICAgJztcblxudmFyIHR5cGUgPSBmdW5jdGlvbihkb2MpIHtcblx0aWYgKGRvYyA9PT0gbnVsbCkgcmV0dXJuICdudWxsJztcblx0aWYgKEFycmF5LmlzQXJyYXkoZG9jKSkgcmV0dXJuICdhcnJheSc7XG5cdGlmICh0eXBlb2YgZG9jID09PSAnc3RyaW5nJyAmJiAvXmh0dHBzPzovLnRlc3QoZG9jKSkgcmV0dXJuICdsaW5rJztcblxuXHRyZXR1cm4gdHlwZW9mIGRvYztcbn07XG5cbnZhciBlc2NhcGUgPSBmdW5jdGlvbihzdHIpIHtcblx0cmV0dXJuIHN0ci5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvPi9nLCAnJmd0OycpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkb2MpIHtcblx0dmFyIGluZGVudCA9ICcnO1xuXG5cdHZhciBmb3JFYWNoID0gZnVuY3Rpb24obGlzdCwgc3RhcnQsIGVuZCwgZm4pIHtcblx0XHRpZiAoIWxpc3QubGVuZ3RoKSByZXR1cm4gc3RhcnQrJyAnK2VuZDtcblxuXHRcdHZhciBvdXQgPSBzdGFydCsnXFxuJztcblxuXHRcdGluZGVudCArPSBJTkRFTlQ7XG5cdFx0bGlzdC5mb3JFYWNoKGZ1bmN0aW9uKGtleSwgaSkge1xuXHRcdFx0b3V0ICs9IGluZGVudCtmbihrZXkpKyhpIDwgbGlzdC5sZW5ndGgtMSA/ICcsJyA6ICcnKSsnXFxuJztcblx0XHR9KTtcblx0XHRpbmRlbnQgPSBpbmRlbnQuc2xpY2UoMCwgLUlOREVOVC5sZW5ndGgpO1xuXG5cdFx0cmV0dXJuIG91dCArIGluZGVudCtlbmQ7XG5cdH07XG5cblx0dmFyIHZpc2l0ID0gZnVuY3Rpb24ob2JqKSB7XG5cdFx0aWYgKG9iaiA9PT0gdW5kZWZpbmVkKSByZXR1cm4gJyc7XG5cblx0XHRzd2l0Y2ggKHR5cGUob2JqKSkge1xuXHRcdFx0Y2FzZSAnYm9vbGVhbic6XG5cdFx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwianNvbi1tYXJrdXAtYm9vbFwiPicrb2JqKyc8L3NwYW4+JztcblxuXHRcdFx0Y2FzZSAnbnVtYmVyJzpcblx0XHRcdHJldHVybiAnPHNwYW4gY2xhc3M9XCJqc29uLW1hcmt1cC1udW1iZXJcIj4nK29iaisnPC9zcGFuPic7XG5cblx0XHRcdGNhc2UgJ251bGwnOlxuXHRcdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cImpzb24tbWFya3VwLW51bGxcIj5udWxsPC9zcGFuPic7XG5cblx0XHRcdGNhc2UgJ3N0cmluZyc6XG5cdFx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwianNvbi1tYXJrdXAtc3RyaW5nXCI+XCInK2VzY2FwZShvYmoucmVwbGFjZSgvXFxuL2csICdcXG4nK2luZGVudCkpKydcIjwvc3Bhbj4nO1xuXG5cdFx0XHRjYXNlICdsaW5rJzpcblx0XHRcdHJldHVybiAnPHNwYW4gY2xhc3M9XCJqc29uLW1hcmt1cC1zdHJpbmdcIj5cIjxhIGhyZWY9XCInK2VzY2FwZShvYmopKydcIj4nK2VzY2FwZShvYmopKyc8L2E+XCI8L3NwYW4+JztcblxuXHRcdFx0Y2FzZSAnYXJyYXknOlxuXHRcdFx0cmV0dXJuIGZvckVhY2gob2JqLCAnWycsICddJywgdmlzaXQpO1xuXG5cdFx0XHRjYXNlICdvYmplY3QnOlxuXHRcdFx0dmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopLmZpbHRlcihmdW5jdGlvbihrZXkpIHtcblx0XHRcdFx0cmV0dXJuIG9ialtrZXldICE9PSB1bmRlZmluZWQ7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIGZvckVhY2goa2V5cywgJ3snLCAnfScsIGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwianNvbi1tYXJrdXAta2V5XCI+JytrZXkgKyAnOjwvc3Bhbj4gJyt2aXNpdChvYmpba2V5XSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gJyc7XG5cdH07XG5cblx0cmV0dXJuICc8ZGl2IGNsYXNzPVwianNvbi1tYXJrdXBcIj4nK3Zpc2l0KGRvYykrJzwvZGl2Pic7XG59O1xuIl19
