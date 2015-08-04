/*
 * Backend for Viki-Kati chrome extension that proxies socket.io
 * network events between server and page-injected javascript
 *
 * chrome/src/background.js
 * Project: Viki-Kati
 * Author: Frank Cangialosi
 * Last Updated: July 27, 2015
 */

/**************
 * CONNECTION *
 **************/

/******************************************************************************/
SERVER = "104.131.18.154"
PORT = "927"
var socket = io('http://' + SERVER + ':' + PORT);
socket.on('connect', function () {
  console.log("Connected to server successfully.");
});
/******************************************************************************/





/************
 * STARTUP *
 ************/

/******************************************************************************/
/*
 * Entry point the first time this extension is installed
 *
 * Sets up the settings popup and waits for user to enter
 * their information
 */
chrome.runtime.onInstalled.addListener(function (){
  localStorage.clear();
  chrome.storage.local.clear();

  // Register listener that responds when user completes popup form
  chrome.runtime.onMessage.addListener(handleMessagesFromSettings);

  chrome.browserAction.setPopup({
    popup : "settings.html"
  });
});

/*
 * Recieves user settings from the settings.html popup and stores
 * them in local storage
 */
function handleMessagesFromSettings(request,sender,sendResponse) {
  if (request.username) {
    localStorage.username = request.username;
    localStorage.nickname = request.nickname
    chrome.storage.local.set({
      session_viewers : [request.username]
    });
    sendResponse({
      "resp": "OK"
    });
    onStartup();
  } else {
    sendResponse({
      "resp" : "FAIL",
    });
  }
}

// Switches to a Viki tab or creates a new one if one
// doesn't already exist
function iconClickedListener() {
  chrome.tabs.getAllInWindow(undefined, function (tabs) {
    for (var i=0, tab; tab = tabs[i]; i++) {
      if(tab.url && tab.url.indexOf("viki.com") != -1) {
        chrome.tabs.update(tab.id, {selected : true});
        return;
      }
    }
    chrome.tabs.create({url : "http://www.viki.com"});
  });
}


var ping = 0;
var pingSent, pingRecv;
var pings = [];
var curr = 0;
var PINGS_CACHE_LENGTH = 10;
function median(arr) {
  if (arr.length == 0) {
    return null;
  }
  arr.concat().sort(function (a,b) {return a - b});
  var mid = Math.floor(arr.length / 2);
  if ((arr.length % 2) == 1)
    return arr[mid];
  else
    return (arr[mid-1] + arr[mid]) / 2;
}
function pingServer() {
  if (pingRecv != 0) { // if it's zero, then we haven't recieved the last ping we sent yet
    pingSent = Date.now();
    socket.emit("ping", {
      ping : ping,
      username : localStorage.username
    });
    pingRecv = 0;
  }
  if (pings.length >= PINGS_CACHE_LENGTH) {
    setTimeout(pingServer, 5000);
  } else {
    setTimeout(pingServer, 2000);
  }
}
function updateMedian(elapsed) {
  pings[curr] = elapsed;
  ping = median(pings);
  curr += 1;
  if (curr >= PINGS_CACHE_LENGTH) {
    curr = 0;
  }
}

/*
 * Entry point every time the browser runs this extension
 *
 * 1. Clicking logo opens new viki page, since settings
 * have already been set
 * 2. Tell the server we are online
 * 3. Setup handlers for messages from content scripts
 */
function onStartup() {
  // Don't need the popup anymore
  chrome.browserAction.setPopup({
    popup : ""
  });

  // When we click the icon, switch to Viki
  chrome.browserAction.onClicked.addListener(iconClickedListener);

  // Tell server we're online and who we are
  socket.emit("hello", {
    username : localStorage.username
  });

  // Switch from listening for settings to listening for content script messages
  chrome.runtime.onMessage.removeListener(handleMessagesFromSettings);
  chrome.runtime.onMessage.addListener(forwardToServer);
  setTimeout(pingServer, 2000);
}
chrome.runtime.onStartup.addListener(onStartup);
/******************************************************************************/




/********************************
 * CONTENT_SCRIPT -> BACKGROUND *
 ********************************/

/******************************************************************************/
function forwardToServer(request,sender,sendResponse) {
    var destination = request.type;
    var data;
    var forward = true;

    // Prepare data packet based on request type
    if (request.type == "invite") {

      data = request;
      data.from = localStorage.username;
      localStorage.session_tab_id = sender.tab.id;

    } else if (request.type == "ready") {

      console.log("forwarding ready to server");
      data = {
        username : localStorage.username
      };

    } else if (request.type == "video-event") {

      destination = 'video-event';
      data = request;
      data.from = localStorage.username;

    } else if (request.type == "pause") {

      destination = "";
      data = {};

    } else if (request.type == "seek") {

      destination = "";
      data = {};

    } else if (request.type == "resync") {

      destination = "";
      data = {};

    } else if (request.type == "get-viewers") {

      forward = false;
      chrome.storage.local.get('session_viewers', function (keys) {
        console.log('responding with viewers from storage');
        console.log(keys);
        console.log(keys.session_viewers);
        sendResponse({
          viewers : keys.session_viewers
        });
      });

    }

    if (forward) { // send to server
      socket.emit(destination, data);
    } else {
      return true;
    }
}

chrome.tabs.onRemoved.addListener(function onRemoved(tabId, removeInfo) {
    console.log("a tab has been closed");
    if (tabId == localStorage.session_tab_id) {
        console.log("your viki tab has been closed, telling everyone else...");
        socket.emit('leave-room', {
            from : localStorage.username
        });
        chrome.storage.local.set({
          session_viewers : [localStorage.username]
        })
        localStorage.session_tab_id = 0;
    }
});
/******************************************************************************/




/********************************
 * BACKGROUND -> CONTENT_SCRIPT *
 ********************************/

/******************************************************************************/
function sendToContentScript(type, data, callback) {
  data.type = type;
  chrome.tabs.sendMessage(parseInt(localStorage.session_tab_id), data, callback);
}
/******************************************************************************/




/************************
 * SERVER -> BACKGROUND *
 ************************/

/******************************************************************************/
rid = 1
requests = {}
socket.on('watch-request', function(data) {
  requests[rid] = data;

  var opt = {
    type : "basic",
    title : "Request to Watch",
    message : data.from + " wants to watch " + data.video_title + " with you!",
    buttons : [{title : "Join"},{title : "Decline"}],
    iconUrl : "viki-kati-white.png"
  }

  chrome.notifications.create(rid.toString(), opt, function() {
    rid += 1;
  });
});

// TODO maybe for loop this with a couple different events and call it forward
socket.on('watch-response', function(data) {
  console.log("watch-response");
  if (data.answer == "accept") {
    chrome.storage.local.get('session_viewers', function (keys) {
      viewers = keys.session_viewers;
      viewers.push(data.to);
      chrome.storage.local.set({
        session_viewers : viewers
      }, function () {
        sendToContentScript('watch-response', data);
      });
    });
  } else {
    sendToContentScript('watch-response', data);
  }
});

socket.on('start', function(data) {
  console.log('all ready!');
  sendToContentScript('start', {});
});

socket.on('video-event', function(data) {
  console.log('got video event, forwarding to content script');
  sendToContentScript('video-event', data);
});

socket.on('friend-joined', function(data) {
  console.log(data.friend + " joined the room");
  chrome.storage.local.get('session_viewers', function (keys) {
    viewers = keys.session_viewers;
    viewers.push(data.friend);
    chrome.storage.local.set({
      session_viewers : viewers
    });
  });
});

socket.on('friend-left', function(data) {
  console.log(data.from + " left the room");
  chrome.storage.local.get('session_viewers', function (keys) {
    viewers = keys.session_viewers;
    viewers.splice(viewers.indexOf(data.from), 1);
    chrome.storage.local.set({
      session_viewers : viewers
    }, function () {
      sendToContentScript('friend-left', data);
    });
  });
});

socket.on('pong', function(data) {
  pingRecv = Date.now();
  elapsed = (pingRecv - pingSent) / 2;
  updateMedian(elapsed);
});
/******************************************************************************/




/******************************
 * NOTIFICATION -> BACKGROUND *
 ******************************/

/******************************************************************************/
chrome.notifications.onButtonClicked.addListener(function recievedResponse(id, buttonIndex) {
  request = requests[id];
  if (buttonIndex == 0) { // Join
    // Add self to viewer list
    request.viewers.push(localStorage.username);
    // Save to DB
    chrome.storage.local.set({
      session_viewers : request.viewers
    }, function () {
      // Create new tab to join the room
      chrome.tabs.create({url : request.video_link}, function tabCreated(tab) {
        socket.emit('watch-response', {
          from : request.from,
          to : request.to,
          answer : 'accept',
          room_id : request.room_id
        });
        localStorage.session_tab_id = tab.id;
      });
    });
  } else { // Decline
    socket.emit('watch-response', {
      from : request.from,
      to : request.to,
      answer : 'decline',
      room_id : request.room_id
    });
  }
});
/******************************************************************************/
