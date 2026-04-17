/**
 * 원가 계산 모듈
 * 재료비, 재단비, 사용률 자동 계산
 */

class CostCalculator {
    /**
     * 원가 계산
     * @param {Array} bins - 최적화 결과 (판재 배열)
     * @param {Object} settings - 설정 정보
     * @returns {Object} - {totalCuttingCost, totalCuts, usageRate}
     */
    static calculate(bins, settings) {
        if (!bins || bins.length === 0) {
            return {
                totalCuttingCost: 0,
                totalCuts: 0,
                usageRate: 0
            };
        }

        // 판재 수
        const panelCount = bins.length;

        // 총 절단 횟수 계산
        const totalCuts = bins.reduce((sum, bin) => sum + (bin.cuttingCount || 0), 0);

        // 트리밍 절단 횟수 (참고용 메타데이터)
        const trimCuts = settings.enableTrim ? panelCount * 4 : 0;

        // 청구 가능한 절단 횟수
        // 주의: totalCuts는 엔진에서 계산된 실제 절단 횟수이며, trimCuts가 이미 포함되어 있지 않다.
        // 따라서 trimCuts를 추가 차감하면 과소청구가 발생한다.
        const billableCuts = totalCuts;

        // 총 재단비 = 조건 충족 판재는 원판당 고정 단가, 그 외는 기존 컷당 단가 유지
        const totalCuttingCost = bins.reduce((sum, bin) => {
            const fixedPrice = this.getLongSidePanelFixedPrice(bin);
            if (fixedPrice > 0) {
                return sum + fixedPrice;
            }
            return sum + ((bin.cuttingCount || 0) * settings.cutPrice);
        }, 0);

        // 사용 면적 및 전체 면적
        const usedArea = bins.reduce((sum, bin) => sum + (bin.usedArea || 0), 0);
        const totalArea = bins.reduce((sum, bin) => sum + (bin.totalArea || 0), 0);

        // 재료 사용률 (%)
        const usageRate = totalArea > 0 ? (usedArea / totalArea) * 100 : 0;

        return {
            totalCuttingCost,
            totalCuts,
            billableCuts,
            usageRate: parseFloat(usageRate.toFixed(2)),
            panelCount,
            trimCuts
        };
    }

    /**
     * 원가 정보를 포맷팅하여 반환
     * @param {Object} costInfo - 원가 정보
     * @returns {Object} - 포맷팅된 원가 정보
     */
    static format(costInfo) {
        return {
            totalCuttingCost: this.formatCurrency(costInfo.totalCuttingCost),
            totalCuts: `${costInfo.totalCuts}회`,
            usageRate: `${costInfo.usageRate}%`,
            billableCuts: `${costInfo.billableCuts}회`
        };
    }

    /**
     * 통화 포맷팅
     * @param {number} amount - 금액
     * @returns {string} - 포맷팅된 금액
     */
    static formatCurrency(amount) {
        return `${amount.toLocaleString('ko-KR')}원`;
    }

    /**
     * 원가 정보를 UI에 표시
     * @param {Object} costInfo - 원가 정보
     */
    static displayCostInfo(costInfo) {
        const formatted = this.format(costInfo);

        const elements = {
            totalCuttingCost: document.getElementById('totalCuttingCost'),
            totalCutCount: document.getElementById('totalCutCount'),
            materialUsageRate: document.getElementById('materialUsageRate')
        };

        if (elements.totalCuttingCost) {
            elements.totalCuttingCost.textContent = formatted.totalCuttingCost;
        }
        if (elements.totalCutCount) {
            elements.totalCutCount.textContent = formatted.totalCuts;
        }
        if (elements.materialUsageRate) {
            elements.materialUsageRate.textContent = formatted.usageRate;
        }
    }

    /**
     * 원가 정보 초기화
     */
    static clearCostInfo() {
        const elements = {
            totalCuttingCost: document.getElementById('totalCuttingCost'),
            totalCutCount: document.getElementById('totalCutCount'),
            materialUsageRate: document.getElementById('materialUsageRate')
        };

        Object.values(elements).forEach(el => {
            if (el) el.textContent = '-';
        });
    }

    /**
     * 두께에 따른 절단 단가 계산
     * @param {number} thickness - 두께 (mm)
     * @returns {number} - 절단 단가 (원)
     */
    static getCutPriceByThickness(thickness) {
        if (thickness <= 12) {
            return 1000;
        } else if (thickness >= 14.5 && thickness <= 23) {
            return 1500;
        } else if (thickness >= 24) {
            return 2000;
        }
        return 1500; // 기본값
    }

    static getLongSidePanelFixedPrice(bin) {
        if (!bin || !Array.isArray(bin.cutDetails) || bin.cutDetails.length === 0) {
            return 0;
        }

        const maxSpanEnd = Math.max(...bin.cutDetails
            .map(detail => detail && detail.spanEnd)
            .filter(value => Number.isFinite(value)));
        const lengthSpan = Number.isFinite(bin.width) ? bin.width : maxSpanEnd;
        const isLongRipCut = detail => detail
            && detail.axis === 'Y'
            && Math.round(detail.spanStart) === 0
            && Math.round(detail.spanEnd) === Math.round(lengthSpan);

        if (bin.cutDetails.some(detail => !isLongRipCut(detail))) {
            return 0;
        }

        const positions = bin.cutDetails
            .filter(isLongRipCut)
            .map(detail => detail.pos)
            .filter(pos => Number.isFinite(pos))
            .sort((a, b) => a - b);

        const kerf = 4.2;
        const actualWidths = [];
        let prev = 0;
        positions.forEach(pos => {
            actualWidths.push(pos - prev);
            prev = pos + kerf;
        });

        const qualifyingWidths = actualWidths.filter(width => Number.isFinite(width) && Math.round(width) >= 50);

        if (qualifyingWidths.length === 0) {
            return 0;
        }

        const count100up = qualifyingWidths.filter(width => Math.round(width) > 100).length;
        const count100down = qualifyingWidths.filter(width => Math.round(width) <= 100).length;
        const useUnder100Price = count100down > count100up;
        const thickness = this.getBoardThickness();
        const cutCost = (bin.cuttingCount || 0) * this.getCutPriceByThickness(thickness);
        let fixedPrice = 0;

        if (thickness <= 12) {
            fixedPrice = useUnder100Price ? 7000 : 5000;
        } else if (thickness >= 14.5 && thickness <= 23) {
            fixedPrice = useUnder100Price ? 10000 : 7000;
        } else if (thickness >= 24) {
            fixedPrice = useUnder100Price ? 15000 : 12000;
        } else {
            fixedPrice = useUnder100Price ? 10000 : 7000;
        }

        return fixedPrice < cutCost ? fixedPrice : 0;
    }

    static getBoardThickness() {
        if (typeof document === 'undefined') {
            return 18;
        }
        const input = document.getElementById('boardThickness');
        const thickness = input ? parseFloat(input.value) : 18;
        return Number.isFinite(thickness) ? thickness : 18;
    }
}

// 전역 노출
window.CostCalculator = CostCalculator;
