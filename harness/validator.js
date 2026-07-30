'use strict';

const EPSILON = 1e-6;

function issue(type, message, details = {}) {
    return { type, message, ...details };
}

function validateGeometry(run) {
    const errors = [];
    const expected = new Map();
    run.items.forEach((item, index) => {
        expected.set(index, {
            qty: item.qty,
            width: item.width,
            height: item.height,
            allowRotate: item.allowRotate !== false
        });
    });
    const counts = new Map();
    const resolveExpected = part => {
        const direct = expected.get(part.originalId);
        const sourceWidth = part.originalWidth ?? part.width;
        const sourceHeight = part.originalHeight ?? part.height;
        const matches = ref =>
            Math.abs(sourceWidth - ref.width) <= EPSILON &&
            Math.abs(sourceHeight - ref.height) <= EPSILON;
        if (direct && matches(direct)) return { id: part.originalId, ref: direct };
        const candidates = [...expected.entries()].filter(([, ref]) => matches(ref));
        return candidates.length === 1
            ? { id: candidates[0][0], ref: candidates[0][1] }
            : null;
    };

    run.result.bins.forEach((bin, binIndex) => {
        (bin.placed ?? []).forEach((part, partIndex) => {
            const resolved = resolveExpected(part);
            const ref = resolved?.ref;
            if (resolved) {
                counts.set(resolved.id, (counts.get(resolved.id) ?? 0) + 1);
            }
            if (![part.x, part.y, part.width, part.height].every(Number.isFinite)) {
                errors.push(issue('nonFinite', '부품 좌표/치수가 유한수가 아닙니다.', { binIndex, partIndex, part }));
                return;
            }
            if (part.x < -EPSILON || part.y < -EPSILON ||
                part.x + part.width > bin.width + EPSILON ||
                part.y + part.height > bin.height + EPSILON) {
                errors.push(issue('outOfBounds', '부품이 판재 경계를 벗어났습니다.', { binIndex, partIndex, part }));
            }
            if (!ref) {
                errors.push(issue('unknownPart', '원본 치수/originalId에 대응하는 입력 부품이 없습니다.', {
                    binIndex, partIndex, originalId: part.originalId, part
                }));
            } else {
                const normal = Math.abs(part.width - ref.width) <= EPSILON &&
                    Math.abs(part.height - ref.height) <= EPSILON;
                const rotated = ref.allowRotate &&
                    Math.abs(part.width - ref.height) <= EPSILON &&
                    Math.abs(part.height - ref.width) <= EPSILON;
                if (!normal && !rotated) {
                    errors.push(issue('dimensionMismatch', '배치 치수가 원본 또는 허용 회전 치수와 다릅니다.', {
                        binIndex, partIndex, part, expected: ref
                    }));
                }
            }
        });

        const placed = bin.placed ?? [];
        for (let i = 0; i < placed.length; i++) {
            for (let j = i + 1; j < placed.length; j++) {
                const a = placed[i];
                const b = placed[j];
                const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
                const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
                if (overlapX > EPSILON && overlapY > EPSILON) {
                    errors.push(issue('overlap', '부품끼리 겹칩니다.', {
                        binIndex, firstPartIndex: i, secondPartIndex: j, first: a, second: b
                    }));
                }
            }
        }
    });

    expected.forEach((ref, id) => {
        const actual = counts.get(id) ?? 0;
        if (actual !== ref.qty) {
            errors.push(issue('quantityMismatch', '입력 수량과 배치 수량이 다릅니다.', {
                originalId: id, expected: ref.qty, actual
            }));
        }
    });
    if ((run.result.unplaced ?? []).length > 0) {
        errors.push(issue('unplaced', '미배치 부품이 남아 있습니다.', {
            count: run.result.unplaced.length
        }));
    }
    return { valid: errors.length === 0, errors };
}

function cutIntersectsPartInterior(cut, part) {
    if (cut.axis === 'X') {
        const insideX = cut.pos > part.x + EPSILON && cut.pos < part.x + part.width - EPSILON;
        const overlapY = Math.min(cut.spanEnd, part.y + part.height) -
            Math.max(cut.spanStart, part.y);
        return insideX && overlapY > EPSILON;
    }
    const insideY = cut.pos > part.y + EPSILON && cut.pos < part.y + part.height - EPSILON;
    const overlapX = Math.min(cut.spanEnd, part.x + part.width) -
        Math.max(cut.spanStart, part.x);
    return insideY && overlapX > EPSILON;
}

function validateCutDetails(run) {
    const errors = [];
    run.result.bins.forEach((bin, binIndex) => {
        (bin.cutDetails ?? []).forEach((cut, cutIndex) => {
            if (!['X', 'Y'].includes(cut.axis) ||
                ![cut.pos, cut.spanStart, cut.spanEnd].every(Number.isFinite) ||
                cut.spanEnd <= cut.spanStart + EPSILON) {
                errors.push(issue('malformedCut', '절단선 형식이 올바르지 않습니다.', { binIndex, cutIndex, cut }));
                return;
            }
            const axisLimit = cut.axis === 'X' ? bin.width : bin.height;
            const spanLimit = cut.axis === 'X' ? bin.height : bin.width;
            if (cut.pos < -EPSILON || cut.pos > axisLimit + EPSILON ||
                cut.spanStart < -EPSILON || cut.spanEnd > spanLimit + EPSILON) {
                errors.push(issue('cutOutOfBounds', '절단선이 판재 범위를 벗어났습니다.', { binIndex, cutIndex, cut }));
            }
            if ((bin.placed ?? []).some(part => cutIntersectsPartInterior(cut, part))) {
                errors.push(issue('cutThroughPart', '절단선이 부품 내부를 통과합니다.', { binIndex, cutIndex, cut }));
            }
            if (cut.sourceRect) {
                const rect = cut.sourceRect;
                const within = cut.axis === 'X'
                    ? cut.pos >= rect.x - EPSILON && cut.pos <= rect.x + rect.width + EPSILON &&
                      cut.spanStart >= rect.y - EPSILON && cut.spanEnd <= rect.y + rect.height + EPSILON
                    : cut.pos >= rect.y - EPSILON && cut.pos <= rect.y + rect.height + EPSILON &&
                      cut.spanStart >= rect.x - EPSILON && cut.spanEnd <= rect.x + rect.width + EPSILON;
                if (!within) {
                    errors.push(issue('sourceRectMismatch', '절단선이 sourceRect 범위와 일치하지 않습니다.', {
                        binIndex, cutIndex, cut
                    }));
                }
            }
        });
    });
    return { valid: errors.length === 0, errors };
}

function splitCandidates(parts, bounds) {
    const candidates = [];
    const xValues = new Set([bounds.x, bounds.x + bounds.width]);
    const yValues = new Set([bounds.y, bounds.y + bounds.height]);
    parts.forEach(part => {
        xValues.add(part.x);
        xValues.add(part.x + part.width);
        yValues.add(part.y);
        yValues.add(part.y + part.height);
    });
    [...xValues].sort((a, b) => a - b).forEach(pos => {
        if (pos <= bounds.x + EPSILON || pos >= bounds.x + bounds.width - EPSILON) return;
        const crosses = parts.some(part => pos > part.x + EPSILON && pos < part.x + part.width - EPSILON);
        const left = parts.filter(part => part.x + part.width <= pos + EPSILON);
        const right = parts.filter(part => part.x >= pos - EPSILON);
        if (!crosses && left.length > 0 && right.length > 0 && left.length + right.length === parts.length) {
            candidates.push({ axis: 'X', pos, first: left, second: right });
        }
    });
    [...yValues].sort((a, b) => a - b).forEach(pos => {
        if (pos <= bounds.y + EPSILON || pos >= bounds.y + bounds.height - EPSILON) return;
        const crosses = parts.some(part => pos > part.y + EPSILON && pos < part.y + part.height - EPSILON);
        const top = parts.filter(part => part.y + part.height <= pos + EPSILON);
        const bottom = parts.filter(part => part.y >= pos - EPSILON);
        if (!crosses && top.length > 0 && bottom.length > 0 && top.length + bottom.length === parts.length) {
            candidates.push({ axis: 'Y', pos, first: top, second: bottom });
        }
    });
    return candidates;
}

function childBounds(bounds, candidate, first) {
    if (candidate.axis === 'X') {
        const start = first ? bounds.x : candidate.pos;
        const end = first ? candidate.pos : bounds.x + bounds.width;
        return { x: start, y: bounds.y, width: end - start, height: bounds.height };
    }
    const start = first ? bounds.y : candidate.pos;
    const end = first ? candidate.pos : bounds.y + bounds.height;
    return { x: bounds.x, y: start, width: bounds.width, height: end - start };
}

function findGuillotineSequence(parts, bounds, memo = new Map()) {
    if (parts.length <= 1) return { valid: true, cuts: [] };
    const key = parts
        .map(part => `${part.x},${part.y},${part.width},${part.height}`)
        .sort()
        .join('|');
    if (memo.has(key)) return memo.get(key);

    for (const candidate of splitCandidates(parts, bounds)) {
        const first = findGuillotineSequence(
            candidate.first, childBounds(bounds, candidate, true), memo
        );
        if (!first.valid) continue;
        const second = findGuillotineSequence(
            candidate.second, childBounds(bounds, candidate, false), memo
        );
        if (!second.valid) continue;
        const success = {
            valid: true,
            cuts: [
                { axis: candidate.axis, pos: candidate.pos, bounds },
                ...first.cuts,
                ...second.cuts
            ]
        };
        memo.set(key, success);
        return success;
    }
    const failure = { valid: false, cuts: [] };
    memo.set(key, failure);
    return failure;
}

function validateGuillotineSequence(run) {
    const errors = [];
    const sequences = [];
    run.result.bins.forEach((bin, binIndex) => {
        const result = findGuillotineSequence(bin.placed ?? [], {
            x: 0, y: 0, width: bin.width, height: bin.height
        });
        sequences.push(result.cuts);
        if (!result.valid) {
            errors.push(issue('notGuillotineSeparable',
                '배치 좌표에서 유효한 재귀 관통절단 순서를 찾지 못했습니다.',
                { binIndex, parts: bin.placed }));
        }
    });
    return { valid: errors.length === 0, errors, sequences };
}

function validateRun(run) {
    const geometry = validateGeometry(run);
    const cutDetails = validateCutDetails(run);
    const guillotineSequence = validateGuillotineSequence(run);
    return {
        geometryValid: geometry.valid,
        cutDetailsValid: cutDetails.valid,
        guillotineSequenceValid: guillotineSequence.valid,
        valid: geometry.valid && cutDetails.valid && guillotineSequence.valid,
        errors: {
            geometry: geometry.errors,
            cutDetails: cutDetails.errors,
            guillotineSequence: guillotineSequence.errors
        },
        sequences: guillotineSequence.sequences
    };
}

module.exports = {
    validateGeometry,
    validateCutDetails,
    validateGuillotineSequence,
    validateRun
};
