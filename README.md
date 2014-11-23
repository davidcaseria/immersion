# Immersion

Immersion is a command-line (CLI) tool built for the Content Direct product catalog system.

Node.js is required in order to run Immersion. Please ensure you have Node.js installed: http://nodejs.org/.

Immersion helps ingesting categories, media, people, playlists, and products by pulling data from a CSV file. 

## Installation

1. Ensure you have Node.js installed: http://nodejs.org/.
2. Globally install the immersion package using npm: `npm install -g immersion`

Running `immersion -h` will display the help menu which indicates a successful install.

## CSV Format

The CSV file that is ingested should have a header row followed by the rows of entity (i.e. Category, Media, Person, Playlist, Product) information. Each row below the header is equivalent to one entity that will be created or updated.

Each column in the header should map to an object in the specified request. For example, when creating products the headers should follow the CreateProduct request format:

`Product.Id.Type,Product.Id.Value,Product.Name,Product.References[0]`

Objects are referenced using dot notation while arrays use brackets.

*{Entity}*.Id.Value is required in all immersion sheets. Not providing that value will produce an "Undefined *{Entity}* Error".

The entity rows can contain either primitive values (i.e. boolean, number, string) or valid JSON.

## Core Documentation

Use your sandbox credentials to view the core request formats: https://documentation.doc1.cdops.net/v6.0/Interface.aspx?interface=Catalog.

## Logging

A logs folder is created in the directory of the file provided when immersion is run. A sub-folder is created for the core API method used for the requests. Sub-sub-folders are created for each entity id. The sub-sub-folders will contain a request.json file and a response.json file for every create or update API call.

## Examples

`immersion -f examples/person.csv create Person`

Creates person objects in sandbox.

`immersion -e stg1 -f examples/media.csv update Media`

Updates media objects in staging.

`immersion -f examples/product.csv -t update Product`

Updates product objects in sandbox using targeted method (only fields in the CSV file are updated).

## Contributing

In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com).

## License

Copyright (c) 2014 David Caseria  
Licensed under the MIT license.