/**
 * 사용자 입력 처리 모듈
 * 판재 및 부품 입력 이벤트 핸들링
 */

class InputHandler {
    constructor(state) {
        this.state = state;
        this.initializeElements();
        this.bindEvents();
    }

    /**
     * DOM 요소 초기화
     */
    initializeElements() {
        this.elements = {
            // 판재 입력
            boardWidth: document.getElementById('boardWidth'),
            boardHeight: document.getElementById('boardHeight'),
            considerGrain: document.getElementById('considerGrain'),

            // 부품 입력
            partWidth: document.getElementById('partWidth'),
            partHeight: document.getElementById('partHeight'),
            partQty: document.getElementById('partQty'),
            partRotatable: document.getElementById('partRotatable'),
            addPartBtn: document.getElementById('addPartBtn'),

            // 부품 목록
            partsTableBody: document.getElementById('partsTableBody'),
            clearPartsBtn: document.getElementById('clearPartsBtn'),

            // 계산 버튼
            calculateBtn: document.getElementById('calculateBtn')
        };
    }

    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        // 판재 입력 변경
        if (this.elements.boardWidth) {
            this.elements.boardWidth.addEventListener('input', () => this.handleBoardWidthChange());
            this.elements.boardWidth.addEventListener('blur', () => this.validateBoardWidth());
        }

        if (this.elements.boardHeight) {
            this.elements.boardHeight.addEventListener('input', () => this.handleBoardHeightChange());
            this.elements.boardHeight.addEventListener('blur', () => this.validateBoardHeight());
        }

        if (this.elements.considerGrain) {
            this.elements.considerGrain.addEventListener('change', () => this.handleGrainChange());
        }

        // 부품 추가
        if (this.elements.addPartBtn) {
            this.elements.addPartBtn.addEventListener('click', () => this.handleAddPart());
        }

        // 부품 입력 필드에서 Enter 키
        [this.elements.partWidth, this.elements.partHeight, this.elements.partQty].forEach(el => {
            if (el) {
                el.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.handleAddPart();
                    }
                });
            }
        });

        // 부품 목록 초기화
        if (this.elements.clearPartsBtn) {
            this.elements.clearPartsBtn.addEventListener('click', () => this.handleClearParts());
        }

        // 상태 변경 리스너
        this.state.subscribe('cuttingList', () => this.renderPartsList());
    }

    /**
     * 판재 폭 변경 처리
     */
    handleBoardWidthChange() {
        const width = parseFloat(this.elements.boardWidth.value);
        if (Validator.isValidNumber(width)) {
            this.state.updateBoardSpec({ width });
            Validator.clearError(this.elements.boardWidth);
        }
    }

    /**
     * 판재 높이 변경 처리
     */
    handleBoardHeightChange() {
        const height = parseFloat(this.elements.boardHeight.value);
        if (Validator.isValidNumber(height)) {
            this.state.updateBoardSpec({ height });
            Validator.clearError(this.elements.boardHeight);
        }
    }

    /**
     * 결 고려 옵션 변경 처리
     */
    handleGrainChange() {
        const considerGrain = this.elements.considerGrain.checked;
        this.state.updateBoardSpec({ considerGrain });
    }

    /**
     * 판재 폭 검증
     */
    validateBoardWidth() {
        const width = this.elements.boardWidth.value;
        const result = Validator.validateBoardWidth(width);

        if (!result.valid) {
            Validator.showError(this.elements.boardWidth, result.message);
            return false;
        }

        Validator.clearError(this.elements.boardWidth);
        return true;
    }

    /**
     * 판재 높이 검증
     */
    validateBoardHeight() {
        const height = this.elements.boardHeight.value;
        const result = Validator.validateBoardHeight(height);

        if (!result.valid) {
            Validator.showError(this.elements.boardHeight, result.message);
            return false;
        }

        Validator.clearError(this.elements.boardHeight);
        return true;
    }

    /**
     * 부품 추가 처리
     */
    handleAddPart() {
        // 부품 수 제한 확인
        const countCheck = Validator.validatePartCount(this.state.cuttingList);
        if (!countCheck.valid) {
            alert(countCheck.message);
            return;
        }

        // 입력값 읽기 (사용자 입력 그대로)
        const width = parseFloat(this.elements.partWidth.value);
        const height = parseFloat(this.elements.partHeight.value);
        const qty = parseInt(this.elements.partQty.value);
        const rotatable = this.elements.partRotatable ? this.elements.partRotatable.checked : true;

        // 검증 (입력값 기준 - 스왑 없음)
        const widthCheck = Validator.validatePartWidth(width, this.state.boardSpec.width);
        const heightCheck = Validator.validatePartHeight(height, this.state.boardSpec.height);
        const qtyCheck = Validator.validatePartQty(qty);

        let hasError = false;

        if (!widthCheck.valid) {
            Validator.showError(this.elements.partWidth, widthCheck.message);
            hasError = true;
        } else {
            Validator.clearError(this.elements.partWidth);
        }

        if (!heightCheck.valid) {
            Validator.showError(this.elements.partHeight, heightCheck.message);
            hasError = true;
        } else {
            Validator.clearError(this.elements.partHeight);
        }

        if (!qtyCheck.valid) {
            Validator.showError(this.elements.partQty, qtyCheck.message);
            hasError = true;
        } else {
            Validator.clearError(this.elements.partQty);
        }

        if (hasError) return;

        // 부품 추가
        this.state.addPart({
            width,
            height,
            qty,
            rotatable
        });

        // 입력 필드 초기화
        this.elements.partWidth.value = '';
        this.elements.partHeight.value = '';
        this.elements.partQty.value = '1';
        this.elements.partWidth.focus();
    }

    /**
     * 부품 목록 렌더링
     */
    renderPartsList() {
        if (!this.elements.partsTableBody) return;

        const parts = this.state.cuttingList;

        if (parts.length === 0) {
            this.elements.partsTableBody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5" class="empty-state">부품을 추가하세요</td>
                </tr>
            `;
            return;
        }

        const html = parts.map((part, index) => `
            <tr>
                <td contenteditable="true" data-index="${index}" data-field="width" class="editable-cell">${part.width}mm</td>
                <td contenteditable="true" data-index="${index}" data-field="height" class="editable-cell">${part.height}mm</td>
                <td contenteditable="true" data-index="${index}" data-field="qty" class="editable-cell">${part.qty}개</td>
                <td>${part.rotatable ? '가능' : '불가'}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="inputHandler.removePart(${index})" aria-label="삭제">
                        삭제
                    </button>
                </td>
            </tr>
        `).join('');

        this.elements.partsTableBody.innerHTML = html;

        // 편집 가능한 셀에 이벤트 리스너 추가
        const editableCells = this.elements.partsTableBody.querySelectorAll('.editable-cell');
        editableCells.forEach(cell => {
            // 포커스 시 숫자만 남기기
            cell.addEventListener('focus', (e) => {
                const text = e.target.textContent;
                e.target.textContent = text.replace(/[^0-9]/g, '');
                // 전체 선택
                const range = document.createRange();
                range.selectNodeContents(e.target);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            });

            // Enter 키로 저장
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
                // 숫자만 입력 허용
                if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
                    e.preventDefault();
                }
            });

            // 포커스 아웃 시 저장
            cell.addEventListener('blur', (e) => {
                this.handleCellEdit(e.target);
            });
        });
    }

    /**
     * 셀 편집 처리
     * @param {HTMLElement} cell - 편집된 셀
     */
    handleCellEdit(cell) {
        const index = parseInt(cell.dataset.index);
        const field = cell.dataset.field;
        const value = parseInt(cell.textContent.replace(/[^0-9]/g, '')) || 0;

        if (isNaN(index) || index < 0 || index >= this.state.cuttingList.length) {
            this.renderPartsList();
            return;
        }

        const part = this.state.cuttingList[index];

        // 검증
        let validation;
        if (field === 'width') {
            validation = Validator.validatePartWidth(value, this.state.boardSpec.width);
        } else if (field === 'height') {
            validation = Validator.validatePartHeight(value, this.state.boardSpec.height);
        } else if (field === 'qty') {
            validation = Validator.validatePartQty(value);
        }

        if (!validation.valid) {
            alert(validation.message);
            this.renderPartsList();
            return;
        }

        // 업데이트
        part[field] = value;
        this.state.update('cuttingList', this.state.cuttingList);

        // 재렌더링
        this.renderPartsList();
    }

    /**
     * 부품 삭제
     * @param {number} index - 삭제할 부품 인덱스
     */
    removePart(index) {
        if (confirm('이 부품을 삭제하시겠습니까?')) {
            this.state.removePart(index);
        }
    }

    /**
     * 모든 부품 삭제
     */
    handleClearParts() {
        if (this.state.cuttingList.length === 0) return;

        if (confirm('모든 부품을 삭제하시겠습니까?')) {
            this.state.clearParts();
        }
    }

    /**
     * 입력값 전체 검증
     * @returns {boolean} - 검증 통과 여부
     */
    validateAll() {
        const boardWidthValid = this.validateBoardWidth();
        const boardHeightValid = this.validateBoardHeight();
        const hasparts = this.state.cuttingList.length > 0;

        if (!hasparts) {
            alert('부품을 최소 1개 이상 추가하세요');
            return false;
        }

        return boardWidthValid && boardHeightValid && hasparts;
    }
}

// 전역 노출
window.InputHandler = InputHandler;
