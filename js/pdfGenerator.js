/**
 * PDF 생성 모듈
 * jsPDF를 사용한 전문 재단 리포트 생성
 */

class PDFGenerator {
    /**
     * PDF 생성 및 다운로드
     * @param {Object} state - 애플리케이션 상태
     * @param {Object} result - 최적화 결과
     * @param {Object} costInfo - 원가 정보
     * @param {Array} labeledGroups - 라벨링된 그룹
     */
    static async generate(state, result, costInfo, labeledGroups) {
        try {
            const { jsPDF } = window.jspdf;
            if (!jsPDF) {
                throw new Error('jsPDF 라이브러리가 로드되지 않았습니다');
            }

            const doc = new jsPDF('p', 'mm', 'a4');

            // Page 1: 요약표 (Canvas로 렌더링하여 이미지로 삽입)
            await this.addSummaryPageAsImage(doc, state, result, costInfo, labeledGroups);

            // Page 2~: 재단 도면 (중복 제거)
            if (result && result.bins) {
                const uniqueBins = this.removeDuplicateBins(result.bins);

                for (let i = 0; i < uniqueBins.length; i++) {
                    doc.addPage();
                    await this.addCuttingDiagramAsImage(doc, uniqueBins[i], i);
                }
            }

            // 파일명 생성 (날짜 포함)
            const date = new Date();
            const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
            const filename = `재단계획_${dateStr}.pdf`;

            // 저장
            doc.save(filename);

            return { success: true, filename };
        } catch (error) {
            console.error('PDF 생성 실패:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 중복 판재 제거
     * @param {Array} bins - 판재 배열
     * @returns {Array} - 중복 제거된 판재 배열 (수량 정보 포함)
     */
    static removeDuplicateBins(bins) {
        const uniqueBins = [];
        const patterns = new Map();

        bins.forEach(bin => {
            // 배치 패턴을 문자열로 변환 (부품 위치와 크기 기준)
            const pattern = bin.placed
                .map(p => `${p.x},${p.y},${p.width},${p.height}`)
                .sort()
                .join('|');

            if (patterns.has(pattern)) {
                // 이미 존재하는 패턴이면 수량만 증가
                patterns.get(pattern).count++;
            } else {
                // 새로운 패턴이면 추가
                const binWithCount = { ...bin, count: 1 };
                patterns.set(pattern, binWithCount);
                uniqueBins.push(binWithCount);
            }
        });

        return uniqueBins;
    }

    /**
     * 요약표를 Canvas로 렌더링하여 이미지로 PDF에 추가
     */
    static async addSummaryPageAsImage(doc, state, result, costInfo, labeledGroups) {
        // 임시 Canvas 생성
        const canvas = document.createElement('canvas');
        canvas.width = 794;  // A4 width in pixels at 96 DPI
        canvas.height = 1123; // A4 height in pixels at 96 DPI
        const ctx = canvas.getContext('2d');

        // 배경
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let y = 60;
        const margin = 60;

        // 제목
        ctx.fillStyle = '#212121';
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

        const settings = window.SettingsManager ? SettingsManager.readFromUI() : {};
        const trimEnabled = settings.enableTrim === true;
        const trimMargin = trimEnabled ? (parseFloat(settings.trimMargin) || 0) : 0;
        const boardWidth = state.boardSpec.width - trimMargin;
        const boardHeight = state.boardSpec.height;

        ctx.font = '18px "Noto Sans KR", sans-serif';
        ctx.fillText(`크기: ${boardWidth} × ${boardHeight} mm`, margin + 20, y);
        y += 30;
        ctx.fillText(`결 고려: ${state.boardSpec.considerGrain ? '예' : '아니오'}`, margin + 20, y);
        y += 30;
        ctx.fillText(`사용 판재: ${result.bins ? result.bins.length : 0}장`, margin + 20, y);
        y += 50;

        // 부품 목록
        ctx.font = 'bold 24px "Noto Sans KR", sans-serif';
        ctx.fillText('부품 요약', margin, y);
        y += 35;

        ctx.font = '18px "Noto Sans KR", sans-serif';
        if (labeledGroups && labeledGroups.length > 0) {
            labeledGroups.forEach(group => {
                const infoText = `${group.label}: ${group.width}×${group.height}mm - `;
                const qtyText = `(${group.count}개)`;

                // 정보 텍스트 (Normal)
                ctx.font = '18px "Noto Sans KR", sans-serif';
                ctx.fillText(infoText, margin + 20, y);

                // 수량 텍스트 (Bold)
                const infoWidth = ctx.measureText(infoText).width;
                ctx.font = 'bold 18px "Noto Sans KR", sans-serif';
                ctx.fillText(qtyText, margin + 20 + infoWidth, y);

                y += 30;
            });
        }
        y += 30;

        // 원가 정보
        ctx.font = 'bold 24px "Noto Sans KR", sans-serif';
        ctx.fillText('원가 정보', margin, y);
        y += 35;

        ctx.font = '18px "Noto Sans KR", sans-serif';
        if (costInfo) {
            ctx.fillText(`총 재단비: ${costInfo.totalCuttingCost.toLocaleString('ko-KR')}원`, margin + 20, y);
            y += 30;
            ctx.fillText(`재단 횟수: ${costInfo.totalCuts}회`, margin + 20, y);
        }

        // Canvas를 이미지로 변환하여 PDF에 추가
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 0, 0, 210, 297); // A4 size in mm
    }

    /**
     * 재단 도면을 Canvas 이미지로 PDF에 추가
     */
    static async addCuttingDiagramAsImage(doc, bin, index) {
        // 기존 Canvas 찾기
        const existingCanvas = document.getElementById(`canvas-${index}`);

        if (existingCanvas) {
            // 임시 Canvas 생성 (한글 텍스트 포함)
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 794;
            tempCanvas.height = 1123;
            const ctx = tempCanvas.getContext('2d');

            // 배경
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            const margin = 60;
            let y = 60;

            // 제목
            ctx.fillStyle = '#212121';
            ctx.font = 'bold 28px "Noto Sans KR", sans-serif';
            const title = bin.count > 1 ? `판재 #${index + 1} (×${bin.count}개)` : `판재 #${index + 1}`;
            ctx.fillText(title, margin, y);
            y += 40;

            // 효율 정보
            ctx.font = '18px "Noto Sans KR", sans-serif';
            y += 30;
            ctx.fillText(`절단 횟수: ${bin.cuttingCount}회`, margin, y);
            y += 50;

            // 기존 Canvas 이미지 복사
            const scale = (tempCanvas.width - margin * 2) / existingCanvas.width;
            const scaledHeight = existingCanvas.height * scale;

            ctx.drawImage(existingCanvas, margin, y, tempCanvas.width - margin * 2, scaledHeight);

            // PDF에 추가
            const imgData = tempCanvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
        } else {
            // Canvas가 없으면 텍스트만 표시
            doc.setFontSize(16);
            doc.text(`판재 #${index + 1}`, 20, 20);
            doc.setFontSize(12);
            doc.text('도면을 찾을 수 없습니다', 20, 40);
        }
    }

    /**
     * 절단 방향 라벨
     */
    static getDirectionLabel(direction) {
        const labels = {
            horizontal: '가로 우선',
            vertical: '세로 우선',
            auto: '자동'
        };
        return labels[direction] || direction;
    }

    /**
     * 절단 방식 라벨
     */
    static getMethodLabel(method) {
        const labels = {
            guillotine: '단두대식',
            free: '자유 절단'
        };
        return labels[method] || method;
    }

    /**
     * PDF 미리보기 (새 창)
     */
    static async preview(state, result, costInfo, labeledGroups) {
        try {
            const { jsPDF } = window.jspdf;
            if (!jsPDF) {
                throw new Error('jsPDF 라이브러리가 로드되지 않았습니다');
            }

            const doc = new jsPDF('p', 'mm', 'a4');

            // 요약표
            this.addSummaryPage(doc, state, result, costInfo, labeledGroups);

            // 재단 도면
            if (result && result.bins) {
                for (let i = 0; i < result.bins.length; i++) {
                    doc.addPage();
                    await this.addCuttingDiagram(doc, result.bins[i], i + 1, state);
                }
            }

            // Blob 생성
            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);

            // 새 창에서 열기
            window.open(url, '_blank');

            return { success: true };
        } catch (error) {
            console.error('PDF 미리보기 실패:', error);
            return { success: false, error: error.message };
        }
    }
}

// 전역 노출
window.PDFGenerator = PDFGenerator;
