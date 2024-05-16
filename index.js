import express from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import mime from 'mime';

const app = express();
const server = app.listen(3000, () => {
  console.log(`Server started on port ${server.address().port}`);
});

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));



app.get('/app/:any*', (req, res) => {
  const file = req.params.any + (req.params[0] || '');
  const internalPaths = file.split('/');

  if (internalPaths.length > 1 && internalPaths[0] === 'assets') {
    const filePath = path.join(__dirname, 'public', file);
    const mimeType = mime.getType(filePath);

    if (!fs.existsSync(filePath)) {
      res.status(404).send('File not found!');
      return;
    }

    res.setHeader('Content-Type', mimeType);
    res.sendFile(filePath);
  } else {
    const filePath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(filePath);
  }
});



const wss = new WebSocketServer({ server });

const connections = [];


wss.on('connection', (ws) => {

  connections.push({
    id: null,
    ws: ws
  });


  ws.on('message', (data) => {
    const event = JSON.parse(data);

    if(event.type === 'register') {
      connections.find(c => c.ws === ws).id = event.id;

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
  });
});