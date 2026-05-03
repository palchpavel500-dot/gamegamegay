const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8787);
const ROOM_PREFIX = 'mageim-room-';
const ROOT_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const rooms = new Map();
const clients = new Map();

function createRoomId() {
    return `${ROOM_PREFIX}${Math.random().toString(36).slice(2, 8)}`;
}

function sendHttpFile(req, res) {
    const requestPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const unsafePath = decodeURIComponent(requestPath);
    const normalizedPath = path.normalize(unsafePath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
    const filePath = path.join(ROOT_DIR, normalizedPath);

    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (error, fileBuffer) => {
        if (error) {
            res.writeHead(error.code === 'ENOENT' ? 404 : 500);
            res.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        res.end(fileBuffer);
    });
}

function sendFrame(socket, payload, opcode = 0x1) {
    const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
    let header;

    if (payloadBuffer.length < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x80 | opcode;
        header[1] = payloadBuffer.length;
    } else if (payloadBuffer.length < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x80 | opcode;
        header[1] = 126;
        header.writeUInt16BE(payloadBuffer.length, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x80 | opcode;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(payloadBuffer.length), 2);
    }

    socket.write(Buffer.concat([header, payloadBuffer]));
}

function sendJson(socket, payload) {
    if (!socket.destroyed) sendFrame(socket, JSON.stringify(payload));
}

function detachClient(client) {
    if (!client) return;
    const { roomId, role, socket } = client;
    clients.delete(socket);

    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room[role] === client) room[role] = null;

    const otherRole = role === 'host' ? 'guest' : 'host';
    const otherClient = room[otherRole];
    if (otherClient) {
        sendJson(otherClient.socket, { type: 'peer_left' });
    }

    if (!room.host && !room.guest) rooms.delete(roomId);
}

function handleGameMessage(client, message) {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'create_room') {
        let roomId = createRoomId();
        while (rooms.has(roomId)) roomId = createRoomId();

        rooms.set(roomId, { host: client, guest: null });
        client.roomId = roomId;
        client.role = 'host';
        sendJson(client.socket, { type: 'room_created', roomId });
        return;
    }

    if (message.type === 'join_room') {
        const roomId = String(message.roomId || '').trim();
        const room = rooms.get(roomId);

        if (!room) {
            sendJson(client.socket, { type: 'error', message: 'Комната не найдена' });
            return;
        }
        if (room.guest) {
            sendJson(client.socket, { type: 'error', message: 'Комната уже занята' });
            return;
        }

        room.guest = client;
        client.roomId = roomId;
        client.role = 'guest';

        sendJson(client.socket, { type: 'joined_room', roomId });
        sendJson(room.host.socket, { type: 'peer_joined', roomId });
        return;
    }

    if (message.type === 'relay') {
        if (!client.roomId || !client.role) return;
        const room = rooms.get(client.roomId);
        if (!room) return;

        const target = client.role === 'host' ? room.guest : room.host;
        if (!target) return;

        const payloadSize = JSON.stringify(message.payload).length;
        console.log(`Relay from ${client.role} to ${target.role}, payload size: ${payloadSize} bytes, kind: ${message.payload?.kind}`);
        sendJson(target.socket, { type: 'relay', payload: message.payload });
    }
}

function consumeFrames(client, chunk) {
    client.buffer = Buffer.concat([client.buffer, chunk]);

    while (client.buffer.length >= 2) {
        const firstByte = client.buffer[0];
        const secondByte = client.buffer[1];
        const fin = (firstByte & 0x80) !== 0;
        const opcode = firstByte & 0x0f;
        const masked = (secondByte & 0x80) !== 0;
        let payloadLength = secondByte & 0x7f;
        let offset = 2;

        if (payloadLength === 126) {
            if (client.buffer.length < offset + 2) return;
            payloadLength = client.buffer.readUInt16BE(offset);
            offset += 2;
        } else if (payloadLength === 127) {
            if (client.buffer.length < offset + 8) return;
            payloadLength = Number(client.buffer.readBigUInt64BE(offset));
            offset += 8;
        }

        const maskLength = masked ? 4 : 0;
        const fullLength = offset + maskLength + payloadLength;
        if (client.buffer.length < fullLength) return;

        let payload = client.buffer.subarray(offset + maskLength, fullLength);
        if (masked) {
            const mask = client.buffer.subarray(offset, offset + 4);
            const decoded = Buffer.alloc(payload.length);
            for (let i = 0; i < payload.length; i++) decoded[i] = payload[i] ^ mask[i % 4];
            payload = decoded;
        }

        client.buffer = client.buffer.subarray(fullLength);

        if (opcode === 0x8) {
            try { client.socket.end(); } catch (e) {}
            return;
        }
        if (opcode === 0x9) {
            sendFrame(client.socket, payload, 0xA);
            continue;
        }

        // Обработка фрагментированных сообщений
        if (opcode === 0x1 || opcode === 0x2) {
            // Начало нового сообщения
            client.fragments = [payload];
            client.fragmentOpcode = opcode;
        } else if (opcode === 0x0) {
            // Продолжение фрагментированного сообщения
            if (!client.fragments) {
                console.error('Continuation frame without initial frame');
                continue;
            }
            client.fragments.push(payload);
        } else {
            continue;
        }

        // Если это последний фрагмент (FIN=1), собираем сообщение
        if (fin) {
            const completePayload = Buffer.concat(client.fragments);
            client.fragments = null;

            if (client.fragmentOpcode === 0x1) {
                // Текстовое сообщение
                try {
                    handleGameMessage(client, JSON.parse(completePayload.toString('utf8')));
                } catch (error) {
                    console.error('Parse error:', error.message, 'Payload length:', completePayload.length);
                    sendJson(client.socket, { type: 'error', message: 'Некорректное сообщение клиента' });
                }
            }
        }
    }
}

const server = http.createServer((req, res) => {
    sendHttpFile(req, res);
});

server.on('upgrade', (req, socket) => {
    if (req.url !== '/ws') {
        socket.destroy();
        return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key) {
        socket.destroy();
        return;
    }

    const acceptKey = crypto
        .createHash('sha1')
        .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest('base64');

    socket.write([
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '\r\n'
    ].join('\r\n'));

    const client = {
        socket,
        buffer: Buffer.alloc(0),
        roomId: null,
        role: null
    };
    clients.set(socket, client);

    socket.on('data', chunk => consumeFrames(client, chunk));
    socket.on('close', () => detachClient(client));
    socket.on('end', () => detachClient(client));
    socket.on('error', () => detachClient(client));
});

server.listen(PORT, HOST, () => {
    console.log(`Mageim server running on http://localhost:${PORT}`);
});
