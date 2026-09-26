// team-logic.js - Handles map coordinate parsing, tile types, capture tracking, and economy coin values (18x18 System)
import { 
    cols, 
    rows,
    goldList, 
    bbcList, 
    rbcList, 
    redBasesList, 
    blueBasesList,
    teamNavySpawns 
} from './game-config.js';

// Legacy exports for compatibility
export const rbList = redBasesList;
export const bbList = blueBasesList;

export let tileCaptures = {};

export const goldCoreClusters = [
    {
        gc: "6,4",
        linked: ["5,4", "5,5", "6,5", "7,5", "7,4", "7,3", "6,3", "5,3"]
    },
    {
        gc: "1,5",
        linked: ["0,4", "1,4", "2,4", "2,5", "2,6", "1,6", "0,6", "0,5"]
    },
    {
        gc: "5,14",
        linked: ["5,15", "6,15", "6,14", "6,13", "5,13", "4,13", "4,14", "4,15"]
    },
    {
        gc: "11,16",
        linked: ["11,17", "12,17", "12,16", "12,15", "11,15", "10,15", "10,16", "10,17"]
    },
    {
        gc: "16,12",
        linked: ["15,12", "15,13", "16,13", "17,13", "17,12", "17,11", "16,11", "15,11"]
    },
    {
        gc: "12,7",
        linked: ["12,8", "13,8", "13,7", "13,6", "12,6", "11,6", "11,7"]
    }
];

// Coin reward mapping for capturing specific tile types
export const tileCoinValues = {
    'gold': 0.5,
    'gold core': 2,
    'red base': 0.5,
    'blue base': 0.5,
    'port': 0.5
};

export function parseCoord(item) {
    if (typeof item !== 'string') return null;
    let parts = item.split(',');
    if (parts.length !== 2) return null;
    
    let c = parseInt(parts[0], 10);
    let r = parseInt(parts[1], 10);
    
    if (isNaN(c) || isNaN(r) || c < 0 || c >= cols || r < 0 || r >= rows) {
        return null;
    }

    return `${c},${r}`;
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

    registerList(goldList, 'gold');
    registerList(redBasesList, 'red base');
    registerList(blueBasesList, 'blue base');
    registerList(bbcList, 'blue base command');
    registerList(rbcList, 'red base command');

    // Register gold core clusters (GC gets 'gold core', linked tiles get 'gold core linked')
    goldCoreClusters.forEach(cluster => {
        let gcKey = parseCoord(cluster.gc);
        if (gcKey) {
            tileCaptures[gcKey] = { type: 'gold core', capturedBy: null };
        }
        cluster.linked.forEach(link => {
            let linkKey = parseCoord(link);
            if (linkKey) {
                tileCaptures[linkKey] = { type: 'gold core linked', gcCoord: gcKey, capturedBy: null };
            }
        });
    });

    // Register team navy spawns as ports/naval structures
    teamNavySpawns.forEach(n => {
        let key = parseCoord(n.coordinates);
        if (key) {
            tileCaptures[key] = { type: 'port', capturedBy: n.team };
        }
    });
}

export function getGoldCoreCluster(coordKey) {
    for (let cluster of goldCoreClusters) {
        let gcKey = parseCoord(cluster.gc);
        if (gcKey === coordKey) return cluster;
        if (cluster.linked.some(l => parseCoord(l) === coordKey)) return cluster;
    }
    return null;
}
