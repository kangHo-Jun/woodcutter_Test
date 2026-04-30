/**
 * 대산 Ai - 통합 메인 애플리케이션
 * PC/Tablet/Mobile 반응형 지원
 */

class WoodcutterApp {
    constructor() {
        this.state = window.appState;
        this.currentBoardIndex = 0;
        this.zoomLevel = 1;
        this.isMobile = window.innerWidth < 1024;
        this.renderer = null;
        this.groupCanvases = []; // 그룹별 캔버스 저장
    }

    /**
     * 애플리케이션 초기화
     */
    async init() {
        // Unified version init started

        // 설정 불러오기
        if (window.SettingsManager) {
            const savedSettings = SettingsManager.load();
            this.state.updateSettings(savedSettings);
            SettingsManager.applyToUI(savedSettings);
        }

        // 이벤트 바인딩
        this.bindEvents();
        this.bindMobileNav();
        this.initAccordions();

        // 초기 상태 설정
        this.updateCutPriceDisplay();

        // 반응형 체크
        this.checkResponsive();
        window.addEventListener('resize', () => this.checkResponsive());

        // 상태 변경 리스너
        this.state.subscribe('cuttingList', () => this.renderPartsList());

        // Init complete
    }

    /**
     * 반응형 체크
     */
    checkResponsive() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth < 1024;

        if (wasMobile !== this.isMobile) {
            if (!this.isMobile) {
                document.getElementById('leftPanel').classList.remove('active');
                document.getElementById('centerPanel').classList.remove('active');
                document.getElementById('rightPanel').classList.remove('active');
            } else {
                this.switchPanel('left');
            }
        }
    }

    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        // Board inputs
        const boardWidth = document.getElementById('boardWidth');
        const boardHeight = document.getElementById('boardHeight');
        const boardThickness = document.getElementById('boardThickness');
        const considerGrain = document.getElementById('considerGrain');

        if (boardWidth) {
            boardWidth.addEventListener('input', () => this.handleBoardChange());
            boardWidth.addEventListener('blur', () => this.validateBoardWidth());
        }
        if (boardHeight) {
            boardHeight.addEventListener('input', () => this.handleBoardChange());
            boardHeight.addEventListener('blur', () => this.validateBoardHeight());
        }
        if (boardThickness) {
            boardThickness.addEventListener('input', () => this.updateCutPriceDisplay());
        }
        if (considerGrain) {
            considerGrain.addEventListener('change', () => this.handleGrainChange());
        }

        // Part inputs
        const addPartBtn = document.getElementById('addPartBtn');
        const clearPartsBtn = document.getElementById('clearPartsBtn');
        const partWidth = document.getElementById('partWidth');
        const partHeight = document.getElementById('partHeight');
        const partQty = document.getElementById('partQty');

        if (addPartBtn) {
            addPartBtn.addEventListener('click', () => this.handleAddPart());
        }
        if (clearPartsBtn) {
            clearPartsBtn.addEventListener('click', () => this.handleClearParts());
        }

        // Enter key to add part
        [partWidth, partHeight, partQty].forEach(el => {
            if (el) {
                el.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.handleAddPart();
                    }
                });
            }
        });

        // Calculate button
        const calculateBtn = document.getElementById('calculateBtn');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => this.handleCalculate());
        }

        // PDF buttons
        const downloadPdfBtn = document.getElementById('downloadPdfBtn');
        const previewPdfBtn = document.getElementById('previewPdfBtn');
        const shareBtn = document.getElementById('shareBtn');
        if (downloadPdfBtn) {
            downloadPdfBtn.addEventListener('click', () => this.handlePdfDownload());
        }
        if (previewPdfBtn) {
            previewPdfBtn.addEventListener('click', () => this.handlePdfPreview());
        }


        // Header buttons
        const newBtn = document.getElementById('newBtn');
        const saveBtn = document.getElementById('saveBtn');
        const loadBtn = document.getElementById('loadBtn');

        if (newBtn) newBtn.addEventListener('click', () => this.handleNewProject());
        if (saveBtn) saveBtn.addEventListener('click', () => this.handleSaveProject());
        if (loadBtn) loadBtn.addEventListener('click', () => this.handleLoadProject());

        // Trim checkbox
        const enableTrim = document.getElementById('enableTrim');
        const trimMargin = document.getElementById('trimMargin');
        if (enableTrim && trimMargin) {
            enableTrim.addEventListener('change', () => {
                trimMargin.disabled = !enableTrim.checked;
            });
        }

        // Settings auto-save
        const settingInputs = ['kerfInput', 'enableTrim', 'trimMargin', 'cutDirection'];
        settingInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.saveSettings());
            }
        });
    }

    /**
     * 모바일 네비게이션 바인딩
     */
    bindMobileNav() {
        const tabs = document.querySelectorAll('.mobile-nav-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const panel = tab.dataset.panel;
                this.switchPanel(panel);

                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });
    }

    /**
     * 패널 전환 (모바일)
     */
    switchPanel(panel) {
        const leftPanel = document.getElementById('leftPanel');
        const centerPanel = document.getElementById('centerPanel');
        const rightPanel = document.getElementById('rightPanel');

        leftPanel.classList.remove('active');
        centerPanel.classList.remove('active');
        rightPanel.classList.remove('active');

        if (panel === 'left') leftPanel.classList.add('active');
        else if (panel === 'center') centerPanel.classList.add('active');
        else if (panel === 'right') rightPanel.classList.add('active');
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
     * 판재 정보 변경 처리
     */
    handleBoardChange() {
        const width = parseFloat(document.getElementById('boardWidth').value);
        const height = parseFloat(document.getElementById('boardHeight').value);

        if (Validator.isValidNumber(width)) {
            this.state.updateBoardSpec({ width });
        }
        if (Validator.isValidNumber(height)) {
            this.state.updateBoardSpec({ height });
        }
    }

    /**
     * 나무결 옵션 변경
     */
    handleGrainChange() {
        const considerGrain = document.getElementById('considerGrain').checked;
        const partRotatable = document.getElementById('partRotatable');

        this.state.updateBoardSpec({ considerGrain });

        if (partRotatable) {
            if (considerGrain) {
                partRotatable.checked = false;
                partRotatable.disabled = true;
            } else {
                partRotatable.disabled = false;
                partRotatable.checked = true;
                // 나무결 OFF 전환 시 기존 부품 rotatable 동기화
                this.state.cuttingList.forEach(part => { part.rotatable = true; });
                this.state.update('cuttingList', this.state.cuttingList);
            }
        }
    }

    /**
     * 판재 폭 검증
     */
    validateBoardWidth() {
        const input = document.getElementById('boardWidth');
        const result = Validator.validateBoardWidth(input.value);
        if (!result.valid) {
            Validator.showError(input, result.message);
            return false;
        }
        Validator.clearError(input);
        return true;
    }

    /**
     * 판재 높이 검증
     */
    validateBoardHeight() {
        const input = document.getElementById('boardHeight');
        const result = Validator.validateBoardHeight(input.value);
        if (!result.valid) {
            Validator.showError(input, result.message);
            return false;
        }
        Validator.clearError(input);
        return true;
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

        this.state.updateSettings({ cutPrice });
    }

    /**
     * 부품 추가
     */
    handleAddPart() {
        const countCheck = Validator.validatePartCount(this.state.cuttingList);
        if (!countCheck.valid) {
            alert(countCheck.message);
            return;
        }

        const partWidthEl = document.getElementById('partWidth');
        const partHeightEl = document.getElementById('partHeight');
        const partQtyEl = document.getElementById('partQty');
        const partRotatableEl = document.getElementById('partRotatable');

        const width = parseFloat(partWidthEl.value);
        const height = parseFloat(partHeightEl.value);
        const qty = parseInt(partQtyEl.value) || 1;
        const rotatable = partRotatableEl ? partRotatableEl.checked : true;

        // 최솟값(10mm) 및 숫자 여부만 체크 — 판재 상한 체크는 계산 시 수행
        let hasError = false;

        if (!width || width < 10) {
            Validator.showError(partWidthEl, '부품 폭은 10mm 이상이어야 합니다');
            hasError = true;
        } else {
            Validator.clearError(partWidthEl);
        }

        if (!height || height < 10) {
            Validator.showError(partHeightEl, '부품 높이는 10mm 이상이어야 합니다');
            hasError = true;
        } else {
            Validator.clearError(partHeightEl);
        }

        const qtyCheck = Validator.validatePartQty(qty);
        if (!qtyCheck.valid) {
            Validator.showError(partQtyEl, qtyCheck.message);
            hasError = true;
        } else {
            Validator.clearError(partQtyEl);
        }

        if (hasError) return;

        this.state.addPart({ width, height, qty, rotatable });

        partWidthEl.value = '';
        partHeightEl.value = '';
        partQtyEl.value = '1';
        partWidthEl.focus();
    }

    /**
     * 부품 목록 렌더링
     */
    renderPartsList() {
        const tbody = document.getElementById('partsTableBody');
        if (!tbody) return;

        const parts = this.state.cuttingList;

        if (parts.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="4">부품을 추가하세요</td>
                </tr>
            `;
            return;
        }

        const html = parts.map((part, index) => `
            <tr>
                <td contenteditable="true" data-index="${index}" data-field="dimensions" class="editable-cell">${part.width}×${part.height}</td>
                <td contenteditable="true" data-index="${index}" data-field="qty" class="editable-cell">${part.qty}</td>
                <td>${part.rotatable ? 'O' : 'X'}</td>
                <td>
                    <button class="delete-btn" data-index="${index}">삭제</button>
                </td>
            </tr>
        `).join('');

        tbody.innerHTML = html;

        tbody.querySelectorAll('.editable-cell').forEach(cell => {
            cell.addEventListener('focus', (e) => {
                const field = e.target.dataset.field;
                const text = e.target.textContent;
                // 수량은 정수만, 치수는 숫자/소수점/× 허용
                if (field === 'qty') {
                    e.target.textContent = text.replace(/[^0-9]/g, '');
                }
                const range = document.createRange();
                range.selectNodeContents(e.target);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            });

            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
                const field = e.target.dataset.field;
                if (field === 'qty') {
                    if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
                        e.preventDefault();
                    }
                } else if (field === 'dimensions') {
                    // 숫자, 소수점, ×(구분자) 허용
                    if (e.key.length === 1 && !/[0-9.×x\*]/.test(e.key)) {
                        e.preventDefault();
                    }
                }
            });

            cell.addEventListener('blur', (e) => {
                this.handleCellEdit(e.target);
            });
        });

        tbody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removePart(index);
            });
        });
    }

    /**
     * 셀 편집 처리
     */
    handleCellEdit(cell) {
        const index = parseInt(cell.dataset.index);
        const field = cell.dataset.field;

        if (isNaN(index) || index < 0 || index >= this.state.cuttingList.length) {
            this.renderPartsList();
            return;
        }

        const part = this.state.cuttingList[index];

        if (field === 'dimensions') {
            // "300×900" 또는 "300x900" 또는 "300*900" 형식 파싱
            const raw = cell.textContent.trim();
            const parts = raw.split(/[×x\*]/);
            const w = Math.round((parseFloat(parts[0]) || 0) * 10) / 10;
            const h = Math.round((parseFloat(parts[1]) || 0) * 10) / 10;

            if (!w || !h || w < 10 || h < 10) {
                alert('치수 형식이 올바르지 않습니다. 예: 300×900');
                this.renderPartsList();
                return;
            }
            part.width = w;
            part.height = h;
        } else if (field === 'qty') {
            const value = parseInt(cell.textContent.replace(/[^0-9]/g, '')) || 0;
            const validation = Validator.validatePartQty(value);
            if (!validation.valid) {
                alert(validation.message);
                this.renderPartsList();
                return;
            }
            part.qty = value;
        }

        this.state.update('cuttingList', this.state.cuttingList);
    }

    /**
     * 부품 삭제
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
     * 설정 저장
     */
    saveSettings() {
        if (!window.SettingsManager) return;
        const settings = SettingsManager.readFromUI();
        SettingsManager.save(settings);
        this.state.updateSettings(settings);
    }

    /**
     * 최적화 계산
     */
    async handleCalculate() {
        const boardWidthValid = this.validateBoardWidth();
        const boardHeightValid = this.validateBoardHeight();
        const hasParts = this.state.cuttingList.length > 0;

        if (!hasParts) {
            alert('부품을 최소 1개 이상 추가하세요');
            return;
        }

        if (!boardWidthValid || !boardHeightValid) {
            return;
        }

        const calculateBtn = document.getElementById('calculateBtn');
        const originalText = calculateBtn.textContent;
        calculateBtn.disabled = true;
        calculateBtn.textContent = '계산 중...';

        try {
            const settings = window.SettingsManager ? SettingsManager.readFromUI() : this.state.settings;
            this.state.updateSettings(settings);

            const trimEnabled = settings.enableTrim === true;
            const trimMargin = trimEnabled ? (parseFloat(settings.trimMargin) || 0) : 0;
            const effectiveBoardWidth = this.state.boardSpec.width - trimMargin;
            const effectiveBoardHeight = this.state.boardSpec.height;

            if (trimEnabled && (effectiveBoardWidth <= 0 || effectiveBoardHeight <= 0)) {
                throw new Error('전단 여백이 판재 크기보다 큽니다. 여백 값을 확인하세요.');
            }

            const rawW = trimEnabled ? effectiveBoardWidth : this.state.boardSpec.width;
            const rawH = trimEnabled ? effectiveBoardHeight : this.state.boardSpec.height;
            const packerW = rawH; // 길이 = 항상 가로(X축)
            const packerH = rawW; // 폭 = 항상 세로(Y축)
            const packer = new GuillotinePacker(packerW, packerH, settings.kerf);

            const considerGrain = this.state.boardSpec.considerGrain;
            const boardW = trimEnabled ? effectiveBoardWidth : this.state.boardSpec.width;
            const boardH = trimEnabled ? effectiveBoardHeight : this.state.boardSpec.height;
            // 판재의 긴 축/짧은 축 판단
            const boardLongIsX = true; // packerW가 항상 긴 축(길이방향)
            const boardLong  = Math.max(boardW, boardH);
            const boardShort = Math.min(boardW, boardH);

            const items = this.state.cuttingList.map(part => {
                // 나무결 ON: 부품 긴값 → 판재 긴축, 부품 짧은값 → 판재 짧은축
                const pw = considerGrain
                    ? (boardLongIsX ? Math.max(part.width, part.height) : Math.min(part.width, part.height))
                    : (!part.rotatable ? part.height : part.width);
                const ph = considerGrain
                    ? (boardLongIsX ? Math.min(part.width, part.height) : Math.max(part.width, part.height))
                    : (!part.rotatable ? part.width : part.height);
                return {
                    width: pw,
                    height: ph,
                    qty: part.qty,
                    rotatable: part.rotatable && !considerGrain
                };
            });

            // 스왑 후 치수 기준 판재 초과 체크
            const oversized = this.state.cuttingList.filter(part => {
                if (considerGrain || !part.rotatable) {
                    return part.width > boardW || part.height > boardH;
                }
                const normalFit = part.width <= boardW && part.height <= boardH;
                const rotatedFit = part.height <= boardW && part.width <= boardH;
                return !normalFit && !rotatedFit;
            });
            if (oversized.length > 0) {
                calculateBtn.disabled = false;
                calculateBtn.textContent = '최적화 계산';
                alert(`판재 크기를 초과하는 부품이 ${oversized.length}종 있습니다. 치수를 확인하세요.`);
                return;
            }

            // cutDirection: 'horizontal' | 'auto'
            const mode = settings.cutDirection || 'auto';
            const result = packer.pack(items, mode);

            if (result.unplaced.length > 0) {
                alert(`${result.unplaced.length}개의 부품을 배치할 수 없습니다. 부품 크기를 확인하세요.`);
            }

            this.state.setResult(result);

            const labeledGroups = LabelingEngine.assignLabels(this.state.cuttingList);
            this.state.setLabeledGroups(labeledGroups);

            const costInfo = CostCalculator.calculate(result.bins, settings);
            this.state.setCostInfo(costInfo);

            this.displayResults();

            if (this.isMobile) {
                this.switchPanel('center');
                document.querySelectorAll('.mobile-nav-tab').forEach(tab => {
                    tab.classList.remove('active');
                    if (tab.dataset.panel === 'center') {
                        tab.classList.add('active');
                    }
                });
            }

        } catch (error) {
            console.error('계산 오류:', error);
            alert('계산 중 오류가 발생했습니다: ' + error.message);
        }

        calculateBtn.disabled = false;
        calculateBtn.textContent = originalText;
    }

    /**
     * 결과 표시
     */
    displayResults() {
        const emptyState = document.getElementById('emptyState');
        const canvasControlsTop = document.getElementById('canvasControlsTop');
        const canvasScrollContainer = document.getElementById('canvasScrollContainer');

        if (emptyState) emptyState.style.display = 'none';
        if (canvasControlsTop) canvasControlsTop.style.display = 'flex';
        if (canvasScrollContainer) canvasScrollContainer.style.display = 'block';

        // 원가 정보 표시 (총 판재수 추가)
        this.displayCostInfo();

        // 부품 그룹 표시
        LabelingEngine.displayLabelGroups(this.state.labeledGroups);

        // 그룹별 대표 도면 렌더링 (display:block 반영 후 다음 프레임에 실행)
        requestAnimationFrame(() => this.renderGroupCanvases());
    }

    /**
     * 원가 정보 표시 (총 판재수 추가)
     */
    displayCostInfo() {
        const costInfo = this.state.costInfo;
        const result = this.state.result;

        const totalPanelCount = document.getElementById('totalPanelCount');
        const totalCutCount = document.getElementById('totalCutCount');
        const totalCuttingCost = document.getElementById('totalCuttingCost');

        if (totalPanelCount) {
            totalPanelCount.textContent = `${result.bins.length}장`;
        }
        if (totalCutCount) {
            totalCutCount.textContent = `${costInfo.totalCuts}회`;
        }
        if (totalCuttingCost) {
            totalCuttingCost.textContent = `${costInfo.totalCuttingCost.toLocaleString('ko-KR')}원`;
        }
    }

    /**
     * 그룹별 대표 도면 렌더링 (중복 제거)
     */
    renderGroupCanvases() {
        const container = document.getElementById('canvasScrollContainer');
        if (!container) return;

        container.innerHTML = '';
        this.groupCanvases = [];

        const result = this.state.result;
        const labeledGroups = this.state.labeledGroups;

        if (!result || !result.bins || result.bins.length === 0) return;

        // 중복 패턴 제거
        const uniqueBins = this.getUniqueBins(result.bins);

        uniqueBins.forEach((binInfo, index) => {
            const { bin, count } = binInfo;

            // 캔버스 컨테이너 생성
            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'canvas-container';
            canvasWrapper.style.marginBottom = '24px';

            // 헤더
            const header = document.createElement('div');
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, #48BB78 0%, #123628 100%); border-radius: 8px; color: white;';

            const title = count > 1 ? `패턴 ${index + 1} (${count}장 동일)` : `패턴 ${index + 1}`;
            header.innerHTML = `
                <span style="font-weight: 700;">${title}</span>
                <span style="font-size: 13px;">절단: ${bin.cuttingCount}회</span>
            `;

            // 캔버스
            const canvas = document.createElement('canvas');
            canvas.id = `groupCanvas-${index}`;
            canvas.style.cssText = 'width: 100%; border: 2px solid #e0e7ff; border-radius: 8px;';

            const canvasInner = document.createElement('div');
            canvasInner.className = 'canvas-wrapper';
            canvasInner.appendChild(canvas);

            canvasWrapper.appendChild(header);
            canvasWrapper.appendChild(canvasInner);
            container.appendChild(canvasWrapper);

            // 캔버스에 그리기
            this.drawBinToCanvas(canvas, bin, labeledGroups);

            // 저장 (PDF용)
            this.groupCanvases.push({ canvas, bin, count });
        });
    }

    /**
     * 중복 패턴 제거된 bin 목록 반환
     */
    getUniqueBins(bins) {
        const uniqueBins = [];
        const patterns = new Map();

        bins.forEach(bin => {
            const pattern = bin.placed
                .map(p => `${p.x},${p.y},${p.width},${p.height}`)
                .sort()
                .join('|');

            if (patterns.has(pattern)) {
                patterns.get(pattern).count++;
            } else {
                const binInfo = { bin, count: 1 };
                patterns.set(pattern, binInfo);
                uniqueBins.push(binInfo);
            }
        });

        return uniqueBins;
    }

    /**
     * 캔버스에 bin 그리기
     */
    drawBinToCanvas(canvas, bin, labeledGroups) {
        const trimSettings = window.SettingsManager ? SettingsManager.readFromUI() : {};
        const trimEnabled = trimSettings.enableTrim === true;
        const trimMargin = trimEnabled ? (parseFloat(trimSettings.trimMargin) || 0) : 0;
        const boardWidth = this.state.boardSpec.width - trimMargin;
        const boardHeight = this.state.boardSpec.height;
        const isPortraitBoard = false;
        const renderBoardWidth = boardHeight;  // 길이 = 가로
        const renderBoardHeight = boardWidth;  // 폭 = 세로
        const maxWidth = 700;
        const padding = 50;
        const drawScale = (maxWidth - padding * 2) / renderBoardWidth;

        canvas.width = maxWidth;
        canvas.height = renderBoardHeight * drawScale + padding * 2;

        const ctx = canvas.getContext('2d');

        // 배경
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 판재 배경
        ctx.fillStyle = '#E5C49F';
        ctx.fillRect(padding, padding, renderBoardWidth * drawScale, renderBoardHeight * drawScale);



        ctx.strokeStyle = '#4a3424';
        ctx.lineWidth = 2;
        ctx.strokeRect(padding, padding, renderBoardWidth * drawScale, renderBoardHeight * drawScale);

        // === 장별 부품 개수 계산 ===
        const partCounts = {};
        bin.placed.forEach((part) => {
            const label = LabelingEngine.findLabel(part.width, part.height, labeledGroups);
            if (!partCounts[label]) {
                partCounts[label] = 0;
            }
            partCounts[label]++;
        });



        // === 라벨별 첫 번째 부품 찾기 (치수 표시용) ===
        const labelFirstPart = {};
        bin.placed.forEach((part, index) => {
            const label = LabelingEngine.findLabel(part.width, part.height, labeledGroups);
            if (labelFirstPart[label] === undefined) {
                labelFirstPart[label] = index;  // 첫 번째만 기록
            }
        });

        // 절단선 표시 (cutDetails 기반)
        const bin_cutDetails = bin.cutDetails || [];
        const cutPlaced = bin.placed || [];
        const isCutAlignedWithPlaced = (cut) => {
            const pos = Math.round(cut.pos);
            return cutPlaced.some(part => {
                if (cut.axis === 'Y') {
                    const edgeTop = Math.round(part.y);
                    const edgeBottom = Math.round(part.y + part.height);
                    const overlaps = cut.spanEnd > part.x && cut.spanStart < part.x + part.width;
                    return overlaps && (pos === edgeTop || pos === edgeBottom);
                }
                const edgeLeft = Math.round(part.x);
                const edgeRight = Math.round(part.x + part.width);
                const overlaps = cut.spanEnd > part.y && cut.spanStart < part.y + part.height;
                return overlaps && (pos === edgeLeft || pos === edgeRight);
            });
        };
        // 중복 제거: 같은 axis+pos면 span 짧은 것 우선
        const cutMap = new Map();
        bin_cutDetails.forEach(c => {
            if (!isCutAlignedWithPlaced(c)) return;
            const key = `${c.axis}_${Math.round(c.pos)}`;
            if (!cutMap.has(key)) {
                cutMap.set(key, c);
            } else {
                const existing = cutMap.get(key);
                const existingSpan = existing.spanEnd - existing.spanStart;
                const newSpan = c.spanEnd - c.spanStart;
                if (newSpan < existingSpan) {
                    cutMap.set(key, c);
                }
            }
        });
        const uniqueCuts = Array.from(cutMap.values());

        // 절단선 그리기
        uniqueCuts.forEach(cut => {
            const spanLength = cut.spanEnd - cut.spanStart;
            if (spanLength < 50) return;
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 0.8;
            ctx.setLineDash([4, 3]);
            if (cut.axis === 'X') {
                const cx = cut.pos * drawScale;
                ctx.moveTo(padding + cx, padding + cut.spanStart * drawScale);
                ctx.lineTo(padding + cx, padding + cut.spanEnd * drawScale);
            } else {
                const cy = cut.pos * drawScale;
                ctx.moveTo(padding + cut.spanStart * drawScale, padding + cy);
                ctx.lineTo(padding + cut.spanEnd * drawScale, padding + cy);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        });

        const renderedPlaced = bin.placed.map(part => ({
            source: part,
            x: part.x,
            y: part.y,
            width: part.width,
            height: part.height
        }));

        // 부품 그리기
        renderedPlaced.forEach((part, index) => {
            const x = padding + part.x * drawScale;
            const y = padding + part.y * drawScale;
            const w = part.width * drawScale;
            const h = part.height * drawScale;
            const label = LabelingEngine.findLabel(part.width, part.height, labeledGroups);

            // 부품 배경
            const PART_COLORS = [
                '#DBEAFE', // A - 연파랑
                '#DCFCE7', // B - 연초록
                '#FEF9C3', // C - 연노랑
                '#FFEDD5', // D - 연주황
                '#F3E8FF', // E - 연보라
                '#FCE7F3', // F - 연핑크
                '#E0F2FE', // G - 하늘
                '#ECFDF5', // H - 민트
            ];

            const labelIndex = label ? label.charCodeAt(0) - 65 : 0;
            const partColor = PART_COLORS[labelIndex % PART_COLORS.length] || '#FFFFFF';
            ctx.fillStyle = partColor;
            ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

            // 절단선 (부품 테두리 = 절단선)
            ctx.strokeStyle = '#2D3748';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, w, h);

            // 라벨
            const FONT_NORMAL = 11;
            const FONT_SMALL = 7;

            // 치수 표시 조건: 실제 크기 50mm 이상
            const showW = part.width >= 50;
            const showH = part.height >= 50;

            // 가로 치수 (상단 중앙)
            if (showW) {
                const text = `${part.width}`;
                // NORMAL 크기로 들어가는지 확인
                ctx.font = `${FONT_NORMAL}px "Noto Sans KR", sans-serif`;
                const textW = ctx.measureText(text).width;
                let fontSize = FONT_NORMAL;
                if (textW > w - 4) {
                    fontSize = FONT_SMALL;
                    ctx.font = `${FONT_SMALL}px "Noto Sans KR", sans-serif`;
                    const smallW = ctx.measureText(text).width;
                    if (smallW > w - 2) fontSize = 0; // 생략
                }
                if (fontSize > 0) {
                    ctx.font = `${fontSize}px "Noto Sans KR", sans-serif`;
                    ctx.fillStyle = '#2B6CB0';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(text, x + w / 2, y + 3);
                }
            }

            // 세로 치수 (좌측 중앙, 90도 회전)
            if (showH) {
                const text = `${part.height}`;
                ctx.save();
                ctx.translate(x + 10, y + h / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.font = `${FONT_NORMAL}px "Noto Sans KR", sans-serif`;
                const textW = ctx.measureText(text).width;
                let fontSize = FONT_NORMAL;
                if (textW > h - 4) {
                    fontSize = FONT_SMALL;
                    ctx.font = `${FONT_SMALL}px "Noto Sans KR", sans-serif`;
                    const smallW = ctx.measureText(text).width;
                    if (smallW > h - 2) fontSize = 0;
                }
                if (fontSize > 0) {
                    ctx.font = `${fontSize}px "Noto Sans KR", sans-serif`;
                    ctx.fillStyle = '#2B6CB0';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(text, 0, 0);
                }
                ctx.restore();
            }

            // 라벨을 부품 우측 상단에 표시
            const LABEL_NORMAL = 11;
            const LABEL_SMALL = 7;

            // 라벨 폰트 크기 결정 (부품 안에 들어가는 크기)
            let labelSize = LABEL_NORMAL;
            ctx.font = `bold ${LABEL_NORMAL}px "Noto Sans KR", sans-serif`;
            const labelW = ctx.measureText(label).width;
            if (labelW > w - 4 || LABEL_NORMAL > h - 2) {
                labelSize = LABEL_SMALL;
            }

            ctx.font = `bold ${labelSize}px "Noto Sans KR", sans-serif`;
            ctx.fillStyle = '#1A202C';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText(label, x + w - 3, y + 3);
        });

        // === 부품 위 워터마크 추가 (설정 연동) ===
        const settings = window.SettingsManager ? SettingsManager.readFromUI() : { enableWatermark: true };
        if (settings.enableWatermark !== false) {
            ctx.save();
            // 판재 영역으로 클리핑
            ctx.beginPath();
            ctx.rect(padding, padding, renderBoardWidth * drawScale, renderBoardHeight * drawScale);
            ctx.clip();

            ctx.font = 'bold 18px "Inter", sans-serif';
            ctx.fillStyle = 'rgba(51, 65, 85, 0.08)';
            ctx.textAlign = 'center';

            const spacingX = 220;
            const spacingY = 150;
            const angle = -Math.PI / 6;

            for (let y = padding - spacingY; y < padding + renderBoardHeight * drawScale + spacingY; y += spacingY) {
                for (let x = padding - spacingX; x < padding + renderBoardWidth * drawScale + spacingX; x += spacingX) {
                    ctx.save();
                    const offsetX = (Math.floor(y / spacingY) % 2 === 0) ? spacingX / 2 : 0;
                    ctx.translate(x + offsetX, y);
                    ctx.rotate(angle);
                    ctx.fillText('DAESAN AI', 0, 0);
                    ctx.restore();
                }
            }
            ctx.restore();
        }

        // 판재 치수 표시
        ctx.fillStyle = '#333';
        ctx.font = '14px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${boardHeight} mm`, padding + (renderBoardWidth * drawScale) / 2, padding - 20);

        ctx.save();
        ctx.translate(padding - 25, padding + (renderBoardHeight * drawScale) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${boardWidth} mm`, 0, 0);
        ctx.restore();

        // === 잔여 영역 치수 표시 (freeRects 기반) ===
        const MIN_AREA = 20000; // 20,000mm² 이상만 표시
        const displayFreeRects = this.buildDisplayFreeRects(renderedPlaced, renderBoardWidth, renderBoardHeight);

        displayFreeRects.forEach(rect => {
            // packer 기준: x=길이방향, y=폭방향
            // 렌더링 기준: x=길이방향(가로), y=폭방향(세로)
            const rw = rect.width;
            const rh = rect.height;
            const rx = rect.x;
            const ry = rect.y;

            // 면적 조건
            if (rw * rh < MIN_AREA) return;

            const rxPx = padding + rx * drawScale;
            const ryPx = padding + ry * drawScale;
            const rwPx = rw * drawScale;
            const rhPx = rh * drawScale;

            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.font = 'bold 13px "Noto Sans KR", sans-serif';

            // 가로 치수 (상단 중앙)
            if (rw >= 50) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(`${Math.round(rw)}`, rxPx + rwPx / 2, ryPx + 4);
            }

            // 세로 치수 (좌측 중앙, 90도 회전)
            if (rh >= 50) {
                ctx.save();
                ctx.translate(rxPx + 12, ryPx + rhPx / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${Math.round(rh)}`, 0, 0);
                ctx.restore();
            }
        });
    }

    buildDisplayFreeRects(placed, boardWidth, boardHeight) {
        const xEdges = new Set([0, boardWidth]);
        const yEdges = new Set([0, boardHeight]);

        placed.forEach(part => {
            xEdges.add(part.x);
            xEdges.add(part.x + part.width);
            yEdges.add(part.y);
            yEdges.add(part.y + part.height);
        });

        const xs = Array.from(xEdges).sort((a, b) => a - b);
        const ys = Array.from(yEdges).sort((a, b) => a - b);
        const freeRects = [];

        for (let yi = 0; yi < ys.length - 1; yi++) {
            const y0 = ys[yi];
            const y1 = ys[yi + 1];
            const h = y1 - y0;
            if (h <= 0) continue;

            let current = null;
            for (let xi = 0; xi < xs.length - 1; xi++) {
                const x0 = xs[xi];
                const x1 = xs[xi + 1];
                const w = x1 - x0;
                if (w <= 0) continue;

                const cx = x0 + w / 2;
                const cy = y0 + h / 2;
                const occupied = placed.some(part =>
                    cx >= part.x && cx <= part.x + part.width &&
                    cy >= part.y && cy <= part.y + part.height
                );

                if (occupied) {
                    if (current) {
                        freeRects.push(current);
                        current = null;
                    }
                    continue;
                }

                if (current) {
                    current.width += w;
                } else {
                    current = { x: x0, y: y0, width: w, height: h };
                }
            }

            if (current) {
                freeRects.push(current);
            }
        }

        return freeRects;
    }

    getAxisMinResiduals(bin, boardWidth, boardHeight) {
        const freeRects = this.buildFreeRects(bin, boardWidth, boardHeight);
        const kerf = (this.state && this.state.settings && Number.isFinite(this.state.settings.kerf))
            ? this.state.settings.kerf
            : 0;
        const minMeaningful = Math.max(1, kerf + 0.01);

        const widthCandidates = freeRects
            .map(rect => rect.width)
            .filter(v => v > minMeaningful);
        const heightCandidates = freeRects
            .map(rect => rect.height)
            .filter(v => v > minMeaningful);

        return {
            minWidth: widthCandidates.length > 0 ? Math.min(...widthCandidates) : 0,
            minHeight: heightCandidates.length > 0 ? Math.min(...heightCandidates) : 0
        };
    }

    buildFreeRects(bin, boardWidth, boardHeight) {
        const xEdges = new Set([0, boardWidth]);
        const yEdges = new Set([0, boardHeight]);
        const placed = bin.placed || [];

        placed.forEach(part => {
            xEdges.add(part.x);
            xEdges.add(part.x + part.width);
            yEdges.add(part.y);
            yEdges.add(part.y + part.height);
        });

        const xs = Array.from(xEdges).sort((a, b) => a - b);
        const ys = Array.from(yEdges).sort((a, b) => a - b);
        const freeRects = [];

        for (let yi = 0; yi < ys.length - 1; yi++) {
            const y0 = ys[yi];
            const y1 = ys[yi + 1];
            const h = y1 - y0;
            if (h <= 0) continue;

            for (let xi = 0; xi < xs.length - 1; xi++) {
                const x0 = xs[xi];
                const x1 = xs[xi + 1];
                const w = x1 - x0;
                if (w <= 0) continue;

                const cx = x0 + w / 2;
                const cy = y0 + h / 2;
                const occupied = placed.some(part =>
                    cx >= part.x && cx <= part.x + part.width &&
                    cy >= part.y && cy <= part.y + part.height
                );
                if (!occupied) {
                    freeRects.push({ x: x0, y: y0, width: w, height: h });
                }
            }
        }

        return freeRects;
    }

    /**
     * PDF 미리보기
     */
    async handlePdfPreview() {
        if (!this.state.result) {
            alert('먼저 최적화 계산을 실행하세요');
            return;
        }

        try {
            const pdfBlob = await this.generatePdfBlob();
            const url = URL.createObjectURL(pdfBlob);
            window.open(url, '_blank');
        } catch (error) {
            console.error('PDF 미리보기 오류:', error);
            alert('PDF 미리보기 중 오류가 발생했습니다');
        }
    }

    /**
     * PDF 다운로드
     */
    async handlePdfDownload() {
        if (!this.state.result) {
            alert('먼저 최적화 계산을 실행하세요');
            return;
        }

        try {
            const pdfBlob = await this.generatePdfBlob();
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date();
            const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
            a.download = `재단계획_${dateStr}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            // PDF download completed
        } catch (error) {
            console.error('PDF 생성 오류:', error);
            alert('PDF 생성 중 오류가 발생했습니다');
        }
    }

    /**
     * PDF Blob 생성 (모든 페이지 Canvas 이미지 방식)
     */
    async generatePdfBlob() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // Page 1: 요약표 (Canvas 이미지)
        await this.addSummaryPageAsImage(doc);

        // Page 2~: 그룹별 대표 도면 (Canvas 이미지)
        for (let i = 0; i < this.groupCanvases.length; i++) {
            doc.addPage();
            await this.addDiagramPageAsImage(doc, i);
        }

        return doc.output('blob');
    }

    /**
     * 요약 페이지를 Canvas 이미지로 추가
     */
    async addSummaryPageAsImage(doc) {
        const canvas = document.createElement('canvas');
        canvas.width = 794;
        canvas.height = 1123;
        const ctx = canvas.getContext('2d');

        // 배경
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let y = 60;
        const margin = 60;

        // 제목
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 32px "Noto Sans KR", sans-serif';
        ctx.fillText('재단 계획서', margin, y);
        y += 50;

        // 생성 일시
        ctx.font = '16px "Noto Sans KR", sans-serif';
        const now = new Date();
        ctx.fillText(`생성일시: ${now.toLocaleString('ko-KR')}`, margin, y);
        y += 60;

        // 판재 정보
        ctx.font = 'bold 24px "Noto Sans KR", sans-serif';
        ctx.fillText('판재 정보', margin, y);
        y += 35;

        ctx.font = '18px "Noto Sans KR", sans-serif';
        ctx.fillText(`크기: ${this.state.boardSpec.width} × ${this.state.boardSpec.height} mm`, margin + 20, y);
        y += 30;
        ctx.fillText(`결 고려: ${this.state.boardSpec.considerGrain ? '예' : '아니오'}`, margin + 20, y);
        y += 50;

        // 최적화 결과
        ctx.font = 'bold 24px "Noto Sans KR", sans-serif';
        ctx.fillText('최적화 결과', margin, y);
        y += 35;

        const costInfo = this.state.costInfo;
        const result = this.state.result;
        ctx.font = '18px "Noto Sans KR", sans-serif';
        ctx.fillText(`총 판재수: ${result.bins.length}장`, margin + 20, y);
        y += 30;
        ctx.fillText(`재단 횟수: ${costInfo.totalCuts}회`, margin + 20, y);
        y += 30;
        ctx.fillText(`총 재단비: ${costInfo.totalCuttingCost.toLocaleString('ko-KR')}원`, margin + 20, y);
        y += 50;

        // 부품 요약
        ctx.font = 'bold 24px "Noto Sans KR", sans-serif';
        ctx.fillText('부품 요약', margin, y);
        y += 35;

        ctx.font = '18px "Noto Sans KR", sans-serif';
        const labeledGroups = this.state.labeledGroups;
        if (labeledGroups && labeledGroups.length > 0) {
            labeledGroups.forEach(group => {
                const infoText = `${group.label}: ${group.width}×${group.height}mm - `;
                const qtyText = `(${group.count}개)`;

                // 기본 정보 (Normal)
                ctx.font = '18px "Noto Sans KR", sans-serif';
                ctx.fillText(infoText, margin + 20, y);

                // 수량 정보 (Bold + 괄호)
                const infoWidth = ctx.measureText(infoText).width;
                ctx.font = 'bold 18px "Noto Sans KR", sans-serif';
                ctx.fillText(qtyText, margin + 20 + infoWidth, y);

                y += 28;
            });
        }

        // PDF에 추가
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
    }

    /**
     * 도면 페이지를 Canvas 이미지로 추가 (세로 회전)
     */
    async addDiagramPageAsImage(doc, index) {
        const { canvas, bin, count } = this.groupCanvases[index];

        // 새 캔버스에 한글 텍스트 포함하여 렌더링 (A4 세로)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 794;   // A4 폭
        tempCanvas.height = 1123; // A4 높이
        const ctx = tempCanvas.getContext('2d');

        // 배경
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        const margin = 40;

        // 텍스트 정보 준비 (나중에 회전하여 배치)
        const title = count > 1 ? `패턴 ${index + 1} (${count}장 동일)` : `패턴 ${index + 1}`;
        const settings = window.SettingsManager ? SettingsManager.readFromUI() : { enableTrim: true };
        const trimStatus = settings.enableTrim ? '전단(O)' : '전단(X)';
        const cutInfo = `절단: ${bin.cuttingCount}회  |  ${trimStatus}`;

        // 부품 사이즈와 개수 계산
        const labeledGroups = this.state.labeledGroups || [];
        const partCounts = {};
        bin.placed.forEach(part => {
            const label = window.LabelingEngine ? LabelingEngine.findLabel(part.width, part.height, labeledGroups) : '?';
            if (!partCounts[label]) {
                partCounts[label] = { width: part.width, height: part.height, count: 0 };
            }
            partCounts[label].count++;
        });
        const partsInfo = Object.entries(partCounts)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([label, info]) => `${label}: ${info.width}×${info.height} (${info.count}개)`)
            .join('  ');

        // 도면 배치 계산 (전체 캔버스 사용)
        const availableWidth = tempCanvas.width - margin * 2;
        const availableHeight = tempCanvas.height - margin * 2;

        // 회전 후 캔버스 크기 (원본의 가로/세로 교체)
        const rotatedWidth = canvas.height;
        const rotatedHeight = canvas.width;

        // 스케일 계산 (회전된 이미지가 가용 공간에 맞도록)
        const scaleX = availableWidth / rotatedWidth;
        const scaleY = availableHeight / rotatedHeight;
        const scale = Math.min(scaleX, scaleY);

        const drawWidth = rotatedWidth * scale;
        const drawHeight = rotatedHeight * scale;

        // 중앙 정렬을 위한 오프셋
        const offsetX = margin + (availableWidth - drawWidth) / 2;
        const offsetY = margin + (availableHeight - drawHeight) / 2;

        // 캔버스 회전 및 그리기 (-90도 회전으로 세로 방향 출력)
        ctx.save();
        ctx.translate(offsetX + drawWidth / 2, offsetY + drawHeight / 2);
        ctx.rotate(-Math.PI / 2);  // -90도 회전 (시계 방향)
        ctx.drawImage(
            canvas,
            -canvas.width * scale / 2,
            -canvas.height * scale / 2,
            canvas.width * scale,
            canvas.height * scale
        );
        ctx.restore();

        // 텍스트 정보를 도면 좌측 상단에 -90도 회전하여 배치
        ctx.save();
        ctx.fillStyle = '#333333';

        // 텍스트 시작 위치 (도면 좌측 상단 빈 공간)
        const textX = offsetX - 45;  // 도면 왼쪽 외부에 배치 (겹치지 않도록)
        const textY = offsetY + drawHeight - 60;  // 텍스트 끝이 도면 상단을 넘지 않도록

        // -90도 회전 (도면과 같은 방향)
        ctx.translate(textX, textY);
        ctx.rotate(-Math.PI / 2);

        // 제목
        ctx.font = 'bold 28px "Noto Sans KR", sans-serif';
        ctx.fillText(title, 0, 0);

        // 절단 정보
        ctx.font = '16px "Noto Sans KR", sans-serif';
        ctx.fillText(cutInfo, 0, 30);

        // 부품 정보
        ctx.fillText(partsInfo, 0, 50);

        ctx.restore();

        // PDF에 추가
        const imgData = tempCanvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
    }

    /**
     * 새 프로젝트
     */
    handleNewProject() {
        if (confirm('새 프로젝트를 시작하시겠습니까?\n현재 작업 내용이 삭제됩니다.')) {
            this.state.reset();

            document.getElementById('boardWidth').value = '1220';
            document.getElementById('boardHeight').value = '2440';
            document.getElementById('boardThickness').value = '18';
            document.getElementById('considerGrain').checked = false;
            document.getElementById('enableTrim').checked = true;

            this.renderPartsList();

            // UI 초기화
            const emptyState = document.getElementById('emptyState');
            const canvasControlsTop = document.getElementById('canvasControlsTop');
            const canvasScrollContainer = document.getElementById('canvasScrollContainer');

            if (emptyState) emptyState.style.display = 'block';
            if (canvasControlsTop) canvasControlsTop.style.display = 'none';
            if (canvasScrollContainer) {
                canvasScrollContainer.style.display = 'none';
                canvasScrollContainer.innerHTML = '';
            }

            // 결과 초기화
            document.getElementById('totalPanelCount').textContent = '-';
            document.getElementById('totalCutCount').textContent = '-';
            document.getElementById('totalCuttingCost').textContent = '-';
            const materialUsageRate = document.getElementById('materialUsageRate');
            if (materialUsageRate) materialUsageRate.textContent = '-';

            const labelGroupsList = document.getElementById('labelGroupsList');
            if (labelGroupsList) {
                labelGroupsList.innerHTML = '<p class="empty-state-text text-center" style="padding: 20px;">계산을 실행하면 결과가 표시됩니다</p>';
            }

            const boardNavSection = document.getElementById('boardNavSection');
            if (boardNavSection) boardNavSection.classList.add('hidden');

            this.groupCanvases = [];

            const calculateBtn = document.getElementById('calculateBtn');
            if (calculateBtn) calculateBtn.disabled = false;

            // New project started
        }
    }

    /**
     * 프로젝트 저장
     */
    handleSaveProject() {
        const project = {
            boardWidth: document.getElementById('boardWidth').value,
            boardHeight: document.getElementById('boardHeight').value,
            boardThickness: document.getElementById('boardThickness').value,
            considerGrain: document.getElementById('considerGrain').checked,
            parts: this.state.cuttingList,
            settings: this.state.settings
        };

        const json = JSON.stringify(project, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `대산Ai_프로젝트_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * 프로젝트 불러오기
     */
    handleLoadProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const project = JSON.parse(event.target.result);

                    document.getElementById('boardWidth').value = project.boardWidth;
                    document.getElementById('boardHeight').value = project.boardHeight;
                    document.getElementById('boardThickness').value = project.boardThickness || '18';
                    document.getElementById('considerGrain').checked = project.considerGrain;

                    this.state.updateBoardSpec({
                        width: parseFloat(project.boardWidth),
                        height: parseFloat(project.boardHeight),
                        considerGrain: project.considerGrain
                    });

                    this.state.cuttingList = project.parts || [];
                    this.state.update('cuttingList', this.state.cuttingList);

                    if (project.settings) {
                        this.state.updateSettings(project.settings);
                        if (window.SettingsManager) {
                            SettingsManager.applyToUI(project.settings);
                        }
                    }

                    this.updateCutPriceDisplay();
                    alert('프로젝트를 불러왔습니다!');

                } catch (err) {
                    console.error('파일 읽기 오류:', err);
                    alert('파일을 읽는 중 오류가 발생했습니다.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
}

// 앱 초기화
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new WoodcutterApp();
    app.init();
});

// 전역 노출
window.app = app;
