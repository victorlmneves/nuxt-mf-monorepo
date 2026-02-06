#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');

function usage() {
    console.log('Usage: node scripts/generate-sri.js <path-to-file>');

    process.exit(1);
}

const file = process.argv[2];

if (!file) {
    usage();
}

try {
    const data = fs.readFileSync(file);
    const hash = crypto.createHash('sha256').update(data).digest('base64');

    console.log(`sha256-${hash}`);
} catch (error) {
    console.error('Error reading file:', error && error.message ? error.message : error);

    process.exit(2);
}
