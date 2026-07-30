'use strict';

const fs = require('fs');
const path = require('path');

const COLORS = ['#dbeafe', '#dcfce7', '#fef9c3', '#ffedd5', '#f3e8ff', '#fce7f3'];

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function writeSvg(run, outputFile) {
    const scale = 0.25;
    const gap = 30;
    const margin = 20;
    const boardW = run.caseData.board.height * scale;
    const boardH = run.caseData.board.width * scale;
    const columns = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(run.result.bins.length))));
    const rows = Math.ceil(run.result.bins.length / columns);
    const width = margin * 2 + columns * boardW + Math.max(0, columns - 1) * gap;
    const height = margin * 2 + rows * boardH + Math.max(0, rows - 1) * gap;
    const labels = run.items.map(item => item.id);
    const body = [];

    run.result.bins.forEach((bin, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const ox = margin + col * (boardW + gap);
        const oy = margin + row * (boardH + gap);
        body.push(`<rect x="${ox}" y="${oy}" width="${boardW}" height="${boardH}" fill="white" stroke="#111827"/>`);
        (bin.placed ?? []).forEach(part => {
            const label = labels[part.originalId] ?? '?';
            const color = COLORS[(part.originalId ?? 0) % COLORS.length];
            const x = ox + part.x * scale;
            const y = oy + part.y * scale;
            const w = part.width * scale;
            const h = part.height * scale;
            body.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" stroke="#334155"/>`);
            body.push(`<text x="${x + 3}" y="${y + 13}" font-size="11" fill="#0f172a">${escapeXml(label)}</text>`);
        });
    });

    const svg = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        `<rect width="100%" height="100%" fill="#f8fafc"/>`,
        ...body,
        `</svg>`,
        ''
    ].join('\n');
    const resolved = path.resolve(outputFile);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, svg);
    return resolved;
}

module.exports = { writeSvg };
