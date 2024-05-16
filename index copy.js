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

const connections = [];


wss.on('connection', (ws) => {

  connections.push({
    id: null,
    ws: ws
  });


  console.log('New client connected!');

  ws.on('message', (data) => {
    const event = JSON.parse(data);

    if(event.type === 'register') {
      connections.find(c => c.ws === ws).id = event.id;
      console.log(`Client registered with id: ${event.id}`);


      connections.forEach(c => {
        if (c.ws !== ws) {
          c.ws.send(JSON.stringify({
            type: 'new-connection',
            id: event.id
          }));
        }
      });
    }

    if(event.type === 'get-same-connections') {
      const count = connections.filter(c => c.id === event.id).length;
      ws.send(JSON.stringify({
        type: 'same-connections',
        count
      }));
    }
    
    if (event.type.startsWith('public-')) {
      connections.forEach(c => {
        if (c.id !== event.id) {
          c.ws.send(data);
        }
      });
    }
  });

  ws.on('close', () => {
    const connection = connections.find(c => c.ws === ws);
    console.log(`Client disconnected with id: ${connection.id}`);
  });
});