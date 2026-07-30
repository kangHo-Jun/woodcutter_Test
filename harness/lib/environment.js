'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let loaded = null;

function createElementStub(values) {
    return {
        value: values.value ?? '',
        checked: values.checked ?? false,
        disabled: false,
        textContent: '',
        addEventListener() {},
        removeEventListener() {}
    };
}

function installBrowserStubs(options = {}) {
    const settings = {
        kerf: options.kerf ?? 4.2,
        enableTrim: options.enableTrim ?? false,
        trimMargin: options.trimMargin ?? 9,
        cutDirection: options.mode ?? 'auto',
        cutMethod: 'guillotine',
        optimizationPriority: 'material',
        boardThickness: options.boardThickness ?? 18,
        enableWatermark: false
    };
    const elements = {
        kerfInput: createElementStub({ value: String(settings.kerf) }),
        enableTrim: createElementStub({ checked: settings.enableTrim }),
        trimMargin: createElementStub({ value: String(settings.trimMargin) }),
        cutDirection: createElementStub({ value: settings.cutDirection }),
        cutMethod: createElementStub({ value: settings.cutMethod }),
        optimizationPriority: createElementStub({ value: settings.optimizationPriority }),
        boardThickness: createElementStub({ value: String(settings.boardThickness) }),
        enableWatermark: createElementStub({ checked: false })
    };
    const storage = new Map();

    global.window = {
        __WOODCUTTER_TRIM_ENABLED__: settings.enableTrim,
        __WOODCUTTER_AUTO_ENGINE__: options.autoEngine ?? 'adaptive',
        app: {
            state: {
                boardSpec: {
                    considerGrain: options.considerGrain ?? false
                }
            }
        }
    };
    global.self = global;
    global.document = {
        getElementById(id) {
            return elements[id] ?? null;
        }
    };
    global.localStorage = {
        getItem(key) {
            return storage.has(key) ? storage.get(key) : null;
        },
        setItem(key, value) {
            storage.set(key, String(value));
        },
        removeItem(key) {
            storage.delete(key);
        }
    };
}

function evaluateFile(file) {
    const source = fs.readFileSync(file, 'utf8');
    vm.runInThisContext(source, { filename: file });
}

function loadProduction(options = {}) {
    if (loaded) {
        installBrowserStubs(options);
        window.CostCalculator = loaded.CostCalculator;
        window.SettingsManager = loaded.SettingsManager;
        window.GuillotinePacker = loaded.GuillotinePacker;
        return loaded;
    }

    installBrowserStubs(options);
    const root = path.resolve(__dirname, '..', '..');
    evaluateFile(path.join(root, 'js', 'costCalculator.js'));
    evaluateFile(path.join(root, 'js', 'settingsManager.js'));
    evaluateFile(path.join(root, 'js', 'packer.js'));

    loaded = {
        GuillotinePacker: window.GuillotinePacker,
        CostCalculator: window.CostCalculator,
        SettingsManager: window.SettingsManager
    };
    return loaded;
}

module.exports = {
    installBrowserStubs,
    loadProduction
};
