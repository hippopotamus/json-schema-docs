module.exports = {
    'resource': 'User',
    "description": "URIs for users",
    rootUri: "/users",
    "create": {
        name: "CREATE",
        uri: "/",
        "method": "POST",
        'fn': 'create',
        "header": {
            "type": "object",
            "properties": {
                "clientId": { "type": "string", "format": "uuid", "required": true, "description": "For headers, put \"required\": true to get the required on it" },
            },
        },
        "type": "object",
        "properties": {
            "ids": { "type": "array", "minItems": 1, "items": { "type": "string", "format": "uuid" } },
            "anotherArray": { "type": "array", "minItems": 1, default: [{ thing: "OMG" }], "items": [
                { "type": "boolean", description: "LOLOL" },
                {
                    "type": "object",
                    "properties": {
                        thing: { type: "string", format: "uuid" },
                    },
                },
            ] },
            "email": { "type": "string", "format": "email", },
            "firstName": { "type": "string", "minLength": 1, "maxLength": 40, },
            "lastName": { "type": "string", "minLength": 1, "maxLength": 80, },
            "password": { "type": "string", "minLength": 8, "maxLength": 32, },
            "phone": { "type": "string", "pattern": "1\d{10}", "description": "Just give the digits in a string.", },
            "timezone": {
                "type": "string",
                "format": "timezone",
                "default": "America/New_York",
                "description": "Look at the momentjs docs for valid timezones",
            },
        },
        "required": ["email", "firstName", "lastName", "password"],
        "response": {
            "status": {
                "code": 201,
            },
            "type": "object",
            "properties": {
                "id": { "type": "string", "format": "uuid", },
                "email": { "type": "string", "format": "email", },
                "firstName": { "type": "string", "minLength": 1, "maxLength": 40, },
                "lastName": { "type": "string", "minLength": 1, "maxLength": 80, },
                "phone": { "type": "string", "pattern": "1\d{10}", "description": "Just give the digits in a string.", },
                "timezone": {
                    "type": "string",
                    "format": "timezone",
                    "default": "America/New_York",
                    "description": "Look at the momentjs docs for valid timezones",
                },
            },
            "required": ["id", "email", "firstName", "lastName", "timezone"],
            "examples": [
                {
                    "status": {
                        "type": "Created",
                        "code": 201,
                    },
                    "properties": {
                        "id": "aae1930c-d267-4fb6-ae34-2013af9b2652",
                        "firstName": "Joseph",
                        "lastName": "Backwater",
                        "email": "lol@youwish.com",
                        "timezone": "America/New_York",
                    }
                },
                {
                    "status": {
                        "type": "Invalid Param",
                        "code": 400,
                    },
                    "properties": {
                        "errors": [
                            "First name cannot be over 80 characters",
                            "Must provide a password",
                        ]
                    }
                }
            ]
        },
    },
    "getById": {
        "name": "Get User By Id",
        uri: "/:id",
        "method": "GET",
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
                "email": { "type": "string", "format": "email", },
                "firstName": { "type": "string", "minLength": 1, "maxLength": 40, },
                "lastName": { "type": "string", "minLength": 1, "maxLength": 80, },
                "phone": { "type": "string", "pattern": "1\d{10}", "description": "Just give the digits in a string.", },
                "timezone": {
                    "type": "string",
                    "format": "timezone",
                    "default": "America/New_York",
                    "description": "Look at the momentjs docs for valid timezones",
                },
            },
            "required": ["id", "email", "firstName", "lastName", "timezone"],
            "examples": [
                {
                    "status": {
                        "type": "Success",
                        "code": 200,
                    },
                    "properties": {
                        "id": "aae1930c-d267-4fb6-ae34-2013af9b2652",
                        "firstName": "Joseph",
                        "lastName": "Backwater",
                        "email": "lol@youwish.com",
                        "timezone": "America/New_York",
                    }
                },
                {
                    "status": {
                        "type": "Not Found",
                        "code": 404,
                    },
                    "properties": {
                        "errors": [
                            "User aae1930c-d267-4fb6-ae34-2013af9b2652 not found.",
                        ]
                    }
                }
            ]
        },
    },
    "update": {
        "name": "Update User",
        uri: "/:id",
        "method": "PUT",
        "header": {
            "type": "object",
            "properties": {
                "clientid": { "type": "string", "format": "uuid", "required": true, "description": "For headers, put \"required\": true to get the required on it" },
                "authorization": { "type": "string" },
            },
        },
        "type": "object",
        "properties": {
            "id": { "type": "string", "format": "uuid" },
            "email": { "type": "string", "format": "email" },
            "firstName": { "type": "string", "minLength": 1, "maxLength": 16 },
            "lastName": { "type": "string", "minLength": 1, "maxLength": 16 },
            "phone": { "type": "string" }, // TODO validate with regex. do we allow international numbers, etc? maybe we can strip it to just the digits and format on the frontend?
            "timezone": { "type": "string", "format": "timezone" }
        },
        "required": ["id"],
        "response": {
            "status": {
                "code": 200,
            },
            "type": "boolean",
            "constant": true,
        },
    },
    "delete": {
        "name": "Delete User",
        uri: "/:id",
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
            "constant": true,
        },
    },
}

// module.exports.addresses = require('./addresses')
