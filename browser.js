var jsonMarkup = require('json-markup')
var path = require('path')

angular.module('app', ['ui.bootstrap', 'ngSanitize']).controller('controller', function($scope){
    $scope.init = function (params) {
        $scope.schema = mapJSON(params.schema)
    }

    function mapJSON(schema) {
        $scope.resources = []
        buildFlatResourcesList(schema, "")
        $scope.sidebarItems = buildSidebar($scope.resources)
        _.map($scope.resources, function (resource) {
            mapRequiredOntoProperties(resource)
        })
    }

    function buildFlatResourcesList (schema, rootUri) {
        _.forEach(_.keys(schema), function (key) {
            var item = schema[key]
            if (_.isObject(item)) {
                _.forEach(_.keys(item), function (k) {
                    if (k === 'uri') {
                        item[k] = path.join(rootUri, item[k])
                    }
                    if (k === 'resource') {
                        var nextRootUri = _.get(item, 'rootUri', '')
                        if (!nextRootUri.length) {
                            console.error("You are missing a rootUri!")
                        }

                        buildFlatResourcesList(item, path.join(rootUri, nextRootUri))
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
                    /* mapping the name of the resource and the uri. name for the title in sidebar, uri is used for bookmarking the item */
                    if (item[key].uri) {
                        return {
                            name: item[key].name,
                            uri: item[key].uri,
                            method: item[key].method,
                        }

                    }
                }).filter('name').value()
            }
        })
    }

    function mapRequiredOntoProperties (resource) {
        var arrayProps = _.get(resource, 'anyOf')
        if (arrayProps) {
            for (var i=0; i < arrayProps.length; i++) {
                var props = arrayProps[i]

                if (!props.type) {
                    props.type = 'object'
                }

                var requiredProps = _.uniq(_.concat(_.get(props, 'required', []), _.get(resource, 'required', [])))
                if (requiredProps.length) {
                    props.required = requiredProps
                }

                mapRequiredOntoProperties(props)
            }
        } else {
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

        var omittedSpecs = _.omit(JSON.parse(angular.toJson(spec)), ['type', 'description', '$$hashKey', 'required', 'items'])
        if (!_.keys(omittedSpecs).length) {
            return
        }

        return _.map(_.keys(omittedSpecs), function (key) {
            var val = omittedSpecs[key]
            if (_.isArray(val)) {
                val = _.map(val, function (item) {
                    return _.isObject(item) ? JSON.stringify(item) : item
                }).join(', ')
            } else if (key === 'pattern') {
                val = '/val/'.replace('val', val)
            } else if (_.isObject(val)) {
                val = JSON.stringify(val)
            }
            return '<strong>'+key+':</strong> ' + val
        }).join(', ')
    }

    $scope.formatNonObjSpecMeta = function (spec) {
        var omittedSpecs = _.omit(JSON.parse(angular.toJson(spec)), ['type', 'description', '$$hashKey', 'required', 'status'])
        if (!_.keys(omittedSpecs).length) {
            return ""
        }

        return _.map(_.keys(omittedSpecs), function (key) {
            return '<strong>'+key+':</strong> ' + omittedSpecs[key]
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
