var enums = require('../../enums')

module.exports = {
    "resource": "Users / Addresses",
    "description": "URIs for user addresses",
    "create": {
        "name": "Create Address",
        "id": "/users/:id/address",
        "method": "POST",
        "header": {
            "type": "object",
            "properties": {
                "clientId": { "type": "string", "format": "uuid", "required": true },
            },
        },
        "type": "object",
        "properties": {
            "street": { "type": "string", },
            "streetExtended": { "type": "string", },
            "city": { "type": "string", "minLength": 2, "maxLength": 40, },
            "state": { "type": "string", "minLength": 2, "maxLength": 2, "enum": enums.states },
            "country": { "type": "string", "minLength": 2, "maxLength": 4, "enums": enums.countries },
        },
        "required": ["street", "city", "state", "country"],
        "response": {
            "status": {
                "code": 201,
            },
            "type": "object",
            "properties": {
                "id": { "type": "string", "format": "uuid", },
                "street": { "type": "string", },
                "streetExtended": { "type": "string", "default": "" },
                "city": { "type": "string", "minLength": 2, "maxLength": 40, },
                "state": { "type": "string", "minLength": 2, "maxLength": 2, "enum": enums.states },
                "country": { "type": "string", "minLength": 2, "maxLength": 4, "enums": enums.countries },
            },
            "required": ["id", "street", "streetExtended", "city", "state", "country"],
            "examples": [
                {
                    "status": {
                        "type": "Created",
                        "code": 201,
                    },
                    "properties": {
                        "id": "b1d93e77-0f72-460c-993b-9e11390febf5",
                        "street": "123 Home Lane",
                        "streetExtended": "",
                        "city": "Harrisburg",
                        "state": "PA",
                        "country": "USA",
                    },
                },
            ]
        },
    },
    "getById": {
        "name": "Get Address By Id",
        "id": "/users/:id/addresses/:addressId",
        "method": "GET",
        "header": {
            "type": "object",
            "properties": {
                "clientId": { "type": "string", "format": "uuid", "required": true, },
                "authorization": { "type": "string", "required": true },
            },
        },
        "type": "object",
        "properties": {
            "id": { "type": "string", "format": "id", },
        },
        "required": ["id"],
        "response": {
            "status": {
                "type": "Success",
                "code": 200,
            },
            "type": "object",
            "properties": {
                "id": { "type": "string", "format": "uuid", },
                "street": { "type": "string", },
                "streetExtended": { "type": "string", "default": "" },
                "city": { "type": "string", "minLength": 2, "maxLength": 40, },
                "state": { "type": "string", "minLength": 2, "maxLength": 2, "enum": enums.states },
                "country": { "type": "string", "minLength": 2, "maxLength": 4, "enums": enums.countries },
            },
            "required": ["id", "street", "streetExtended", "city", "state", "country"],
            "examples": [
                {
                    "status": {
                        "type": "Success",
                        "code": 200,
                    },
                    "properties": {
                        "id": "b1d93e77-0f72-460c-993b-9e11390febf5",
                        "street": "123 Home Lane",
                        "streetExtended": "",
                        "city": "Harrisburg",
                        "state": "PA",
                        "country": "USA",
                    },
                },
                {
                    "status": {
                        "type": "Not Found",
                        "code": 404,
                    },
                    "properties": {
                        "errors": [
                            "Address b1d93e77-0f72-460c-993b-9e11390febf5 for user aae1930c-d267-4fb6-ae34-2013af9b2652 not found.",
                        ]
                    }
                }
            ]
        },
    },
    "update": {
        "name": "Update Address",
        "id": "/users/:id/addresses/:addressId",
        "method": "PUT",
        "header": {
            "type": "object",
            "properties": {
                "clientId": { "type": "string", "format": "uuid", "required": true, "description": "For headers, put \"required\": true to get the required on it" },
                "authorization": { "type": "string", "required": true },
            },
        },
        "type": "object",
        "properties": {
            "id": { "type": "string", "format": "uuid" },
            "street": { "type": "string", },
            "streetExtended": { "type": "string", "default": "" },
            "city": { "type": "string", "minLength": 2, "maxLength": 40, },
            "state": { "type": "string", "minLength": 2, "maxLength": 2, "enum": enums.states },
            "country": { "type": "string", "minLength": 2, "maxLength": 4, "enums": enums.countries },
        },
        "required": ["id"],
        "response": {
            "status": {
                "code": 200,
            },
            "type": "boolean",
            "constant": true ,
        },
    },
    "delete": {
        "name": "Delete User",
        "id": "/users/:id",
        "method": "DELETE",
        "header": {
            "type": "object",
            "properties": {
                "clientId": { "type": "string", "format": "uuid", "required": true, },
            },
        },
        "type": "object",
        "properties": {
            "id": { "type": "string", "format": "uuid" },
        },
        "required": ["id"],
        "response": {
            "status": {
                "type": "Success",
                "code": 200,
            },
            "type": "boolean",
            "constant": true ,
        },
    },
}
