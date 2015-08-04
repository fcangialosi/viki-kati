var io = require('socket.io').listen(927);

client_sockets = {};
rooms = {};
users = {};
latencies = {}

var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz012345678";
function generateid(){
	var text = "";
	for (var i=0; i < 5; i++) {
		text += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return text;
}
function newid(){
	var id = generateid();
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
		var username = data.username;
		users[username] = {};
		client_sockets[username] = socket;

		console.log(username + " logged on.");
	});

	socket.on('ping', function(data) {
		var username = data.username;
		users[username].ping = data.ping;
		console.log("got ping " + data.ping.toString() + " from " + username);
		client_sockets[username].emit('pong', {});
	});

	socket.on('invite', function(data) {
		console.log(data.from + " wants to watch " + data.video_title + " with " + data.to);

		var room_id, room;
		if ('room_id' in users[data.from] && users[data.from].room_id in rooms) {
			room_id = users[data.from].room_id;
			room = rooms[room_id];
			console.log("User is already in room: " + room_id);
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
		data.viewers = room.viewers;

		if (data.to in client_sockets) {
			client_sockets[data.to].emit('watch-request', data);
		} else {
			console.log(data.to + " is not currently online.");
			data.answer = 'decline';
			client_sockets[data.from].emit('watch-response', data);
		}
	});

	socket.on('watch-response', function(data) {
		// TODO REMOVE
		console.log("watch-response");
		console.log(data);

		if (data.answer == 'accept') { // Add self to room
			console.log("Adding self to room " + data.room_id);
			var responder = data.to;
			users[responder].room_id = data.room_id;
			rooms[data.room_id].viewers.push(responder);
			//data.viewers = rooms[data.room_id].viewers;
		}
		client_sockets[data.from].emit('watch-response', data);
	});

	// TODO this is only the perfect case, need to handle
	// when room or user hasn't been initialized yet
	socket.on('ready', function(data) {
		var username = data.username;
		console.log(username + " is ready in room " + users[username].room_id);
		var room = rooms[users[username].room_id];
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

	socket.on('video-event', function(data) {
		console.log(data);
		var room = rooms[users[data.from].room_id];
		if (data.time) {
			room.current_position = data.time;
		}

		if (data.action == "pause" || data.paused) {
			for (var i=0; i < room.ready.length; i++) {
				user = room.ready[i];
				if (user != data.from) {
					client_sockets[user].emit('video-event', data);
				}
			}
		} else {
			max_latency = 0;
			for (var i=0; i < room.ready.length; i++) {
				p = room.ready[i].ping;
				if (p > max_latency) {
					max_latency = p;
				}
			}
			total_delay = max_latency + 150;
			console.log("latency delay is " + total_delay.toString());
			for (var i=0; i < room.ready.length; i++) {
				user = room.ready[i];
				data.wait = (total_delay - user.ping);
				client_sockets[user].emit('video-event', data);
			}
		}
	});

	socket.on('leave-room', function(data) {
		var room_id = users[data.from].room_id;
		var room = rooms[room_id];
		for (var i=0; i < room.ready.length; i++) {
			user = room.ready[i];
			if (user != data.from) {
				client_sockets[user].emit('friend-left', data);
			}
		}
		console.log(data.from + " left " + room_id);
		room.ready.splice(room.ready.indexOf(data.from), 1);
		room.viewers.splice(room.viewers.indexOf(data.from), 1);
		users[data.from].room_id = null;
		if (room.viewers.length < 1) {
			delete rooms[room_id];
		}
	});
});

