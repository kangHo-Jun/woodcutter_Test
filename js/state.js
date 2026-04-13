/**
 * 전역 상태 관리 모듈
 * 애플리케이션의 모든 상태를 중앙에서 관리
 */

class AppState {
    constructor() {
        this.boardSpec = {
            width: 1220,
            height: 2440,
            considerGrain: false
        };

        this.cuttingList = [];

        this.settings = {
            kerf: 4.2,
            enableTrim: true,
            trimMargin: 5,
            cutDirection: 'auto', // 'horizontal' | 'vertical' | 'auto'
            cutMethod: 'guillotine', // 'guillotine' | 'free'
            optimizationPriority: 'material', // 'material' | 'speed' | 'balance'
            panelPrice: 50000,
            cutPrice: 1500
        };

        this.result = null;
        this.costInfo = null;
        this.labeledGroups = null;

        this.listeners = new Map();
    }

    /**
     * 상태 변경 리스너 등록
     * @param {string} key - 감시할 상태 키
     * @param {Function} callback - 변경 시 호출될 콜백
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
    }

    /**
     * 상태 업데이트 및 리스너 호출
     * @param {string} key - 업데이트할 상태 키
     * @param {*} value - 새로운 값
     */
    update(key, value) {
        this[key] = value;
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(callback => callback(value));
        }
    }

    /**
     * 부품 추가
     * @param {Object} part - {width, height, qty, rotatable}
     */
    addPart(part) {
        this.cuttingList.push(part);
        this.update('cuttingList', this.cuttingList);
    }

    /**
     * 부품 삭제
     * @param {number} index - 삭제할 부품 인덱스
     */
    removePart(index) {
        this.cuttingList.splice(index, 1);
        this.update('cuttingList', this.cuttingList);
    }

    /**
     * 모든 부품 삭제
     */
    clearParts() {
        this.cuttingList = [];
        this.update('cuttingList', this.cuttingList);
    }

    /**
     * 설정 업데이트
     * @param {Object} newSettings - 업데이트할 설정 객체
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.update('settings', this.settings);
    }

    /**
     * 판재 정보 업데이트
     * @param {Object} newBoardSpec - 업데이트할 판재 정보
     */
    updateBoardSpec(newBoardSpec) {
        this.boardSpec = { ...this.boardSpec, ...newBoardSpec };
        this.update('boardSpec', this.boardSpec);
    }

    /**
     * 결과 저장
     * @param {Object} result - 최적화 결과
     */
    setResult(result) {
        this.result = result;
        this.update('result', result);
    }

    /**
     * 원가 정보 저장
     * @param {Object} costInfo - 원가 계산 결과
     */
    setCostInfo(costInfo) {
        this.costInfo = costInfo;
        this.update('costInfo', costInfo);
    }

    /**
     * 라벨 그룹 저장
     * @param {Array} labeledGroups - 라벨링된 부품 그룹
     */
    setLabeledGroups(labeledGroups) {
        this.labeledGroups = labeledGroups;
        this.update('labeledGroups', labeledGroups);
    }

    /**
     * 상태 초기화
     */
    reset() {
        this.cuttingList = [];
        this.result = null;
        this.costInfo = null;
        this.labeledGroups = null;
        this.update('cuttingList', this.cuttingList);
        this.update('result', null);
        this.update('costInfo', null);
        this.update('labeledGroups', null);
    }
}

// 전역 상태 인스턴스
const appState = new AppState();

// 전역 노출
window.appState = appState;
