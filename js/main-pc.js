/**
 * 대장간 V3 - PC 버전 메인 애플리케이션
 * 모든 모듈을 초기화하고 이벤트를 연결
 */

class WoodcutterPC {
    constructor() {
        this.state = window.appState;
        this.inputHandler = null;
        this.currentBoardIndex = 0;
    }

    /**
     * 애플리케이션 초기화
     */
    async init() {
        // Initialization started

        // 설정 불러오기
        const savedSettings = SettingsManager.load();
        this.state.updateSettings(savedSettings);
        SettingsManager.applyToUI(savedSettings);

        // 입력 핸들러 초기화
        this.inputHandler = new InputHandler(this.state);

        // 이벤트 바인딩
        this.bindEvents();

        // 아코디언 초기화
        this.initAccordions();

        // 절단 단가 표시 초기화
        this.updateCutPriceDisplay();

        // Initialization complete
    }

    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        // 계산 버튼
        const calculateBtn = document.getElementById('calculateBtn');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => this.handleCalculate());
        }

        // 새 작업 버튼
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.handleReset());
        }

        // PDF 버튼
        const previewPdfBtn = document.getElementById('previewPdfBtn');
        if (previewPdfBtn) {
            previewPdfBtn.addEventListener('click', () => this.handlePdfPreview());
        }

        const downloadPdfBtn = document.getElementById('downloadPdfBtn');
        if (downloadPdfBtn) {
            downloadPdfBtn.addEventListener('click', () => this.handlePdfDownload());
        }

        // 트리밍 체크박스
        const enableTrim = document.getElementById('enableTrim');
        const trimMargin = document.getElementById('trimMargin');
        if (enableTrim && trimMargin) {
            enableTrim.addEventListener('change', () => {
                trimMargin.disabled = !enableTrim.checked;
            });
        }

        // 나무결 방향 고려 체크박스
        const considerGrain = document.getElementById('considerGrain');
        const partRotatable = document.getElementById('partRotatable');
        if (considerGrain && partRotatable) {
            considerGrain.addEventListener('change', () => {
                if (considerGrain.checked) {
                    // 나무결 고려 시 회전 불가
                    partRotatable.checked = false;
                    partRotatable.disabled = true;
                } else {
                    // 나무결 고려하지 않으면 회전 가능 활성화
                    partRotatable.disabled = false;
                    partRotatable.checked = true;
                }
            });
        }

        // 판재 두께 변경 시 절단 단가 자동 업데이트
        const boardThickness = document.getElementById('boardThickness');
        if (boardThickness) {
            boardThickness.addEventListener('input', () => this.updateCutPriceDisplay());
        }

        // 설정 변경 시 저장
        const settingInputs = [
            'kerfInput', 'enableTrim', 'trimMargin',
            'cutDirection', 'cutMethod', 'optimizationPriority'
        ];

        settingInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.saveSettings());
            }
        });
    }

    /**
     * 아코디언 초기화
     */
    initAccordions() {
        const accordions = document.querySelectorAll('.accordion');
        accordions.forEach(accordion => {
            const header = accordion.querySelector('.accordion-header');
            if (header) {
                header.addEventListener('click', () => {
                    accordion.classList.toggle('open');
                });
            }
        });
    }

    /**
     * 절단 단가 표시 업데이트
     */
    updateCutPriceDisplay() {
        const thicknessInput = document.getElementById('boardThickness');
        const cutPriceDisplay = document.getElementById('autoCutPrice');

        if (!thicknessInput || !cutPriceDisplay) return;

        const thickness = parseFloat(thicknessInput.value) || 18;
        const cutPrice = CostCalculator.getCutPriceByThickness(thickness);
        cutPriceDisplay.textContent = `${cutPrice.toLocaleString('ko-KR')}원/회`;
    }

    /**
     * 설정 저장
     */
    saveSettings() {
        const settings = SettingsManager.readFromUI();
        SettingsManager.save(settings);
        this.state.updateSettings(settings);
    }

    /**
     * 최적화 계산 실행
     */
    async handleCalculate() {
        try {
            // 입력 검증
            if (!this.inputHandler.validateAll()) {
                return;
            }

            // 버튼 비활성화
            const calculateBtn = document.getElementById('calculateBtn');
            const originalText = calculateBtn.textContent;
            calculateBtn.disabled = true;
            calculateBtn.textContent = '계산 중...';

            // 설정 읽기
            const settings = SettingsManager.readFromUI();
            this.state.updateSettings(settings);

            // 패킹 실행
            const packer = new GuillotinePacker(
                this.state.boardSpec.width,
                this.state.boardSpec.height,
                settings.kerf
            );

            const items = this.state.cuttingList.map(part => ({
                width: part.width,
                height: part.height,
                qty: part.qty,
                rotatable: part.rotatable && !this.state.boardSpec.considerGrain
            }));

            const result = packer.pack(items);

            // 배치 실패 확인
            if (result.unplaced.length > 0) {
                alert(`${result.unplaced.length}개의 부품을 배치할 수 없습니다. 부품 크기를 확인하세요.`);
                calculateBtn.disabled = false;
                calculateBtn.textContent = originalText;
                return;
            }

            // 결과 저장
            this.state.setResult(result);

            // 라벨링
            const labeledGroups = LabelingEngine.assignLabels(this.state.cuttingList);
            this.state.setLabeledGroups(labeledGroups);

            // 원가 계산
            const costInfo = CostCalculator.calculate(result.bins, settings);
            this.state.setCostInfo(costInfo);

            // 결과 표시
            this.displayResults();

            // 버튼 복원
            calculateBtn.disabled = false;
            calculateBtn.textContent = originalText;

        } catch (error) {
            console.error('계산 오류:', error);
            alert('계산 중 오류가 발생했습니다: ' + error.message);

            const calculateBtn = document.getElementById('calculateBtn');
            calculateBtn.disabled = false;
            calculateBtn.textContent = '최적화 계산';
        }
    }

    /**
     * 결과 표시
     */
    displayResults() {
        // 빈 상태 숨기기
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('resultContainer').classList.remove('hidden');

        // 원가 정보 표시
        CostCalculator.displayCostInfo(this.state.costInfo);

        // 부품 그룹 표시
        LabelingEngine.displayLabelGroups(this.state.labeledGroups);

        // 캔버스 렌더링
        this.renderCanvases();
    }

    /**
     * 캔버스 렌더링
     */
    renderCanvases() {
        const container = document.getElementById('canvasListContainer');
        if (!container) return;

        container.innerHTML = '';

        const result = this.state.result;
        const labeledGroups = this.state.labeledGroups;

        // 중복 제거
        const uniqueBins = this.removeDuplicateBins(result.bins);

        uniqueBins.forEach((bin, index) => {
            // 캔버스 컨테이너 생성
            const canvasContainer = document.createElement('div');
            canvasContainer.className = 'canvas-container';

            // 헤더
            const header = document.createElement('div');
            header.className = 'canvas-header';
            const title = bin.count > 1 ? `판재 #${index + 1} (×${bin.count}개)` : `판재 #${index + 1}`;
            header.innerHTML = `
                <span class="canvas-title">${title}</span>
                <span class="canvas-info">효율: ${bin.efficiency.toFixed(2)}% | 절단: ${bin.cuttingCount}회</span>
            `;

            // 캔버스 바디
            const body = document.createElement('div');
            body.className = 'canvas-body';

            // 캔버스 생성
            const canvas = document.createElement('canvas');
            canvas.id = `canvas-${index}`;
            canvas.width = 800;
            canvas.height = 800 * (this.state.boardSpec.height / this.state.boardSpec.width);

            body.appendChild(canvas);
            canvasContainer.appendChild(header);
            canvasContainer.appendChild(body);
            container.appendChild(canvasContainer);

            // 렌더링
            this.renderBoard(canvas, bin, labeledGroups);
        });
    }

    /**
     * 중복 판재 제거
     */
    removeDuplicateBins(bins) {
        const uniqueBins = [];
        const patterns = new Map();

        bins.forEach(bin => {
            // 배치 패턴을 문자열로 변환
            const pattern = bin.placed
                .map(p => `${p.x},${p.y},${p.width},${p.height}`)
                .sort()
                .join('|');

            if (patterns.has(pattern)) {
                patterns.get(pattern).count++;
            } else {
                const binWithCount = { ...bin, count: 1 };
                patterns.set(pattern, binWithCount);
                uniqueBins.push(binWithCount);
            }
        });

        return uniqueBins;
    }

    /**
     * 개별 판재 렌더링
     */
    renderBoard(canvas, bin, labeledGroups) {
        const ctx = canvas.getContext('2d');
        const padding = 40;
        const scale = (canvas.width - padding * 2) / this.state.boardSpec.width;

        // 배경
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 판재 외곽선
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            padding,
            padding,
            this.state.boardSpec.width * scale,
            this.state.boardSpec.height * scale
        );

        // 부품 그리기
        bin.placed.forEach(part => {
            const x = padding + part.x * scale;
            const y = padding + part.y * scale;
            const w = part.width * scale;
            const h = part.height * scale;

            // 부품 사각형
            ctx.strokeStyle = '#616161';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, w, h);

            // 라벨 찾기
            const label = LabelingEngine.findLabel(part.width, part.height, labeledGroups);

            // 라벨 텍스트
            ctx.fillStyle = '#212121';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x + w / 2, y + h / 2);

            // 치수 표시 (부품이 충분히 클 때만)
            if (w > 60 && h > 40) {
                ctx.font = '12px monospace';
                ctx.fillStyle = '#616161';
                ctx.fillText(`${part.width}×${part.height}`, x + w / 2, y + h / 2 + 20);
            }
        });
    }

    /**
     * PDF 미리보기
     */
    async handlePdfPreview() {
        try {
            const result = await PDFGenerator.preview(
                this.state,
                this.state.result,
                this.state.costInfo,
                this.state.labeledGroups
            );

            if (!result.success) {
                alert('PDF 미리보기 실패: ' + result.error);
            }
        } catch (error) {
            console.error('PDF 미리보기 오류:', error);
            alert('PDF 미리보기 중 오류가 발생했습니다');
        }
    }

    /**
     * PDF 다운로드
     */
    async handlePdfDownload() {
        try {
            const result = await PDFGenerator.generate(
                this.state,
                this.state.result,
                this.state.costInfo,
                this.state.labeledGroups
            );

            if (result.success) {
                // PDF saving completed
            } else {
                alert('PDF 생성 실패: ' + result.error);
            }
        } catch (error) {
            console.error('PDF 생성 오류:', error);
            alert('PDF 생성 중 오류가 발생했습니다');
        }
    }

    /**
     * 새 작업
     */
    handleReset() {
        if (!confirm('모든 입력 내용이 초기화됩니다. 계속하시겠습니까?')) {
            return;
        }

        // 상태 초기화
        this.state.reset();

        // UI 초기화
        document.getElementById('boardWidth').value = '2440';
        document.getElementById('boardHeight').value = '1220';
        document.getElementById('considerGrain').checked = true;

        // 결과 숨기기
        document.getElementById('resultContainer').classList.add('hidden');
        document.getElementById('emptyState').classList.remove('hidden');

        // New task started
    }
}

// 앱 초기화
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new WoodcutterPC();
    app.init();
});

// 전역 노출 (디버깅용)
window.app = app;
