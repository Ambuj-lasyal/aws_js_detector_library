// should trigger codeql/javascript/ql/src/Security/CWE-079/ExceptionXss.ql

function setLanguageOptions() {
    var href = document.location.href,
        deflt = href.substring(href.indexOf("default=")+8);
    
    try {
        var parsed = unknownParseFunction(deflt); 
    } catch(e) {
        document.write("Had an error: " + e + ".");
    }
}

// should trigger codeql/javascript/ql/src/Security/CWE-079/ReflectedXss.ql

var app = require('express')();

app.get('/user/:id', function(req, res) {
  if (!isValidUserId(req.params.id))
    // BAD: a request parameter is incorporated without validation into the response
    res.send("Unknown user: " + req.params.id);
  else
    // TODO: do something exciting
    ;
});

// should trigger codeql/javascript/ql/src/Security/CWE-079/StoredXss.ql

var express = require('express'),
    fs = require('fs');

express().get('/list-directory', function(req, res) {
    fs.readdir('/public', function (error, fileNames) {
        var list = '<ul>';
        fileNames.forEach(fileName => {
            // BAD: `fileName` can contain HTML elements
            list += '<li>' + fileName + '</li>';
        });
        list += '</ul>'
        res.send(list);
    });
});

// should trigger codeql/javascript/ql/src/Security/CWE-079/UnsafeHtmlConstruction.ql

module.exports = function showBoldName(name) {
  document.getElementById('name').innerHTML = "<b>" + name + "</b>";
}

// should trigger codeql/javascript/ql/src/Security/CWE-079/UnsafeJQueryPlugin.ql

jQuery.fn.copyText = function(options) {
	// BAD may evaluate `options.sourceSelector` as HTML
	var source = jQuery(options.sourceSelector),
	    text = source.text();
	jQuery(this).text(text);
}

// should trigger codeql/javascript/ql/src/Security/CWE-079/Xss.ql

function setLanguageOptions() {
    var href = document.location.href,
        deflt = href.substring(href.indexOf("default=")+8);
    document.write("<OPTION value=1>"+deflt+"</OPTION>");
    document.write("<OPTION value=2>English</OPTION>");
}

// should trigger codeql/javascript/ql/src/Security/CWE-079/XssThroughDom.ql

$("button").click(function () {
    var target = $(this).attr("data-target");
    $(target).hide();
});

// should trigger codeql/javascript/ql/src/Security/CWE-094/CodeInjection.ql

eval(document.location.href.substring(document.location.href.indexOf("default=")+8))

// should trigger codeql/javascript/ql/src/Security/CWE-094/ImproperCodeSanitization.ql

function createObjectWrite() {
    const assignment = `obj[${JSON.stringify(key)}]=42`;
    return `(function(){${assignment}})` // NOT OK
}

// should trigger codeql/javascript/ql/src/Security/CWE-094/UnsafeCodeConstruction.ql

export function unsafeDeserialize(value) {
  return eval(`(${value})`);
}

export function unsafeGetter(obj, path) {
    return eval(`obj.${path}`);
}

// should trigger codeql/javascript/ql/src/Security/CWE-094/UnsafeDynamicMethodAccess.ql

// API methods
function play(data) {
  // ...
}
function pause(data) {
  // ...
}

window.addEventListener("message", (ev) => {
    let message = JSON.parse(ev.data);

    // Let the parent frame call the 'play' or 'pause' function 
    window[message.name](message.payload);
});

// should trigger codeql/javascript/ql/src/Security/CWE-116/BadTagFilter.ql

function filterScript(html) {
    var scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    var match;
    while ((match = scriptRegex.exec(html)) !== null) {
        html = html.replace(match[0], match[1]);
    }
    return html;
}

// should trigger codeql/javascript/ql/src/Security/CWE-116/DoubleEscaping.ql

module.exports.encode = function(s) {
  return s.replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");
};

module.exports.decode = function(s) {
  return s.replace(/&amp;/g, "&")
          .replace(/&quot;/g, "\"")
          .replace(/&apos;/g, "'");
};

// should trigger codeql/javascript/ql/src/Security/CWE-116/IncompleteHtmlAttributeSanitization.ql

var app = require('express')();

app.get('/user/:id', function(req, res) {
	let id = req.params.id;
	id = id.replace(/<|>/g, ""); // BAD
	let userHtml = `<div data-id="${id}">${getUserName(id) || "Unknown name"}</div>`;
	// ...
	res.send(prefix + userHtml + suffix);
});

// should trigger codeql/javascript/ql/src/Security/CWE-116/IncompleteSanitization.ql

function escapeQuotes(s) {
  return s.replace("'", "''");
}

// should trigger codeql/javascript/ql/src/Security/CWE-116/UnsafeHtmlExpansion.ql

function expandSelfClosingTags(html) {
	var rxhtmlTag = /<(?!img|area)(([a-z][^\w\/>]*)[^>]*)\/>/gi;
	return html.replace(rxhtmlTag, "<$1></$2>"); // BAD
}
