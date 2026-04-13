/**
 * 대장간 V3 - Mobile-First App Logic
 */

/* Removed WheelSelector class */

class CuttingAppMobile {
    constructor() {
        this.currentStep = 1;
        this.currentField = 'boardWidth'; // Start with board width
        this.inputValues = {
            boardWidth: '2440',
            boardHeight: '1220',
            width: '0',
            height: '0',
            qty: '0'
        };
        this.parts = [];
        this.kerf = 4.2; // Optimized blade size
        this.lastResult = null;
        this.currentBoardIndex = 0;
        this.renderer = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateStepIndicator();
    }


    bindEvents() {
        // Logo Navigation (Go to Step 1)
        document.querySelector('.logo')?.addEventListener('click', () => this.goToStep(1));

        // Step Tab Navigation
        document.querySelectorAll('.step-indicator .step').forEach(step => {
            step.addEventListener('click', (e) => {
                const targetStep = parseInt(e.currentTarget.dataset.step);
                if (targetStep === 3 && this.parts.length === 0) {
                    this.showToast('부품을 먼저 추가해주세요', 'error');
                    return;
                }
                this.goToStep(targetStep);
            });
        });

        // Step Navigation Buttons
        document.getElementById('toStep2Btn')?.addEventListener('click', () => this.goToStep(2));
        document.getElementById('toStep1Btn')?.addEventListener('click', () => this.goToStep(1));
        document.getElementById('backToInputBtn')?.addEventListener('click', () => this.goToStep(2));

        // Board Selection (Step 1)
        document.querySelectorAll('[data-board-field]').forEach(field => {
            field.addEventListener('click', (e) => this.selectField(e.currentTarget.dataset.boardField, true, true));
        });

        // Compact Input Boxes (Step 2)
        document.querySelectorAll('.input-box-compact[data-field]').forEach(box => {
            box.addEventListener('click', (e) => {
                this.selectField(e.currentTarget.dataset.field, false, true);
            });
        });

        // Grain Toggle (Step 2)
        document.getElementById('grainToggle')?.addEventListener('click', () => this.toggleGrain());

        // Keypad Keys (with haptic feedback)
        document.querySelectorAll('.key').forEach(key => {
            key.addEventListener('click', (e) => {
                this.haptic('light');
                this.handleKeyPress(e.currentTarget.dataset.key);
            });
        });

        // Keypad Done Button
        document.getElementById('keypadDone')?.addEventListener('click', () => this.setKeypadVisibility(false));
        document.getElementById('keypadOverlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'keypadOverlay') this.setKeypadVisibility(false);
        });

        // Calculate
        document.getElementById('calculateBtn')?.addEventListener('click', () => this.calculate());

        // Clear All Parts
        document.getElementById('clearAllBtn')?.addEventListener('click', () => this.clearParts());

        // Board Navigation
        document.getElementById('prevBoard')?.addEventListener('click', () => this.navigateBoard(-1));
        document.getElementById('nextBoard')?.addEventListener('click', () => this.navigateBoard(1));

        // PDF Preview Modal
        document.getElementById('downloadPdfBtn')?.addEventListener('click', () => this.openPdfModal());
        document.getElementById('pdfCloseBtn')?.addEventListener('click', () => this.closePdfModal());
        document.getElementById('pdfDownloadBtn')?.addEventListener('click', () => this.downloadPDF());
        document.getElementById('pdfShareBtn')?.addEventListener('click', () => this.share());
        document.getElementById('pdfModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'pdfModal') this.closePdfModal();
        });

        // Share
        document.getElementById('shareBtn')?.addEventListener('click', () => this.share());

        // Step 1: Settings Sync
        ['boardWidth', 'boardHeight', 'boardThickness', 'kerfInput'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this.updateSettingsSummary());
        });

        // Step 2: Add Part Button
        document.getElementById('addPartBtn')?.addEventListener('click', () => this.addPart());

        // UI2: Zoom Controls
        this.initZoomHandlers();
    }

    initZoomHandlers() {
        const wrapper = document.querySelector('.result-canvas-wrapper');
        const zoomLevelEl = document.getElementById('zoomLevel');
        if (!wrapper) return;

        // Interaction state
        let isDragging = false;
        let lastX, lastY;
        let initialDistance = null;
        let lastTouchTime = 0;

        const handleZoom = (delta, centerX, centerY) => {
            if (!this.renderer) return;
            const prevZoom = this.renderer.zoom;
            // Limit zoom between 0.5x and 10x
            this.renderer.zoom = Math.min(Math.max(0.5, this.renderer.zoom + delta), 10);

            if (prevZoom !== this.renderer.zoom) {
                // Adjust offsets to zoom relative to cursor/center
                // (Optional but feels better. For now, simple zoom is fine)
                this.updateZoomUI();
                this.renderResult();
            }
        };

        // Buttons
        document.getElementById('zoomIn')?.addEventListener('click', () => handleZoom(0.5));
        document.getElementById('zoomOut')?.addEventListener('click', () => handleZoom(-0.5));

        // Wheel Zoom
        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.2 : -0.2;
            handleZoom(delta);
        }, { passive: false });

        // Mouse Pan
        wrapper.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.renderer) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            this.renderer.offsetX += dx;
            this.renderer.offsetY += dy;
            lastX = e.clientX;
            lastY = e.clientY;
            this.renderResult();
        });

        window.addEventListener('mouseup', () => isDragging = false);

        // Touch Gestures (Pinch & Pan)
        wrapper.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;

                // Double Tap Check
                const now = Date.now();
                if (now - lastTouchTime < 300) {
                    // Toggle Zoom (1.0 <-> 3.0)
                    this.renderer.zoom = this.renderer.zoom > 1.5 ? 1.0 : 3.0;
                    this.renderer.offsetX = 0;
                    this.renderer.offsetY = 0;
                    this.updateZoomUI();
                    this.renderResult();
                }
                lastTouchTime = now;
            } else if (e.touches.length === 2) {
                isDragging = false;
                initialDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        }, { passive: true });

        wrapper.addEventListener('touchmove', (e) => {
            if (!this.renderer) return;
            if (e.touches.length === 1 && isDragging) {
                const dx = e.touches[0].clientX - lastX;
                const dy = e.touches[0].clientY - lastY;
                this.renderer.offsetX += dx;
                this.renderer.offsetY += dy;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
                this.renderResult();
            } else if (e.touches.length === 2 && initialDistance !== null) {
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = (currentDistance - initialDistance) * 0.01;
                handleZoom(delta);
                initialDistance = currentDistance;
            }
        }, { passive: true });

        wrapper.addEventListener('touchend', () => {
            isDragging = false;
            initialDistance = null;
        });
    }

    updateZoomUI() {
        const zoomLevelEl = document.getElementById('zoomLevel');
        if (zoomLevelEl && this.renderer) {
            zoomLevelEl.textContent = `${Math.round(this.renderer.zoom * 100)}%`;
        }
    }

    // ============================================
    // Step Navigation
    // ============================================

    goToStep(step) {
        const prevStep = this.currentStep;
        this.currentStep = step;

        // Update screen visibility
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active', 'prev');
        });

        const targetScreen = document.getElementById(`step${step}`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        // Mark previous screens
        for (let i = 1; i < step; i++) {
            const prevScreen = document.getElementById(`step${i}`);
            if (prevScreen) prevScreen.classList.add('prev');
        }

        this.updateStepIndicator();

        // Initialize Step 1: Hide keypad initially
        if (step === 1) {
            this.setKeypadVisibility(false);
            document.querySelectorAll('.input-field').forEach(f => f.classList.remove('active'));
            this.currentField = 'boardWidth';
        }

        // Initialize Step 2 from Step 1
        if (step === 2 && prevStep === 1) {
            this.resetInputFields();
        }

        // Initialize Step 2 from Step 3 (No reset, just hide keypad)
        if (step === 2 && prevStep === 3) {
            this.setKeypadVisibility(false);
            document.querySelectorAll('.input-box-compact').forEach(f => f.classList.remove('active'));
        }

        if (step === 2) {
            this.updateGrainUI();
        }

        // Initialize Step 3: Hide keypad
        if (step === 3) {
            this.setKeypadVisibility(false);
        }
    }

    updateStepIndicator() {
        document.querySelectorAll('.step-indicator .step').forEach((stepEl, index) => {
            const stepNum = index + 1;
            stepEl.classList.remove('active', 'done');
            if (stepNum === this.currentStep) {
                stepEl.classList.add('active');
            } else if (stepNum < this.currentStep) {
                stepEl.classList.add('done');
            }
        });
    }

    changeQty(delta) {
        let current = parseInt(this.inputValues.qty) || 1;
        current += delta;
        if (current < 1) current = 1;
        if (current > 100) current = 100;
        this.inputValues.qty = String(current);
        this.updateInputField('qty', current);
    }

    updateSettingsSummary() {
        const w = document.getElementById('boardWidth').value;
        const h = document.getElementById('boardHeight').value;
        const t = document.getElementById('boardThickness').value;
        const k = document.getElementById('kerfInput').value;

        document.getElementById('displayBoardSize').textContent = `${w} × ${h} mm`;
        document.getElementById('displayThickness').textContent = `${t} mm`;
        document.getElementById('displayKerf').textContent = `${k} mm`;

        // Also update home screen title if it matches default
        const title = document.querySelector('.home-title');
        if (title) title.textContent = `합판 ${t}T`;
    }

    // ============================================
    // Step 1: Settings
    // ============================================

    selectPreset(card) {
        // Remove active from all
        document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const w = card.dataset.w;
        const h = card.dataset.h;
        const t = card.dataset.t;
        const k = card.dataset.k;

        // Update hidden inputs
        document.getElementById('boardWidth').value = w;
        document.getElementById('boardHeight').value = h;
        document.getElementById('boardThickness').value = t;
        document.getElementById('kerfInput').value = k;
        this.kerf = parseInt(k);

        // Update display
        document.getElementById('displayBoardSize').textContent = `${w} × ${h} mm`;
        document.getElementById('displayThickness').textContent = `${t} mm`;
        document.getElementById('displayKerf').textContent = `${k} mm`;
    }

    // ============================================
    // Step 2: Parts Input
    // ============================================

    selectField(field, isBoard = false, showKeypad = true) {
        this.currentField = field;

        // Remove active from all
        document.querySelectorAll('.input-field, .input-box, .input-box-compact').forEach(f => f.classList.remove('active'));

        // Add active to correct one
        const selector = isBoard ? `[data-board-field="${field}"]` : `[data-field="${field}"]`;
        const fieldEl = document.querySelector(selector);
        if (fieldEl) fieldEl.classList.add('active');


        // Clear field on click as requested
        this.inputValues[field] = '';
        this.updateInputField(field, '');

        // Handle Keypad Visibility
        if (showKeypad) {
            this.setKeypadVisibility(true);

            // Update Keypad Header
            const labels = { width: '가로', height: '세로', qty: '개수' };
            const label = labels[field] || '값 입력';
            const labelEl = document.getElementById('keypadFieldLabel');
            if (labelEl) labelEl.textContent = label;

            const unitEl = document.getElementById('keypadUnit');
            if (unitEl) {
                unitEl.textContent = field === 'qty' ? '개' : 'mm';
            }
            this.updateKeypadPreview(this.inputValues[field] || '0');
        }
    }

    setKeypadVisibility(visible) {
        const overlay = document.getElementById('keypadOverlay');

        if (visible) {
            overlay?.classList.remove('hidden');
            document.querySelectorAll('.screen').forEach(s => s.classList.add('has-keypad'));
            // Center active box view if needed
        } else {
            overlay?.classList.add('hidden');
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('has-keypad'));
            // Remove selection active state when closing
            document.querySelectorAll('.input-box-compact').forEach(f => f.classList.remove('active'));
        }
    }

    updateKeypadPreview(value) {
        const previewEl = document.getElementById('keypadPreview');
        if (previewEl) {
            previewEl.textContent = value || '0';
        }
    }

    updateInputField(field, value) {
        if (this.currentStep === 1) {
            // Handle board fields in Step 1
            if (field === 'boardWidth') {
                const displayEl = document.getElementById('displayBoardWidth');
                if (displayEl) displayEl.textContent = value || '-';
                const realEl = document.getElementById('boardWidth');
                if (realEl) realEl.value = value;
            } else if (field === 'boardHeight') {
                const displayEl = document.getElementById('displayBoardHeight');
                if (displayEl) displayEl.textContent = value || '-';
                const realEl = document.getElementById('boardHeight');
                if (realEl) realEl.value = value;
            }
        } else {
            const displayId = `input${field.charAt(0).toUpperCase() + field.slice(1)}`;
            const element = document.getElementById(displayId);
            if (element) {
                element.textContent = value || '';
                // Add a placeholder-like state if empty
                if (!value) element.innerHTML = '<span style="color:var(--text-dim); opacity:0.3">0</span>';
            }
        }
    }

    handleKeyPress(key) {
        let currentValue = this.inputValues[this.currentField];
        if (currentValue === '0') currentValue = ''; // Start fresh if it was '0'

        switch (key) {
            case 'C':
                this.inputValues[this.currentField] = '';
                break;

            case '←':
                if (currentValue.length > 0) {
                    this.inputValues[this.currentField] = currentValue.slice(0, -1);
                }
                break;

            case '+50':
            case '+100':
                const addValue = parseInt(key.replace('+', ''));
                const current = parseInt(currentValue) || 0;
                this.inputValues[this.currentField] = String(current + addValue);
                break;

            case 'next':
                if (this.currentStep === 1) {
                    if (this.currentField === 'boardWidth') {
                        this.selectField('boardHeight', true, true);
                    } else {
                        this.goToStep(2);
                    }
                } else {
                    const fieldOrder = ['width', 'height', 'qty'];
                    const currentIndex = fieldOrder.indexOf(this.currentField);
                    if (currentIndex < fieldOrder.length - 1) {
                        this.selectField(fieldOrder[currentIndex + 1], false, true);
                    } else {
                        // If current is qty (or last item), close keypad or add part?
                        // Usually 'next' on last item should close keypad or add.
                        // Let's close keypad for now as 'done' handles closure
                        this.setKeypadVisibility(false);
                    }
                }
                return;

            case 'done':
                // UI2: Auto-transition width → height → qty → close
                if (this.currentStep === 2) {
                    if (this.currentField === 'width') {
                        this.selectField('height', false, true);
                    } else if (this.currentField === 'height') {
                        this.selectField('qty', false, true);
                    } else {
                        this.setKeypadVisibility(false);
                    }
                } else {
                    this.setKeypadVisibility(false);
                }
                return;

            case '00':
                if (currentValue.length > 0 && currentValue !== '0') {
                    this.inputValues[this.currentField] = currentValue + '00';
                }
                break;

            default:
                if (currentValue === '' && key === '0') return;
                this.inputValues[this.currentField] = currentValue + key;
                break;
        }

        // Update display and preview (ensure '0' if empty)
        const finalValue = this.inputValues[this.currentField] || '0';
        this.updateInputField(this.currentField, finalValue);
        this.updateKeypadPreview(finalValue);

        // Validation warning for Step 2 dimensions
        if (this.currentStep === 2 && (this.currentField === 'width' || this.currentField === 'height')) {
            this.checkInputValidation();
        }
    }

    checkInputValidation() {
        const boardW = parseInt(document.getElementById('boardWidth').value);
        const boardH = parseInt(document.getElementById('boardHeight').value);
        const inputW = parseInt(this.inputValues.width) || 0;
        const inputH = parseInt(this.inputValues.height) || 0;

        const preview = document.getElementById('keypadPreview');
        const warning = document.getElementById('validationWarning');

        let isInvalid = false;
        let message = '';

        if (this.currentField === 'width' && inputW > boardW) {
            isInvalid = true;
            message = `⚠️ 원판 가로(${boardW})보다 큼`;
        } else if (this.currentField === 'height' && inputH > boardH) {
            isInvalid = true;
            message = `⚠️ 원판 세로(${boardH})보다 큼`;
        }

        if (preview) {
            preview.classList.toggle('invalid', isInvalid);
        }

        if (warning) {
            warning.textContent = message;
            warning.classList.toggle('show', isInvalid);
        }
    }

    handleNext() {
        const fieldOrder = ['width', 'height', 'qty'];
        const currentIndex = fieldOrder.indexOf(this.currentField);

        if (currentIndex < fieldOrder.length - 1) {
            // Move to next field
            this.selectField(fieldOrder[currentIndex + 1], false, true);
        } else {
            // Add part
            this.addPart();
        }
    }

    updateNextButtonText() {
        const btn = document.getElementById('keyNext');
        if (!btn) return;

        if (this.currentStep === 1) {
            btn.textContent = this.currentField === 'boardHeight' ? '입력 완료' : '다음';
        } else {
            const fieldOrder = ['width', 'height'];
            const currentIndex = fieldOrder.indexOf(this.currentField);
            btn.textContent = currentIndex < fieldOrder.length - 1 ? '다음' : '추가하기';
        }
    }

    addPart() {
        const w = parseInt(this.inputValues.width);
        const h = parseInt(this.inputValues.height);
        const qty = parseInt(this.inputValues.qty) || 1;

        if (!w || !h || w <= 0 || h <= 0) {
            this.showToast('가로와 세로를 입력하세요', 'error');
            return;
        }

        const rotatable = document.getElementById('partRotatable')?.checked ?? true;

        this.parts.push({ width: w, height: h, qty, rotatable });
        this.renderPartsList();
        this.resetInputFields();
        this.showToast(`${w}×${h} ×${qty} 추가됨`, 'success');
    }

    resetInputFields() {
        this.inputValues.width = '0';
        this.inputValues.height = '0';
        // Keep qty as is or reset to 0? User asked for 0 globally.
        this.inputValues.qty = '0';

        this.updateInputField('width', '0');
        this.updateInputField('height', '0');
        this.updateInputField('qty', '0');
        // Select width but DO NOT OPEN KEYPAD (wait for user)
        this.selectField('width', false, false);
    }

    toggleGrain() {
        const checkbox = document.getElementById('partRotatable');
        const card = document.getElementById('grainToggle');
        if (!checkbox || !card) return;

        // Toggle logic: checkbox.checked means rotatable (Grain OFF)
        // Card active means Grain ON (Not rotatable)
        const isRotatable = checkbox.checked;
        checkbox.checked = !isRotatable;

        this.updateGrainUI();
    }

    updateGrainUI() {
        const checkbox = document.getElementById('partRotatable');
        const card = document.getElementById('grainToggle');
        const labelEl = card?.querySelector('.grain-label-tiny') || card?.querySelector('.grain-status-text');

        if (!checkbox || !card || !labelEl) return;

        if (checkbox.checked) {
            // Rotatable = Grain OFF (Free)
            card.classList.remove('active');
            labelEl.textContent = '자유 회전';
        } else {
            // Not Rotatable = Grain ON (Fixed)
            card.classList.add('active');
            labelEl.textContent = '결 고정';
        }
    }

    renderPartsList() {
        const container = document.getElementById('partsList');
        if (!container) return;

        // Toggle empty state visibility
        if (this.parts.length === 0) {
            container.innerHTML = `
                <div class="empty-state" id="emptyState">
                    <span class="empty-icon">📦</span>
                    <span class="empty-text">아직 부품이 없습니다</span>
                    <span class="empty-hint">아래에서 추가해주세요 ↓</span>
                </div>
            `;
        } else {
            container.innerHTML = this.parts.map((part, index) => `
                <div class="part-item-wrap" data-index="${index}">
                    <div class="part-item swipeable">
                        <span class="part-info">
                            ${part.width}×${part.height}
                            <span class="part-qty">×${part.qty}</span>
                        </span>
                    </div>
                    <button class="swipe-delete-btn" onclick="app.removePart(${index})">삭제</button>
                </div>
            `).join('');

            // Bind swipe events
            this.bindSwipeEvents();
        }

        const totalParts = this.parts.reduce((sum, p) => sum + p.qty, 0);
        document.getElementById('partsCount').textContent = `절단 ${totalParts}개`;
    }

    bindSwipeEvents() {
        document.querySelectorAll('.part-item-wrap').forEach(wrap => {
            let startX = 0;
            let currentX = 0;
            const item = wrap.querySelector('.part-item');

            wrap.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                item.style.transition = 'none';
            });

            wrap.addEventListener('touchmove', (e) => {
                currentX = e.touches[0].clientX;
                const diff = currentX - startX;
                if (diff < 0) {
                    item.style.transform = `translateX(${Math.max(diff, -80)}px)`;
                }
            });

            wrap.addEventListener('touchend', () => {
                item.style.transition = 'transform 0.2s ease';
                const diff = currentX - startX;
                if (diff < -40) {
                    item.style.transform = 'translateX(-80px)';
                } else {
                    item.style.transform = 'translateX(0)';
                }
            });
        });
    }

    removePart(index) {
        const deleted = this.parts.splice(index, 1)[0];
        this.lastDeletedPart = { part: deleted, index: index };
        this.renderPartsList();
        this.showUndoToast(deleted);
    }

    showUndoToast(part) {
        const existing = document.querySelector('.undo-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'undo-toast';
        toast.innerHTML = `
            <span>${part.width}×${part.height} 삭제됨</span>
            <button class="undo-btn" onclick="app.undoDelete()">되돌리기</button>
        `;
        document.body.appendChild(toast);

        this.undoTimeout = setTimeout(() => {
            toast.remove();
            this.lastDeletedPart = null;
        }, 3000);
    }

    undoDelete() {
        if (!this.lastDeletedPart) return;

        clearTimeout(this.undoTimeout);
        const { part, index } = this.lastDeletedPart;
        this.parts.splice(index, 0, part);
        this.renderPartsList();
        this.lastDeletedPart = null;

        const toast = document.querySelector('.undo-toast');
        if (toast) toast.remove();

        this.showToast('되돌렸습니다', 'success');
    }

    clearParts() {
        this.parts = [];
        this.renderPartsList();
    }

    // ============================================
    // Step 3: Calculate & Results
    // ============================================

    calculate() {
        if (this.parts.length === 0) {
            this.showToast('부품을 추가해주세요', 'error');
            return;
        }

        let boardW = parseInt(document.getElementById('boardWidth').value);
        let boardH = parseInt(document.getElementById('boardHeight').value);
        const thickness = parseInt(document.getElementById('boardThickness').value);
        const preCutting = document.getElementById('preCutting')?.checked ?? false;

        // Apply pre-cutting logic (12mm each side = 24mm total)
        if (preCutting) {
            boardW -= 24;
            boardH -= 24;
        }

        // Use packer
        const packer = new GuillotinePacker(boardW, boardH, this.kerf);
        const result = packer.pack(this.parts);

        this.lastResult = result;
        this.currentBoardIndex = 0;

        // Calculate stats
        const totalCuts = result.bins.reduce((sum, bin) => sum + (bin.cuttingCount || 0), 0);
        const cost = this.calculateCuttingCost(thickness, totalCuts, preCutting, result.bins.length);
        const efficiency = result.totalEfficiency || 0;

        // Update UI
        document.getElementById('statCost').textContent = cost.toLocaleString() + '원';
        document.getElementById('statCuts').textContent = totalCuts + '회';
        document.getElementById('statBoards').textContent = result.bins.length + '장';
        document.getElementById('statEfficiency').textContent = efficiency.toFixed(1) + '%';

        // Results page labels
        const boardSizeLabel = document.getElementById('boardSizeLabel');
        if (boardSizeLabel) boardSizeLabel.textContent = `${boardW} × ${boardH} mm`;

        // Render canvas
        this.renderResult();

        // Go to Step 3
        this.goToStep(3);
    }

    calculateCuttingCost(thickness, totalCuts, isPreCut, binCount) {
        let costPerCut = 1000;
        if (thickness >= 13 && thickness <= 23) {
            costPerCut = 1500;
        } else if (thickness >= 24) {
            costPerCut = 2000;
        }
        return totalCuts * costPerCut;
    }

    renderResult() {
        if (!this.lastResult || this.lastResult.bins.length === 0) return;

        const bin = this.lastResult.bins[this.currentBoardIndex];
        const canvas = document.getElementById('resultCanvas');
        if (!canvas) return;

        // Initialize renderer if needed
        if (!this.renderer) {
            this.renderer = new CuttingRenderer('resultCanvas');
        }

        const boardW = parseInt(document.getElementById('boardWidth').value);
        const boardH = parseInt(document.getElementById('boardHeight').value);

        const legend = this.renderer.render(boardW, boardH, bin.placed, this.kerf);

        // Update indicator
        document.getElementById('boardIndicator').textContent =
            `${this.currentBoardIndex + 1} / ${this.lastResult.bins.length}`;

        // UI2: Display legend for small parts
        this.updateLegend(legend);
    }

    updateLegend(legend) {
        const container = document.getElementById('legendSection');
        if (!container) return;

        if (!legend || legend.length === 0) {
            container.innerHTML = '';
            return;
        }

        const circles = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
        const items = legend.map(l => {
            const circle = circles[l.num - 1] || `(${l.num})`;
            return `${circle} ${l.width}×${l.height} ×${l.count}`;
        }).join('   ');

        container.innerHTML = `<span class="legend-title">범례</span> ${items}`;
    }

    navigateBoard(delta) {
        if (!this.lastResult) return;
        const newIndex = this.currentBoardIndex + delta;
        if (newIndex >= 0 && newIndex < this.lastResult.bins.length) {
            this.currentBoardIndex = newIndex;
            // Reset zoom/pan when switching boards
            if (this.renderer) {
                this.renderer.zoom = 1.0;
                this.renderer.offsetX = 0;
                this.renderer.offsetY = 0;
                this.updateZoomUI();
            }
            this.renderResult();
        }
    }

    // ============================================
    // Export & Share
    // ============================================

    openPdfModal() {
        const modal = document.getElementById('pdfModal');
        const previewCanvas = document.getElementById('pdfPreviewCanvas');
        const sourceCanvas = document.getElementById('resultCanvas');

        if (!modal || !previewCanvas || !sourceCanvas) return;

        // Copy the result canvas to preview
        const ctx = previewCanvas.getContext('2d');
        previewCanvas.width = sourceCanvas.width;
        previewCanvas.height = sourceCanvas.height;
        ctx.drawImage(sourceCanvas, 0, 0);

        modal.classList.remove('hidden');
    }

    closePdfModal() {
        document.getElementById('pdfModal')?.classList.add('hidden');
    }

    downloadPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const canvas = document.getElementById('resultCanvas');

        doc.setFontSize(20);
        doc.text('Wood Cutter 재단 도면', 20, 20);

        doc.setFontSize(12);
        doc.text(`원판: ${document.getElementById('boardWidth').value} x ${document.getElementById('boardHeight').value}`, 20, 30);
        doc.text(`비용: ${document.getElementById('statCost').textContent}`, 20, 38);
        doc.text(`효율: ${document.getElementById('statEfficiency').textContent}`, 20, 46);

        if (canvas) {
            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 20, 60, 170, 0);
        }

        doc.save(`woodcutter-result-${Date.now()}.pdf`);
        this.showToast('PDF 다운로드가 시작되었습니다', 'success');
    }

    share() {
        const boardW = document.getElementById('boardWidth').value;
        const boardH = document.getElementById('boardHeight').value;
        const cost = document.getElementById('statCost').textContent;
        const cuts = document.getElementById('statCuts').textContent;
        const boards = document.getElementById('statBoards').textContent;
        const efficiency = document.getElementById('statEfficiency').textContent;

        // Build parts list text
        const partsList = this.parts.map(p => `• ${p.width}×${p.height} ×${p.qty}개`).join('\n');

        const shareText = `[대장간 V3 재단 결과]

📐 원판: ${boardW} × ${boardH} mm
📦 사용 원판: ${boards}
✂️ 총 절단: ${cuts}
📊 효율: ${efficiency}
💰 예상 비용: ${cost}

─────────────────
부품 목록:
${partsList}

📎 대장간 V3으로 작성됨`;

        // If Web Share API supports files (png from canvas)
        const canvas = document.getElementById('resultCanvas');
        if (navigator.share && canvas) {
            canvas.toBlob((blob) => {
                const file = new File([blob], 'result.png', { type: 'image/png' });
                navigator.share({
                    files: [file],
                    title: '대장간 V3 재단 결과',
                    text: shareText,
                }).catch(() => {
                    // Fallback to text
                    navigator.share({
                        title: '대장간 V3 재단 결과',
                        text: shareText,
                    });
                });
            });
        } else {
            // Very simple fallback for desktop or older browsers
            navigator.clipboard.writeText(shareText);
            this.showToast('결과가 클립보드에 복사되었습니다 (카톡/메세지에 붙여넣으세요)', 'success');
        }
    }

    // ============================================
    // Utilities
    // ============================================

    haptic(type = 'light') {
        if (!navigator.vibrate) return;
        switch (type) {
            case 'light': navigator.vibrate(10); break;
            case 'medium': navigator.vibrate(20); break;
            case 'success': navigator.vibrate([10, 50, 10]); break;
            case 'error': navigator.vibrate([50, 50, 50]); break;
        }
    }

    showToast(message, type = 'info') {
        // Simple toast implementation
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#FF6B6B' : type === 'success' ? '#00D4AA' : '#2D2D2D'};
            color: ${type === 'info' ? '#F5F5F5' : '#1A1A1A'};
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            z-index: 9999;
            animation: fadeInUp 0.3s ease;
        `;

        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    // ============================================
    // Debugging
    // ============================================

    debug() {
        console.group('/debug - Application State');
        // No console logging
    }
            width: document.getElementById('boardWidth')?.value,
            height: document.getElementById('boardHeight')?.value,
            thickness: document.getElementById('boardThickness')?.value,
            kerf: this.kerf
        });
        console.groupEnd();

        this.showToast('디버그 정보가 콘솔에 출력되었습니다', 'success');
    }
}

// Initialize App
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new CuttingAppMobile();
});
