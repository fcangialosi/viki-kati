ul = document.getElementById('viewer-list');
function addViewer(viewer) {
    console.log("adding viewer: " + viewer);
    li = document.createElement("li");
    li.setAttribute('id', 'viewer-'+viewer);
    text = document.createTextNode(viewer);
    li.appendChild(text);
    ul.appendChild(li);
}
function removeViewer(viewer) {
    li = document.getElementById('viewer-'+viewer);
    if (li) {
        li.parentNode.removeChild(li);
    }
}

stream = null;
peer_id = null;

var peer = new Peer({key: '42bimnywmj8umcxr'});
peer.on('open', function(id) {
	  console.log('My peer ID is: ' + id);
		peer_id = id;
		conn.on('data', function(data) {
			console.log('Received:',data);
		});
		conn.send('Hello!');
});
peer.on('call', function(call) {
	console.log("Got call!");
	console.log(call);
	console.log("My stream is",stream);
	call.answer(stream);
});

var p = navigator.mediaDevices.getUserMedia({ audio: true, video: true });
p.then(function(mediaStream) {
	console.log("Got media stream!");
	stream = mediaStream;
	var video = document.querySelector('video');
	video.src = window.URL.createObjectURL(mediaStream);
	video.onloadedmetadata = function(e) {
		video.play();
	};

	chrome.runtime.sendMessage({
			type : 'get-viewers'
	}, function (response) {
			console.log("got viewers: ");
			console.log(response.viewers);
			for (var i=0; i < response.viewers.length; i++) {
					addViewer(response.viewers[i]);
			}
			console.log("Number of viewers: ",response.viewers.length);
			if(response.viewers.length > 1) {
				console.log("Number of viewers is greater than 1!");
				console.log("Friend's peer id is",response.friend_peer_id);
				var call = peer.call(response.friend_peer_id,stream);
			}
	});
});
p.catch(function(err) {
	console.log(err.name);
	console.log(err);
});



// Get container
//var watch = document.getElementsByClassName("watch")[0];
var watch = document.getElementsByClassName("cinematic-wrapper-row")[0];
var player = watch.children[0];
player.setAttribute("style","float:right");
// Global variables
var playerLoaded = false;
var playerObject;
var playerFrame;
var alone = true;
var syncd = false;
var invitePending = false;
var playerLocked = false;

side_width = Math.floor((watch.clientWidth * 0.1675178754))
// Create sidebar
var side_div = document.createElement("DIV");
side_div.setAttribute("style","width:"+side_width+"px;margin-top:"+(side_width/10)+"px;position:absolute");
side_div.innerHTML = "<center style=\"color:#fff\">\
        <img src=\"" + chrome.extension.getURL("./viki-kati-logo.png") + "\" height=\""+(side_width/4)+"\" width=\""+(side_width/4)+"\">\
        <br>\
        <br>\
        <button class=\"small ui inverted blue button\" style=\"width:"+(side_width/2)+"px\" id=\"readyButton\">\
            Ready\
        </button>\
        <br>\
        <br>\
        <button class=\"small ui inverted green button\" style=\"width:"+(side_width/2)+"px\">\
            Re-Sync\
        </button>\
        <br>\
        <br>\
        <br>\
        <br>\
        <div class=\"field\" style=\"width:"+(side_width/2)+"px\">\
            <label style=\"text-align:left\"> Invite: </label>\
            <div class=\"ui action input\">\
                <input type=\"text\" placeholder=\"Friend\" style=\"width:83px;\" id=\"inviteInput\">\
                <button class=\"tiny ui inverted red icon button\" id=\"inviteButton\">\
                    <i class=\"plus icon\"></i>\
                </button>\
            </div>\
        </div>\
        <br>\
        <br>\
        <h4>Watching now:</h4>\
        <ul style=\"text-align: left;\" id=\"viewer-list\">\
        </ul></center>"


// Insert sidebar into container
watch.insertBefore(side_div, watch.childNodes[0]);



// Add click handlers for invite
var inviteButton = document.getElementById("inviteButton");
var inviteInput = document.getElementById("inviteInput");
var readyButton = document.getElementById("readyButton");

function inviteTimeout() {
    if (invitePending) {
        inviteButton.setAttribute('class', 'tiny ui red icon button');
        inviteButton.childNodes[1].setAttribute('class', 'remove icon');
    }
}

inviteButton.onclick = function inviteFriend() {
    var friend_name = inviteButton.parentNode.childNodes[1].value;
    var isLoading = (inviteButton.getAttribute('class').indexOf('loading') >= 0);
    if (isLoading) {
        inviteButton.setAttribute('class', 'tiny ui red icon button');
        inviteButton.childNodes[1].setAttribute('class', 'plus icon');
    } else {
        inviteButton.setAttribute('class', 'tiny ui red icon loading button');

        // Parse video title + episode number
        var video_title;
        if (document.title.indexOf(" - ") > 0) {
            video_title = document.title.split(" - ")[0];
        } else {
            video_title = document.title;
        }

        // Notify background.js, send request to friend
        chrome.runtime.sendMessage({
            type : "invite",
            to : friend_name,
						from_peer_id : peer_id,
            video_title : video_title,
            video_link : document.URL
        }, function (response){});
    }
}

inviteInput.onclick = function inviteFocus() {
    inviteInput.nextElementSibling.childNodes[1].setAttribute('class', 'plus icon');
}


function handleMessagesFromBackground(request,sender,sendResponse) {
    console.log("from background: ");
    console.log(request);
    if (request.type == "watch-response") {
        inviteButton.setAttribute('class', 'tiny ui red icon button');
        inviteInput.value = "";
        if (request.answer == "accept") {
            invitePending = false;
            inviteButton.childNodes[1].setAttribute('class', 'checkmark icon');
            addViewer(request.to);
            alone = false;
        } else {
            inviteButton.childNodes[1].setAttribute('class', 'remove icon');
        }
    } else if (request.type == "start") {
        readyButton.setAttribute('class', 'small disabled ui inverted grey button');
        readyButton.innerHTML = "Enjoy! :)";
        startCountdown();
        syncd = true;
    } else if (request.type == "video-event") {
        playerLocked = true;
        if (request.action == "pause") {
            //playerObject.seekTo(request.time);
            playerObject.pause();
            playerLocked = false;
        } else if (request.action == "resume") {
            startCountdown();
        } else if (request.action == "seek") {
            playerObject.pause();
            playerObject.seekTo(request.time);
            startCountdown();
        }
    } else if (request.type == "friend-left") {
        console.log("friend left");
        removeViewer(request.from);
    }
}
chrome.runtime.onMessage.addListener(handleMessagesFromBackground);

readyButton.onclick = function () {
    readyButton.setAttribute('class', 'small ui inverted button loading');
    chrome.runtime.sendMessage({type : 'ready'}, function (response) {});
}

var countdown_position = 5;
var countdown_overlay;
var countdown_text;

function countdown() {
    if (countdown_position > 1) {
        countdown_position -= 1;
        countdown_text = document.getElementById("overlay-text")
        countdown_text.innerHTML = countdown_position.toString();
        setTimeout(countdown, 1000);
    } else {
        countdown_overlay = document.getElementById("overlay");
        countdown_overlay.parentElement.removeChild(countdown_overlay);
        playerLocked = true;
        playerObject.playVideo();
        countdown_position = 3;
        playerLocked = false;
    }
}

function startCountdown() {
    console.log("start countdown...");
    countdown_overlay = document.createElement('DIV');
    countdown_overlay.setAttribute('id', 'overlay');
    countdown_overlay.setAttribute('style', 'position:fixed;height: 100%;width: 100%;opacity: .5;z-index: 1;');
    number = document.createElement('P');
    number.setAttribute('id', 'overlay-text');
    number.setAttribute('style', "text-align: center; vertical-align: middle; line-height: 100%; font-size:200px; color:#fff; font-family:'Montserrat'");
    countdown_text = document.createTextNode(countdown_position.toString());
    number.appendChild(countdown_text);
    countdown_overlay.appendChild(number);
    playerFrame.insertBefore(countdown_overlay, playerFrame.childNodes[0]);
    countdown_overlay = document.getElementById('overlay');
    setTimeout(countdown, 1000);
}


document.addEventListener('videoLoad', function(event) {
    playerLoaded = true;
    playerObject = document.getElementById("flashObject").getElementsByTagName("object")[0];
    playerFrame = document.getElementsByClassName("show-video")[0];
});

document.addEventListener('videoStart', function(event) {
    playerObject.pause();
    playerObject.seekTo(0);
});

document.addEventListener('videoPause', function(event) {
    console.log('pause');
    console.log(playerLocked);
    if (syncd && !playerLocked) {
        myPosition = playerObject.getCurrentTime();
        chrome.runtime.sendMessage({
            type : 'video-event',
            action : 'pause',
            time : myPosition
        });
    }
});

document.addEventListener('videoResume', function(event) {
    console.log('resume');
    console.log(playerLocked);
    if (syncd && !playerLocked) {
        playerLocked = true;
        playerObject.pause();
        chrome.runtime.sendMessage({
            type : 'video-event',
            action : 'resume'
        });
        // TODO add latency delay
        startCountdown();
        playerLocked = false;
    }
});

document.addEventListener('videoSeek', function(event) {
    console.log('seek');
    console.log(playerLocked);
    if (syncd && !playerLocked) {
        playerLocked = true;
        playerObject.pause();
        myPosition = playerObject.getCurrentTime();
        chrome.runtime.sendMessage({
            type : 'video-event',
            action : 'seek',
            time : myPosition
        });
        // TODO add latency delay
        startCountdown();
        playerLocked = false;
    }
});

document.addEventListener('videoView', function(event) {
    // TODO what is this? when is it fired?
});

document.addEventListener('videoFinish', function(event) {
    // TODO not important now
    // TODO go to next episode / save progress?
});
