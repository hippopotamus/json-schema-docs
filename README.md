# json-schema-docs
a framework agnostic documentation generator for your json schemas.

it feels a little weird to write documentation for something that generates documentation...

[See the example app here](http://hippopotamus2.github.io/json-docs.html) <- this is out of date, but you'll get the idea

i got annoyed writing documentation, when i felt like our json validation should be self documenting.  
this for the most part is is json schema compliant. i'm not supporting json pointers. in all honestly, i don't really like them.  
THAT BEING SAID, if 1 person asks me to add json pointer support, i will.  

#### How to use it
```bash
npm install json-schema-docs --save
```
```js
var schemaDocs = require('json-schema-docs')
var docs = schemaDocs({
    title: "My Api Docs",
    schema: require('./schemas'),
    // plus any optional params, currently, you can customize the styles
})
router.get('/docs', function (req, res) {
    res.send(docs)
})
```

A lot of the styles are configurable. Here are all the defaults, you can override any of them:  
```js
{
    code: {
        color: "#FFF",
        backgroundColor: "#042A48",
    },
    thead: {
        th: {
            color: "#FFF",
            backgroundColor: "#042A48",
        },
    },
    th: {
        color: "#FFF",
        backgroundColor: "#91A0AC",
    },
    td: {
        color: "#FFF",
        backgroundColor: "#C3C6C8",
    },
    jsonMarkup: {
        color: "#C3C6C8",
        backgroundColor: "#042A48",
        boolean: {
            color: "#A8573D",
        },
        string: {
            color: "#AA8C3D",
        },
        null: {
            color: "#CFCFCF",
        },
        number: {
            color: "#92B076",
        },
    },
}
```

#### If you're using JSON schema. here is what you need to add to your schema to make this work
basically, if you structure your schema like RESTful routes, you'll have a good time.  
```js
{    
    resource: "Name of resource, e.g. 'Users'",
    description: "Any description you have to have, e.g. 'URIs for users'",
    rootUri: "The root of uri of your resource, e.g. /users",
    create: {
        name: "Create",
        uri: "/",
        method: "POST",
        type: "object",
        properties: {
            // your api props
        }
        response: {
            status: {
                code: 201,
            },
            type: "etc...."
        },
        addresses: {
            resource: "Users/Addresses",
            description: "Addresses for users",
            rootUri: "/:id/addresses",
            getById: {
                name: "Create",
                uri: "/:addressId",
                method: "GET",
                // etc...
            }
        }
    }
}
```
root uris will inherit whatever resource they're inside, and uris will inherit their root uri

You can also add example responses. look in the schemas folder for examples. there might be some changes, though. my coworker had a good idea for generating examples with another tool i'll be writing that's going to build on this schema structure.

There's currently support for headers, but i don't really the way it's done. i know what i want now. when i get time i'm going to change it to something that fits my js stackvana better
