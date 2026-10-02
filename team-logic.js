// team-logic.js - Handles map coordinate parsing, tile types, capture tracking, and economy coin values[span_3](start_span)[span_3](end_span)
import { 
    cols, 
    rows,
    colLetterToIndex,
    goldList, 
    bbcList, 
    rbcList, 
    redBasesList, 
    blueBasesList,
    navList,
    artList,
    tList,
    goldCoreList
} from './game-config.js';

export const rbList = redBasesList;
export const bbList = blueBasesList;

export let tileCaptures = {};

// Helper to calculate Chebyshev distance between two coordinates ("C,R")
function getChebyshevDistance(coordA, coordB) {
    let [c1, r1] = coordA.split(',').map(Number);
    let [c2, r2] = coordB.split(',').map(Number);
    return Math.max(Math.abs(c1 - c2), Math.abs(r1 - r2));
}

export const goldCoreClusters = [
    {
        gc: "BB21",
        linked: ["BA20", "BB20", "BA21", "BC21", "BA22", "BB22", "BC22"]
    },
    {
        gc: "BJ19",
        linked: ["BI18", "BJ18", "BK18", "BI19", "BK19", "BI20", "BJ20", "BK20"]
    },
    {
        gc: "BO21",
        linked: ["BN20", "BO20", "BP20", "BN21", "BP21", "BN22", "BO22", "BP22"]
    },
    {
        gc: "BU24",
        linked: ["BT23", "BU23", "BV23", "BT24", "BV24", "BT25", "BU25", "BV25"]
    },
    {
        gc: "BP25",
        linked: ["BO24", "BP24", "BQ24", "BQ25", "BP26", "BQ26"]
    },
    {
        gc: "BT28",
        linked: ["BS27", "BT27", "BU27", "BS28", "BU28", "BS29", "BT29", "BU29"]
    },
    {
        gc: "BF32",
        linked: ["BF31", "BG31", "BE32", "BG32", "BE33", "BF33", "BG33"]
    },
    {
        gc: "BL34",
        linked: ["BK33", "BL33", "BM33", "BK34", "BM34", "BK35", "BL35", "BM35"]
    },
    {
        gc: "BP35",
        linked: ["BP34", "BQ34", "BQ35", "BQ36"]
    },
    {
        gc: "BK39",
        linked: ["BJ38", "BK38", "BL38", "BJ39", "BL39", "BJ40", "BK40", "BL40"]
    },
    {
        gc: "BE42",
        linked: ["BD41", "BE41", "BF41", "BD42", "BF42", "BD43", "BE43", "BF43"]
    },
    {
        gc: "BA49",
        linked: ["BA48", "BB48", "AZ49", "BB49", "AZ50", "BA50", "BB50"]
    }
];

// Automatically link artillery, tank, and port tiles to their closest Gold Core via Chebyshev distance
[...artList, ...tList, ...navList].forEach(tileItem => {
    let parsedTile = parseCoord(tileItem);
    if (!parsedTile) return;

    let closestCore = goldCoreList[0];
    let minDistance = Infinity;

    goldCoreList.forEach(coreStr => {
        let parsedCore = parseCoord(coreStr);
        let dist = getChebyshevDistance(parsedTile, parsedCore);
        if (dist < minDistance) {
            minDistance = dist;
            closestCore = coreStr;
        }
    });

    let targetCluster = goldCoreClusters.find(c => c.gc === closestCore);
    if (targetCluster && !targetCluster.linked.includes(tileItem)) {
        targetCluster.linked.push(tileItem);
    }
});

export const tileCoinValues = {
    'gold': 0.5,
    'gold core': 2,
    'red base': 0.5,
    'blue base': 0.5,
    'port': 0.5,
    'artillery': 0.5,
    'tank': 0.5
};

export function parseCoord(item) {
    if (typeof item !== 'string') return null;

    let chessMatch = item.match(/^([A-Z]+)(\d+)$/);
    if (chessMatch) {
        let colStr = chessMatch[1];
        let rowNum = parseInt(chessMatch[2], 10);
        let rawIndex = colLetterToIndex(colStr);
        if (rawIndex === undefined || rawIndex === null) return null;
        
        let correctedCol = rawIndex;
        let rIdx = rowNum - 18; 
        if (correctedCol < 0 || correctedCol >= cols || rIdx < 0 || rIdx >= rows) return null;

        return `${correctedCol},${rIdx}`;
    }

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
    const registerList = (list, typeName, defaultOwner = null) => {
        if (!list) return;
        list.forEach(item => {
            let key = parseCoord(item);
            if (key) {
                tileCaptures[key] = { type: typeName, capturedBy: defaultOwner };
            }
        });
    };

    registerList(goldList, 'gold', null);
    registerList(redBasesList, 'red base', 'red');       
    registerList(blueBasesList, 'blue base', 'blue');    
    registerList(bbcList, 'blue base command', 'blue');  
    registerList(rbcList, 'red base command', 'red');    

    goldCoreClusters.forEach(cluster => {
        let gcKey = parseCoord(cluster.gc);
        if (gcKey) {
            tileCaptures[gcKey] = { type: 'gold core', capturedBy: null };
        }
        cluster.linked.forEach(link => {
            let linkKey = parseCoord(link);
            if (linkKey) {
                let tName = 'gold core linked';
                if (artList.includes(link)) tName = 'artillery';
                else if (tList.includes(link)) tName = 'tank';
                else if (navList.includes(link)) tName = 'port';

                tileCaptures[linkKey] = { type: tName, gcCoord: gcKey, capturedBy: null };
            }
        });
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
