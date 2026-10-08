/* Presentation only: never changes packing, cuts, prices or result objects. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.ResidualLabels = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    const EPS = 1e-7;
    const validRect = r => r && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(r[k]))
        && r.width > EPS && r.height > EPS;
    const copyRect = r => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    function formatMm(value) {
        if (!Number.isFinite(value) || value < 0) return '';
        const nearest = Math.round(value);
        return String(Math.abs(value - nearest) < EPS ? nearest : Math.floor(value));
    }
    const sameRect = (a, b) => ['x', 'y', 'width', 'height'].every(k => Math.abs(a[k] - b[k]) < EPS);
    const contains = (a, b) => b.x >= a.x - EPS && b.y >= a.y - EPS
        && b.x + b.width <= a.x + a.width + EPS && b.y + b.height <= a.y + a.height + EPS;
    const overlaps = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > EPS
        && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > EPS;

    // Reconstruct display-only remainder regions. Recorded cuts take precedence;
    // known engine remnants are protected from further subdivision. Missing final
    // trims are inferred only at fixed part edges, never by moving a part.
    function recover(bin, board, kerf) {
        const rectangles = [], unresolved = [];
        const bounds = { x: 0, y: 0, width: board.width, height: board.height };
        const parts = bin.placed || [];
        const known = (bin.freeRects || []).filter(validRect).map(copyRect);
        if (!validRect(bounds) || !Number.isFinite(kerf) || kerf < 0 ||
            parts.some(p => !validRect(p) || !contains(bounds, p)) ||
            known.some(r => !contains(bounds, r) || parts.some(p => overlaps(r, p)))) {
            return { rectangles: [], unresolved: [{ reason: 'invalid geometry' }] };
        }
        const cuts = (bin.cutDetails || []).filter(c => ['X', 'Y'].includes(c.axis)
            && [c.pos, c.spanStart, c.spanEnd].every(Number.isFinite));
        const pending = [bounds];
        let visits = 0;
        while (pending.length) {
            const rect = pending.pop();
            // Finite work even for malformed legacy output.
            if (++visits > 10000) { unresolved.push({ reason: 'partition limit', region: rect }); break; }
            const inside = parts.filter(p => overlaps(rect, p));
            const remnants = known.filter(r => overlaps(rect, r));
            if (inside.some(p => !contains(rect, p)) || remnants.some(r => !contains(rect, r))) {
                unresolved.push({ reason: 'crossed existing region', region: rect }); continue;
            }
            if (inside.length === 1 && sameRect(rect, inside[0])) continue;
            if (remnants.length === 1 && sameRect(rect, remnants[0])) { rectangles.push(copyRect(rect)); continue; }
            const objects = [...inside, ...remnants];
            const feasible = (axis, pos) => {
                const coordinate = axis === 'X' ? 'x' : 'y';
                const size = axis === 'X' ? 'width' : 'height';
                if (pos <= rect[coordinate] + EPS || pos >= rect[coordinate] + rect[size] - EPS) return false;
                return objects.every(o => o[coordinate] + o[size] <= pos + EPS || o[coordinate] >= pos + kerf - EPS);
            };
            let split = cuts.find(c => {
                const span = c.axis === 'X' ? 'y' : 'x';
                const size = c.axis === 'X' ? 'height' : 'width';
                return c.spanStart <= rect[span] + EPS && c.spanEnd >= rect[span] + rect[size] - EPS
                    && feasible(c.axis, c.pos);
            });
            if (!split && !inside.length && !remnants.length) { rectangles.push(copyRect(rect)); continue; }
            if (!split) {
                // Preserve engine-defined leftovers before inferring finishing cuts.
                for (const o of [...remnants, ...inside]) {
                    const candidates = [
                        { axis: 'X', pos: o.x - kerf }, { axis: 'Y', pos: o.y - kerf },
                        { axis: 'X', pos: o.x + o.width }, { axis: 'Y', pos: o.y + o.height }
                    ];
                    split = candidates.find(c => feasible(c.axis, c.pos));
                    if (split) break;
                }
            }
            if (!split) { unresolved.push({ reason: 'no separating cut', region: rect }); continue; }
            const coordinate = split.axis === 'X' ? 'x' : 'y';
            const size = split.axis === 'X' ? 'width' : 'height';
            const before = split.pos - rect[coordinate];
            const after = rect[size] - before - kerf;
            pending.push({ ...rect, [size]: before });
            if (after > EPS) pending.push({ ...rect, [coordinate]: split.pos + kerf, [size]: after });
        }
        return { rectangles, unresolved };
    }
    function build({ bin, board, kerf }) {
        const { rectangles, unresolved } = recover(bin, board, kerf);
        const groups = new Map();
        for (const rect of rectangles) {
            if (rect.width * rect.height < 20000 - EPS) continue;
            // Group real dimensions, not truncated display numbers.
            const key = [rect.width, rect.height].map(v => Math.round(v * 1e6)).join(':');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(rect);
        }
        const labels = [...groups.values()].map(regions => ({
            rect: regions[Math.floor(regions.length / 2)], regions,
            text: `${formatMm(regions[0].width)} × ${formatMm(regions[0].height)}`
                + (regions.length > 1 ? ` · ${regions.length}개` : '')
        }));
        return { rectangles, labels, unresolved };
    }
    function draw(ctx, result, { scale, padding }) {
        const boxes = [], issues = [];
        for (const label of result.labels) {
            const r = label.rect;
            const width = r.width * scale, height = r.height * scale;
            const vertical = width < height && width < 100;
            const fontSize = Math.min(11, (vertical ? width : height) - 2);
            if (fontSize <= 0) { issues.push({ reason: 'label too narrow', text: label.text }); continue; }
            ctx.save();
            ctx.font = `600 ${fontSize}px "Noto Sans KR", sans-serif`;
            const available = Math.max(1, (vertical ? height : width) - 6);
            const length = Math.min(ctx.measureText(label.text).width, available);
            const x = padding + (r.x + r.width / 2) * scale;
            const y = padding + (r.y + r.height / 2) * scale;
            const box = { x: x - (vertical ? fontSize : length) / 2,
                y: y - (vertical ? length : fontSize) / 2,
                width: vertical ? fontSize : length, height: vertical ? length : fontSize };
            if (boxes.some(b => overlaps(b, box))) {
                issues.push({ reason: 'overlapping label', text: label.text }); ctx.restore(); continue;
            }
            ctx.translate(x, y);
            if (vertical) ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = '#6a4b2a';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(label.text, 0, 0, available);
            ctx.restore(); boxes.push(box);
        }
        return { boxes, issues };
    }
    return { build, formatMm, draw };
});
