var io = require('socket.io').listen(927);

client_sockets = {}
rooms = {}
users = {}

var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz012345678";
function generateid(){
	text = "";
	for (var i=0; i < 5; i++) {
		text += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return text;
}
function newid(){
	id = generateid();
	while (id in rooms) {
		id = generateid();
	}
	return id;
}

io.on('connection', function(socket) {
	console.log("client connected");

	socket.on('disconnect', function() {
		console.log("client disconnected")
		// TODO delete user?
	});

	socket.on('hello', function(data) {
		username = data.username;
		users[username] = {};
		client_sockets[username] = socket;

		console.log(username + " logged on.");
	});

	socket.on('invite', function(data) {
		console.log(data.from + " wants to watch " + data.video_title + " with " + data.to);

		if ('room_id' in users[data.from] && users[data.from].room_id in rooms) {
			console.log("User is already in room: " + room_id);
			room_id = users[data.from].room_id;
		} else { // Create new room
			room_id = newid();
			room = {
				video_title : data.video_title,
				video_link : data.video_link,
				viewers : [data.from],
				ready : []
			}
			users[data.from].room_id = room_id;
			rooms[room_id] = room;
			console.log("User not in room. Create new one: " + room_id);
		}
		data.room_id = room_id;

		if (data.to in client_sockets) {
			client_sockets[data.to].emit('watch-request', data);
		} else {
			console.log(data.to + " is not currently online.");
		}
	});

	socket.on('watch-response', function(data) {
		// TODO REMOVE
		console.log("watch-response");
		console.log(data);

		if (data.answer == 'accept') { // Add self to room
			console.log("Adding self to room " + data.room_id);
			responder = data.to;
			users[responder].room_id = data.room_id;
			rooms[data.room_id].viewers.push(responder);
		}

		client_sockets[data.from].emit('watch-response', data);
	});

	// TODO this is only the perfect case, need to handle
	// when room or user hasn't been initialized yet
	socket.on('ready', function(data) {
		username = data.username;
		console.log(username + " is ready in room " + users[username].room_id);
		room = rooms[users[username].room_id];
		room.ready.push(username);

		if (room.viewers.length == room.ready.length) { // everyone is ready!
			console.log("everyone is ready! let's go!");
			for (var i=0; i < room.ready.length; i++) {
				user = room.ready[i];
				console.log(user);
				client_sockets[user].emit('start', {});
			}
		}
	});
});

