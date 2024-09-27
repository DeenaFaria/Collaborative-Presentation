const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow any origin for development, but restrict in production
    }
});

const presentations = {};
const users = {};

// Helper function to initialize a new presentation
const createNewPresentation = (presentationId) => {
    presentations[presentationId] = {
        slides: [createNewSlide()], // Initialize with one slide
        users: {},
    };
};

// Helper function to create a blank slide
const createNewSlide = () => {
    return {
        drawings: [], // Store drawing data per slide
    };
};

// On client connection
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join presentation
    socket.on('join_presentation', ({ presentationId, nickname }) => {
        console.log(`${nickname} joined presentation: ${presentationId}`);
        socket.join(presentationId);

        if (!presentations[presentationId]) {
            createNewPresentation(presentationId);
        }

        // Add user to the presentation's user list
        presentations[presentationId].users[socket.id] = { nickname, role: 'Viewer' };
        users[socket.id] = presentationId;

        // Send the list of users to all clients in the presentation
        io.to(presentationId).emit('user_list', presentations[presentationId].users);

        // Send the current slides to the user
        socket.emit('slide_data', presentations[presentationId].slides);
    });

    // Handle drawing event
    socket.on('drawing', (data) => {
        const { presentationId, slideIndex, x0, y0, x1, y1, tool } = data;

        // Store the drawing on the correct slide
        presentations[presentationId].slides[slideIndex].drawings.push({ x0, y0, x1, y1, tool });

        // Broadcast the drawing to everyone else in the presentation
        socket.broadcast.to(presentationId).emit('drawing', data);
    });

    // Handle adding new slide
    socket.on('add_slide', (presentationId) => {
        const newSlide = createNewSlide();
        presentations[presentationId].slides.push(newSlide);

        // Broadcast the addition of a new slide to all users in the presentation
        io.to(presentationId).emit('slide_added', presentations[presentationId].slides.length - 1);
    });

    // Handle role switching (Viewer <-> Editor)
    socket.on('switch_role', ({ userId, presentationId, newRole }) => {
        presentations[presentationId].users[userId].role = newRole;

        // Broadcast the role change to all users
        io.to(presentationId).emit('role_updated', { userId, newRole });
    });

    // On disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        const presentationId = users[socket.id];
        if (presentations[presentationId]) {
            delete presentations[presentationId].users[socket.id];
            io.to(presentationId).emit('user_list', presentations[presentationId].users);
        }

        delete users[socket.id];
    });
});

// Start the server
server.listen(3001, () => {
    console.log('Server is running on port 3001');
});
