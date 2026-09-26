// game-config.js - Configuration, Map Data Arrays, Terrain Parsers, and Local Asset Loaders (18x18 Grid System)

export const cols = 18;
export const rows = 18;

export let blueAntiairImg = new Image(), blueAntiairLoaded = false;
export let redAntiairImg = new Image(), redAntiairLoaded = false;
export let blueArtilleryImg = new Image(), blueArtilleryLoaded = false;
export let redArtilleryImg = new Image(), redArtilleryLoaded = false;
export let blueEngineerImg = new Image(), blueEngineerLoaded = false;
export let redEngineerImg = new Image(), redEngineerLoaded = false;
export let blueInfantryImg = new Image(), blueInfantryLoaded = false;
export let redInfantryImg = new Image(), redInfantryLoaded = false;
export let blueMineImg = new Image(), blueMineLoaded = false;
export let redMineImg = new Image(), redMineLoaded = false;
export let bluePlaneImg = new Image(), bluePlaneLoaded = false;
export let redPlaneImg = new Image(), redPlaneLoaded = false;
export let blueShipImg = new Image(), blueShipLoaded = false;
export let redShipImg = new Image(), redShipLoaded = false;
export let blueTankImg = new Image(), blueTankLoaded = false;
export let redTankImg = new Image(), redTankLoaded = false;
export let mapImg = new Image(), mapLoaded = false;

function loadOnlineAsset(url, imgObj, setLoadedFlag) {
    imgObj.crossOrigin = "anonymous";
    imgObj.src = url;
    imgObj.onload = () => { setLoadedFlag(true); };
    imgObj.onerror = () => {
        console.error(`Failed to load online asset: ${url}`);
    };
}

const repoBaseUrl = 'https://raw.githubusercontent.com/ModernChess/assets-images/main/';

loadOnlineAsset(`${repoBaseUrl}blueantiair.png`, blueAntiairImg, (val) => { blueAntiairLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}redantiair.png`, redAntiairImg, (val) => { redAntiairLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}blueartillery.png`, blueArtilleryImg, (val) => { blueArtilleryLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}redartillery.png`, redArtilleryImg, (val) => { redArtilleryLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}blueengineer.png`, blueEngineerImg, (val) => { blueEngineerLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}redengineer.png`, redEngineerImg, (val) => { redEngineerLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}blueinfantry.png`, blueInfantryImg, (val) => { blueInfantryLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}redinfantry.png`, redInfantryImg, (val) => { redInfantryLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}bluemine.png`, blueMineImg, (val) => { blueMineLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}redmine.png`, redMineImg, (val) => { redMineLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}blueplane.png`, bluePlaneImg, (val) => { bluePlaneLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}redplane.png`, redPlaneImg, (val) => { redPlaneLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}blueship.png`, blueShipImg, (val) => { blueShipLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}redship.png`, redShipImg, (val) => { redShipLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}bluetank.png`, blueTankImg, (val) => { blueTankLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}redtank.png`, redTankImg, (val) => { redTankLoaded = val; });
loadOnlineAsset(`${repoBaseUrl}map_8.jpg`, mapImg, (val) => { mapLoaded = val; });

// Legacy compatibility placeholder
export function colLetterToIndex(colStr) {
    return 0;
}

// 1. Water Array
const waterList = [
    "8,4","9,4","8,5","9,5","10,5","7,6","8,6","9,6","10,6","6,7","7,7","7,8","6,8","5,8","4,8","4,9","5,9","5,10","6,9","6,10","7,9","7,10","8,7","8,8","8,9","8,10","8,11","9,10","9,11","9,9","9,8","9,7","10,7","10,8","10,9","10,10","10,11","10,12","11,8","11,9","11,10","11,11","11,12","11,13","12,13","12,12","12,11","12,10","13,11","13,12","13,13"
];

// 2. Land Array
const landList = [
    "0,0","0,1","0,2","0,3","1,0","1,1","1,2","1,3","2,0","2,1","2,2","2,3","3,0","3,1","3,2","3,3","4,0","4,1","4,2","4,3","5,0","5,1","5,2","6,0","6,1","6,2","7,0","7,1","7,2","8,0","8,1","8,2","9,0","9,1","9,2","10,2","10,3","10,4","11,2","11,3","11,4","12,2","12,3","12,4","13,2","13,3","13,4","14,2","14,3","14,4","15,2","15,3","15,4","16,2","16,3","16,4","17,2","17,3","17,4","13,0","13,1","14,0","14,1","15,0","15,1","16,0","16,1","17,0","17,1","14,5","14,6","14,7","14,8","14,9","14,10","15,5","15,6","15,7","15,8","15,9","15,10","16,5","16,6","16,7","16,8","16,9","16,10","17,5","17,6","17,7","17,8","17,9","17,10","13,14","13,15","13,16","13,17","14,14","14,15","14,16","14,17","15,14","15,15","15,16","15,17","16,14","16,15","16,16","16,17","17,14","17,15","17,16","17,17","7,12","7,13","7,14","7,15","7,16","7,17","8,12","8,13","8,14","8,15","8,16","8,17","9,12","9,13","9,14","9,15","9,16","9,17","0,16","0,17","1,16","1,17","2,16","2,17","3,16","3,17","4,16","4,17","5,16","5,17","6,16","6,17","0,13","0,14","0,15","1,13","1,14","1,15","2,13","2,14","2,15","3,13","3,14","3,15","2,7","2,8","2,9","2,10","2,11","2,12","3,7","3,8","3,9","3,10","3,11","3,12","8,3","9,3","4,7","4,6","5,6","5,7","6,6","3,6","3,5","4,5","4,4","3,4","1,7","1,8","1,9","0,9","0,8","0,7","4,10","4,11","4,12","5,12","6,12","6,11","7,11","10,13","10,14","11,14","12,14","14,13","14,12","14,11","13,10","13,9","12,9","13,5","12,5"
];

// 3. Gold Core Specific List (Added back to satisfy deployment.js import)
export const goldCoreList = [
    "6,4", "1,5", "5,14", "11,16", "16,12", "12,7"
];

// 4. Unified Gold List (Flattened from cores + linked tiles)
export const goldList = [
    // Core 1 & Links
    "6,4", "5,4", "5,5", "6,5", "7,5", "7,4", "7,3", "6,3", "5,3",
    // Core 2 & Links
    "1,5", "0,5", "0,6", "1,6", "2,6", "2,5", "2,4", "1,4", "0,4",
    // Core 3 & Links
    "5,14", "4,14", "4,13", "5,13", "6,13", "6,14", "6,15", "5,15", "4,15",
    // Core 4 & Links
    "11,16", "10,16", "10,15", "11,15", "12,15", "12,16", "12,17", "11,17", "10,17",
    // Core 5 & Links
    "16,12", "15,12", "15,11", "16,11", "17,11", "17,12", "17,13", "16,13", "15,13",
    // Core 6 & Links
    "12,7", "13,7", "13,8", "12,8", "11,7", "11,6", "12,6", "13,6"
];

// Bases & Structures
export const artList = [];
export const tList = [];
export const rbList = [];
export const bbList = [];

// Team-Owned Naval / Spawn Units
export const navList = [];

// Team Bases & Core Ownership setup
export const bbcList = ["0,11"];
export const rbcList = ["11,0"];

export const redBasesList = ["10,1", "10,0", "11,1", "12,1", "12,0"];
export const blueBasesList = ["0,12", "1,12", "1,11", "1,10", "0,10"];

// Initial Team-Owned Navy Units/Tiles configuration
export const teamNavySpawns = [
    { custom_name: "nav_5_11", type_name: "nav", coordinates: "5,11", team: "blue" },
    { custom_name: "nav_11_5", type_name: "nav", coordinates: "11,5", team: "red" }
];

// Populate Lookups via Sets
const waterSet = new Set(waterList);
const landSet = new Set(landList);
const goldSet = new Set(goldList);
const bbcSet = new Set(bbcList);
const rbcSet = new Set(rbcList);
const redBasesSet = new Set(redBasesList);
const blueBasesSet = new Set(blueBasesList);

teamNavySpawns.forEach(n => {
    waterSet.add(n.coordinates);
});

export function getTerrain(c, r) {
    let key = `${c},${r}`;
    if (bbcSet.has(key)) return 'bbc';
    if (rbcSet.has(key)) return 'rbc';
    if (goldSet.has(key)) return 'gold';
    if (redBasesSet.has(key)) return 'red_base';
    if (blueBasesSet.has(key)) return 'blue_base';
    if (landSet.has(key)) return 'land';
    return 'light_navy';
}

export function isWaterTerrain(c, r) {
    return getTerrain(c, r) === 'light_navy';
}

export function parseCoord(coordStr) {
    let parts = coordStr.split(',');
    if (parts.length === 2) {
        return {
            c: parseInt(parts[0], 10),
            r: parseInt(parts[1], 10)
        };
    }
    return {c: 0, r: 0};
}

export function spawnTeamUnits(team, unitsArray) {
    let coordStr = team === 'blue' ? "0,11" : "11,0";
    let coord = parseCoord(coordStr);
    unitsArray.push({
        id: `${team}-infantry-0-${Math.random().toString(36).substring(2, 7)}`,
        name: 'Infantry',
        type: 'land',
        range: 2,
        gridX: coord.c,
        gridY: coord.r,
        team: team
    });
}
