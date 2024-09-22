const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Handle socket connections
io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    // Broadcast changes to all clients
    socket.on('slide-update', (data) => {
        socket.broadcast.emit('slide-update', data);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

// Serve the app
app.get('/', (req, res) => {
    res.send("Server is running...");
});

server.listen(3001, () => {
    console.log('listening on *:3001');
});
