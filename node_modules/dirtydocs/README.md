# Dirty Docs

Quick and dirty single page docs from [JSDoc](http://usejsdoc.org/) doclets.

**Warning: Very simplistic, only currently handles classes, may not work for you!**

## Why

* I wanted to include the API docs for a [very simple JS project](https://github.com/walkermatt/ol3-layerswitcher) directly within the README file.
* The source already had JSDoc style comments and I didn't want to manually duplicate them in the README.

## How

Once installed a `dirtydocs` executable should be found in `node_modules/.bin` which accepts JSDoc doclet JSON on `stdin` and the path to a [nunjucks template](http://mozilla.github.io/nunjucks/templating.html) file as it's first argument. The JSON is transformed to make it more suitable for use within the template before the template is rendered and the results output to `stdout`.

## Install

    npm install dirtydocs

NOTE: JSDoc will be installed as a peer dependency.

## Usage

Assuming you have installed locally, to run the example:

    node_modules/.bin/jsdoc --explain node_modules/dirtydocs/examples/code.js | node_modules/.bin/dirtydocs node_modules/dirtydocs/examples/README.md

To run against your own source using the example template:

    node_modules/.bin/jsdoc --explain path/to/source.js | node_modules/.bin/dirtydocs node_modules/dirtydocs/examples/README.md

When designing your own template you can view the object that will be passed to the template as JSON by omitting the template argument:

    node_modules/.bin/jsdoc --explain path/to/source.js | node_modules/.bin/dirtydocs

## License

MIT (c) Matt Walker
