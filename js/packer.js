/**
 * Guillotine Bin Packing Algorithm
 * 두 가지 모드 지원:
 * - horizontal: Strip-based (절단 편리)
 * - auto: 첫 절단 방향(H/V) 효율 비교 후 관통 절단 적용
 */

class GuillotinePacker {
    constructor(width, height, kerf = 0) {
        this.binWidth = width;
        this.binHeight = height;
        this.kerf = kerf;
    }

    /**
     * 메인 패킹 메서드
     * @param {Array} items - [{width, height, qty, rotatable}]
     * @param {string} mode - 'horizontal' | 'auto'
     */
    pack(items, mode = 'auto') {
        if (mode === 'horizontal') {
            return this.packHorizontal(items);
        }

        // auto: 운영 wrapper를 통해 엔진 선택 (UI 호출 시그니처 유지)
        return this.packAutoWithWrapper(items);
    }

    packAutoWithWrapper(items) {
        const engine = this.resolveAutoEngineFlag();
        this.logEngineSelection(engine);

        if (engine === 'legacy') {
            const result = this.packBandSingleMode(items);
            result.mode = 'auto';
            result.engine = 'legacy';
            return result;
        }

        if (engine === 'rip-reapply') {
            const result = this.packRipReapply(items);
            result.mode = 'auto';
            result.engine = 'rip-reapply';
            return result;
        }

        const result = this.packAdaptiveAuto(items);
        result.engine = 'adaptive';
        return result;
    }

    resolveAutoEngineFlag() {
        const rawFlag = this.getGlobalAutoEngineFlag();
        if (rawFlag === 'legacy' || rawFlag === 'rip-reapply' || rawFlag === 'adaptive') {
            return rawFlag;
        }
        return 'adaptive';
    }

    getGlobalAutoEngineFlag() {
        // 호환 스위치: USE_STABLE_ENGINE = true/false
        if (typeof window !== 'undefined' && typeof window.USE_STABLE_ENGINE === 'boolean') {
            return window.USE_STABLE_ENGINE ? 'adaptive' : 'legacy';
        }

        if (typeof window !== 'undefined' && typeof window.__WOODCUTTER_AUTO_ENGINE__ === 'string') {
            return window.__WOODCUTTER_AUTO_ENGINE__;
        }
        return null;
    }

    logEngineSelection(engine) {
        // 운영 로그 전용: UI 표시/렌더링에는 영향 없음
        console.info(`[ENGINE] auto wrapper selected: ${engine}`);
    }

    packAdaptiveAuto(items) {
        const expandedItems = this.expandItems(items, false);
        const bins = [];
        let remainingItems = [...expandedItems];

        while (remainingItems.length > 0) {
            const bin = new AdaptiveGuillotineBin(this.binWidth, this.binHeight, this.kerf);
            const result = bin.pack(remainingItems);

            if (result.placed.length === 0) break;

            if (this.isTrimEnabled() && result.unplaced.length > 0) {
                this.tryPlaceResidualInAdaptive(result);
            }

            bins.push(result);
            remainingItems = result.unplaced;
        }

        return {
            bins,
            unplaced: remainingItems,
            totalEfficiency: this.calculateTotalEfficiency(bins),
            mode: 'auto'
        };
    }

    /**
     * 가로 우선 (Strip-based) - 절단 편리
     * 2단계: 스트립 배치 후 잔여 공간에 추가 배치
     */
    packHorizontal(items) {
        const expandedItems = this.expandItems(items, false);

        const bins = [];
        let remainingItems = [...expandedItems];

        while (remainingItems.length > 0) {
            const bin = new WidthStripBin(this.binWidth, this.binHeight, this.kerf);
            const result = bin.packWidthStrips(remainingItems);

            if (result.placed.length === 0) break;

            // 2단계: 잔여 공간에 추가 배치 (회전 포함)
            if (result.unplaced.length > 0) {
                const freeRects = bin.collectFreeRects();
                if (freeRects.length > 0) {
                    const fillResult = bin.fillFreeRects(freeRects, result.unplaced);
                    result.unplaced = fillResult.unplaced;
                    result.usedArea = bin.placed.reduce((sum, p) => sum + p.width * p.height, 0);
                    result.efficiency = (result.usedArea / result.totalArea) * 100;
                    result.cuttingCount = bin.cutLinesX.size + bin.cutLinesY.size;
                }
            }

            bins.push(result);
            remainingItems = result.unplaced;
        }

        return {
            bins,
            unplaced: remainingItems,
            totalEfficiency: this.calculateTotalEfficiency(bins),
            mode: 'horizontal'
        };
    }

    /**
     * 2단계 리핑-재적용 (Auto)
     * - 1단계: 전체 판재에 폭 스트립 배치
     * - 2단계: 남은 직사각형 잔여에 동일 로직 재적용
     */
    packRipReapply(items) {
        const expandedItems = this.expandItems(items, false);
        const bins = [];
        let remainingItems = [...expandedItems];

        while (remainingItems.length > 0) {
            const bin = new RipReapplyBin(this.binWidth, this.binHeight, this.kerf);
            const result = bin.pack(remainingItems);

            if (result.placed.length === 0) break;

            bins.push(result);
            remainingItems = result.unplaced;
        }

        return {
            bins,
            unplaced: remainingItems,
            totalEfficiency: this.calculateTotalEfficiency(bins),
            mode: 'rip-reapply'
        };
    }

    /**
     * 스트립 효율 (Strip-Enhanced Efficiency)
     * - 비슷한 높이 그룹화 (허용 오차 내)
     * - 같은 크기 부품은 같은 방향으로 정규화
     * - 스트립 우선 배치 + 남은 공간 활용
     */
    packStripEfficiency(items) {
        const expandedItems = this.expandItems(items, false);

        // 회전 가능한 부품은 높이 작게 정규화 (스트립 효율을 위해)
        expandedItems.forEach(item => {
            if (item.rotatable && item.width < item.height) {
                [item.width, item.height] = [item.height, item.width];
                item.rotated = !item.rotated;
            }
        });

        // 높이 그룹화 (10% 허용 오차)
        const heightGroups = this.groupByHeight(expandedItems, 0.1);

        // 그룹별 면적 합계 계산 후 내림차순 정렬
        const sortedGroups = Object.entries(heightGroups)
            .map(([height, items]) => ({
                height: parseFloat(height),
                items: items,
                totalArea: items.reduce((sum, i) => sum + i.width * i.height, 0)
            }))
            .sort((a, b) => b.height - a.height); // 높이 큰 순

        const bins = [];
        let allItems = sortedGroups.flatMap(g => g.items);

        while (allItems.length > 0) {
            const bin = new StripEfficiencyBin(this.binWidth, this.binHeight, this.kerf);
            const result = bin.packWithStrips(allItems);

            if (result.placed.length === 0) break;

            bins.push(result);
            allItems = result.unplaced;
        }

        return {
            bins,
            unplaced: allItems,
            totalEfficiency: this.calculateTotalEfficiency(bins),
            mode: 'strip-efficiency'
        };
    }

    /**
     * 높이별 그룹화 (허용 오차 적용)
     */
    groupByHeight(items, tolerance) {
        const groups = {};
        const sortedItems = [...items].sort((a, b) => b.height - a.height);

        for (const item of sortedItems) {
            let foundGroup = false;

            // 기존 그룹에서 허용 오차 내 높이 찾기
            for (const groupHeight of Object.keys(groups)) {
                const gh = parseFloat(groupHeight);
                const diff = Math.abs(item.height - gh) / Math.max(item.height, gh);

                if (diff <= tolerance) {
                    groups[groupHeight].push(item);
                    foundGroup = true;
                    break;
                }
            }

            if (!foundGroup) {
                groups[item.height] = [item];
            }
        }

        return groups;
    }

    /**
     * 부품을 수량만큼 펼치기
     */
    expandItems(items, normalizeHeight) {
        const expandedItems = [];
        items.forEach((item, idx) => {
            for (let i = 0; i < item.qty; i++) {
                let w = item.width;
                let h = item.height;
                let rotated = false;

                // normalizeHeight: Strip용 - 높이 작게 정규화
                if (normalizeHeight && item.rotatable && w < h) {
                    [w, h] = [h, w];
                    rotated = true;
                }

                expandedItems.push({
                    width: w,
                    height: h,
                    id: `${idx}-${i}`,
                    originalId: idx,
                    originalWidth: item.width,
                    originalHeight: item.height,
                    rotatable: item.rotatable !== false,
                    rotated: rotated
                });
            }
        });
        return expandedItems;
    }

    calculateTotalEfficiency(bins) {
        if (bins.length === 0) return 0;
        const totalUsed = bins.reduce((sum, b) => sum + b.usedArea, 0);
        const totalArea = bins.reduce((sum, b) => sum + b.totalArea, 0);
        return (totalUsed / totalArea) * 100;
    }

    isTrimEnabled() {
        if (typeof window === 'undefined') return false;
        if (typeof window.__WOODCUTTER_TRIM_ENABLED__ === 'boolean') {
            return window.__WOODCUTTER_TRIM_ENABLED__;
        }
        if (window.SettingsManager && typeof window.SettingsManager.readFromUI === 'function') {
            try {
                const settings = window.SettingsManager.readFromUI();
                return settings && settings.enableTrim === true;
            } catch (error) {
                return false;
            }
        }
        return false;
    }

    tryPlaceResidualInAdaptive(result) {
        if (!result || !Array.isArray(result.unplaced) || result.unplaced.length === 0) {
            return false;
        }

        let sourceFreeRects = Array.isArray(result.freeRects) ? result.freeRects : [];

        // freeRects가 비어있으면 배치된 부품 기준으로 잔재 공간을 직접 계산
        if (sourceFreeRects.length === 0) {
            if (!result.placed || result.placed.length === 0) return false;
            const maxY = Math.max(...result.placed.map(p => p.y + p.height));
            const residualY = maxY + this.kerf;
            const residualH = this.binHeight - residualY;
            if (residualH <= 0) return false;
            sourceFreeRects = [{ x: 0, y: residualY, width: this.binWidth, height: residualH }];
        }

        const freeRects = [...sourceFreeRects]
            .filter(rect => rect.width > 0 && rect.height > 0)
            .sort((a, b) => (b.width * b.height) - (a.width * a.height));

        const candidates = [...result.unplaced]
            .sort((a, b) => (b.width * b.height) - (a.width * a.height));

        for (const rect of freeRects) {
            for (const item of candidates) {
                const orientations = [{ w: item.width, h: item.height, rotated: false }];
                if (item.rotatable) {
                    orientations.push({ w: item.height, h: item.width, rotated: true });
                }

                for (const orient of orientations) {
                    if (orient.w <= rect.width && orient.h <= rect.height + this.kerf) {
                        result.placed.push({
                            ...item,
                            x: rect.x,
                            y: rect.y,
                            width: orient.w,
                            height: orient.h,
                            rotated: orient.rotated
                        });

                        result.unplaced = result.unplaced.filter(p => p.id !== item.id);
                        result.usedArea = result.placed.reduce((sum, p) => sum + p.width * p.height, 0);
                        result.efficiency = (result.usedArea / result.totalArea) * 100;
                        result.cuttingCount = this.recomputeAdaptiveCuttingCount(result.placed);
                        return true;
                    }
                }
            }
        }

        return false;
    }

    recomputeAdaptiveCuttingCount(placed) {
        const cutLinesX = new Set();
        const cutLinesY = new Set();

        placed.forEach(part => {
            const cutX = part.x + part.width;
            const cutY = part.y + part.height;
            if (cutX < this.binWidth) cutLinesX.add(cutX);
            if (cutY < this.binHeight) cutLinesY.add(cutY);
        });

        return cutLinesX.size + cutLinesY.size;
    }

    packBandSingleMode(items) {
        const baseOptions = {
            topK: 5,
            lambda: 0.4,
            tailUtilizationThreshold: 0.55,
            maxRetries: 3,
            sliverFactor: 1.0,
            debug: false
        };

        let bestResult = this.runBandSingleMode(items, baseOptions);
        bestResult.mode = 'band-single';

        if (bestResult.totalEfficiency >= 60 || bestResult.unplaced.length === 0) {
            return bestResult;
        }

        // 파라미터 스윕 (1~2회)
        const sweepOptions = [
            { lambda: 0.2 },
            { lambda: 0.6 }
        ];

        for (const override of sweepOptions) {
            const sweepResult = this.runBandSingleMode(items, { ...baseOptions, ...override });
            sweepResult.mode = 'band-single-sweep';

            if (sweepResult.totalEfficiency > bestResult.totalEfficiency) {
                bestResult = sweepResult;
            }
        }

        if (bestResult.totalEfficiency >= 60) {
            return bestResult;
        }

        // 보수적 단일 모드
        const conservative = this.runBandSingleMode(items, {
            ...baseOptions,
            topK: 2,
            sliverFactor: 1.2
        });
        conservative.mode = 'band-single-conservative';

        if (conservative.totalEfficiency > bestResult.totalEfficiency) {
            bestResult = conservative;
        }

        if (bestResult.totalEfficiency >= 60) {
            return bestResult;
        }

        // 최후: 가로 우선으로 롤백
        const fallback = this.packHorizontal(items);
        fallback.mode = 'horizontal-fallback';
        fallback.fallbackFrom = 'band-single';
        return fallback;
    }

    runBandSingleMode(items, options) {
        const expandedItems = this.expandItems(items, false);
        const bins = [];
        let remainingItems = [...expandedItems];
        const debugLogs = [];

        while (remainingItems.length > 0) {
            const bin = new BandSingleModeBin(this.binWidth, this.binHeight, this.kerf, options);
            const result = bin.pack(remainingItems);

            if (result.placed.length === 0) break;

            bins.push(result);
            remainingItems = result.unplaced;
            if (result.debug && result.debug.length > 0) {
                debugLogs.push(...result.debug);
            }
        }

        const finalResult = {
            bins,
            unplaced: remainingItems,
            totalEfficiency: this.calculateTotalEfficiency(bins),
            mode: 'band-single'
        };

        if (debugLogs.length > 0) {
            finalResult.debug = debugLogs;
        }

        return finalResult;
    }
}

/**
 * 방향 적응형 관통 절단 Bin
 * 1) 첫 절단 H/V 시뮬레이션 비교
 * 2) 선택된 첫 절단의 반대 방향으로 1차 조각 처리
 * 3) 이후 잔여 직사각형은 H/V 자유 비교로 반복
 */
class AdaptiveGuillotineBin {
    constructor(width, height, kerf) {
        this.width = width;
        this.height = height;
        this.kerf = kerf;
        this.sliverThreshold = 30;
    }

    pack(items) {
        const simulationH = this.simulateFirstDirection(items, 'H');
        const simulationV = this.simulateFirstDirection(items, 'V');
        const selected = this.pickBetterSimulation(simulationH, simulationV);

        const cutLinesX = new Set();
        const cutLinesY = new Set();

        selected.placed.forEach(part => {
            const cutX = part.x + part.width;
            const cutY = part.y + part.height;
            if (cutX < this.width) cutLinesX.add(cutX);
            if (cutY < this.height) cutLinesY.add(cutY);
        });

        const usedArea = selected.placedArea;
        const totalArea = this.width * this.height;

        return {
            placed: selected.placed,
            unplaced: selected.unplaced,
            freeRects: selected.freeRects,
            efficiency: (usedArea / totalArea) * 100,
            usedArea,
            totalArea,
            cuttingCount: cutLinesX.size + cutLinesY.size,
            firstCutDirection: selected.firstDirection,
            cutDetails: selected.cutDetails || []
        };
    }

    simulateFirstDirection(items, firstDirection) {
        const rootRect = { x: 0, y: 0, width: this.width, height: this.height };
        const initial = this.packRectWithDirection(rootRect, items, firstDirection);

        let placed = [...initial.placed];
        let remaining = initial.unplaced;
        let freeRects = [...initial.freeRects];
        let cutDetails = [...(initial.cutDetails || [])];

        while (remaining.length > 0 && freeRects.length > 0) {
            let placedAny = false;
            const nextFreeRects = [];

            freeRects
                .sort((a, b) => (b.width * b.height) - (a.width * a.height))
                .forEach(rect => {
                    if (!this.canFitAny(rect, remaining)) {
                        nextFreeRects.push(rect);
                        return;
                    }

                    const bestForRect = this.packRectFlexible(rect, remaining);
                    if (bestForRect.placed.length === 0) {
                        nextFreeRects.push(rect);
                        return;
                    }

                    placedAny = true;
                    placed.push(...bestForRect.placed);
                    remaining = bestForRect.unplaced;
                    nextFreeRects.push(...bestForRect.freeRects);
                    cutDetails.push(...(bestForRect.cutDetails || []));
                });

            freeRects = this.normalizeFreeRects(nextFreeRects);
            if (!placedAny) break;
        }

        const placedArea = placed.reduce((sum, part) => sum + (part.width * part.height), 0);
        const score = this.computeEfficiencyScore(placedArea, freeRects);

        return {
            firstDirection,
            placed,
            unplaced: remaining,
            freeRects,
            placedArea,
            score,
            cutDetails
        };
    }

    pickBetterSimulation(a, b) {
        if (a.score !== b.score) return a.score > b.score ? a : b;
        if (a.placedArea !== b.placedArea) return a.placedArea > b.placedArea ? a : b;
        if (a.placed.length !== b.placed.length) return a.placed.length > b.placed.length ? a : b;
        return a.unplaced.length <= b.unplaced.length ? a : b;
    }

    packRectFlexible(rect, items) {
        const horizontal = this.packRectWithDirection(rect, items, 'H');
        const vertical = this.packRectWithDirection(rect, items, 'V');

        const areaH = horizontal.placed.reduce((sum, part) => sum + (part.width * part.height), 0);
        const areaV = vertical.placed.reduce((sum, part) => sum + (part.width * part.height), 0);

        if (areaH !== areaV) return areaH > areaV ? horizontal : vertical;
        if (horizontal.placed.length !== vertical.placed.length) {
            return horizontal.placed.length > vertical.placed.length ? horizontal : vertical;
        }
        return horizontal.unplaced.length <= vertical.unplaced.length ? horizontal : vertical;
    }

    packRectWithDirection(rect, items, direction) {
        if (direction === 'H') {
            return this.packHorizontalPrimary(rect, items);
        }
        return this.packVerticalPrimary(rect, items);
    }

    packHorizontalPrimary(rect, items) {
        const placed = [];
        const freeRects = [];
        const cutDetails = [];
        let remaining = [...items];
        let currentY = rect.y;

        while (true) {
            const stripStartY = currentY === rect.y ? rect.y : currentY + this.kerf;
            const availableHeight = rect.y + rect.height - stripStartY;
            if (availableHeight <= 0) break;

            const candidateHeights = this.collectStripSizes(remaining, availableHeight, rect.width, 'H');
            if (candidateHeights.length === 0) break;

            let bestAttempt = null;
            for (const stripHeight of candidateHeights) {
                const attempt = this.fillHorizontalStrip(rect, stripStartY, stripHeight, remaining);
                if (attempt.placed.length === 0) continue;

                if (!bestAttempt) {
                    bestAttempt = attempt;
                    continue;
                }

                if (attempt.usedArea > bestAttempt.usedArea) {
                    bestAttempt = attempt;
                    continue;
                }

                if (attempt.usedArea === bestAttempt.usedArea &&
                    attempt.placed.length > bestAttempt.placed.length) {
                    bestAttempt = attempt;
                }
            }

            if (!bestAttempt) break;

            placed.push(...bestAttempt.placed);
            remaining = bestAttempt.unplaced;
            if (bestAttempt.rightFreeRect) {
                freeRects.push(bestAttempt.rightFreeRect);
            }
            cutDetails.push(...(bestAttempt.cutDetails || []));
            currentY = stripStartY + bestAttempt.stripSize;
            if (currentY < rect.y + rect.height) {
                cutDetails.push(this.createCutDetail('Y', currentY, rect.x, rect.x + rect.width, rect));
            }
        }

        const bottomY = currentY === rect.y ? rect.y : currentY + this.kerf;
        const bottomHeight = rect.y + rect.height - bottomY;
        if (bottomHeight > 0) {
            freeRects.push({
                x: rect.x,
                y: bottomY,
                width: rect.width,
                height: bottomHeight
            });
        }

        return {
            placed,
            unplaced: remaining,
            freeRects: this.normalizeFreeRects(freeRects),
            cutDetails
        };
    }

    packVerticalPrimary(rect, items) {
        const placed = [];
        const freeRects = [];
        const cutDetails = [];
        let remaining = [...items];
        let currentX = rect.x;

        while (true) {
            const stripStartX = currentX === rect.x ? rect.x : currentX + this.kerf;
            const availableWidth = rect.x + rect.width - stripStartX;
            if (availableWidth <= 0) break;

            const candidateWidths = this.collectStripSizes(remaining, availableWidth, rect.height, 'V');
            if (candidateWidths.length === 0) break;

            let bestAttempt = null;
            for (const stripWidth of candidateWidths) {
                const attempt = this.fillVerticalStrip(rect, stripStartX, stripWidth, remaining);
                if (attempt.placed.length === 0) continue;

                if (!bestAttempt) {
                    bestAttempt = attempt;
                    continue;
                }

                if (attempt.usedArea > bestAttempt.usedArea) {
                    bestAttempt = attempt;
                    continue;
                }

                if (attempt.usedArea === bestAttempt.usedArea &&
                    attempt.placed.length > bestAttempt.placed.length) {
                    bestAttempt = attempt;
                }
            }

            if (!bestAttempt) break;

            placed.push(...bestAttempt.placed);
            remaining = bestAttempt.unplaced;
            if (bestAttempt.bottomFreeRect) {
                freeRects.push(bestAttempt.bottomFreeRect);
            }
            cutDetails.push(...(bestAttempt.cutDetails || []));
            currentX = stripStartX + bestAttempt.stripSize;
            if (currentX < rect.x + rect.width) {
                cutDetails.push(this.createCutDetail('X', currentX, rect.y, rect.y + rect.height, rect));
            }
        }

        const rightX = currentX === rect.x ? rect.x : currentX + this.kerf;
        const rightWidth = rect.x + rect.width - rightX;
        if (rightWidth > 0) {
            freeRects.push({
                x: rightX,
                y: rect.y,
                width: rightWidth,
                height: rect.height
            });
        }

        return {
            placed,
            unplaced: remaining,
            freeRects: this.normalizeFreeRects(freeRects),
            cutDetails
        };
    }

    fillHorizontalStrip(rect, stripStartY, stripHeight, items) {
        const oriented = [];
        const cutDetails = [];

        items.forEach(item => {
            if (item.height === stripHeight && item.width <= rect.width) {
                oriented.push({
                    item,
                    width: item.width,
                    height: item.height,
                    rotated: item.rotated
                });
            } else if (item.rotatable && item.width === stripHeight && item.height <= rect.width) {
                oriented.push({
                    item,
                    width: item.height,
                    height: item.width,
                    rotated: !item.rotated
                });
            }
        });

        oriented.sort((a, b) => b.width - a.width);

        const placed = [];
        const placedIds = new Set();
        let currentX = rect.x;
        let usedWidthEnd = rect.x;

        for (const candidate of oriented) {
            if (placedIds.has(candidate.item.id)) continue;

            const neededWidth = currentX === rect.x ? candidate.width : candidate.width + this.kerf;
            if (currentX + neededWidth > rect.x + rect.width) continue;

            const x = currentX === rect.x ? rect.x : currentX + this.kerf;
            placed.push({
                ...candidate.item,
                x,
                y: stripStartY,
                width: candidate.width,
                height: stripHeight,
                rotated: candidate.rotated
            });

            placedIds.add(candidate.item.id);
            currentX = x + candidate.width;
            usedWidthEnd = currentX;

            if (x + candidate.width < rect.x + rect.width) {
                cutDetails.push(this.createCutDetail('X', x + candidate.width, stripStartY, stripStartY + stripHeight, rect));
            }
        }

        const unplaced = items.filter(item => !placedIds.has(item.id));
        const usedArea = placed.reduce((sum, part) => sum + (part.width * part.height), 0);

        let rightFreeRect = null;
        if (placed.length > 0) {
            const rightX = usedWidthEnd + this.kerf;
            const rightWidth = rect.x + rect.width - rightX;
            if (rightWidth > 0) {
                rightFreeRect = {
                    x: rightX,
                    y: stripStartY,
                    width: rightWidth,
                    height: stripHeight
                };
            }
        }

        return {
            placed,
            unplaced,
            stripSize: stripHeight,
            usedArea,
            rightFreeRect,
            cutDetails
        };
    }

    fillVerticalStrip(rect, stripStartX, stripWidth, items) {
        const oriented = [];
        const cutDetails = [];

        items.forEach(item => {
            if (item.width === stripWidth && item.height <= rect.height) {
                oriented.push({
                    item,
                    width: item.width,
                    height: item.height,
                    rotated: item.rotated
                });
            } else if (item.rotatable && item.height === stripWidth && item.width <= rect.height) {
                oriented.push({
                    item,
                    width: item.height,
                    height: item.width,
                    rotated: !item.rotated
                });
            }
        });

        oriented.sort((a, b) => b.height - a.height);

        const placed = [];
        const placedIds = new Set();
        let currentY = rect.y;
        let usedHeightEnd = rect.y;

        for (const candidate of oriented) {
            if (placedIds.has(candidate.item.id)) continue;

            const neededHeight = currentY === rect.y ? candidate.height : candidate.height + this.kerf;
            if (currentY + neededHeight > rect.y + rect.height) continue;

            const y = currentY === rect.y ? rect.y : currentY + this.kerf;
            placed.push({
                ...candidate.item,
                x: stripStartX,
                y,
                width: stripWidth,
                height: candidate.height,
                rotated: candidate.rotated
            });

            placedIds.add(candidate.item.id);
            currentY = y + candidate.height;
            usedHeightEnd = currentY;

            if (y + candidate.height < rect.y + rect.height) {
                cutDetails.push(this.createCutDetail('Y', y + candidate.height, stripStartX, stripStartX + stripWidth, rect));
            }
        }

        const unplaced = items.filter(item => !placedIds.has(item.id));
        const usedArea = placed.reduce((sum, part) => sum + (part.width * part.height), 0);

        let bottomFreeRect = null;
        if (placed.length > 0) {
            const bottomY = usedHeightEnd + this.kerf;
            const bottomHeight = rect.y + rect.height - bottomY;
            if (bottomHeight > 0) {
                bottomFreeRect = {
                    x: stripStartX,
                    y: bottomY,
                    width: stripWidth,
                    height: bottomHeight
                };
            }
        }

        return {
            placed,
            unplaced,
            stripSize: stripWidth,
            usedArea,
            bottomFreeRect,
            cutDetails
        };
    }

    createCutDetail(axis, pos, spanStart, spanEnd, sourceRect) {
        const length = Math.max(0, spanEnd - spanStart);
        const fullSpan = axis === 'X'
            ? spanStart === 0 && spanEnd === this.height
            : spanStart === 0 && spanEnd === this.width;
        const relativePos = axis === 'X'
            ? pos - sourceRect.x
            : pos - sourceRect.y;
        const sourceSize = axis === 'X' ? sourceRect.width : sourceRect.height;
        const firstPiece = Math.max(0, relativePos);
        const secondPiece = Math.max(0, sourceSize - relativePos - this.kerf);

        return {
            axis,
            pos,
            spanStart,
            spanEnd,
            length,
            fullSpan,
            sourceRect: {
                x: sourceRect.x,
                y: sourceRect.y,
                width: sourceRect.width,
                height: sourceRect.height
            },
            pieceWidthsAfterCut: [firstPiece, secondPiece]
        };
    }

    collectStripSizes(items, maxPrimarySize, crossSize, direction) {
        const sizes = new Set();

        items.forEach(item => {
            if (direction === 'H') {
                if (item.height <= maxPrimarySize && item.width <= crossSize) {
                    sizes.add(item.height);
                }
                if (item.rotatable && item.width <= maxPrimarySize && item.height <= crossSize) {
                    sizes.add(item.width);
                }
            } else {
                if (item.width <= maxPrimarySize && item.height <= crossSize) {
                    sizes.add(item.width);
                }
                if (item.rotatable && item.height <= maxPrimarySize && item.width <= crossSize) {
                    sizes.add(item.height);
                }
            }
        });

        return Array.from(sizes).sort((a, b) => b - a);
    }

    canFitAny(rect, items) {
        return items.some(item => {
            const normalFit = item.width <= rect.width && item.height <= rect.height;
            const rotatedFit = item.rotatable && item.height <= rect.width && item.width <= rect.height;
            return normalFit || rotatedFit;
        });
    }

    normalizeFreeRects(rects) {
        return rects.filter(rect => rect.width > 0 && rect.height > 0);
    }

    computeEfficiencyScore(placedArea, freeRects) {
        const boardArea = this.width * this.height;
        const utilization = boardArea > 0 ? (placedArea / boardArea) * 100 : 0;
        const sliverPenalty = this.computeSliverPenalty(freeRects);
        const disconnectionPenalty = this.computeDisconnectionPenalty(freeRects);
        return utilization - sliverPenalty - disconnectionPenalty;
    }

    computeSliverPenalty(freeRects) {
        let penalty = 0;

        freeRects.forEach(rect => {
            const widthSliver = rect.width < this.sliverThreshold;
            const heightSliver = rect.height < this.sliverThreshold;

            if (widthSliver && heightSliver) {
                penalty += 100;
            } else if (widthSliver || heightSliver) {
                penalty += 50;
            }
        });

        return penalty;
    }

    computeDisconnectionPenalty() {
        // 기준 문서(가로세로_알고리즘_정리.md)에는 단절 패널티 수치가 정의되어 있지 않음
        // 현재 단계에서는 임의 계수 없이 고정값 0을 사용
        return 0;
    }
}

/**
 * Width-based Strip Bin (가로우선: 동일 폭 스트립)
 * 높이 방향(짧은 쪽)으로 리핑 후 크로스컷
 */
class WidthStripBin {
    constructor(width, height, kerf) {
        this.width = width;
        this.height = height;
        this.kerf = kerf;
        this.placed = [];
        this.cutLinesX = new Set();
        this.cutLinesY = new Set();
        this.strips = [];
        this.lastStripEnd = 0;
    }

    packWidthStrips(items) {
        const unplaced = [];

        // 폭별 그룹화 (동일 폭만 같은 스트립)
        const widthGroups = {};
        items.forEach(original => {
            const item = { ...original };
            if (item.rotatable) {
                const fits = item.width <= this.width && item.height <= this.height;
                const fitsRotated = item.height <= this.width && item.width <= this.height;
                if (!fits && fitsRotated) {
                    [item.width, item.height] = [item.height, item.width];
                    item.rotated = !item.rotated;
                }
            }
            if (item.width > this.width || item.height > this.height) {
                unplaced.push({ ...original });
                return;
            }
            const w = item.width;
            if (!widthGroups[w]) widthGroups[w] = [];
            widthGroups[w].push(item);
        });

        // 폭 빈도 내림차순, 동일 빈도면 폭 큰 순
        const sortedWidths = Object.entries(widthGroups)
            .map(([width, itemsForWidth]) => ({
                width: parseFloat(width),
                items: itemsForWidth,
                count: itemsForWidth.length
            }))
            .sort((a, b) => (b.count - a.count) || (b.width - a.width));

        let currentX = 0;
        this.strips = [];
        this.lastStripEnd = 0;

        for (const group of sortedWidths) {
            const stripWidth = group.width;
            const groupItems = group.items;

            // 높이 큰 순 정렬 (배치는 작은 것부터)
            groupItems.sort((a, b) => b.height - a.height);

            while (groupItems.length > 0) {
                const neededWidth = currentX === 0 ? stripWidth : stripWidth + this.kerf;
                if (currentX + neededWidth > this.width) break;

                const stripX = currentX === 0 ? 0 : currentX + this.kerf;
                let currentY = 0;
                const placedInStrip = [];

                for (let i = groupItems.length - 1; i >= 0; i--) {
                    const item = groupItems[i];
                    const neededHeight = currentY === 0 ? item.height : item.height + this.kerf;

                    if (currentY + neededHeight <= this.height) {
                        const y = currentY === 0 ? 0 : currentY + this.kerf;

                        this.placed.push({
                            ...item,
                            x: stripX,
                            y: y,
                            width: item.width,
                            height: item.height
                        });

                        if (y + item.height < this.height) {
                            this.cutLinesY.add(y + item.height);
                        }

                        currentY = y + item.height;
                        placedInStrip.push(i);
                    }
                }

                if (placedInStrip.length === 0) break;

                for (let i = 0; i < placedInStrip.length; i++) {
                    groupItems.splice(placedInStrip[i], 1);
                }

                this.strips.push({
                    x: stripX,
                    width: stripWidth,
                    usedHeight: currentY
                });

                if (stripX + stripWidth < this.width) {
                    this.cutLinesX.add(stripX + stripWidth);
                }

                currentX = stripX + stripWidth;
                this.lastStripEnd = currentX;
            }

            if (groupItems.length > 0) {
                unplaced.push(...groupItems);
            }
        }

        const usedArea = this.placed.reduce((sum, p) => sum + p.width * p.height, 0);
        const totalArea = this.width * this.height;

        return {
            placed: this.placed,
            unplaced,
            efficiency: (usedArea / totalArea) * 100,
            usedArea,
            totalArea,
            cuttingCount: this.cutLinesX.size + this.cutLinesY.size
        };
    }

    collectFreeRects() {
        const rects = [];

        // Strip 상단의 남는 공간
        this.strips.forEach(strip => {
            const freeY = strip.usedHeight + (strip.usedHeight === 0 ? 0 : this.kerf);
            const freeHeight = this.height - freeY;
            if (freeHeight > 0) {
                rects.push({
                    x: strip.x,
                    y: freeY,
                    width: strip.width,
                    height: freeHeight
                });
            }
        });

        // 우측 남는 공간
        const startX = this.lastStripEnd + (this.lastStripEnd === 0 ? 0 : this.kerf);
        if (startX < this.width) {
            rects.push({
                x: startX,
                y: 0,
                width: this.width - startX,
                height: this.height
            });
        }

        return rects;
    }

    fillFreeRects(freeRects, items) {
        const remaining = [...items];
        const placed = [];

        // 큰 것 우선
        remaining.sort((a, b) => (b.width * b.height) - (a.width * a.height));

        for (const rect of freeRects) {
            let x = rect.x;
            let y = rect.y;
            let rowHeight = 0;

            for (let i = 0; i < remaining.length; i++) {
                const item = remaining[i];
                const orientations = [{ w: item.width, h: item.height, rotated: false }];
                if (item.rotatable) {
                    orientations.push({ w: item.height, h: item.width, rotated: true });
                }

                let placedItem = null;
                for (const orient of orientations) {
                    if (x + orient.w <= rect.x + rect.width && y + orient.h <= rect.y + rect.height) {
                        placedItem = { ...item, width: orient.w, height: orient.h, rotated: orient.rotated };
                        break;
                    }

                    // 다음 줄로 이동 후 재시도
                    if (rowHeight > 0) {
                        const nextY = y + rowHeight + this.kerf;
                        if (nextY + orient.h <= rect.y + rect.height &&
                            rect.x + orient.w <= rect.x + rect.width) {
                            x = rect.x;
                            y = nextY;
                            rowHeight = 0;
                            placedItem = { ...item, width: orient.w, height: orient.h, rotated: orient.rotated };
                            break;
                        }
                    }
                }

                if (!placedItem) {
                    continue;
                }

                this.placed.push({
                    ...placedItem,
                    x,
                    y
                });
                placed.push(placedItem);

                const cutX = x + placedItem.width;
                const cutY = y + placedItem.height;
                if (cutX < this.width) this.cutLinesX.add(cutX);
                if (cutY < this.height) this.cutLinesY.add(cutY);

                x = x + placedItem.width + this.kerf;
                rowHeight = Math.max(rowHeight, placedItem.height);

                remaining.splice(i, 1);
                i -= 1;
            }
        }

        return { unplaced: remaining, placed };
    }
}

/**
 * 2단계 리핑-재적용 Bin
 */
class RipReapplyBin {
    constructor(width, height, kerf) {
        this.width = width;
        this.height = height;
        this.kerf = kerf;
        this.placed = [];
        this.cutLinesX = new Set();
        this.cutLinesY = new Set();
    }

    pack(items) {
        let remaining = items.map(i => ({ ...i }));
        const rootRect = { x: 0, y: 0, width: this.width, height: this.height };

        // 1단계: 전체 판재에 1차 배치
        let result = this.packInRect(rootRect, remaining, { allowAllGroups: false, pairSameWidth: true });
        this.placed.push(...result.placed);
        this.mergeCutLines(result.cutLinesX, result.cutLinesY);
        remaining = result.unplaced;

        let freeRects = result.freeRects;

        // 2단계: 잔여 영역에 재적용 (추가 배치가 없으면 중단)
        while (true) {
            let placedAny = false;
            const nextFreeRects = [];

            freeRects.sort((a, b) => (b.width * b.height) - (a.width * a.height));

            for (const rect of freeRects) {
                if (remaining.length === 0) {
                    nextFreeRects.push(rect);
                    continue;
                }

                result = this.packInRectWithRotation(rect, remaining, { allowAllGroups: true, pairSameWidth: false });

                if (result.placed.length > 0) {
                    placedAny = true;
                    this.placed.push(...result.placed);
                    this.mergeCutLines(result.cutLinesX, result.cutLinesY);
                    remaining = result.unplaced;
                    nextFreeRects.push(...result.freeRects);
                } else {
                    nextFreeRects.push(rect);
                }
            }

            freeRects = nextFreeRects;

            if (!placedAny) break;
        }

        const usedArea = this.placed.reduce((sum, p) => sum + p.width * p.height, 0);
        const totalArea = this.width * this.height;

        return {
            placed: this.placed,
            unplaced: remaining,
            efficiency: (usedArea / totalArea) * 100,
            usedArea,
            totalArea,
            cuttingCount: this.cutLinesX.size + this.cutLinesY.size
        };
    }

    mergeCutLines(xLines, yLines) {
        xLines.forEach(v => this.cutLinesX.add(v));
        yLines.forEach(v => this.cutLinesY.add(v));
    }

    packInRect(rect, items, options = {}) {
        // 리핑 방향: 짧은 축(높이)이 기준일 때 폭 스트립 사용
        const useWidthAxis = rect.height <= rect.width;
        if (useWidthAxis) {
            return this.packInRectByWidth(rect, items, options);
        }
        return this.packInRectByHeight(rect, items, options);
    }

    /**
     * 회전 최적화 적용 패킹
     * 회전 가능한 부품을 양방향으로 시도하여 더 많이 배치되는 결과 선택
     */
    packInRectWithRotation(rect, items, options = {}) {
        // 1) 원래 방향으로 배치
        const normalResult = this.packInRect(rect, items, options);

        // 2) 회전 가능한 부품을 회전시킨 복사본 생성
        const rotatedItems = items.map(item => {
            if (item.rotatable && item.width !== item.height) {
                return {
                    ...item,
                    width: item.height,
                    height: item.width,
                    rotated: !item.rotated
                };
            }
            return { ...item };
        });

        const rotatedResult = this.packInRect(rect, rotatedItems, options);

        // 3) 더 많이 배치된 결과 선택 (같으면 면적 큰 쪽)
        const normalArea = normalResult.placed.reduce((s, p) => s + p.width * p.height, 0);
        const rotatedArea = rotatedResult.placed.reduce((s, p) => s + p.width * p.height, 0);

        if (rotatedResult.placed.length > normalResult.placed.length ||
            (rotatedResult.placed.length === normalResult.placed.length && rotatedArea > normalArea)) {
            return rotatedResult;
        }
        return normalResult;
    }

    packInRectByWidth(rect, items, options = {}) {
        const placed = [];
        const cutLinesX = new Set();
        const cutLinesY = new Set();
        const freeRects = [];
        const placedIds = new Set();

        const widthGroups = {};

        items.forEach(original => {
            const item = { ...original };
            if (item.rotatable) {
                const fits = item.width <= rect.width && item.height <= rect.height;
                const fitsRotated = item.height <= rect.width && item.width <= rect.height;
                if (!fits && fitsRotated) {
                    [item.width, item.height] = [item.height, item.width];
                    item.rotated = !item.rotated;
                }
            }
            if (item.width > rect.width || item.height > rect.height) return;
            const w = item.width;
            if (!widthGroups[w]) widthGroups[w] = [];
            widthGroups[w].push(item);
        });

        const sortedWidths = Object.entries(widthGroups)
            .map(([width, groupItems]) => ({
                width: parseFloat(width),
                items: groupItems,
                count: groupItems.length
            }))
            .sort((a, b) => (b.count - a.count) || (b.width - a.width));

        const allowAllGroups = options.allowAllGroups !== false;
        const pairSameWidth = options.pairSameWidth === true;
        const effectiveWidths = allowAllGroups ? sortedWidths : sortedWidths.slice(0, 2);

        let currentX = rect.x;

        for (const group of effectiveWidths) {
            const baseWidth = group.width;
            let groupItems = group.items;
            const canPair = pairSameWidth
                && groupItems.length >= 2
                && baseWidth * 2 + this.kerf <= rect.width;
            const stripWidth = canPair ? baseWidth * 2 + this.kerf : baseWidth;

            groupItems.sort((a, b) => b.height - a.height);

            while (groupItems.length > 0) {
                const neededWidth = currentX === rect.x ? stripWidth : stripWidth + this.kerf;
                if (currentX + neededWidth > rect.x + rect.width) break;

                const stripX = currentX === rect.x ? rect.x : currentX + this.kerf;
                let currentY = rect.y;
                const placedInStrip = [];

                if (canPair) {
                    const takePair = () => {
                        for (let i = groupItems.length - 1; i >= 0; i--) {
                            const first = groupItems[i];
                            if (placedIds.has(first.id)) continue;
                            for (let j = i - 1; j >= 0; j--) {
                                const second = groupItems[j];
                                if (placedIds.has(second.id)) continue;
                                if (second.height === first.height) {
                                    return { first, second, i, j };
                                }
                            }
                        }
                        return null;
                    };

                    while (groupItems.length > 1) {
                        const pair = takePair();
                        if (!pair) break;

                        const itemA = pair.first;
                        const itemB = pair.second;
                        const neededHeight = currentY === rect.y ? itemA.height : itemA.height + this.kerf;

                        if (currentY + neededHeight > rect.y + rect.height) break;

                        const y = currentY === rect.y ? rect.y : currentY + this.kerf;

                        placed.push({
                            ...itemA,
                            x: stripX,
                            y: y,
                            width: itemA.width,
                            height: itemA.height
                        });
                        placed.push({
                            ...itemB,
                            x: stripX + itemA.width + this.kerf,
                            y: y,
                            width: itemB.width,
                            height: itemB.height
                        });

                        // 쌍 사이 내부 절단선 (지연된 분리)
                        cutLinesX.add(stripX + itemA.width);

                        placedIds.add(itemA.id);
                        placedIds.add(itemB.id);

                        if (y + itemA.height < rect.y + rect.height) {
                            cutLinesY.add(y + itemA.height);
                        }

                        currentY = y + itemA.height;
                        placedInStrip.push(pair.i, pair.j);
                    }
                } else {
                    for (let i = groupItems.length - 1; i >= 0; i--) {
                        const item = groupItems[i];
                        const neededHeight = currentY === rect.y ? item.height : item.height + this.kerf;

                        if (currentY + neededHeight <= rect.y + rect.height) {
                            const y = currentY === rect.y ? rect.y : currentY + this.kerf;

                            placed.push({
                                ...item,
                                x: stripX,
                                y: y,
                                width: item.width,
                                height: item.height
                            });
                            placedIds.add(item.id);

                            if (y + item.height < rect.y + rect.height) {
                                cutLinesY.add(y + item.height);
                            }

                            currentY = y + item.height;
                            placedInStrip.push(i);
                        }
                    }
                }

                if (placedInStrip.length === 0) break;
                const beforeCount = groupItems.length;
                groupItems = groupItems.filter(item => !placedIds.has(item.id));
                if (groupItems.length === beforeCount) break;

                if (stripX + stripWidth < rect.x + rect.width) {
                    cutLinesX.add(stripX + stripWidth);
                }

                const bottomY = currentY + this.kerf;
                const bottomHeight = rect.y + rect.height - bottomY;
                if (bottomHeight > 0) {
                    freeRects.push({
                        x: stripX,
                        y: bottomY,
                        width: stripWidth,
                        height: bottomHeight
                    });
                }

                currentX = stripX + stripWidth;
            }

        }

        const rightX = currentX === rect.x ? rect.x : currentX + this.kerf;
        const rightWidth = rect.x + rect.width - rightX;
        if (rightWidth > 0) {
            freeRects.push({
                x: rightX,
                y: rect.y,
                width: rightWidth,
                height: rect.height
            });
        }

        const unplaced = items.filter(item => !placedIds.has(item.id));

        return {
            placed,
            unplaced,
            freeRects,
            cutLinesX,
            cutLinesY
        };
    }

    packInRectByHeight(rect, items, options = {}) {
        const placed = [];
        const cutLinesX = new Set();
        const cutLinesY = new Set();
        const freeRects = [];
        const placedIds = new Set();

        const heightGroups = {};

        items.forEach(original => {
            const item = { ...original };
            if (item.rotatable) {
                const fits = item.width <= rect.width && item.height <= rect.height;
                const fitsRotated = item.height <= rect.width && item.width <= rect.height;
                if (!fits && fitsRotated) {
                    [item.width, item.height] = [item.height, item.width];
                    item.rotated = !item.rotated;
                }
            }
            if (item.width > rect.width || item.height > rect.height) return;
            const h = item.height;
            if (!heightGroups[h]) heightGroups[h] = [];
            heightGroups[h].push(item);
        });

        const sortedHeights = Object.entries(heightGroups)
            .map(([height, groupItems]) => ({
                height: parseFloat(height),
                items: groupItems,
                count: groupItems.length
            }))
            .sort((a, b) => (b.count - a.count) || (b.height - a.height));

        const allowAllGroups = options.allowAllGroups !== false;
        const effectiveHeights = allowAllGroups ? sortedHeights : sortedHeights.slice(0, 2);

        let currentY = rect.y;

        for (const group of effectiveHeights) {
            const stripHeight = group.height;
            const groupItems = group.items;

            groupItems.sort((a, b) => b.width - a.width);

            while (groupItems.length > 0) {
                const neededHeight = currentY === rect.y ? stripHeight : stripHeight + this.kerf;
                if (currentY + neededHeight > rect.y + rect.height) break;

                const stripY = currentY === rect.y ? rect.y : currentY + this.kerf;
                let currentX = rect.x;
                const placedInStrip = [];

                for (let i = groupItems.length - 1; i >= 0; i--) {
                    const item = groupItems[i];
                    const neededWidth = currentX === rect.x ? item.width : item.width + this.kerf;

                    if (currentX + neededWidth <= rect.x + rect.width) {
                        const x = currentX === rect.x ? rect.x : currentX + this.kerf;

                        placed.push({
                            ...item,
                            x: x,
                            y: stripY,
                            width: item.width,
                            height: item.height
                        });
                        placedIds.add(item.id);

                        if (x + item.width < rect.x + rect.width) {
                            cutLinesX.add(x + item.width);
                        }

                        currentX = x + item.width;
                        placedInStrip.push(i);
                    }
                }

                if (placedInStrip.length === 0) break;

                for (let i = 0; i < placedInStrip.length; i++) {
                    groupItems.splice(placedInStrip[i], 1);
                }

                if (stripY + stripHeight < rect.y + rect.height) {
                    cutLinesY.add(stripY + stripHeight);
                }

                const rightX = currentX === rect.x ? rect.x : currentX + this.kerf;
                const rightWidth = rect.x + rect.width - rightX;
                if (rightWidth > 0) {
                    freeRects.push({
                        x: rightX,
                        y: stripY,
                        width: rightWidth,
                        height: stripHeight
                    });
                }

                currentY = stripY + stripHeight;
            }

        }

        const bottomY = currentY === rect.y ? rect.y : currentY + this.kerf;
        const bottomHeight = rect.y + rect.height - bottomY;
        if (bottomHeight > 0) {
            freeRects.push({
                x: rect.x,
                y: bottomY,
                width: rect.width,
                height: bottomHeight
            });
        }

        const unplaced = items.filter(item => !placedIds.has(item.id));

        return {
            placed,
            unplaced,
            freeRects,
            cutLinesX,
            cutLinesY
        };
    }
}

/**
 * Band 기반 단일 모드 Bin
 * - 가로 절단은 Band 경계에서만 관통
 * - Band 내부는 세로(Rip) 분할만 허용
 */
class BandSingleModeBin {
    constructor(width, height, kerf, options = {}) {
        this.width = width;
        this.height = height;
        this.kerf = kerf;
        this.options = {
            topK: options.topK ?? 5,
            lambda: options.lambda ?? 0.4,
            tailUtilizationThreshold: options.tailUtilizationThreshold ?? 0.55,
            maxRetries: options.maxRetries ?? 3,
            sliverFactor: options.sliverFactor ?? 1.0,
            debug: options.debug ?? false
        };
        this.placed = [];
        this.cutLinesX = new Set();
        this.cutLinesY = new Set();
        this.debugLogs = [];
    }

    pack(items) {
        let remaining = [...items];
        let currentY = 0;
        let lastBandInfo = null;
        let retryCount = 0;
        const bandHistory = [];

        while (remaining.length > 0) {
            const bandStartY = currentY === 0 ? 0 : currentY + this.kerf;
            const availableHeight = this.height - bandStartY;
            if (availableHeight <= 0) break;

            const snapshot = {
                remaining: [...remaining],
                placed: [...this.placed],
                cutLinesX: new Set(this.cutLinesX),
                cutLinesY: new Set(this.cutLinesY),
                bandStartY,
                availableHeight
            };

            const bandResult = this.selectAndPlaceBand(remaining, bandStartY, availableHeight);
            if (!bandResult || bandResult.placed.length === 0) break;

            this.placed.push(...bandResult.placed);
            this.recordCutLines(bandResult.placed, bandStartY + bandResult.height);

            remaining = bandResult.unplaced;
            currentY = bandStartY + bandResult.height;

            lastBandInfo = bandResult;
            bandHistory.push({
                snapshot,
                selectedHeight: bandResult.height,
                result: bandResult
            });

            // Tail Retry 트리거는 루프 종료 후 처리
            if (currentY >= this.height) break;
        }

        // Tail Retry: 마지막 1개 Band만 재시도
        if (lastBandInfo && retryCount < this.options.maxRetries) {
            const tailTriggered = this.isTailTriggered(lastBandInfo);
            if (tailTriggered) {
                const retryResult = this.retryLastBand(bandHistory, retryCount);
                if (retryResult && retryResult.placed.length >= this.placed.length) {
                    this.placed = retryResult.placed;
                    remaining = retryResult.unplaced;
                    this.cutLinesX = retryResult.cutLinesX;
                    this.cutLinesY = retryResult.cutLinesY;
                    if (retryResult.debug && retryResult.debug.length > 0) {
                        this.debugLogs.push(...retryResult.debug);
                    }
                }
            }
        }

        const usedArea = this.placed.reduce((sum, p) => sum + p.width * p.height, 0);
        const totalArea = this.width * this.height;

        return {
            placed: this.placed,
            unplaced: remaining,
            efficiency: (usedArea / totalArea) * 100,
            usedArea,
            totalArea,
            cuttingCount: this.cutLinesX.size + this.cutLinesY.size,
            debug: this.debugLogs
        };
    }

    selectAndPlaceBand(items, bandStartY, availableHeight) {
        const candidates = this.getBandHeightCandidates(items, availableHeight);
        if (candidates.length === 0) return null;

        const candidateLogs = [];
        let best = null;

        for (const height of candidates) {
            const placement = this.placeBand(items, height, bandStartY, availableHeight);
            if (!placement || placement.invalid) continue;

            const baseScore = this.scoreBandLexValue(placement.metrics);
            const lookahead = this.bestNextApprox(placement.unplaced, availableHeight - height);
            const totalScore = baseScore + this.options.lambda * lookahead;

            candidateLogs.push({
                height,
                metrics: placement.metrics,
                baseScore,
                lookahead,
                totalScore
            });

            if (!best || totalScore > best.totalScore) {
                best = {
                    height,
                    placement,
                    totalScore
                };
            }
        }

        if (!best) return null;

        if (this.options.debug) {
            this.debugLogs.push({
                type: 'band-select',
                bandStartY,
                candidates: candidateLogs,
                selectedHeight: best.height
            });
        }

        return {
            ...best.placement,
            height: best.height
        };
    }

    getBandHeightCandidates(items, availableHeight) {
        const heights = new Set();

        items.forEach(item => {
            if (item.height <= availableHeight) {
                heights.add(item.height);
            }
            if (item.rotatable && item.width <= availableHeight) {
                heights.add(item.width);
            }
        });

        return Array.from(heights)
            .sort((a, b) => b - a)
            .slice(0, this.options.topK);
    }

    placeBand(items, height, bandStartY, availableHeight) {
        if (height > availableHeight) return null;

        const minPartDim = this.getMinPartDimension(items);
        const sliverThreshold = (minPartDim + this.kerf) * this.options.sliverFactor;

        const orientedItems = this.getItemsForHeight(items, height);
        if (orientedItems.length === 0) return null;

        orientedItems.sort((a, b) => {
            const areaDiff = (b.width * b.height) - (a.width * a.height);
            if (areaDiff !== 0) return areaDiff;
            const longA = Math.max(a.width, a.height);
            const longB = Math.max(b.width, b.height);
            return longB - longA;
        });

        const spans = [{ x: 0, width: this.width }];
        const placed = [];
        const placedIds = new Set();
        for (const candidate of orientedItems) {
            const bestSpanIndex = this.pickBestSpan(spans, candidate.width, sliverThreshold);
            if (bestSpanIndex < 0) continue;

            const span = spans[bestSpanIndex];
            const exactFit = span.width === candidate.width;
            const hasKerf = span.width >= candidate.width + this.kerf;
            if (!exactFit && !hasKerf) continue;

            const leftover = exactFit ? 0 : span.width - candidate.width - this.kerf;
            if (leftover > 0 && leftover < sliverThreshold) {
                continue;
            }

            placed.push({
                ...candidate.item,
                x: span.x,
                y: bandStartY,
                width: candidate.width,
                height: height,
                rotated: candidate.isRotated
            });
            placedIds.add(candidate.item.id);

            if (leftover === 0) {
                spans.splice(bestSpanIndex, 1);
            } else {
                spans[bestSpanIndex] = {
                    x: span.x + candidate.width + this.kerf,
                    width: leftover
                };
            }
        }

        const remainingHeight = this.height - (bandStartY + height);
        if (remainingHeight > 0 && remainingHeight < sliverThreshold) {
            return { invalid: true };
        }

        const sliverSpans = spans.filter(span => span.width > 0 && span.width < sliverThreshold);
        if (sliverSpans.length > 0) {
            return { invalid: true };
        }

        const unplaced = items.filter(item => !placedIds.has(item.id));
        const usedArea = placed.reduce((sum, p) => sum + p.width * p.height, 0);
        const utilization = (usedArea / (this.width * height)) * 100;
        const metrics = {
            sliverCount: sliverSpans.length,
            spanCount: spans.length,
            utilization,
            integerBonus: spans.length === 0 ? 1 : 0
        };

        return {
            placed,
            unplaced,
            height,
            metrics,
        };
    }

    pickBestSpan(spans, itemWidth, sliverThreshold) {
        let bestIndex = -1;
        let bestLeftover = Infinity;

        for (let i = 0; i < spans.length; i++) {
            const span = spans[i];
            if (span.width < itemWidth) continue;

            if (span.width === itemWidth) {
                if (0 < bestLeftover) {
                    bestLeftover = 0;
                    bestIndex = i;
                }
                continue;
            }

            if (span.width < itemWidth + this.kerf) continue;
            const leftover = span.width - itemWidth - this.kerf;
            if (leftover > 0 && leftover < sliverThreshold) continue;

            if (leftover < bestLeftover) {
                bestLeftover = leftover;
                bestIndex = i;
            }
        }

        return bestIndex;
    }

    getItemsForHeight(items, height) {
        const oriented = [];

        for (const item of items) {
            if (item.height === height) {
                oriented.push({ item, width: item.width, height: item.height, isRotated: false });
                continue;
            }
            if (item.rotatable && item.width === height) {
                oriented.push({ item, width: item.height, height: item.width, isRotated: true });
            }
        }

        return oriented;
    }

    getMinPartDimension(items) {
        let minDim = Infinity;
        for (const item of items) {
            minDim = Math.min(minDim, item.width, item.height);
        }
        return Number.isFinite(minDim) ? minDim : 0;
    }

    scoreBandLexValue(metrics) {
        const sliverPenalty = metrics.sliverCount * 1_000_000;
        const spanPenalty = metrics.spanCount * 1_000;
        const utilizationScore = metrics.utilization * 10;
        const bonusScore = metrics.integerBonus ? 1 : 0;
        return -sliverPenalty - spanPenalty + utilizationScore + bonusScore;
    }

    bestNextApprox(items, availableHeight) {
        if (items.length === 0 || availableHeight <= 0) return 0;
        const candidates = this.getBandHeightCandidates(items, availableHeight);
        let bestScore = 0;

        for (const height of candidates) {
            const placement = this.placeBand(items, height, 0, availableHeight);
            if (!placement || placement.invalid) continue;
            const score = this.scoreBandLexValue(placement.metrics);
            if (score > bestScore) bestScore = score;
        }

        return bestScore;
    }

    recordCutLines(placed, bandBottomY) {
        placed.forEach(item => {
            const cutX = item.x + item.width;
            if (cutX < this.width) this.cutLinesX.add(cutX);
        });

        if (bandBottomY < this.height) {
            this.cutLinesY.add(bandBottomY);
        }
    }

    isTailTriggered(lastBandInfo) {
        const utilization = lastBandInfo.metrics ? lastBandInfo.metrics.utilization / 100 : 0;
        if (utilization < this.options.tailUtilizationThreshold) return true;
        return false;
    }

    retryLastBand(bandHistory, retryCount) {
        if (bandHistory.length === 0) return null;
        const last = bandHistory[bandHistory.length - 1];
        const { snapshot, selectedHeight } = last;
        const availableHeight = snapshot.availableHeight;
        const candidates = this.getBandHeightCandidates(snapshot.remaining, availableHeight);

        if (candidates.length < 2) return null;

        const originalHeight = selectedHeight;
        const alternativeHeights = candidates.filter(h => h !== originalHeight).slice(0, 2);
        if (alternativeHeights.length === 0) return null;

        let best = null;
        for (const height of alternativeHeights) {
            const placement = this.placeBand(snapshot.remaining, height, snapshot.bandStartY, availableHeight);
            if (!placement || placement.invalid) continue;

            const totalPlaced = snapshot.placed.concat(placement.placed);

            const usedArea = totalPlaced.reduce((sum, p) => sum + p.width * p.height, 0);
            const totalArea = this.width * this.height;

            const cutLinesX = new Set(snapshot.cutLinesX);
            const cutLinesY = new Set(snapshot.cutLinesY);
            placement.placed.forEach(p => {
                const cutX = p.x + p.width;
                if (cutX < this.width) cutLinesX.add(cutX);
            });
            const bandBottom = snapshot.bandStartY + placement.height;
            if (bandBottom < this.height) cutLinesY.add(bandBottom);

            if (!best || usedArea > best.usedArea) {
                best = {
                    placed: totalPlaced,
                    unplaced: placement.unplaced,
                    usedArea,
                    totalArea,
                    cutLinesX,
                    cutLinesY,
                    debug: [{
                        type: 'tail-retry',
                        retryCount: retryCount + 1,
                        replacedHeight: originalHeight,
                        newHeight: height
                    }]
                };
            }
        }

        return best;
    }
}

/**
 * Strip-based Bin (가로 우선)
 */
class StripBin {
    constructor(width, height, kerf) {
        this.width = width;
        this.height = height;
        this.kerf = kerf;
        this.placed = [];
        this.currentY = 0;
        this.cutLinesX = new Set();
        this.cutLinesY = new Set();
    }

    packStrips(items) {
        const unplaced = [];

        // 높이별 그룹화
        const heightGroups = {};
        items.forEach(item => {
            const h = item.height;
            if (!heightGroups[h]) heightGroups[h] = [];
            heightGroups[h].push({ ...item });
        });

        // 높이 내림차순
        const sortedHeights = Object.keys(heightGroups)
            .map(Number)
            .sort((a, b) => b - a);

        for (const stripHeight of sortedHeights) {
            const groupItems = heightGroups[stripHeight];
            groupItems.sort((a, b) => b.width - a.width);

            while (groupItems.length > 0) {
                const spaceNeeded = this.currentY === 0 ? stripHeight : stripHeight + this.kerf;
                const canFitStrip = this.currentY + spaceNeeded <= this.height;

                if (!canFitStrip) {
                    unplaced.push(...groupItems);
                    break;
                }

                const stripY = this.currentY === 0 ? 0 : this.currentY + this.kerf;
                let currentX = 0;
                const placedInStrip = [];

                for (let i = groupItems.length - 1; i >= 0; i--) {
                    const item = groupItems[i];
                    const neededWidth = currentX === 0 ? item.width : item.width + this.kerf;

                    if (currentX + neededWidth <= this.width) {
                        const x = currentX === 0 ? 0 : currentX + this.kerf;

                        this.placed.push({
                            ...item,
                            x: x,
                            y: stripY,
                            width: item.width,
                            height: item.height
                        });

                        if (x + item.width < this.width) {
                            this.cutLinesX.add(x + item.width);
                        }

                        currentX = x + item.width;
                        placedInStrip.push(i);
                    }
                }

                for (let i = 0; i < placedInStrip.length; i++) {
                    groupItems.splice(placedInStrip[i], 1);
                }

                if (placedInStrip.length === 0) {
                    unplaced.push(...groupItems);
                    break;
                }

                if (stripY + stripHeight < this.height) {
                    this.cutLinesY.add(stripY + stripHeight);
                }
                this.currentY = stripY + stripHeight;
            }
        }

        const usedArea = this.placed.reduce((sum, p) => sum + p.width * p.height, 0);
        const totalArea = this.width * this.height;

        return {
            placed: this.placed,
            unplaced,
            efficiency: (usedArea / totalArea) * 100,
            usedArea,
            totalArea,
            cuttingCount: this.cutLinesX.size + this.cutLinesY.size
        };
    }
}

/**
 * Strip-Enhanced Efficiency Bin (스트립 효율)
 * 스트립 구조 유지하면서 남은 공간 활용
 */
class StripEfficiencyBin {
    constructor(width, height, kerf) {
        this.width = width;
        this.height = height;
        this.kerf = kerf;
        this.placed = [];
        this.freeRects = []; // 남은 공간 목록
        this.cutLinesX = new Set();
        this.cutLinesY = new Set();
    }

    packWithStrips(items) {
        const unplaced = [];
        const itemsCopy = items.map(i => ({ ...i }));

        // 1단계: 높이별 그룹화 (정확한 높이 기준)
        const heightGroups = {};
        itemsCopy.forEach(item => {
            const h = item.height;
            if (!heightGroups[h]) heightGroups[h] = [];
            heightGroups[h].push(item);
        });

        // 높이 내림차순 정렬
        const sortedHeights = Object.keys(heightGroups)
            .map(Number)
            .sort((a, b) => b - a);

        let currentY = 0;

        // 2단계: 스트립 배치
        for (const stripHeight of sortedHeights) {
            const groupItems = heightGroups[stripHeight];
            // 너비 내림차순 정렬
            groupItems.sort((a, b) => b.width - a.width);

            while (groupItems.length > 0) {
                const spaceNeeded = currentY === 0 ? stripHeight : stripHeight + this.kerf;
                const canFitStrip = currentY + spaceNeeded <= this.height;

                if (!canFitStrip) break;

                const stripY = currentY === 0 ? 0 : currentY + this.kerf;
                let currentX = 0;
                const placedInStrip = [];
                let stripMaxWidth = 0;

                // 같은 높이 부품을 스트립에 배치
                for (let i = groupItems.length - 1; i >= 0; i--) {
                    const item = groupItems[i];
                    const neededWidth = currentX === 0 ? item.width : item.width + this.kerf;

                    if (currentX + neededWidth <= this.width) {
                        const x = currentX === 0 ? 0 : currentX + this.kerf;

                        this.placed.push({
                            ...item,
                            x: x,
                            y: stripY,
                            width: item.width,
                            height: item.height
                        });

                        if (x + item.width < this.width) {
                            this.cutLinesX.add(x + item.width);
                        }

                        currentX = x + item.width;
                        stripMaxWidth = Math.max(stripMaxWidth, currentX);
                        placedInStrip.push(i);
                    }
                }

                // 배치된 항목 제거
                for (let i = 0; i < placedInStrip.length; i++) {
                    groupItems.splice(placedInStrip[i], 1);
                }

                if (placedInStrip.length === 0) break;

                // 스트립 우측 남은 공간 기록
                if (stripMaxWidth < this.width) {
                    const rightSpace = {
                        x: stripMaxWidth + this.kerf,
                        y: stripY,
                        width: this.width - stripMaxWidth - this.kerf,
                        height: stripHeight
                    };
                    if (rightSpace.width > 0) {
                        this.freeRects.push(rightSpace);
                    }
                }

                if (stripY + stripHeight < this.height) {
                    this.cutLinesY.add(stripY + stripHeight);
                }
                currentY = stripY + stripHeight;
            }
        }

        // 3단계: 남은 부품들을 unplaced에 모으기
        for (const height of sortedHeights) {
            const remaining = heightGroups[height];
            if (remaining.length > 0) {
                unplaced.push(...remaining);
            }
        }

        // 4단계: 남은 공간에 작은 부품 배치 시도 (같은 방향 유지)
        // 면적 작은 순으로 정렬하여 작은 공간에 맞추기
        const sortedFreeRects = [...this.freeRects].sort((a, b) =>
            (a.width * a.height) - (b.width * b.height)
        );

        for (const freeRect of sortedFreeRects) {
            if (freeRect.width <= 0 || freeRect.height <= 0) continue;

            // unplaced에서 이 공간에 맞는 부품 찾기
            for (let i = unplaced.length - 1; i >= 0; i--) {
                const item = unplaced[i];

                // 정방향으로만 시도 (회전 없이)
                const canFitW = freeRect.width >= item.width;
                const canFitH = freeRect.height >= item.height;

                if (canFitW && canFitH) {
                    this.placed.push({
                        ...item,
                        x: freeRect.x,
                        y: freeRect.y,
                        width: item.width,
                        height: item.height
                    });

                    // 공간 분할 (수평 분할 우선)
                    const rightWidth = freeRect.width - item.width - this.kerf;
                    const bottomHeight = freeRect.height - item.height - this.kerf;

                    if (rightWidth > 0) {
                        this.freeRects.push({
                            x: freeRect.x + item.width + this.kerf,
                            y: freeRect.y,
                            width: rightWidth,
                            height: item.height
                        });
                        this.cutLinesX.add(freeRect.x + item.width + this.kerf);
                    }
                    if (bottomHeight > 0) {
                        this.freeRects.push({
                            x: freeRect.x,
                            y: freeRect.y + item.height + this.kerf,
                            width: freeRect.width,
                            height: bottomHeight
                        });
                        this.cutLinesY.add(freeRect.y + item.height + this.kerf);
                    }

                    unplaced.splice(i, 1);
                    break; // 이 공간에는 하나만 배치
                }
            }
        }

        // 5단계: 하단 남은 공간에 추가 배치 시도
        const bottomY = currentY === 0 ? 0 : currentY + this.kerf;
        const bottomHeight = this.height - bottomY;

        if (bottomHeight > 0 && unplaced.length > 0) {
            // 남은 부품 중 이 공간에 맞는 것들 배치
            let bottomX = 0;

            for (let i = unplaced.length - 1; i >= 0; i--) {
                const item = unplaced[i];

                // 정방향 시도
                const canFitW = bottomX === 0
                    ? item.width <= this.width
                    : bottomX + item.width + this.kerf <= this.width;
                const canFitH = item.height <= bottomHeight;

                if (canFitW && canFitH) {
                    const x = bottomX === 0 ? 0 : bottomX + this.kerf;

                    this.placed.push({
                        ...item,
                        x: x,
                        y: bottomY,
                        width: item.width,
                        height: item.height
                    });

                    if (x + item.width < this.width) {
                        this.cutLinesX.add(x + item.width);
                    }

                    bottomX = x + item.width;
                    unplaced.splice(i, 1);
                }
            }

            // 각 부품의 하단 경계면 절단 (기존 stripY+stripHeight 로직과 중복을 피하기 위해 Set이 자동 처리)
            this.placed.filter(p => p.y === bottomY).forEach(p => {
                if (p.y + p.height < this.height) {
                    this.cutLinesY.add(p.y + p.height);
                }
            });
        }

        const usedArea = this.placed.reduce((sum, p) => sum + p.width * p.height, 0);
        const totalArea = this.width * this.height;

        return {
            placed: this.placed,
            unplaced,
            efficiency: (usedArea / totalArea) * 100,
            usedArea,
            totalArea,
            cuttingCount: this.cutLinesX.size + this.cutLinesY.size
        };
    }
}

// 전역 노출
window.GuillotinePacker = GuillotinePacker;
