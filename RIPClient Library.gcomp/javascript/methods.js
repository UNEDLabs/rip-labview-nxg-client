// Example JavaScript for JSLI Calculator Example WebVI
//
// This example creates a function literal, and adds
// the function as a property of the Window object.
// The functions are defined within an anonymous function ( (function(){}()); )
// as a closure to prevent polluting the global namespace with our variables.
// If 'window.' is removed from 'window.MultiplyWithJSLI' then the function
// is no longer accessible from the WebVI. This is because it is only in the scope of
// this anonymous function, and not the global scope of the browser.
//
// From more information see:
// https://github.com/ni/webvi-examples
// https://developer.mozilla.org/en-US/docs/Web/API/Window

(function () {
    // Use strict prevents silent and common JavaScript errors.
    'use strict';
    window.connect = function (expid, host, port) {
        var conf = { 'host': host, 'port': port }
        window.alert(`Abriendo conexión ${host}:${port}`);
        var transport = new SSETransport(conf);
        var client = new RIPClient(transport);
        client.connect(expid, function(data) {
            // Gestionar los valores de las variables
            window.__RIPCLIENT_data = data;
        });
    };

    window.get = function(variable) {
        if (window.__RIPCLIENT_data[variable] != undefined) {
            return window.__RIPCLIENT_data[variable].toFixed(4);
        }
    }
}());