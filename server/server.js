var io = require('socket.io').listen(927);

sockets = {}
socket_to_room = {}
room_to_socket = {}
users = {}

io.on('connection', function(socket) {
	console.log("client connected");

	username = null;
	socket.on('disconnect', function() {
		console.log("client disconnected")
		if (username) {
			users[username] = false;
		}
	});

	socket.on('hello', function(data) {
		username = data.username
		users[username] = true;
		sockets[username] = socket;
		// TODO REMOVE
		console.log(username + " logged on.");
	});

	socket.on('invite', function(data) {
		// TODO REMOVE
		console.log(username + " wants to watch " + data.video_title + " with " + data.to);

		if (data.to in sockets) {
			sockets[data.to].emit('watch-request', data);
		} else {
			console.log(data.to + " is not currently online.");
		}
	});

	socket.on('watch-response', function(data) {
		// TODO REMOVE
		console.log("watch-response");
		console.log(data);

		sockets[data.from].emit('watch-response', data);
	});
});

