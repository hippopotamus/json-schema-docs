var enums = require('../enums')

module.exports = {
    "resource": "Addresses",
    "description": "URIs for addresses",
    rootUri: "/addresses",
    test: {
        name: "TEST",
        method: "POST",
        uri: "/",
        type:"object",
        properties: {
            issuerId: { type: "string", format: "uuid" },
            receiverId: { type: "string", format: "uuid" },
            title: { type: "string", minLength: 4, maxLength: 60 },
            type: { type: "string" },
            code: { type: "string", pattern: "\\w+", minLength: 4, maxLength: 15, },
            amount: { type: "number", minimum: 0 },
            unit: { type: "string" },
            quantity: { anyOf: [{ type: "null" }, { type: "integer", minimum: 1 }] }, // null means infinite
            expiresAt: { type: "string", format: "date-time" },
            isActive: { type: "boolean" },
            salesforceCampaignId: { type: "string" },
            resultingPromotion: {
                type: "object",
                properties: {
                    issuerId: { type: "string", format: "uuid" },
                    receiverId: { type: "string", format: "uuid" },
                    title: { type: "string", minLength: 4, maxLength: 60 },
                    type: { type: "string" },
                    code: { type: "string", pattern: "\\w+", minLength: 4, maxLength: 15, },
                    amount: { type: "number", minimum: 0 },
                    unit: { type: "string" },
                    quantity: { anyOf: [{ type: "null" }, { type: "integer", minimum: 1 }] }, // null means infinite
                    expiresAt: { type: "string", format: "date-time" },
                    isActive: { type: "boolean" },
                },
                required: ["code", "amount", "unit", "quantity", "isActive"],
            },
        },
        required: ["code", "amount", "unit", "quantity", "isActive"],
    },
    "create": {
        "name": "Create Address",
        "uri": "/",
        "method": "POST",
        "headers": {
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
            "country": { "type": "string", "minLength": 2, "maxLength": 4, "enum": enums.countries },
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
                "country": { "type": "string", "minLength": 2, "maxLength": 4, "enum": enums.countries },
            },
            "required": ["id", "street", "streetExtended", "city", "state", "country"],
            "examples": [
                {
                    "status": {
                        "type": "Created",
                        "code": 201,
                    },
                    "properties": {
                        "uri": "b1d93e77-0f72-460c-993b-9e11390febf5",
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
        "uri": "/:addressId",
        "method": "GET",
        "headers": {
            "type": "object",
            "properties": {
                "clientId": { "type": "string", "format": "uuid", "required": true, },
                "authorization": { "type": "string", "required": true },
            },
        },
        "type": "object",
        "properties": {
            "id": { "type": "string", "format": "id", },
            "addressId": { "type": "string", "format": "id", },
        },
        "required": ["id", "addressId"],
        "response": {
            "status": {
                "type": "Success",
                "code": 200,
            },
            "type": "object",
            "properties": {
                "addressId": { "type": "string", "format": "uuid", },
                "street": { "type": "string", },
                "streetExtended": { "type": "string", "default": "" },
                "city": { "type": "string", "minLength": 2, "maxLength": 40, },
                "state": { "type": "string", "minLength": 2, "maxLength": 2, "enum": enums.states },
                "country": { "type": "string", "minLength": 2, "maxLength": 4, "enum": enums.countries },
            },
            "required": ["addressId", "street", "streetExtended", "city", "state", "country"],
            "examples": [
                {
                    "status": {
                        "type": "Success",
                        "code": 200,
                    },
                    "properties": {
                        "uri": "b1d93e77-0f72-460c-993b-9e11390febf5",
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
        "uri": "/:addressId",
        "method": "PUT",
        "headers": {
            "type": "object",
            "properties": {
                "clientId": { "type": "string", "format": "uuid", "required": true, "description": "For headers, put \"required\": true to get the required on it" },
                "authorization": { "type": "string", "required": true },
            },
        },
        "type": "object",
        "properties": {
            "id": { "type": "string", "format": "uuid" },
            "addressId": { "type": "string", "format": "uuid", },
            "street": { "type": "string", },
            "streetExtended": { "type": "string", "default": "" },
            "city": { "type": "string", "minLength": 2, "maxLength": 40, },
            "state": { "type": "string", "minLength": 2, "maxLength": 2, "enum": enums.states },
            "country": { "type": "string", "minLength": 2, "maxLength": 4, "enum": enums.countries },
        },
        "required": ["id", "addressId"],
        "response": {
            "status": {
                "code": 200,
            },
            "type": "boolean",
            "constant": true ,
        },
    },
    "delete": {
        "name": "Delete Address",
        "uri": "/:addressId",
        "method": "DELETE",
        "headers": {
            "type": "object",
            "properties": {
                "clientId": { "type": "string", "format": "uuid", "required": true, },
            },
        },
        "type": "object",
        "properties": {
            "id": { "type": "string", "format": "uuid" },
            "addressId": { "type": "string", "format": "uuid" },
        },
        "required": ["id", "addressId"],
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
