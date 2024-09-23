const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000', // Your React frontend URL
        methods: ['GET', 'POST'],
    },
});

let presentations = {}; // Store all presentations

io.on('connection', (socket) => {
    console.log('A user connected');

    // Send the list of presentations when requested
    socket.on('get_presentations', () => {
        const presentationList = Object.keys(presentations).map((id) => ({
            id,
            name: `Presentation ${id.substring(0, 5)}`,
        }));
        socket.emit('presentation_list', presentationList);
    });

    // When a new presentation is created
    socket.on('create_presentation', (presentationId, nickname) => {
        if (!presentations[presentationId]) {
            presentations[presentationId] = { drawings: [], nickname };
        }
        io.emit('presentation_list', Object.keys(presentations).map((id) => ({
            id,
            name: `Presentation ${id.substring(0, 5)}`,
        }))); // Broadcast the updated list
    });

    // When a user joins a presentation
    socket.on('join_presentation', ({ presentationId, nickname }) => {
        socket.join(presentationId); // Join the room for this presentation
        console.log(`${nickname} joined presentation ${presentationId}`);
        
        // Send existing drawings to the new user
        if (presentations[presentationId]) {
            socket.emit('canvas_data', presentations[presentationId].drawings);
        }
    });

    // When a drawing is received, broadcast it to the room
    socket.on('drawing', (data) => {
        const { presentationId, x0, y0, x1, y1, tool } = data;
        if (presentations[presentationId]) {
            // Store the drawing
            presentations[presentationId].drawings.push({ x0, y0, x1, y1, tool });

            // Broadcast to others in the same presentation room
            socket.broadcast.to(presentationId).emit('drawing', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

server.listen(3001, () => {
    console.log('Server is running on port 3001');
});
