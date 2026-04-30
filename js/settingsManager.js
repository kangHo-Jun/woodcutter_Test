/**
 * 설정 관리 모듈
 * localStorage를 사용한 설정값 저장/불러오기
 */

class SettingsManager {
    static STORAGE_KEY = 'woodcutter_settings';

    /**
     * 기본 설정값
     */
    static DEFAULT_SETTINGS = {
        kerf: 4.2,
        enableTrim: true,
        trimMargin: 5,
        cutDirection: 'auto',
        cutMethod: 'guillotine',
        optimizationPriority: 'material',
        cutPrice: 1500,
        enableWatermark: true
    };

    /**
     * 설정 저장
     * @param {Object} settings - 저장할 설정
     */
    static save(settings) {
        try {
            const validated = this.validateSettings(settings);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validated));
            return { success: true };
        } catch (error) {
            console.error('설정 저장 실패:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 설정 불러오기
     * @returns {Object} - 저장된 설정 또는 기본 설정
     */
    static load() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) {
                return { ...this.DEFAULT_SETTINGS };
            }

            const parsed = JSON.parse(stored);
            const validated = this.validateSettings(parsed);

            // 기본값과 병합 (새로운 설정 항목 대응)
            return { ...this.DEFAULT_SETTINGS, ...validated };
        } catch (error) {
            console.error('설정 불러오기 실패:', error);
            return { ...this.DEFAULT_SETTINGS };
        }
    }

    /**
     * 설정 검증
     * @param {Object} settings - 검증할 설정
     * @returns {Object} - 검증된 설정
     */
    static validateSettings(settings) {
        const validated = {};

        // 톱날 두께 - 항상 기본값 4.2 사용 (페이지 새로고침시 초기화)
        validated.kerf = this.DEFAULT_SETTINGS.kerf;

        // 트리밍 사용
        validated.enableTrim = typeof settings.enableTrim === 'boolean'
            ? settings.enableTrim
            : this.DEFAULT_SETTINGS.enableTrim;

        // 트리밍 여백
        validated.trimMargin = this.validateNumber(settings.trimMargin, 0, 50, this.DEFAULT_SETTINGS.trimMargin);

        // 절단 방향
        const validDirections = ['horizontal', 'vertical', 'auto'];
        validated.cutDirection = validDirections.includes(settings.cutDirection)
            ? settings.cutDirection
            : this.DEFAULT_SETTINGS.cutDirection;

        // 절단 방식
        const validMethods = ['guillotine', 'free'];
        validated.cutMethod = validMethods.includes(settings.cutMethod)
            ? settings.cutMethod
            : this.DEFAULT_SETTINGS.cutMethod;

        // 최적화 우선순위
        const validPriorities = ['material', 'speed', 'balance'];
        validated.optimizationPriority = validPriorities.includes(settings.optimizationPriority)
            ? settings.optimizationPriority
            : this.DEFAULT_SETTINGS.optimizationPriority;

        // 절단 단가 (자동 계산되므로 저장하지 않음)
        validated.cutPrice = this.validateNumber(settings.cutPrice, 0, Infinity, this.DEFAULT_SETTINGS.cutPrice);

        // 워터마크 사용
        validated.enableWatermark = typeof settings.enableWatermark === 'boolean'
            ? settings.enableWatermark
            : this.DEFAULT_SETTINGS.enableWatermark;

        return validated;
    }

    /**
     * 숫자 검증 헬퍼
     * @param {*} value - 검증할 값
     * @param {number} min - 최소값
     * @param {number} max - 최대값
     * @param {number} defaultValue - 기본값
     * @returns {number} - 검증된 값
     */
    static validateNumber(value, min, max, defaultValue) {
        const num = Number(value);
        if (!Number.isFinite(num) || num < min || num > max) {
            return defaultValue;
        }
        return num;
    }

    /**
     * 설정 초기화
     */
    static reset() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return { success: true, settings: { ...this.DEFAULT_SETTINGS } };
        } catch (error) {
            console.error('설정 초기화 실패:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 설정을 UI에 적용
     * @param {Object} settings - 적용할 설정
     */
    static applyToUI(settings) {
        const elements = {
            kerf: document.getElementById('kerfInput'),
            enableTrim: document.getElementById('enableTrim'),
            trimMargin: document.getElementById('trimMargin'),
            cutDirection: document.getElementById('cutDirection'),
            cutMethod: document.getElementById('cutMethod'),
            optimizationPriority: document.getElementById('optimizationPriority'),
            enableWatermark: document.getElementById('enableWatermark')
        };

        if (elements.kerf) elements.kerf.value = settings.kerf;
        if (elements.enableTrim) elements.enableTrim.checked = settings.enableTrim;
        if (elements.trimMargin) {
            elements.trimMargin.value = settings.trimMargin;
            elements.trimMargin.disabled = !settings.enableTrim;
        }
        if (elements.cutDirection) elements.cutDirection.value = settings.cutDirection;
        if (elements.cutMethod) elements.cutMethod.value = settings.cutMethod;
        if (elements.optimizationPriority) elements.optimizationPriority.value = settings.optimizationPriority;
        if (elements.enableWatermark) elements.enableWatermark.checked = settings.enableWatermark;
    }

    /**
     * UI에서 설정 읽기
     * @returns {Object} - 현재 UI의 설정값
     */
    static readFromUI() {
        const elements = {
            kerf: document.getElementById('kerfInput'),
            enableTrim: document.getElementById('enableTrim'),
            trimMargin: document.getElementById('trimMargin'),
            cutDirection: document.getElementById('cutDirection'),
            cutMethod: document.getElementById('cutMethod'),
            optimizationPriority: document.getElementById('optimizationPriority'),
            boardThickness: document.getElementById('boardThickness'),
            enableWatermark: document.getElementById('enableWatermark')
        };

        // 두께에 따른 절단 단가 자동 계산
        const thickness = elements.boardThickness ? parseFloat(elements.boardThickness.value) : 18;
        const cutPrice = window.CostCalculator ? window.CostCalculator.getCutPriceByThickness(thickness) : 1500;

        return {
            kerf: elements.kerf ? parseFloat(elements.kerf.value) : this.DEFAULT_SETTINGS.kerf,
            enableTrim: elements.enableTrim ? elements.enableTrim.checked : this.DEFAULT_SETTINGS.enableTrim,
            trimMargin: elements.trimMargin ? parseFloat(elements.trimMargin.value) : this.DEFAULT_SETTINGS.trimMargin,
            cutDirection: elements.cutDirection ? elements.cutDirection.value : this.DEFAULT_SETTINGS.cutDirection,
            cutMethod: elements.cutMethod ? elements.cutMethod.value : this.DEFAULT_SETTINGS.cutMethod,
            optimizationPriority: elements.optimizationPriority ? elements.optimizationPriority.value : this.DEFAULT_SETTINGS.optimizationPriority,
            cutPrice: cutPrice,
            enableWatermark: elements.enableWatermark ? elements.enableWatermark.checked : this.DEFAULT_SETTINGS.enableWatermark
        };
    }
}

// 전역 노출
window.SettingsManager = SettingsManager;
