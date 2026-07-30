'use strict';

const fs = require('fs');
const path = require('path');

const CASES_DIR = path.resolve(__dirname, '..', 'cases');

function resolveCasePath(input) {
    if (!input) {
        throw new Error('케이스 파일을 지정하세요. 예: --case case1.json');
    }
    const direct = path.resolve(process.cwd(), input);
    if (fs.existsSync(direct)) return direct;

    const inCases = path.join(CASES_DIR, input);
    if (fs.existsSync(inCases)) return inCases;
    if (!path.extname(input) && fs.existsSync(`${inCases}.json`)) {
        return `${inCases}.json`;
    }
    throw new Error(`케이스 파일을 찾을 수 없습니다: ${input}`);
}

function validateCase(data, file) {
    if (!data || typeof data !== 'object') throw new Error(`${file}: JSON 객체가 아닙니다.`);
    if (!data.name) throw new Error(`${file}: name이 없습니다.`);
    if (!data.board || !(data.board.width > 0) || !(data.board.height > 0)) {
        throw new Error(`${file}: 올바른 board.width/height가 필요합니다.`);
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new Error(`${file}: items가 비어 있습니다.`);
    }
    data.items.forEach((item, index) => {
        if (!(item.width > 0) || !(item.height > 0) || !(item.qty > 0)) {
            throw new Error(`${file}: items[${index}] 치수/수량이 올바르지 않습니다.`);
        }
    });
    return data;
}

function loadCase(input) {
    const file = resolveCasePath(input);
    return {
        file,
        data: validateCase(JSON.parse(fs.readFileSync(file, 'utf8')), file)
    };
}

function listCaseFiles() {
    return fs.readdirSync(CASES_DIR)
        .filter(name => name.endsWith('.json'))
        .sort()
        .map(name => path.join(CASES_DIR, name));
}

module.exports = {
    CASES_DIR,
    loadCase,
    listCaseFiles
};
