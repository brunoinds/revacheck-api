import express from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';

const app = express();
const server = app.listen(3000, () => {
  console.log(`Server started on port ${server.address().port}`);
});

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    console.log(`Received message: ${data}`);
    ws.send(`Server received: ${data}`);
  });

  ws.send('Hello from server!');
});