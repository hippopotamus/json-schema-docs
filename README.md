# json-schema-docs
A framework agnostic documentation generator for your JSON schemas.

I got annoyed writing documentation, when I felt like our JSON validation should be self documenting.  
I'll turn this into an npm package after I'm done.  
It's pretty easy to use. You serve the html file to whatever uri you'd like, then you make a route called '/schema' and send serve your schema as a JSON response.  

I've tried to match the JSON schema spec for most of it.

[color palette](http://paletton.com/#uid=13x0u0kktl7Xh3pEkaI5tyV00Kh)

#### To add more information to your schema for the documentation
- For each resource (e.g. "Users") you add the key value pair "resource" => "resource name"
- For sub resources you add the k/v pair "name" => "method name" (e.g "Create User")
- You can use the id attribute to list the uri for each sub resource. This will also be used for bookmarking the item
- It crawls the schema recursively, so you can have resources inside resources (users/addresses)

#### To Dos
- [ ] Header information for routes
- [ ] required info -- do I want to show required when required, or optional when not required?
- [ ] Make it look not terrible
- [ ] Example req/response?
- [ ] Make a list of other things to add support for: anyOf, allOf, etc
- [ ] Get people's opinions
