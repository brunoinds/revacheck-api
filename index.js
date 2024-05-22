import express from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import mime from 'mime';
import {OneDriveBridge} from './src/drive/onedrive.js';
import 'dotenv/config';


const app = express();
const server = app.listen(3000, () => {
  console.log(`Server started on port ${server.address().port}`);
  console.log(`Enviroment variables: REVACHECK_ONEDRIVE_INTRA_SECRET: ${process.env.REVACHECK_ONEDRIVE_INTRA_SECRET}`);
});

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));


//Enable CORS from localhost and localhost:8100:
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:8100');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

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


app.get('/api/content-explorer/folders/:folderId', async (req, res) => {
  try {
    let responseFolder = (await OneDriveBridge.getItemsInFolder(req.params.folderId))
    
    responseFolder.files = responseFolder.files.filter((file) => file.original.file.mimeType.startsWith('application/pdf'));
    res.json(responseFolder);
  } catch (error) {
    res.status(500).json({ error: error.message }); 
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