/**
 * 입력값 검증 모듈
 * XSS 방지 및 데이터 유효성 검증
 */

class Validator {
    /**
     * 숫자 타입 검증
     * @param {*} value - 검증할 값
     * @returns {boolean}
     */
    static isValidNumber(value) {
        return Number.isFinite(Number(value));
    }

    /**
     * 범위 검증
     * @param {number} value - 검증할 값
     * @param {number} min - 최소값
     * @param {number} max - 최대값
     * @returns {boolean}
     */
    static isInRange(value, min, max) {
        const num = Number(value);
        return this.isValidNumber(num) && num >= min && num <= max;
    }

    /**
     * 필수 필드 검증
     * @param {*} value - 검증할 값
     * @returns {boolean}
     */
    static isRequired(value) {
        return value !== null && value !== undefined && value !== '';
    }

    /**
     * 판재 폭 검증
     * @param {number} width - 폭 (mm)
     * @returns {Object} {valid: boolean, message: string}
     */
    static validateBoardWidth(width) {
        if (!this.isRequired(width)) {
            return { valid: false, message: '판재 폭을 입력하세요' };
        }
        if (!this.isValidNumber(width)) {
            return { valid: false, message: '올바른 숫자를 입력하세요' };
        }
        if (!this.isInRange(width, 100, 5000)) {
            return { valid: false, message: '판재 폭은 100~5000mm 범위여야 합니다' };
        }
        return { valid: true, message: '' };
    }

    /**
     * 판재 높이 검증
     * @param {number} height - 높이 (mm)
     * @returns {Object} {valid: boolean, message: string}
     */
    static validateBoardHeight(height) {
        if (!this.isRequired(height)) {
            return { valid: false, message: '판재 높이를 입력하세요' };
        }
        if (!this.isValidNumber(height)) {
            return { valid: false, message: '올바른 숫자를 입력하세요' };
        }
        if (!this.isInRange(height, 100, 5000)) {
            return { valid: false, message: '판재 높이는 100~5000mm 범위여야 합니다' };
        }
        return { valid: true, message: '' };
    }

    /**
     * 부품 폭 검증
     * @param {number} width - 폭 (mm)
     * @param {number} boardWidth - 판재 폭
     * @returns {Object} {valid: boolean, message: string}
     */
    static validatePartWidth(width, boardWidth) {
        if (!this.isRequired(width)) {
            return { valid: false, message: '부품 폭을 입력하세요' };
        }
        if (!this.isValidNumber(width)) {
            return { valid: false, message: '올바른 숫자를 입력하세요' };
        }
        if (!this.isInRange(width, 10, boardWidth)) {
            if (Number(width) > Number(boardWidth)) {
                return { valid: false, message: `부품 폭은 판재 폭(${boardWidth} mm) 이하여야 합니다` };
            }
            return { valid: false, message: '부품 폭은 10mm 이상이어야 합니다' };
        }
        return { valid: true, message: '' };
    }

    /**
     * 부품 높이 검증
     * @param {number} height - 높이 (mm)
     * @param {number} boardHeight - 판재 높이
     * @returns {Object} {valid: boolean, message: string}
     */
    static validatePartHeight(height, boardHeight) {
        if (!this.isRequired(height)) {
            return { valid: false, message: '부품 높이를 입력하세요' };
        }
        if (!this.isValidNumber(height)) {
            return { valid: false, message: '올바른 숫자를 입력하세요' };
        }
        if (!this.isInRange(height, 10, boardHeight)) {
            if (Number(height) > Number(boardHeight)) {
                return { valid: false, message: `부품 높이는 판재 높이(${boardHeight} mm) 이하여야 합니다` };
            }
            return { valid: false, message: '부품 높이는 10mm 이상이어야 합니다' };
        }
        return { valid: true, message: '' };
    }

    /**
     * 부품 수량 검증
     * @param {number} qty - 수량
     * @returns {Object} {valid: boolean, message: string}
     */
    static validatePartQty(qty) {
        if (!this.isRequired(qty)) {
            return { valid: false, message: '수량을 입력하세요' };
        }
        if (!this.isValidNumber(qty)) {
            return { valid: false, message: '올바른 숫자를 입력하세요' };
        }
        if (!this.isInRange(qty, 1, 999)) {
            return { valid: false, message: '수량은 1~999 범위여야 합니다' };
        }
        return { valid: true, message: '' };
    }

    /**
     * 톱날 두께 검증
     * @param {number} kerf - 톱날 두께 (mm)
     * @returns {Object} {valid: boolean, message: string}
     */
    static validateKerf(kerf) {
        if (!this.isRequired(kerf)) {
            return { valid: false, message: '톱날 두께를 입력하세요' };
        }
        if (!this.isValidNumber(kerf)) {
            return { valid: false, message: '올바른 숫자를 입력하세요' };
        }
        if (!this.isInRange(kerf, 0, 10)) {
            return { valid: false, message: '톱날 두께는 0~10mm 범위여야 합니다' };
        }
        return { valid: true, message: '' };
    }

    /**
     * 트리밍 여백 검증
     * @param {number} margin - 여백 (mm)
     * @returns {Object} {valid: boolean, message: string}
     */
    static validateTrimMargin(margin) {
        if (!this.isRequired(margin)) {
            return { valid: false, message: '트리밍 여백을 입력하세요' };
        }
        if (!this.isValidNumber(margin)) {
            return { valid: false, message: '올바른 숫자를 입력하세요' };
        }
        if (!this.isInRange(margin, 0, 50)) {
            return { valid: false, message: '트리밍 여백은 0~50mm 범위여야 합니다' };
        }
        return { valid: true, message: '' };
    }

    /**
     * 가격 검증
     * @param {number} price - 가격 (원)
     * @returns {Object} {valid: boolean, message: string}
     */
    static validatePrice(price) {
        if (!this.isRequired(price)) {
            return { valid: false, message: '가격을 입력하세요' };
        }
        if (!this.isValidNumber(price)) {
            return { valid: false, message: '올바른 숫자를 입력하세요' };
        }
        if (Number(price) < 0) {
            return { valid: false, message: '가격은 0 이상이어야 합니다' };
        }
        return { valid: true, message: '' };
    }

    /**
     * 부품 목록 최대 개수 검증
     * @param {Array} parts - 부품 목록
     * @returns {Object} {valid: boolean, message: string}
     */
    static validatePartCount(parts) {
        if (parts.length >= 500) {
            return { valid: false, message: '부품은 최대 500개까지 추가할 수 있습니다' };
        }
        return { valid: true, message: '' };
    }

    /**
     * XSS 방지를 위한 문자열 sanitize
     * @param {string} str - 입력 문자열
     * @returns {string} - 정제된 문자열
     */
    static sanitize(str) {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * 에러 메시지 표시
     * @param {HTMLElement} element - 입력 요소
     * @param {string} message - 에러 메시지
     */
    static showError(element, message) {
        element.classList.add('error');

        // 기존 에러 메시지 제거
        const existingError = element.parentElement.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        // 새 에러 메시지 추가
        if (message) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.setAttribute('role', 'alert');
            errorDiv.textContent = message;
            element.parentElement.appendChild(errorDiv);
        }
    }

    /**
     * 에러 메시지 제거
     * @param {HTMLElement} element - 입력 요소
     */
    static clearError(element) {
        element.classList.remove('error');
        const errorDiv = element.parentElement.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.remove();
        }
    }
}

// 전역 노출
window.Validator = Validator;
