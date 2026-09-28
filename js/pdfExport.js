(function (root) {
    'use strict';
    const MAX_PDF_BYTES = 10_000_000;
    const PROFILES = [
        { id: 'png-fast', mimeType: 'image/png', quality: undefined, imageFormat: 'PNG', imageCompression: 'FAST', compress: true },
        { id: 'png-medium', mimeType: 'image/png', quality: undefined, imageFormat: 'PNG', imageCompression: 'MEDIUM', compress: true },
        { id: 'png-slow', mimeType: 'image/png', quality: undefined, imageFormat: 'PNG', imageCompression: 'SLOW', compress: true },
        { id: 'jpeg-92', mimeType: 'image/jpeg', quality: 0.92, imageFormat: 'JPEG', imageCompression: undefined, compress: true },
        { id: 'jpeg-85', mimeType: 'image/jpeg', quality: 0.85, imageFormat: 'JPEG', imageCompression: undefined, compress: true }
    ];
    function sizeError(bytes, attempts) {
        const error = new Error('PDF를 10MB 이하로 만들지 못했습니다. 도면 품질을 유지하기 위해 저장을 중단했습니다.');
        error.code = 'PDF_SIZE_LIMIT'; error.smallestBytes = bytes; error.attempts = attempts;
        return error;
    }
    function assertWithinLimit(blob, maxBytes = MAX_PDF_BYTES) {
        if (!blob || !Number.isFinite(blob.size)) throw new TypeError('PDF Blob 크기를 확인할 수 없습니다.');
        if (blob.size > maxBytes) throw sizeError(blob.size, 1);
        return blob;
    }
    async function buildWithinLimit({ buildDocument, maxBytes = MAX_PDF_BYTES }) {
        if (typeof buildDocument !== 'function') throw new TypeError('buildDocument 함수가 필요합니다.');
        let smallestBytes = Infinity;
        for (let i = 0; i < PROFILES.length; i++) {
            const profile = { ...PROFILES[i] };
            const doc = await buildDocument(profile);
            const blob = doc.output('blob');
            if (!blob || !Number.isFinite(blob.size)) throw new TypeError('PDF Blob 크기를 확인할 수 없습니다.');
            smallestBytes = Math.min(smallestBytes, blob.size);
            if (blob.size <= maxBytes) return { blob, profileId: profile.id, attempts: i + 1 };
        }
        throw sizeError(smallestBytes, PROFILES.length);
    }
    function downloadBlob({ blob, filename, document, URL, schedule = root.setTimeout }) {
        assertWithinLimit(blob);
        if (!document || !URL) throw new TypeError('다운로드 환경이 필요합니다.');
        const url = URL.createObjectURL(blob);
        try {
            const anchor = document.createElement('a');
            anchor.href = url; anchor.download = filename; anchor.click();
        } finally { schedule(() => URL.revokeObjectURL(url), 1000); }
    }
    const api = { MAX_PDF_BYTES, PROFILES, buildWithinLimit, assertWithinLimit, downloadBlob };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PdfExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
