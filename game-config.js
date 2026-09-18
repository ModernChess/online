// game-config.js - Configuration, Map Data Arrays, Terrain Parsers, and Local Asset Loaders (24x34 Grid System)

export const cols = 24;
export const rows = 34;

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
loadOnlineAsset(`${repoBaseUrl}map_3.png`, mapImg, (val) => { mapLoaded = val; });

export function colLetterToIndex(colStr) {
    let upper = colStr.toUpperCase();
    let col = 0;
    for (let i = 0; i < upper.length; i++) {
        col = col * 26 + (upper.charCodeAt(i) - 64);
    }
    const baseColCode = 'AY'.toUpperCase();
    let baseVal = 0;
    for (let i = 0; i < baseColCode.length; i++) {
        baseVal = baseVal * 26 + (baseColCode.charCodeAt(i) - 64);
    }
    return col - baseVal;
}

const landList = [
    "BA18", "BF18", "BG18", "BH18", "BL18", "BM18", "BN18", "BO18", "BP18", "BQ18",
    "BR18", "BS18", "BT18", "BU18", "BV18", "BG19", "BH19", "BL19", "BM19", "BN19",
    "BO19", "BP19", "BQ19", "BR19", "BS19", "BT19", "BU19", "BV19", "BD20", "BE20",
    "BG20", "BH20", "BL20", "BM20", "BQ20", "BR20", "BS20", "BT20", "BU20", "BV20",
    "AZ21", "BD21", "BE21", "BF21", "BG21", "BH21", "BI21", "BJ21", "BK21", "BL21",
    "BM21", "BQ21", "BR21", "BS21", "BT21", "BU21", "BV21", "BD22", "BH22", "BI22",
    "BJ22", "BK22", "BL22", "BM22", "BQ22", "BR22", "BS22", "BT22", "BU22", "BV22",
    "AZ23", "BA23", "BC23", "BH23", "BI23", "BN23", "BO23", "BP23", "BQ23", "BR23",
    "BS23", "BH24", "BI24", "BR24", "BS24", "BG25", "BM25", "BN25", "BS25", "BR26",
    "BS26", "BT26", "BU26", "BV26", "BQ27", "BR27", "BV27", "BA28", "BL28", "BN28",
    "BP28", "BQ28", "BR28", "BV28", "BI29", "BP29", "BQ29", "BR29", "BV29", "BD30",
    "BF30", "BK30", "BL30", "BM30", "BO30", "BP30", "BQ30", "BR30", "BS30", "BT30",
    "BU30", "BV30", "BJ31", "BK31", "BL31", "BM31", "BO31", "BP31", "BQ31", "BR31",
    "BS31", "BT31", "BU31", "BV31", "BC32", "BH32", "BI32", "BJ32", "BK32", "BL32",
    "BM32", "BP32", "BQ32", "BR32", "BS32", "BT32", "BU32", "BV32", "BB33", "BC33",
    "BD33", "BH33", "BI33", "BJ33", "BN33", "BP33", "BS33", "BT33", "BU33", "BA34",
    "BB34", "BC34", "BD34", "BE34", "BF34", "BG34", "BH34", "BI34", "BJ34", "BN34",
    "BR34", "BA35", "BB35", "BC35", "BD35", "BE35", "BF35", "BG35", "BH35", "BI35",
    "BJ35", "AZ36", "BA36", "BB36", "BC36", "BD36", "BE36", "BF36", "BG36", "BH36",
    "BI36", "BJ36", "BK36", "BL36", "BM36", "BN36", "AY37", "AZ37", "BA37", "BB37",
    "BC37", "BD37", "BE37", "BF37", "BG37", "BH37", "BI37", "BJ37", "BK37", "BL37",
    "BM37", "BN37", "BO37", "BP37", "AY38", "AZ38", "BA38", "BB38", "BC38", "BD38",
    "BE38", "BF38", "BG38", "BH38", "BI38", "BM38", "BN38", "BO38", "BP38", "BA39",
    "BB39", "BC39", "BD39", "BE39", "BF39", "BG39", "BH39", "BI39", "BM39", "BN39",
    "BO39", "BP39", "BA40", "BB40", "BC40", "BD40", "BE40", "BF40", "BG40", "BH40",
    "BI40", "BM40", "BN40", "BO40", "BP40", "BA41", "BB41", "BC41", "BG41", "BH41",
    "BI41", "BJ41", "BK41", "BL41", "BM41", "BN41", "BO41", "BP41", "BQ41", "AZ42",
    "BA42", "BB42", "BC42", "BG42", "BH42", "BI42", "BJ42", "BM42", "BN42", "BO42",
    "BP42", "BQ42", "BR42", "AY43", "AZ43", "BA43", "BB43", "BC43", "BG43", "BH43",
    "BI43", "BJ43", "BN43", "BO43", "BP43", "BQ43", "BR43", "BS43", "AY44", "AZ44",
    "BA44", "BB44", "BC44", "BD44", "BE44", "BF44", "BG44", "BH44", "BI44", "BJ44",
    "BN44", "BO44", "BP44", "BQ44", "BR44", "BS44", "AY45", "AZ45", "BA45", "BB45",
    "BC45", "BD45", "BE45", "BF45", "BG45", "BH45", "BI45", "BJ45", "BN45", "BO45",
    "BP45", "BQ45", "BR45", "BS45", "BT45", "AY46", "AZ46", "BA46", "BB46", "BC46",
    "BD46", "BE46", "BF46", "BG46", "BH46", "BI46", "BJ46", "BK46", "BL46", "BM46",
    "BN46", "BO46", "BP46", "BQ46", "BR46", "BS46", "BT46", "AZ47", "BA47", "BB47",
    "BC47", "BD47", "BE47", "BF47", "BG47", "BH47", "BI47", "BJ47", "BK47", "BL47",
    "BM47", "BN47", "BO47", "BP47", "BQ47", "BR47", "BS47", "BT47", "BC48", "BD48",
    "BE48", "BF48", "BG48", "BH48", "BI48", "BJ48", "BK48", "BL48", "BM48", "BN48",
    "BO48", "BP48", "BQ48", "BR48", "BS48", "BT48", "BC49", "BD49", "BE49", "BF49",
    "BG49", "BH49", "BI49", "BJ49", "BK49", "BL49", "BM49", "BN49", "BO49", "BP49",
    "BQ49", "BR49", "BS49", "BC50", "BD50", "BE50", "BF50", "BG50", "BH50", "BI50",
    "BJ50", "BK50", "BL50", "BM50", "BN50", "BO50", "BP50", "BQ50", "BR50", "AZ51",
    "BA51", "BB51", "BC51", "BD51", "BE51", "BF51", "BG51", "BH51", "BI51", "BJ51",
    "BK51", "BL51", "BM51", "BN51", "BO51", "BP51", "BQ51", "BR51"
];

export const goldList = [
    "BI18", "BJ18", "BK18", "BI19", "BK19", "BA20", "BB20", "BI20", "BJ20", "BK20", "BN20", "BO20", "BP20",
    "BA21", "BC21", "BN21", "BP21", "BA22", "BB22", "BC22", "BN22", "BO22", "BP22",
    "BT23", "BU23", "BV23", "BO24", "BP24", "BQ24", "BT24", "BV24", "BQ25", "BT25", "BU25", "BV25",
    "BP26", "BQ26", "BS27", "BT27", "BU27", "BS28", "BU28", "BS29", "BT29", "BU29",
    "BF31", "BG31", "BE32", "BG32", "BE33", "BF33", "BG33", "BK33", "BL33", "BM33",
    "BK34", "BM34", "BP34", "BQ34", "BK35", "BL35", "BM35", "BQ35", "BQ36",
    "BJ38", "BK38", "BL38", "BJ39", "BL39", "BJ40", "BK40", "BL40",
    "BD41", "BE41", "BF41", "BD42", "BF42", "BD43", "BE43", "BF43",
    "BA48", "BB48", "AZ49", "BB49", "AZ50", "BA50", "BB50"
];

export const goldCoreList = [
    "BB21", "BJ19", "BO21", "BU24", "BP25", "BT28", "BL34", "BF32", "BP35", "BK39", "BE42", "BA49"
];

export const artList = ["BG23", "BR25", "BQ33", "BL42"];
export const tList = ["BG24", "BP27", "BR33", "BK42"];
export const rbList = ["BK43", "BL43", "BM43", "BK44", "BM44", "BK45", "BL45", "BM45"];
export const bbList = ["BF23", "BF24", "BD25", "BE25", "BF25"];
export const navList = ["BG22", "BN24", "BD32", "BS34"];

export const bbcList = ["BE24"];
export const rbcList = ["BL44"];

const landSet = new Set();
landList.forEach(item => {
    let m = item.match(/^([A-Z]+)(\d+)$/);
    if (m) landSet.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
});

const goldSet = new Set();
goldList.forEach(item => {
    let m = item.match(/^([A-Z]+)(\d+)$/);
    if (m) goldSet.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
});

const goldCoreSet = new Set();
goldCoreList.forEach(item => {
    let m = item.match(/^([A-Z]+)(\d+)$/);
    if (m) goldCoreSet.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
});

const artSet = new Set();
artList.forEach(item => {
    let m = item.match(/^([A-Z]+)(\d+)$/);
    if (m) artSet.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
});

const tSet = new Set();
tList.forEach(item => {
    let m = item.match(/^([A-Z]+)(\d+)$/);
    if (m) tSet.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
});

const rbSet = new Set();
rbList.forEach(item => {
    let m = item.match(/^([A-Z]+)(\d+)$/);
    if (m) rbSet.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
});

const bbSet = new Set();
bbList.forEach(item => {
    let m = item.match(/^([A-Z]+)(\d+)$/);
    if (m) bbSet.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
});

const navSet = new Set();
navList.forEach(item => {
    let m = item.match(/^([A-Z]+)(\d+)$/);
    if (m) navSet.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
});

const bbcSet = new Set();
bbcList.forEach(item => {
    let m = item.match(/^([A-Z]+)(\d+)$/);
    if (m) bbcSet.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
});

const rbcSet = new Set();
rbcList.forEach(item => {
    let m = item.match(/^([A-Z]+)(\d+)$/);
    if (m) rbcSet.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
});

export function getTerrain(c, r) {
    let key = `${c},${r}`;
    if (bbcSet.has(key)) return 'bbc';
    if (rbcSet.has(key)) return 'rbc';
    if (goldCoreSet.has(key)) return 'gold_core';
    if (goldSet.has(key)) return 'gold';
    if (artSet.has(key)) return 'artillery';
    if (tSet.has(key)) return 'tank_spawn';
    if (rbSet.has(key)) return 'red_base';
    if (bbSet.has(key)) return 'blue_base';
    if (navList.length && navSet.has(key)) return 'naval';
    if (landSet.has(key)) return 'land';
    return 'light_navy';
}

export function isWaterTerrain(c, r) {
    return getTerrain(c, r) === 'light_navy';
}

export function parseCoord(coordStr) {
    let m = coordStr.match(/^([A-Z]+)(\d+)$/);
    if (m) {
        return {
            c: colLetterToIndex(m[1]),
            r: parseInt(m[2], 10) - 18
        };
    }
    return {c: 0, r: 0};
}

export function spawnTeamUnits(team, unitsArray) {
    let coordStr = team === 'blue' ? "BE24" : "BL44";
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
