#!/usr/bin/env node

var dirtydocs = require('./'),
    args = process.argv.slice(2),
    template = null;

// Pick up template path from args
if (args.length) {
    template = args[0];
}

// Attempt to read JSON string from stdin
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', function(data) {
    // Prepare the data
    var munged = dirtydocs.munge(JSON.parse(data));
    // If there is a template render it, otherwise return the
    // munged data which can be handy when designing templates
    if (template) {
        console.log(dirtydocs.render(template, munged));
    } else {
        console.log(JSON.stringify(munged, null, '  '));
    }
    process.exit(0);
});
