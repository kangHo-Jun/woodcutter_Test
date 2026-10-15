/** Opt-in X-strip planner. Dimensions and rotation permissions are already UI-normalized. */
(function (root) {
    'use strict';
    const EPS = 1e-6;
    const fits = (available, used, kerf) => Math.abs(available - used) <= EPS || available - used >= kerf - EPS;

    function pack({ board, kerf, items }, options = {}) {
        if (!board || ![board.width, board.height].every(v => Number.isFinite(v) && v > 0) ||
            !Number.isFinite(kerf) || kerf < 0 || !Array.isArray(items) ||
            items.some(i => !i || ![i.width,i.height].every(v => Number.isFinite(v) && v > 0) ||
                !Number.isSafeInteger(i.qty) || i.qty <= 0)) throw new Error('세로 절단 입력값을 확인하세요.');
        if (items.reduce((n,i) => n+i.qty,0) > 10000 || items.length > 256)
            throw new Error('세로 절단은 한 번에 10,000개·256종까지 입력할 수 있습니다.');
        const maxOperations = Math.min(200000, Math.max(1, options.maxOperations || 200000));
        const started = Date.now();
        let operations = 0;
        function spend() {
            if (++operations > maxOperations || (operations % 64 === 0 && Date.now()-started > 1000)) {
                const error = new Error('세로 절단 탐색 한도를 초과했습니다. 수량을 나누거나 가로 절단 우선을 선택하세요.');
                error.code = 'VERTICAL_SEARCH_LIMIT';
                throw error;
            }
        }
        const groups = items.map((item, index) => ({ ...item, index }));
        const variants = groups.flatMap(item => {
            const normal = { index: item.index, width: item.width, height: item.height, rotated: false };
            return item.allowRotate === true && item.width !== item.height
                ? [normal, { ...normal, width: item.height, height: item.width, rotated: true }] : [normal];
        });
        const widths = [...new Set(variants.map(v => v.width))].sort((a,b) => a-b);
        let remaining = groups.map(g => g.qty);
        const bins = [];

        function columnOptions(counts, width) {
            const candidates = variants.filter(v => v.width === width && counts[v.index] > 0);
            const options = [];
            for (const order of [1, -1]) {
                const rest = counts.slice(), parts = [];
                let y = 0;
                for (const v of [...candidates].sort((a,b) => order * (a.height - b.height) || a.index-b.index)) {
                    while (rest[v.index] > 0 && fits(board.height-y, v.height, kerf)) {
                        spend();
                        parts.push({ ...v, y });
                        rest[v.index]--;
                        y += v.height + kerf;
                    }
                }
                if (parts.length) options.push({ rest, parts, width });
            }
            return options;
        }
        const rank = (a,b) => b.area-a.area || a.x-b.x;
        while (remaining.some(q => q > 0)) {
            let frontier = [{ counts: remaining, columns: [], x: 0, area: 0 }];
            let best = frontier[0];
            while (frontier.length) {
                const next = new Map();
                for (const state of frontier) {
                    for (const width of widths) {
                        spend();
                        if (!fits(board.width-state.x, width, kerf)) continue;
                        for (const column of columnOptions(state.counts, width)) {
                            const candidate = {
                                counts: column.rest,
                                columns: [...state.columns, { ...column, x: state.x }],
                                x: Math.min(board.width, state.x+width+kerf),
                                area: state.area + column.parts.reduce((n,p) => n+p.width*p.height, 0)
                            };
                            if (rank(candidate, best) < 0) best = candidate;
                            const key = candidate.counts.join(',') + ':' + candidate.x.toFixed(6);
                            if (!next.has(key)) next.set(key, candidate);
                        }
                    }
                }
                frontier = [...next.values()].sort(rank).slice(0, 64);
                if (best.counts.every(q => q === 0)) break;
            }
            if (!best.columns.length) break;
            const placed = [], freeRects = [], cutDetails = [];
            function cut(axis, pos, sourceRect) {
                const spanStart = axis === 'X' ? sourceRect.y : sourceRect.x;
                const length = axis === 'X' ? sourceRect.height : sourceRect.width;
                cutDetails.push({ axis, pos, spanStart, spanEnd: spanStart+length, length,
                    fullSpan: axis === 'X', sourceRect: { ...sourceRect } });
            }
            for (const column of best.columns) {
                const { x, width } = column;
                if (board.width-x-width > EPS) cut('X', x+width,
                    { x, y: 0, width: board.width-x, height: board.height });
                let bottom = 0;
                for (const part of column.parts) {
                    const item = groups[part.index];
                    placed.push({ id: `${part.index}-${item.qty-remaining[part.index]}`,
                        originalId: part.index, originalWidth: item.width, originalHeight: item.height,
                        width: part.width, height: part.height, x, y: part.y,
                        rotated: part.rotated, allowRotate: item.allowRotate === true });
                    remaining[part.index]--;
                    bottom = part.y+part.height;
                    if (board.height-bottom > EPS) cut('Y', bottom,
                        { x, y: part.y, width, height: board.height-part.y });
                    bottom = Math.min(board.height, bottom+kerf);
                }
                if (board.height-bottom > EPS) freeRects.push({ x, y: bottom, width, height: board.height-bottom });
            }
            if (board.width-best.x > EPS) freeRects.push({ x: best.x, y: 0, width: board.width-best.x, height: board.height });
            const totalArea = board.width*board.height;
            bins.push({ width: board.width, height: board.height, placed, freeRects, cutDetails,
                cuttingCount: cutDetails.length, usedArea: best.area, totalArea,
                efficiency: best.area/totalArea*100, firstCutDirection: 'V' });
        }
        const unplaced = groups.flatMap((item,index) => Array.from({ length: remaining[index] }, (_,i) => ({
            ...item, id: `${index}-${item.qty-remaining[index]+i}`, originalId: index,
            originalWidth: item.width, originalHeight: item.height
        })));
        return { bins, unplaced, mode: 'vertical', engine: 'VERTICAL_STRIPS',
            totalEfficiency: bins.length ? bins.reduce((n,b) => n+b.usedArea,0)/(bins.length*board.width*board.height)*100 : 0 };
    }
    const api = Object.freeze({ pack });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.VerticalStripPacker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
