var saveButton = document.getElementById("saveButton");
var errorMessage = document.getElementById("errorMessage");

saveButton.onclick = function() {

  username = document.getElementById("username").value;
  nickname = document.getElementById("nickname").value;

  console.log("got values");
  
  chrome.runtime.sendMessage({
    "username" : username,
    "nickname" : nickname
  }, function(response) {
    console.log("sent");
    console.log(response);
    saveButton.textContent = "Loading";
    saveButton.setAttribute('class','ui green loading button');
    if (response.resp == "OK") {
      setTimeout(function() {
        window.close()
      }, 2500);
    } else {
      saveButton.textContent = "Save";
      saveButton.setAttribute('class', 'ui green button');
      errorMessage.textContent = "Please enter both a username and nickname!"
    }
  });
}
