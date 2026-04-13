/**
 * 상단 '오늘의 특가' 배너 관리 모듈
 * 구글 시트 데이터를 가져와 티커 스타일로 렌더링
 */

class SpecialBannerManager {
    // 구글 시트 CSV 내보내기 URL (시트 ID와 GID를 포함)
    static SHEET_URL = 'https://docs.google.com/spreadsheets/d/1juV_iial7LoM6NX5xKLjzAeInb4Wxqgx_rtJbVJK6uc/export?format=csv&gid=0';

    static async init() {
        const data = await this.fetchData();
        if (data && data.length > 0) {
            this.render(data);
        }
    }

    /**
     * 구글 시트 데이터 페치
     */
    static async fetchData() {
        try {
            const response = await fetch(this.SHEET_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            const csvText = await response.text();

            // 단순 CSV 파싱 (A열만 사용)
            // 첫 번째 줄은 헤더일 수 있으므로 제외할지 여부는 시트 구조에 따라 결정 가능
            // 여기서는 모든 행을 데이터로 간주하고 빈 행 제외
            const rows = csvText.split('\n')
                .map(row => row.split(',')[0].replace(/"/g, '').trim())
                .filter(text => text.length > 0 && text !== '항목' && text !== '문구'); // 헤더 방지 

            return rows;
        } catch (error) {
            console.error('특가 배너 데이터 로드 실패:', error);
            return null;
        }
    }

    /**
     * 특정 키워드 강조 처리 (HTML 태그 삽입)
     */
    static highlightText(text) {
        // 숫자, 특가, 할인, % , 이벤트, 한정, 마감 등의 키워드를 빨간색 강조
        const keywords = [/(\d+[\d,]*%)/g, /(\d+[\d,]*원)/g, /(특가|할인|이벤트|한정|마감|무료|배송|보장|파격)/g];

        let highlighted = text;
        keywords.forEach(pattern => {
            highlighted = highlighted.replace(pattern, '<span class="highlight">$1</span>');
        });

        return highlighted;
    }

    /**
     * 배너 렌더링 및 애니메이션 설정
     */
    static render(texts) {
        const bannerContainer = document.getElementById('top-special-banner');
        if (!bannerContainer) return;

        const content = texts.map(t => this.highlightText(t)).join(' &nbsp;&nbsp;&nbsp;&nbsp; | &nbsp;&nbsp;&nbsp;&nbsp; ');

        // 무한 루프를 위해 동일한 내용을 두 번 반복
        bannerContainer.innerHTML = `
            <div class="ticker-wrapper">
                <div class="ticker-content" id="ticker-content">
                    <span>${content}</span>
                    <span>${content}</span>
                </div>
            </div>
        `;

        bannerContainer.style.display = 'block';
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    SpecialBannerManager.init();
});
