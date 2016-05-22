# json-schema-docs
a framework agnostic documentation generator for your json schemas.

i got annoyed writing documentation, when i felt like our json validation should be self documenting.  
i'll turn this into an npm package after i'm done.  
it's pretty easy to use. you serve the html file to whatever uri you'd like, add meta information to your schema, and you make a route called '/schema' and send serve your schema as a json response.  

i've tried to match the json schema spec. the extra meta information needed for this fits around what i read in the spec.

[color palette](http://paletton.com/#uid=13x0u0kktl7Xh3pEkaI5tyV00Kh)

#### to add more information to your schema for the documentation
- for each resource (e.g. "Users") you add the key value pair "resource" => "resource name"
- for sub resources you add the k/v pair "name" => "method name" (e.g "Create User")
- you can use the id attribute to list the uri for each sub resource. this will also be used for bookmarking the item
- it crawls the schema recursively, so you can have resources inside resources (users/addresses)

i'm planning on using a similar structure to get some tests out of this (or a similar) convention for json schema, as well. that was the initial idea behind adding response to the resource info. everything is in the schema for some basic unit tests. hopefully, in the next few weeks, i'll get to write a wrapper around mocha that does exactly that. it'd be nice to get some of the "i hope i didn't break anything by making this simple change" tests for free, along with automatic documentation for a little bit of schema definition...
