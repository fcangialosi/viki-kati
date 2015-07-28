// Get container
var watch = document.getElementsByClassName("watch")[0];

// Create sidebar
var side_div = document.createElement("DIV");
side_div.setAttribute("style","width:168px;margin:10px;position:absolute");
side_div.innerHTML = "<center>\
        <img src=\"" + chrome.extension.getURL("./viki-kati-logo.png") + "\" height=\"50\" width=\"50\">\
        <br>\
        <br>\
        <button class=\"small ui inverted blue button\" style=\"width:120px\">\
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

    window.setTimeout(function inviteTimeout() {
        inviteButton.setAttribute('class', 'tiny ui red icon button');
        inviteButton.childNodes[1].setAttribute('class', 'remove icon');
    }, 7000);
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
            inviteButton.childNodes[1].setAttribute('class', 'checkmark icon');
            appendFriend(request.to);
        } else {
            inviteButton.childNodes[1].setAttribute('class', 'remove icon');
        }
    } else if (request.type == "joined") {
        console.log("joined");
        appendFriend(request.to)
    }
}
chrome.runtime.onMessage.addListener(handleMessagesFromBackground);

document.addEventListener('videoLoad', function(event) {
    console.log('cs.videoLoad');
});

document.addEventListener('videoStart', function(event) {
    console.log('cs.videoStart');
});

document.addEventListener('videoPause', function(event) {
    console.log('cs.videoPause');
});

document.addEventListener('videoResume', function(event) {
    console.log('cs.videoResume');
});

document.addEventListener('videoSeek', function(event) {
    console.log('cs.videoSeek');
});

document.addEventListener('videoView', function(event) {
    console.log('cs.videoView');
});

document.addEventListener('videoFinish', function(event) {
    console.log('cs.videoFinish');
});
