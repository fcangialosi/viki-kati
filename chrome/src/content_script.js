// Get container
var watch = document.getElementsByClassName("watch")[0];

// Global variables
var playerLoaded = false;
var playerObject;
var playerFrame;
var alone = true;
var syncd = false;

// Create sidebar
var side_div = document.createElement("DIV");
side_div.setAttribute("style","width:168px;margin:10px;position:absolute");
side_div.innerHTML = "<center>\
        <img src=\"" + chrome.extension.getURL("./viki-kati-logo.png") + "\" height=\"50\" width=\"50\">\
        <br>\
        <br>\
        <button class=\"small ui inverted blue button\" style=\"width:120px\" id=\"readyButton\">\
            Ready\
        </button>\
        <br>\
        <br>\
        <button class=\"small ui inverted green button\" style=\"width:120px\">\
            Re-Sync\
        </button>\
        <br>\
        <br>\
        <br>\
        <br>\
        <div class=\"field\" style=\"width:120px\">\
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
        <p style=\"text-align:left;\">\
            1. You\
        </p>"

// Insert sidebar into container
watch.insertBefore(side_div, watch.childNodes[0]);

// Add click handlers for invite
var inviteButton = document.getElementById("inviteButton");
var inviteInput = document.getElementById("inviteInput");
var readyButton = document.getElementById("readyButton");

function inviteTimeout() {
    inviteButton.setAttribute('class', 'tiny ui red icon button');
    inviteButton.childNodes[1].setAttribute('class', 'remove icon');
}

inviteButton.onclick = function inviteFriend() {
    var friend_name = inviteButton.parentNode.childNodes[1].value;
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
        video_title : video_title,
        video_link : document.URL
    }, function (response){});

    setTimeout(inviteTimeout, 7000);
}

inviteInput.onclick = function inviteFocus() {
    inviteInput.nextElementSibling.childNodes[1].setAttribute('class', 'plus icon');
}

var friend_count = 2;
function appendFriend(friend) {
    p = document.createElement("P");
    text = document.createTextNode(friend_count.toString() + ". " + friend);
    p.setAttribute('style', 'text-align:left;');
    p.appendChild(text);
    side_div.childNodes[0].appendChild(p);
    friend_count += 1;
}

function handleMessagesFromBackground(request,sender,sendResponse) {
    if (request.type == "watch-response") {
        console.log("watch-response")
        inviteButton.setAttribute('class', 'tiny ui red icon button');
        inviteInput.value = "";
        if (request.answer == "accept") {
            console.log("friend accepted");
            clearTimeout(inviteTimeout);
            inviteButton.childNodes[1].setAttribute('class', 'checkmark icon');
            appendFriend(request.to);
            alone = false;
        } else {
            console.log("friend declined");
            inviteButton.childNodes[1].setAttribute('class', 'remove icon');
        }
    } else if (request.type == "joined") {
        console.log("joined");
        appendFriend(request.to);
        alone = false;
    } else if (request.type == "start") {
        console.log("got start");
        readyButton.setAttribute('class', 'small disabled ui inverted grey button');
        readyButton.innerHTML = "Enjoy! :)";
        startCountdown();
        syncd = true;
    } else if (request.type == "video-event") {
        console.log("got video event");
        if (request.action == "pause") {
            playerObject.pause();
            //playerObject.seekTo(request.time);
        } else if (request.action == "resume") {
            startCountdown();
        }
    }
}
chrome.runtime.onMessage.addListener(handleMessagesFromBackground);

readyButton.onclick = function () {
    console.log("clicked ready button");
    readyButton.setAttribute('class', 'small ui inverted button loading');
    chrome.runtime.sendMessage({type : 'ready'}, function (response) {});
}

var countdown_position = 5;
var countdown_overlay;
var countdown_text;

function countdown() {
    console.log("countdown event fired!");
    if (countdown_position > 1) {
        countdown_position -= 1;
        countdown_text = document.getElementById("overlay-text")
        countdown_text.innerHTML = countdown_position.toString();
        setTimeout(countdown, 1000);
        console.log("decreased number to " + countdown_position.toString());
    } else {
        countdown_overlay = document.getElementById("overlay");
        countdown_overlay.parentElement.removeChild(countdown_overlay);
        playerLocked = true;
        playerObject.playVideo();
        countdown_position = 3;
        console.log("finished counting down. stopping timer now.");
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

playerLocked = false;

//     playerObject.getCurrentTime();
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
    if (syncd && !playerLocked) {
        myPosition = playerObject.getCurrentTime();
        //playerObject.seekTo(myPosition);
        chrome.runtime.sendMessage({
            type : 'video-event',
            action : 'pause',
            time : myPosition
        });
    }
});

document.addEventListener('videoResume', function(event) {
    if (syncd && !playerLocked) {
        playerLocked = true;
        playerObject.pause();
        chrome.runtime.sendMessage({
            type : 'video-event',
            action : 'resume'
        });
        startCountdown();
        playerLocked = false;
    }
});

document.addEventListener('videoSeek', function(event) {

});

document.addEventListener('videoView', function(event) {
    // TODO what is this? when is it fired?
});

document.addEventListener('videoFinish', function(event) {
    // TODO not important now
    // TODO go to next episode / save progress?
});
