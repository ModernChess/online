// team-logic.js - Handles map coordinate parsing, tile types, capture tracking, and economy coin values
import { 
    cols, 
    colLetterToIndex, 
    goldCoreList, 
    goldList, 
    artList, 
    tList, 
    rbList, 
    bbList, 
    navList, 
    bbcList, 
    rbcList 
} from './game-config.js';

export { rbList, bbList };

export let tileCaptures = {};

// Coin reward mapping for capturing specific tile types
export const tileCoinValues = {
    'gold core': 2,
    'gold': 0.5,
    'artillery': 0.5,
    'tank': 0.5,
    'port': 0.5
};

export function parseCoord(item) {
    let m = item.match(/^([A-Z]+)(\d+)$/);
    if (!m) return null;
    let colStr = m[1];
    let rowNum = parseInt(m[2], 10);
    let rawIndex = colLetterToIndex(colStr);
    if (rawIndex === undefined || rawIndex === null) return null;
    
    let correctedCol = rawIndex;
    let rIdx = rowNum - 18;
    if (correctedCol < 0 || correctedCol >= cols) return null;

    return `${correctedCol},${rIdx}`;
}

export function initTileCaptures() {
    tileCaptures = {};
    const registerList = (list, typeName) => {
        list.forEach(item => {
            let key = parseCoord(item);
            if (key) {
                tileCaptures[key] = { type: typeName, capturedBy: null };
            }
        });
    };
    registerList(goldCoreList, 'gold core');
    registerList(goldList, 'gold');
    registerList(artList, 'artillery');
    registerList(tList, 'tank');
    registerList(rbList, 'red base');
    registerList(bbList, 'blue base');
    registerList(navList, 'port');
    registerList(bbcList, 'blue base command');
    registerList(rbcList, 'red base command');
}
