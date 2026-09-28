/* Optional comparison view. Uses existing state notifications; never writes to state. */
(function (root) {
    'use strict';

    function createSnapshot(state) {
        if (!state?.result?.bins?.length || !state.costInfo) return null;
        const { boardSpec: spec, settings, cuttingList } = state;
        // Respect each version's own trimming rules; never recalculate usable dimensions.
        const firstBin = state.result.bins[0];
        if (!(Number.isFinite(firstBin.width) && firstBin.width > 0 &&
            Number.isFinite(firstBin.height) && firstBin.height > 0)) return null;
        const items = cuttingList.map(part => ({
            id: part.id, qty: part.qty,
            width: spec.considerGrain ? Math.max(part.width, part.height)
                : (!part.allowRotate ? part.height : part.width),
            height: spec.considerGrain ? Math.min(part.width, part.height)
                : (!part.allowRotate ? part.width : part.height),
            allowRotate: !!part.allowRotate && !spec.considerGrain
        }));
        return structuredClone({ input: {
            board: { width: firstBin.width, height: firstBin.height },
            kerf: settings.kerf, items, baseline: state.result
        }, spec, settings, cost: state.costInfo, parts: cuttingList });
    }

    function initialize() {
        const state = root.appState;
        const get = id => document.getElementById(id);
        const dialog = get('repeatedLayoutDialog');
        const button = get('compareLayoutBtn');
        if (!state || !dialog || !button || !root.RepeatedLayout) return;
        const edition = dialog.dataset.version || 'Test';
        const enabled = get('repeatedLayoutEnabled');
        const pdfButton = get('downloadComparisonPdf');
        const status = get('repeatedLayoutStatus');
        let snapshot = null, candidate = null, generation = 0, pdfBusy = false;
        let baselineCanvases = [], candidateCanvases = [];
        const colors = ['#c9e2f4', '#cce8d9', '#f4dfac', '#f5cdbd', '#ddd0ef', '#f2ccdf', '#d1e3df'];

        // Listener failures must not propagate into the existing calculation.
        const safe = fn => (...args) => {
            try {
                const result = fn(...args);
                if (result && typeof result.then === 'function') result.catch(error => {
                    console.error('반복 배치 비교:', error);
                    status.textContent = error.code === 'PDF_SIZE_LIMIT' ? error.message
                        : fn.name === 'downloadPdf' ? '비교 PDF 생성 중 오류가 발생했습니다. 다시 시도하세요.'
                        : '비교 화면을 만들지 못했습니다. 기존 계산 결과는 유지됩니다.';
                });
            } catch (error) {
                console.error('반복 배치 비교:', error);
                status.textContent = '비교 화면을 만들지 못했습니다. 기존 계산 결과는 유지됩니다.';
                pdfButton.disabled = true;
            }
        };
        function invalidate() {
            generation++;
            snapshot = null; candidate = null; button.disabled = true; pdfButton.disabled = true;
            baselineCanvases = []; candidateCanvases = [];
            get('repeatedLayoutBaseline').replaceChildren();
            get('repeatedLayoutCandidate').replaceChildren();
            get('repeatedLayoutSummary').textContent = '';
            get('repeatedLayoutLegend').textContent = '';
            status.textContent = '입력이 변경되었습니다. 최적화 계산을 다시 실행하세요.';
        }
        ['cuttingList', 'boardSpec', 'settings', 'result'].forEach(key => state.subscribe(key, safe(invalidate)));
        state.subscribe('costInfo', safe(() => {
            snapshot = createSnapshot(state);
            button.disabled = !snapshot;
            if (snapshot && dialog.open) render();
        }));
        // Uncommitted form edits must also invalidate the previous snapshot.
        document.addEventListener('input', safe(event => {
            if (!dialog.contains(event.target) && event.target.matches('input, select')) invalidate();
        }));
        document.addEventListener('change', safe(event => {
            if (!dialog.contains(event.target) && event.target.matches('input, select')) invalidate();
        }));

        function drawBin(bin, heading) {
            const canvas = document.createElement('canvas');
            canvas.width = 1400; canvas.height = 860;
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', `${heading}, 부품 ${bin.placed.length}개`);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1400, 860);
            ctx.fillStyle = '#19382e'; ctx.font = '30px sans-serif'; ctx.fillText(heading, 45, 48);
            ctx.font = '23px sans-serif';
            ctx.fillText(`가로 ${bin.width} × 세로 ${Math.round(bin.height * 10) / 10} mm · 유효 판재`, 45, 88);
            const scale = Math.min(1300 / bin.width, 660 / bin.height);
            const ox = 50, oy = 125;
            ctx.fillStyle = '#e7dcc8'; ctx.fillRect(ox, oy, bin.width * scale, bin.height * scale);
            for (const part of bin.placed) {
                let index = Number(part.originalId);
                if (!Number.isInteger(index) || !snapshot.input.items[index]) index = 0;
                const label = String(snapshot.input.items[index]?.id ?? index + 1);
                const x = ox + part.x * scale, y = oy + part.y * scale;
                const w = part.width * scale, h = part.height * scale;
                ctx.fillStyle = colors[index % colors.length]; ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = '#4a6260'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
                ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2, Math.max(0, w - 4), Math.max(0, h - 4)); ctx.clip();
                ctx.fillStyle = '#203c3a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const text = `${label} ${part.width}×${part.height}`;
                if (h < 65 || w < 95) {
                    ctx.font = '19px sans-serif'; ctx.fillText(text, x + w / 2, y + h / 2, Math.max(1, w - 8));
                } else {
                    ctx.font = '28px sans-serif'; ctx.fillText(label, x + w / 2, y + h / 2 - 15);
                    ctx.font = '21px sans-serif'; ctx.fillText(`${part.width} × ${part.height}`, x + w / 2, y + h / 2 + 20, w - 8);
                }
                ctx.restore();
            }
            ctx.strokeStyle = '#29463c'; ctx.lineWidth = 2;
            ctx.strokeRect(ox, oy, bin.width * scale, bin.height * scale);
            ctx.fillStyle = '#526b60'; ctx.font = '22px sans-serif';
            ctx.fillText('베이지색: 잔재  |  부품 안 치수: 배치된 가로 × 세로 (mm)', 45, 835);
            return canvas;
        }

        function render() {
            if (!snapshot) return invalidate();
            const compared = root.RepeatedLayout.compareLayouts(snapshot.input, { enabled: enabled.checked });
            candidate = compared.candidate;
            const before = get('repeatedLayoutBaseline'), after = get('repeatedLayoutCandidate');
            before.replaceChildren(); after.replaceChildren();
            baselineCanvases = compared.baseline.bins.map((bin, i) => drawBin(bin, `기존 배치 · 판재 ${i + 1}`));
            candidateCanvases = candidate ? candidate.bins.map((bin, i) => drawBin(bin, `반복 후보 · 판재 ${i + 1}`)) : [];
            const appendDiagrams = (parent, canvases) => canvases.forEach(canvas => {
                const wrapper = document.createElement('div');
                wrapper.className = 'rlc-diagram';
                wrapper.tabIndex = 0;
                wrapper.setAttribute('aria-label', '배치 도면, 작은 화면에서 좌우로 스크롤');
                wrapper.append(canvas); parent.append(wrapper);
            });
            appendDiagrams(before, baselineCanvases); appendDiagrams(after, candidateCanvases);
            if (!candidate) {
                const note = document.createElement('p');
                note.textContent = enabled.checked ? '조건에 맞는 완전 반복 후보가 없습니다. 기존 배치를 유지합니다.' : '후보 보기가 꺼져 있습니다.';
                after.append(note);
            }
            get('repeatedLayoutSummary').textContent = `기존 ${compared.baseline.bins.length}장 · 표시 ${snapshot.cost.totalCuts}회 · 재단비 ${snapshot.cost.totalCuttingCost.toLocaleString()}원`;
            status.textContent = candidate
                ? `후보 ${candidate.bins.length}장 · 개별 절단 순서 ${candidate.bins.reduce((n, b) => n + b.cuttingCount, 0)}회. 묶음 절단 횟수와 요금은 산정하지 않았습니다.`
                : '기존 배치·요금은 변경되지 않습니다.';
            get('repeatedLayoutLegend').textContent = snapshot.parts.map(p => `${p.id} ${p.width}×${p.height}mm ${p.qty}개`).join('  /  ');
            pdfButton.disabled = pdfBusy;
        }

        async function downloadPdf() {
            if (!snapshot || pdfBusy) return;
            if (!root.jspdf?.jsPDF || !root.PdfExport) throw new Error('PDF 라이브러리를 불러오지 못했습니다.');
            pdfBusy = true; pdfButton.disabled = true;
            const token = generation, lockedSnapshot = snapshot, lockedCandidate = candidate;
            const summaryText = get('repeatedLayoutSummary').textContent, candidateEnabled = enabled.checked;
            const copyCanvases = canvases => canvases.map(source => {
                const copy = document.createElement('canvas'); copy.width = source.width; copy.height = source.height;
                copy.getContext('2d').drawImage(source, 0, 0); return copy;
            });
            const baseline = copyCanvases(baselineCanvases), candidates = copyCanvases(candidateCanvases);
            const pages = Math.max(baseline.length, candidates.length);
            try {
              const result = await root.PdfExport.buildWithinLimit({ buildDocument: async profile => {
                const doc = new root.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: profile.compress });
                for (let i = 0; i < pages; i++) {
                const page = document.createElement('canvas'); page.width = 1654; page.height = 2339;
                const ctx = page.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1654, 2339);
                ctx.fillStyle = '#19382e'; ctx.font = 'bold 43px sans-serif'; ctx.fillText(`재단 배치 비교 · ${edition} / 검토용`, 80, 95);
                ctx.font = '27px sans-serif'; ctx.fillText(summaryText, 80, 152);
                const s = lockedSnapshot;
                ctx.fillText(`원판 ${s.spec.width}×${s.spec.height} mm · 톱날 ${s.input.kerf} mm · 결 ${s.spec.considerGrain ? 'ON' : 'OFF'} · 전단 ${s.settings.enableTrim ? 'ON' : 'OFF'}`, 80, 202);
                const draw = (canvas, y, message) => {
                    if (canvas) ctx.drawImage(canvas, 80, y, 1494, 918);
                    else { ctx.font = '29px sans-serif'; ctx.fillText(message, 100, y + 80); }
                };
                draw(baseline[i], 245, '해당 번호의 기존 판재 없음');
                draw(candidates[i], 1190, candidateEnabled ? '조건에 맞는 반복 후보가 없습니다.' : '반복 후보 보기 OFF');
                ctx.font = '25px sans-serif';
                ctx.fillText('후보는 비교용이며 기존 계산·저장·청구 결과에 적용되지 않습니다.', 80, 2180);
                ctx.fillText(lockedCandidate ? `후보 개별 절단 ${lockedCandidate.bins.reduce((n, b) => n + b.cuttingCount, 0)}회 · 묶음 절단과 요금 미산정` : '기존 결과 유지', 80, 2225);
                ctx.fillText(`${i + 1} / ${pages}`, 1490, 2290);
                if (i) doc.addPage();
                doc.addImage(page.toDataURL(profile.mimeType, profile.quality), profile.imageFormat, 0, 0, 210, 297, undefined, profile.imageCompression);
                }
                return doc;
              }});
              if (generation !== token) return;
              root.PdfExport.downloadBlob({ blob: result.blob, filename: `재단_반복배치_비교_${edition}.pdf`, document, URL: root.URL });
            } finally {
              pdfBusy = false;
              if (generation === token && snapshot) pdfButton.disabled = false;
            }
        }
        button.addEventListener('click', safe(() => { if (snapshot) { render(); dialog.showModal(); } }));
        get('closeRepeatedLayout').addEventListener('click', () => dialog.close());
        enabled.addEventListener('change', safe(render));
        pdfButton.addEventListener('click', safe(downloadPdf));
    }

    const api = { createSnapshot };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else { root.RepeatedLayoutUI = api; document.addEventListener('DOMContentLoaded', initialize); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
