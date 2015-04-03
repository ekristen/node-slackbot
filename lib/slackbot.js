var ws = require('ws')
var util = require('util')
var async = require('async')
var https = require('https')
var events = require('events')
var querystring = require('querystring')


var Slackbot = function (token) { 
  this.token = token
  this.handlers = []
  this.messageID = 0
  this.agent = 'node-slackbot'
  return this
}

util.inherits(Slackbot, events.EventEmitter)

Slackbot.prototype.api = function(method, params, cb) {
  var options, post_data, req

  params['token'] = params['token'] || this.token
  if (typeof params['attachments'] != 'undefined') {
    params['attachments'] = JSON.stringify(params['attachments'])
  }

  post_data = querystring.stringify(params)

  options = {
    hostname: 'api.slack.com',
    method: 'POST',
    path: '/api/' + method,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': post_data.length
    }
  }

  req = https.request(options)

  req.on('response', function(res) {
    var buffer
    buffer = ''
    res.on('data', function(chunk) {
      return buffer += chunk
    });
    return res.on('end', function() {
      var value
      if (cb != null) {
        if (res.statusCode === 200) {
          value = JSON.parse(buffer)
          return cb(value)
        } else {
          return cb({
            'ok': false,
            'error': 'API response: ' + res.statusCode
          })
        }
      }
    })
  })
  
  req.on('error', function(error) {
    if (cb != null) {
      return cb({
        'ok': false,
        'error': error.errno
      })
    }
  })
  
  req.write(post_data)
  return req.end()
};

Slackbot.prototype.use = function(fn) {
  this.handlers.push(fn)
  return this
}

Slackbot.prototype.handle = function(data) {
  async.series(this.handlers.map(function(fn) {
    return function(cb) {
      fn(data, cb);
    }
  }))

  return this
}

Slackbot.prototype.sendMessage = function(channel, text) {
  var message = {
    id: ++this.messageID,
    type: 'message',
    channel: channel,
    text: text
  }
  return this.ws.send(JSON.stringify(message))
}

Slackbot.prototype.connect = function(callback) {
  var self = this

  if (typeof callback != 'function') {
    callback = function connectNoop() {}
  }

  self.api('rtm.start', {agent: self.agent}, function(data) {

    self.ws = new ws(data.url)
    self.ws.on('message', function(data, flags) {
      var message = JSON.parse(data)

      self.emit('event', message)

      if (typeof message.type != 'undefined') {
        self.emit(message.type, message)
      }
      
      if (typeof message.subtype != 'undefined') {
        self.emit(message.subtype, message)
      }

      self.handle(message)
    })
    
    callback(data)
  })   
}

module.exports = Slackbot
