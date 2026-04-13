/**
 * 라벨링 엔진
 * 부품을 크기별로 그룹화하고 A, B, C 라벨 할당
 */

class LabelingEngine {
    /**
     * 부품 목록에 라벨 할당
     * @param {Array} parts - 부품 목록 [{width, height, qty}]
     * @returns {Array} - 라벨링된 그룹 [{label, width, height, area, count, parts}]
     */
    static assignLabels(parts) {
        if (!parts || parts.length === 0) {
            return [];
        }

        // 1. 크기별 그룹화
        const groups = this.groupBySize(parts);

        // 2. 면적 기준 내림차순 정렬
        groups.sort((a, b) => b.area - a.area);

        // 3. A, B, C... 라벨 할당
        const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        groups.forEach((group, index) => {
            if (index < 26) {
                group.label = labels[index];
            } else {
                // Z 이후는 Z1, Z2, Z3...
                group.label = `Z${index - 25}`;
            }
        });

        return groups;
    }

    /**
     * 부품을 크기별로 그룹화
     * @param {Array} parts - 부품 목록
     * @returns {Array} - 그룹 배열
     */
    static groupBySize(parts) {
        const map = new Map();

        parts.forEach((part, index) => {
            const key = `${part.width}x${part.height}`;

            if (!map.has(key)) {
                map.set(key, {
                    width: part.width,
                    height: part.height,
                    area: part.width * part.height,
                    count: 0,
                    parts: [],
                    label: ''
                });
            }

            const group = map.get(key);
            group.count += part.qty || 1;
            group.parts.push({ ...part, originalIndex: index });
        });

        return Array.from(map.values());
    }

    /**
     * 배치된 부품에 라벨 매핑
     * @param {Array} placedParts - 배치된 부품 목록
     * @param {Array} labeledGroups - 라벨링된 그룹
     * @returns {Array} - 라벨이 추가된 배치 부품
     */
    static mapLabelsToPlaced(placedParts, labeledGroups) {
        return placedParts.map(part => {
            // 정방향 또는 회전된 부품 모두 매칭 (가로/세로 바뀌어도 같은 부품)
            const group = labeledGroups.find(g =>
                (g.width === part.width && g.height === part.height) ||
                (g.width === part.height && g.height === part.width)
            );
            return {
                ...part,
                label: group ? group.label : '?'
            };
        });
    }

    /**
     * 라벨 그룹 정보를 UI에 표시
     * @param {Array} labeledGroups - 라벨링된 그룹
     */
    static displayLabelGroups(labeledGroups) {
        const container = document.getElementById('labelGroupsList');
        if (!container) return;

        if (!labeledGroups || labeledGroups.length === 0) {
            container.innerHTML = '<p class="empty-state">부품이 없습니다</p>';
            return;
        }

        const html = labeledGroups.map(group => `
            <div class="label-group-item">
                <span class="label-badge">${group.label}</span>
                <span class="label-size">${group.width}×${group.height}mm</span>
                <span class="label-count">${group.count}개</span>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * 라벨 범례 생성 (Canvas용)
     * @param {Array} labeledGroups - 라벨링된 그룹
     * @returns {Object} - {label: {width, height, count}}
     */
    static createLegend(labeledGroups) {
        const legend = {};
        labeledGroups.forEach(group => {
            legend[group.label] = {
                width: group.width,
                height: group.height,
                count: group.count,
                area: group.area
            };
        });
        return legend;
    }

    /**
     * 특정 크기의 부품에 대한 라벨 찾기
     * @param {number} width - 폭
     * @param {number} height - 높이
     * @param {Array} labeledGroups - 라벨링된 그룹
     * @returns {string} - 라벨
     */
    static findLabel(width, height, labeledGroups) {
        // 정방향 또는 회전된 부품 모두 매칭 (가로/세로 바뀌어도 같은 부품)
        const group = labeledGroups.find(g =>
            (g.width === width && g.height === height) ||
            (g.width === height && g.height === width)
        );
        return group ? group.label : '?';
    }

    /**
     * 라벨 그룹을 텍스트로 포맷팅 (공유/PDF용)
     * @param {Array} labeledGroups - 라벨링된 그룹
     * @returns {string} - 포맷팅된 텍스트
     */
    static formatGroupsAsText(labeledGroups) {
        if (!labeledGroups || labeledGroups.length === 0) {
            return '부품 없음';
        }

        return labeledGroups.map(group =>
            `${group.label}: ${group.width}×${group.height}mm - ${group.count}개`
        ).join('\n');
    }
}

// 전역 노출
window.LabelingEngine = LabelingEngine;
