#!/usr/bin/env node
// Dev remote server: serves a static directory, exposes SRI hashes and a WS for hot reload notifications

const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const chokidar = require('chokidar');
const WebSocket = require('ws');

function usage() {
    console.log('Usage: dev-remote-server.js --dir <path-to-public> --port <port> [--watch]');

    process.exit(1);
}

const argv = require('minimist')(process.argv.slice(2));

if (!argv.dir || !argv.port) {
    usage();
}

const DIR = path.resolve(process.cwd(), argv.dir);
const PORT = parseInt(argv.port, 10) || 3001;
const ENABLE_WATCH = argv.watch !== undefined ? !!argv.watch : true;

if (!fs.existsSync(DIR)) {
    console.error('Directory not found:', DIR);

    process.exit(2);
}

function computeSRI(filePath) {
    const data = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha384').update(data).digest('base64');

    return `sha384-${hash}`;
}

function buildSRIMap(dir) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
    const map = {};

    files.forEach((f) => {
        try {
            map['/' + f] = computeSRI(path.join(dir, f));
        } catch (error) {
            console.error(`Failed to compute SRI for ${f}:`, error);
        }
    });

    return map;
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/__remote_ws' });

// serve static files
app.use(express.static(DIR, { index: false }));

// expose SRI map
app.get('/sri.json', (req, res) => {
    try {
        const map = buildSRIMap(DIR);
        res.json(map);
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// simple health
app.get('/health', (req, res) => res.json({ ok: true, dir: DIR }));

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'welcome', msg: 'dev-remote-server' }));
});

// Listen on all interfaces (IPv4 & IPv6) to avoid localhost address-family
// routing differences where another process (Nuxt dev) may bind only to IPv6
// and shadow requests to `localhost`.
server.listen(PORT, '::', () => {
    console.log(`dev-remote-server serving ${DIR} on http://localhost:${PORT}`);
    console.log(`SRI manifest available at http://localhost:${PORT}/sri.json`);
    console.log(`WS reload endpoint ws://localhost:${PORT}/__remote_ws`);
});

if (ENABLE_WATCH) {
    const watcher = chokidar.watch(DIR, { ignoreInitial: true });
    watcher.on('all', (event, pathChanged) => {
        console.log('file', event, pathChanged);

        // rebuild SRI map and notify clients
        const map = buildSRIMap(DIR);
        const payload = JSON.stringify({ type: 'change', event, path: pathChanged, sri: map });

        wss.clients.forEach((c) => {
            if (c.readyState === WebSocket.OPEN) c.send(payload);
        });
    });
}
