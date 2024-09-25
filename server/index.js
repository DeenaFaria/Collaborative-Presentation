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

    socket.on('create_presentation', (presentationId, nickname) => {
        if (!presentations[presentationId]) {
            presentations[presentationId] = {
                drawings: [], 
                users: {}
            };
        }
    
        // Add the creator to the user list with the 'Editor' role
        presentations[presentationId].users[socket.id] = {
            nickname,
            role: 'Editor'
        };
    
        // Broadcast the updated list of presentations
        io.emit('presentation_list', Object.keys(presentations).map((id) => ({
            id,
            name: `Presentation ${id.substring(0, 5)}`,
        })));
    
        // Send the updated user list for the presentation
        io.to(presentationId).emit('user_list', presentations[presentationId].users);
    });

    socket.on('join_presentation', ({ presentationId, nickname }) => {
        if (!presentations[presentationId]) {
            socket.emit('error', 'Presentation not found');
            return; // Handle non-existent presentation
        }

        socket.join(presentationId); // Join the room for this presentation
    
        // Add the user to the presentation's user list
        if (!presentations[presentationId].users[socket.id]) { // Only add if the user is not already there
            presentations[presentationId].users[socket.id] = {
                nickname,
                role: 'Viewer' // Default role is Viewer for new users
            };
        }
    
        // Send existing drawings to the new user
        socket.emit('canvas_data', presentations[presentationId].drawings);
    
        // Broadcast the updated user list to everyone in the presentation
        io.to(presentationId).emit('user_list', presentations[presentationId].users);
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
        // Remove the user from the presentations they were in
        for (const [presentationId, presentation] of Object.entries(presentations)) {
            if (presentation.users[socket.id]) {
                delete presentation.users[socket.id];
                io.to(presentationId).emit('user_list', presentation.users); // Broadcast updated user list
            }
        }
        console.log('A user disconnected');
    });

// Assuming you're using socket.io
socket.on('switch_role', ({ userId, presentationId, newRole }) => {
    // Update the user role in your data (e.g., database or in-memory storage)
    const presentation = presentations[presentationId];
    if (presentation && presentation.users[userId]) {
        presentation.users[userId].role = newRole;

        // Notify all connected clients about the role change
        io.to(presentationId).emit('role_updated', {
            userId,
            newRole,
            presentationId
        });

        console.log(`User ${userId}'s role updated to ${newRole} in presentation ${presentationId}`);
    } else {
        socket.emit('error', 'User or presentation not found');
    }
});

    
    
    
});

server.listen(3001, () => {
    console.log('Server is running on port 3001');
});
