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
var socket = io('http://104.131.18.154:927');
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
  localStorage.username = null;
  localStorage.nickname = null;

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
    // Save preferences to local storage
    localStorage.username = request.username;
    sendResponse({
      "resp": "OK"
    });
    // Change browser action behavior now that we're setup
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

    // Prepare data packet based on request type
    if (request.type == "invite") {

      data = request;
      data.from = localStorage.username;
      localStorage.session_tab_id = sender.tab.id;
      console.log("tab_id is " + sender.tab.id.toString());

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

    }

    // Send to server
    socket.emit(destination, data);
}
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

// maybe for loop this with a couple different events and call it forward
socket.on('watch-response', function(data) {
  console.log("watch-response");
  console.log(data);
  sendToContentScript('watch-response', data, function (response) {
  });
});

socket.on('start', function(data) {
  console.log('all ready!');
  sendToContentScript('start', {}, function (response) {
  });
});

socket.on('video-event', function(data) {
  console.log('got video event, forwarding to content script');
  sendToContentScript('video-event', data, function (response) {
  });
});
/******************************************************************************/




/******************************
 * NOTIFICATION -> BACKGROUND *
 ******************************/

/******************************************************************************/
chrome.notifications.onButtonClicked.addListener(function recievedResponse(id, buttonIndex) {
  request = requests[id];
  if (buttonIndex == 0) { // Join
    chrome.tabs.create({url : request.video_link}, function tabCreated(tab) {
      socket.emit('watch-response', {
        from : request.from,
        to : request.to,
        answer : 'accept',
        room_id : request.room_id
      });
      localStorage.session_tab_id = tab.id;
      sendToContentScript('joined', {friend : request.from});
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



// TODO on tab close, exit the room, need to invite again to sync hem back up
