/*
 * Facilitates communication from js running in web page
 * to js running in the extensions content script
 *
 * Reference: http://stackoverflow.com/questions/10526995/can-a-site-invoke-a-browser-extension/10527809#10527809
 */

function fireEvent(event_type) {
    var new_event = new CustomEvent(event_type);
    document.dispatchEvent(new_event);
}

window.onVideoLoad = function onVideoLoad() {
    fireEvent("videoLoad");
}

window.onVideoStart = function onVideoStart() {
    fireEvent("videoStart");
}

window.onVideoPause = function onVideoPause() {
    fireEvent("videoPause");
}

window.onVideoResume = function onVideoResume() {
    fireEvent("videoResume");
}

window.onVideoSeek = function onVideoSeek() {
    fireEvent("videoSeek");
}

window.onVideoView = function onVideoView() {
    fireEvent("videoView");
}

window.onVideoFinish = function onVideoFinish() {
    fireEvent("videoFinish");
}
