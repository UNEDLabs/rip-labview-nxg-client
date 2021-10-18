/**
 * JSON-RPC Client
 *
 * Copyright (C) 2013 Jesus Chacon and Luis de la Torre
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

 var JsonRpcBuilder = {
	request: function(method, params, id) {
	  if(params && !(params instanceof Array)) {
		throw new InvalidParamsException();
	  }
	  var request = {
		jsonrpc: '2.0',
		method: method
	  };
	  if(params !== undefined) {
		request.params = params;
	  }
	  if(id !== undefined) {
		request.id = id;
	  }
	  return request;
	},
  
	response: function(result, id) {
	  return {
		jsonrpc: '2.0',
		result: result,
		id: id
	  }
	},
  
	responseWithError: function(error, id) {
	  return {
		jsonrpc: '2.0',
		error: error,
		id: id
	  };
	},
  
	error: function(code, message, data) {
	  return {
		code: code,
		message: message,
		data: data
	  };
	}
  };
  
  function JsonRpcClient(transport) {
	this.batch = [];
	this.id = 0;
  
	this.setTransport(transport);
  }
  
  JsonRpcClient.prototype.setTransport = function(transport) {
	if(transport !== undefined) {
	  this.transport = transport;
	}
  };
  
  // Espera respuesta por parte del servidor
  JsonRpcClient.prototype.invoke = function(method, params, callback) {
	this.id ++;
	var request = JsonRpcBuilder.request(method, params, this.id.toString());
	try {
	  var transport = (this.proxy != undefined) ? this.proxy : this.transport;
	  transport.send(JSON.stringify(request), function _onResponse(response) {
		try {
		  var result = this.parseResponse(JSON.parse(response));
		  callback(result);
		} catch(error) {}
	  }.bind(this));
	} catch(error) {
	  console.log('[ERROR] Invalid Transport');
	}
  };
  
  // *NO* espera respuesta por parte del servidor
  JsonRpcClient.prototype.notify = function(method, params, callback) {
	var request = JsonRpcBuilder.request(method, params);
	try {
	  var transport = (this.proxy != undefined) ? this.proxy : this.transport;
	  transport.send(JSON.stringify(request));
	} catch(error) {
	  console.log('[ERROR] Invalid Transport');
	}
  };
  
  JsonRpcClient.prototype.invokeLater = function(method, params) {
	this.id++;
	var request = JsonRpcBuilder.request(method, params, this.id.toString());
	this.batch.push(request);
  };
  
  JsonRpcClient.prototype.notifyLater = function(method, params) {
	var request = JsonRpcBuilder.request(method, params);
	this.batch.push(request);
  };
  
  JsonRpcClient.prototype.sendBatch = function(callback) {
	if(this.transport === undefined || this.transport.send === undefined)
	  throw new Error('[ERROR] Undefined Transport Method');
	this.transport.send(JSON.stringify(this.batch), function(response) {
	  if(callback != undefined) {
		callback(JSON.parse(response));
	  }
	});
	this.batch = [];
  };
  
  JsonRpcClient.prototype.parseResponse = function(response) {
	try {
	  if(response.result != undefined) {
		return response.result;
	  } else if(response.error != undefined) {
		return response.error;
	  }
	} catch(error) {
	  console.log(error);
	  return error;
	}
  };
  
  // ----------------------------------------------------------------------------
  
  /**
   * Interface Transport {
   * 	send(request, callback)
   * }
   */
  
  /**
   * WebSocket Transport
   */
  
  function WebSocketTransport(server) {
	this.host = 'localhost';
	this.security = false;
	if(server.host !== undefined) {
	  this.setHost(server.host);
	}
  //  if(server.port != undefined) {
  //    this.port = server.port;
  //  }
	this.url = '';
	if(server.url !== undefined) {
	  this.url = server.url;
	}
	this.ws = null;
  }
  
  WebSocketTransport.prototype.setHost = function(host) {
	  if (!String.prototype.startsWith) { // polyfill for IE and Edge
		  String.prototype.startsWith = function(searchString, position) {
			  position = position || 0;
			  return this.indexOf(searchString, position) === position;
		  };
	  }
	  if (host.startsWith('http://')) {
		  this.host = host.substr(7);
		  this.transport = 'http://';
		  console.log("[ERROR] Wrong transport (http instead of ws/wss).");
	  } else if (host.startsWith('https://')) {
		  this.host = host.substr(8);
		  this.transport = 'https://';
		  console.log("[ERROR] Wrong transport (https instead of ws/wss).");
	  } else if(host.startsWith('ws://')) {
		  this.host = host.substr(5);
		  this.transport = 'ws://';
	  } else if(host.startsWith('wss://')) {
		  this.host = host.substr(6);
		  this.transport = 'wss://';
	  } else {
		  this.host = host;
	  }
  };
  
  WebSocketTransport.prototype.send = function(request, callback) {
	if(this.ws !== undefined) {
	  this.ws.send(request);
	} else {
	  console.log('[ERROR]: WebSockets channel not connected.');
	}
  };
  
  WebSocketTransport.prototype.open = function(params, handler, callback) {
	if(this.ws != null) {
	  console.log('[WARNING] Using previously opened WebSocket');
	  return this.ws;
	}
	var url = this.transport + this.host;
	if(this.port !== undefined) {
	  url += ":" + this.port;
	}
	if(this.url !== undefined) {
	  url += this.url;
	}
  
	this.ws = new WebSocket(url);
  
	this.ws.onopen = function(e) {
	  if(handler.open !== undefined) {
		handler.open();
	  }
	};
  
	this.ws.onmessage = function(e) {
	  try {
		if(handler.message !== undefined) {
		  data = JSON.parse(e.data);
		  handler.message(data);
		}
	  } catch(error) {
		console.log('[ERROR]: invalid WebSockets response.');
	  }
	};
  
	this.ws.onclose = function() {
	  if(handler.close != undefined) {
		handler.close();
	  } else {
		console.log('[INFO]: Websocket connection closed');
	  }
	};
  
	this.ws.onerror = function(e) {
	  if(error != undefined) {
		error(e.data);
	  } else {
		console.log('[ERROR]: Websocket connection closed');
	  }
	};
  
	return this.ws;
  };
  
  WebSocketTransport.prototype.close = function() {
	this.ws.close();
  };
  
  /**
  * HTTP Transport
  */
  
  function HttpTransport(host, port, url) { // implements Transport
	this.configure(host, port, url);
  }
  
  HttpTransport.prototype = {
	host: 'localhost',
	port: 2055,
	url: '/',
	transport: 'http://',
  
	configure: function(host, port, url) {
	  this.setHost(host);
	  if(port != undefined && port > 0 && port < 65535) {
		this.port = port;
	  } else {
		this.port = undefined;
	  }
	  if(url != undefined) {
		this.url = url;
	  }
	},
  
	setHost: function(host) {
	  if (!String.prototype.startsWith) { // polyfill for IE and Edge
		  String.prototype.startsWith = function(searchString, position) {
			  position = position || 0;
			  return this.indexOf(searchString, position) === position;
		  };
	  }
	  if (host.startsWith('http://')) {
		this.host = host.substr(7);
		this.transport = 'http://';
	  } else if (host.startsWith('https://')) {
		this.host = host.substr(8);
		this.transport = 'https://';
	  } else if(host.startsWith('ws://')) {
		console.log("[ERROR] Wrong transport (ws instead of http/https).");
		this.host = host.substr(5);
		this.transport = 'ws://';
	  } else if(host.startsWith('wss://')) {
		console.log("[ERROR] Wrong transport (wss instead of http/https).");
		this.host = host.substr(6);
		this.transport = 'wss://';
	  } else {
		this.host = host;
		this.transport = 'http://';
	  }
	},
  
	send: function(request, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.open('POST', this.getURL(), true);
	  xhr.onload = function (e) {
		if (xhr.readyState === 4) {
		  if (xhr.status === 200) {
			if(xhr.response != undefined) {
			  if(callback != undefined) {
				callback(xhr.response);
			  }
			}
		  } else {
  //          console.error(xhr.statusText);
		  }
		}
	  };
	  xhr.onerror = function (e) {
		console.log(e);
	  };
	  xhr.send(request);
	},
  
	getURL: function(url) {
	  if(url == undefined) {
		url = (this.url == undefined) ? '/' : this.url;
	  }
	  if(!url.startsWith('/')) {
		url = '/' + url;
	  }
	  if(this.port != 80 && this.port != undefined) {
		return this.transport + this.host + ':' + this.port + url;
	  }
	  var hostEndsWithSlash = (this.host.charAt(this.host.length-1) == '/');
	  var host = hostEndsWithSlash ? this.host.substr(0, this.host.length-1) : this.host;
	  return this.transport + host + url;
	}
  };
  
  
  /**
  * HTTP-SSE Transport
  */
  
  function SSETransport(conf) {
	conf['urlPOST'] = '/RIP/POST';
	conf['urlSSE'] = '/RIP/SSE';
	HttpTransport.call(this, conf.host, conf.port, conf.urlPOST);
	this.pathSSE = conf['urlSSE'];
	if(this.port != undefined) {
	  this.urlSSE = this.transport + this.host + ':' + this.port + conf.urlSSE;
	} else {
	  this.urlSSE = this.transport + this.host + conf.urlSSE;
	}
  }
  
  SSETransport.prototype = Object.create(HttpTransport.prototype);
  
  /*
	Creates a new SSE connection.
  */
  SSETransport.prototype.open = function(params, handler, callback) {
	var baseurl = this.getURL(this.pathSSE);
	var url = this.addParams(baseurl, params);
	if(typeof(EventSource) !== "undefined") {
	  //source = new EventSource(encodeURI(url), {withCredentials: true});
	  source = new EventSource(encodeURI(url));
	} else {
	  alert("SSE are not supported by your browser!");
	}
  
	source.onopen = function(e) {
	  if(handler.open != undefined) {
		handler.open();
	  }
	};
  
	source.addEventListener('periodiclabdata', function(e) {
	  try {
		var parsed = JSON.parse(e.data);
		if(handler.message != undefined) {
		  handler.message(parsed);
		}
	  } catch(error) {
		console.log('[ERROR] invalid SSE response.');
	  }
	}, false);
  
	source.addEventListener('CLOSE', function(e) {
	  try {
		var parsed = JSON.parse(e.data);
		console.log(parsed.error);
	  } catch (error) {}
	  console.log('Closing');
	  source.close();
	  }, false);
  
	return source;
  };
  
  SSETransport.prototype.addParams = function (url, params) {
	if(params != undefined) {
	  var paramsString = '', first = true;
	  for(var param in params) {
		if(first) {
		  paramsString += '?' + param + '=' + params[param];
		} else {
		  paramsString += '&' + param + '=' + params[param];
		}
		first = false;
	  }
	}
	return url + paramsString;
  };
  
  // ----------------------------------------------------------------------------
  
  /**
  * RIP Client
  */
  
  function RIPClient(transport) {
	this.transport = transport;
	/*var transport = new SSETransport({
	  'host': host,
	  'port': port,
	  'portSSE': 8080,
	  'urlSSE': '/RIP/SSE',
	  'urlPOST': '/RIP/POST',
	});*/
	var ripclient = new JsonRpcClient(transport);
	ripclient.connected = false;
	ripclient.buffer = [];
	ripclient.BUFFER_SIZE = 2000;
	ripclient.state = {};
  
	ripclient.methods = {
	  get: 'get', // Get some variables from the server
	  set: 'set', // Set some variables in the server
	  start: 'start', // Start a new Experience
	  stop: 'stop', // Stop a running Experience
	  info: 'info'
	};
  
	ripclient.setDefaultExperience = function(expid) {
	  this.expid = expid;
	};
  
	ripclient.info = function(callback, expid) {
	  if(expid == undefined || expid == null) {
		this.invoke(this.methods.info, [], callback);
	  } else {
		this.invoke(this.methods.info, [expid], callback);
	  }
	};
  
	ripclient.start = function(callback, expid) {
	  expid = this.checkExpid(expid);
	  if(expid == undefined) { return }
	  this.invoke(this.methods.start, [expid], callback);
	};
  
	ripclient.checkExpid = function(expid) {
	  return (expid != undefined) ? expid : this.expid;
	};
  
	ripclient.stop = function(callback, expid) {
	  expid = this.checkExpid(expid);
	  if(expid == undefined) { return }
	  return this.invoke(this.methods.stop, [expid], callback);
	};
  
	ripclient.get = function(vars, callback, expid) {
	  expid = this.checkExpid(expid);
	  if(expid == undefined) { return }
	  this.invoke(this.methods.get, [expid, vars], callback);
	};
  
	ripclient.set = function (vars, values, callback, expid) {
	  expid = this.checkExpid(expid);
	  if (expid == undefined) { return }
	  var varsToSend = [], valuesToSend = [];
	  var stateUpdated = {};
	  var send = false;
	  for (var i = 0; i < vars.length; i++) {
		var name = vars[i], value = values[i];
		if (this.state[name] != value) {
		  varsToSend.push(name);
		  valuesToSend.push(value);
		  send = true;
		}
		stateUpdated[name] = value;
	  }
	  if (send) {
		this.invoke(this.methods.set, [expid, varsToSend, valuesToSend], function (data) {
		  this.state = stateUpdated;
		  try {
			callback(data);
		  } catch (e) { }
		}.bind(this));
	  }
	};
  
	ripclient.connect = function(expid, callback) {
	  expid = this.checkExpid(expid);
	  if(expid == undefined) { return }
	  this.expid = expid;
	  this.userOnMessage = callback;
	  this.session = this.transport.open({'expId':expid}, {
		'open': this.onopen.bind(this),
		'message': this.ondata.bind(this)
	  });
	};
  
	ripclient.onopen = function(data) {
	  this.connected = true;
	};
  
	ripclient.ondata = function(data) {
	  try {
		var result = data.result;
		var names = result[0];
		var values = result[1];
		var n = names.length;
		var notifyUser = (this.userOnMessage != undefined);
		for(var i = 0; i<n; i++) {
		  data[names[i]] = values[i];
		}
		if(notifyUser) {
		  this.userOnMessage(data);
		}
	  } catch(error) {
		console.log(error);
	  }
	};
  
	ripclient.disconnect = function() {
	  this.connected = false;
	  this.session.close();
	};
  
	return ripclient;
  }
  
  /**
   * Arduino API
   */
  function RIPArduino(transport) {
	this.transport = transport;
	//Input digitals pin Arduino
	this.DI = [].fill(false, 1, 54);
	this.DI[2]=true;
	//Output digitals pin Arduino
	this.DO = [].fill(false, 1, 54);
	//Input analogs pin Arduino
	this.AI = [].fill(0, 1, 16);
	//Out analogs pin Arduino
	this.AO = [].fill(0, 1, 54);
	// Values Digital
	this.digitalValue = [].fill(false, 1, 54);
	// Values analog
	this.analogValue = [].fill(0, 0, 100);
	
	//List setup
	this.listSetup=[];
	this.connected=false;
	this.commandExt
  }
  
  RIPArduino.prototype.isConnected = function() {
	  return this.connected;
  };
  
  RIPArduino.prototype.setDefaultExperience = function(expid) {
	  this.expid = expid;
  };
  
  RIPArduino.prototype.setCommandExt = function(func) {
	  this.commandExt = func;
  };
  
  RIPArduino.prototype.connect = function() {
		
	params = {};
	handler = {
	  'open':this.onopen.bind(this),
	  'message':this.onmessage.bind(this),
	  'error':this.onerror.bind(this)
	};
	this.transport.open(params, handler);
  };
  
  RIPArduino.prototype.onopen = function (data) {
	this.connected = true;
	console.log('[INFO] Opening WebSocket connection.');
	this.setup();
  };
  
  RIPArduino.prototype.onmessage = function (data) {
	try {
	  if(data.orden.mode == 1) {
		this.performerCommand(data);
	  } else if(data.orden.mode === 0) {
		this.performerResponse(data);
	  } else if(data.orden.mode === 2) {
		this.performerCommandExt(data);
	  }
	} catch(error) {
	  console.log('[WARNING] Discarding unknown or invalid message.');
	}
  };
  
  RIPArduino.prototype.onerror = function (data) {
	console.log('[ERROR] Error on WebSocket connection.');
  };
  
  RIPArduino.prototype.setup =function (){
	  var i;
	  for (i = 0; i < this.listSetup.length; i++) {
		  console.log(JSON.stringify(this.listSetup[i]));
		  this.transport.send(JSON.stringify(this.listSetup[i]));
	  }
  
	  //this.listSetup.forEach(function(item, index, array) {
	  //	console.log(JSON.stringify(item), index);
	  //	this.transport.send(JSON.stringify(item));
	  //})
  };
  
  RIPArduino.prototype.pinMode = function (ind,value) {
	  var command = 'pinMode';
	  var params = [ind, value];
	  var id = this.getId();
	  var request = this.buildRequest(command, params, id);
	  //this.transport.send(JSON.stringify(request));
	  this.listSetup.push(request);
	};
  
  RIPArduino.prototype.digitalWrite = function(ind, value) {
	if(!this.connected) return;
	var command = 'digitalWrite';
	var params = [ind, value];
	var id = this.getId();
	var request = this.buildRequest(command, params, id);
	this.transport.send(JSON.stringify(request));
  };
  
  RIPArduino.prototype.buildRequest = function(method, params, id) {
	var request = {
	  "orden" : {
		"mode" : 1,
		"idSecuent" : id,
		"command" : method,
		"parameters" : params
	  }
	};
	return request;
  };
  
  RIPArduino.prototype.analogWrite = function(ind, value) {
	if(!this.connected) return;
	var command = 'analogWrite';
	var params = [ind, value];
	var id = this.getId();
	var request = this.buildRequest(command, params, id);
	this.transport.send(JSON.stringify(request));
  };
  
  RIPArduino.prototype.servoWrite = function(ind, value) {
	  if(!this.connected) return;
	  var command = 'servoWrite';
	  var params = [ind, value];
	  var id = this.getId();
	  var request = this.buildRequest(command, params, id);
	  this.transport.send(JSON.stringify(request));
  };
  
  RIPArduino.prototype.getId = function() {
	return Math.floor(Math.random()*1000);
  };
  
  RIPArduino.prototype.putAnalogValue = function(ind, value) {
	if(!this.connected) return;
	var command = 'putAnalogValue';
	var params = [ind, value];
	var id = this.getId();
	var request = this.buildRequest(command, params, id);
	this.transport.send(JSON.stringify(request));
  };
  
  RIPArduino.prototype.putDigitalValue = function(ind, value) {
	if(!this.connected) return;
	var command = 'putDigitalValue';
	var params = [ind, value];
	var id = this.getId();
	var request = this.buildRequest(command, params, id);
	this.transport.send(JSON.stringify(request));
  };
  
  RIPArduino.prototype.putNewCommand = function(method,params) {
	if(!this.connected) return;
	//var command = 'message';
	//var params = [message];
	var id = this.getId();
	var request = {
	  "orden" : {
		"mode" : 2,
		"idSecuent" : id,
		"command" : method,
		"parameters" : params
	  }
	}
	
	//var request = this.buildRequest(command, params, id);
	
	this.transport.send(JSON.stringify(request));
  };
  
  
  RIPArduino.prototype.putMessage = function(message) {
	if(!this.connected) return;
	//var command = 'message';
	//var params = [message];
	//var id = this.getId();
	//var request = this.buildRequest(command, params, id);
	//this.transport.send(JSON.stringify(request));
	this.transport.send(message);
  };
  
  
  
  RIPArduino.prototype.digitalRead = function(ind) {
	return this.DI[ind];
  };
  
  RIPArduino.prototype.analogRead = function(ind) {
	return this.AI[ind];
  };
  
  RIPArduino.prototype.upDateDigitalOut = function(ind) {
	return this.DO[ind];
  };
  
  RIPArduino.prototype.upDateAnalogOut = function(ind) {
	return this.AO[ind];
  };
  
  RIPArduino.prototype.getDigitalValue = function(ind) {
	return this.digitalValue[ind];
  };
  
  RIPArduino.prototype.getAnalogValue = function(ind) {
	return this.analogValue[ind];
  };
  
  RIPArduino.prototype.performerCommand = function(obj) {
	switch(obj.orden.command) {
	  case "log":
		value = value + obj.orden.parameters[1] + "\r\n";
		break;
	  case "digitalRead":
		  this.DI = obj.orden.parameters;
		  break;
	  case "analogRead":
		this.AI = obj.orden.parameters;
		break;
	  case "putDigitalValue":		
		this.digitalValue[obj.orden.parameters[0]] = (obj.orden.parameters[1]== "true" );
		break;
	  case "putAnalogValue":
		this.analogValue[obj.orden.parameters[0]] = obj.orden.parameters[1];
	  break;  
	  default:
		text = "...";
	}
  };
  
  RIPArduino.prototype.performerCommandExt = function(obj) {
	  console.log("Command exten"); 
	switch(obj.orden.command) {
	  case "log":
		value = value + obj.orden.parameters[1] + "\r\n";
		break;
	  default:
		  if (this.commandExt === undefined) {
			  console.log("No esta definido commandExt");
		  }
		  else {
			  //console.log("Esta definida"); 
			  this.commandExt(obj);
		  }	
		text = "...";
	}
  };
  
  RIPArduino.prototype.performerResponse = function(obj) {
	switch(obj.orden.command) {
	  case "digitalWrite":		
		this.DO[obj.orden.parameters[0]] = (obj.orden.parameters[1]== "true" );
		break;
	  case "analogWrite":
		this.AO[obj.orden.parameters[0]] = obj.orden.parameters[1];
	  break;
	  default:
	   text = "...";
	}
  };
  