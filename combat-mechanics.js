// combat-mechanics.js - Handles combat power definitions, superunit clustering with enemy bridging, target tracking, instant stalemates, and reinforcements
import { cols, rows, isWaterTerrain } from './game-config.js';
import { getUnitRange } from './unit-movement.js';

export let unitsToDestroy = [];
export let stalematedUnits = new Set(); // Registry tracking unit IDs currently in a stalemated/locked state

export function getUnitPower(unit) {
    if (!unit) return 0;
    if (unit.name === 'Infantry') return 1;
    if (unit.name === 'Tank') return 2;
    return 0;
}

function areUnitsAdjacent(u1, u2) {
    let colDiff = Math.abs(u1.gridX - u2.gridX);
    let rowDiff = Math.abs(u1.gridY - u2.gridY);
    return colDiff <= 1 && rowDiff <= 1 && !(colDiff === 0 && rowDiff === 0);
}

export const planeVulnerableUnits = new Set(['Tank', 'Infantry', 'Engineer', 'Artillery']);
export const shipVulnerableUnits = new Set(['Infantry', 'Tank', 'Anti-Air', 'Engineer', 'Artillery']);
export const artilleryVulnerableUnits = new Set(['Ship', 'Infantry', 'Tank', 'Anti-Air', 'Engineer', 'Artillery']);
export const antiairVulnerableUnits = new Set(['Plane']);
export const mineLandVulnerableUnits = new Set(['Tank', 'Infantry', 'Anti-Air', 'Artillery', 'Engineer']);
export const mineWaterVulnerableUnits = new Set(['Ship']);
export const infantryTankVulnerableUnits = new Set(['Engineer', 'Artillery', 'Anti-Air']);

export function getUnitMacroRangeTiles(unit) {
    if (!unit) return [];
    
    let rangeVal = getUnitRange(unit);
    if (rangeVal <= 0) {
        if (unit.name === 'Mine') rangeVal = 3;
        else if (unit.name === 'Artillery') rangeVal = 2;
        else if (unit.name === 'Ship') rangeVal = 2;
        else if (unit.name === 'Anti-Air') rangeVal = 2;
        else if (unit.name === 'Engineer') rangeVal = 1;
    }
    
    if (rangeVal <= 0) return [];
    
    let tiles = [];
    let macroSize = 2;
    let unitMCol = Math.floor(unit.gridX / macroSize);
    let unitMRow = Math.floor(unit.gridY / macroSize);

    let directions = [
        { dc: 0, dr: -1 }, { dc: 0, dr: 1 },   
        { dc: -1, dr: 0 }, { dc: 1, dr: 0 },   
        { dc: -1, dr: -1 }, { dc: 1, dr: -1 }, 
        { dc: -1, dr: 1 }, { dc: 1, dr: 1 }
    ];

    let targetMacroSquares = new Set();

    directions.forEach(dir => {
        for (let step = 1; step <= rangeVal; step++) {
            let targetMCol = unitMCol + (dir.dc * step);
            let targetMRow = unitMRow + (dir.dr * step);

            let startGridX = targetMCol * macroSize;
            let startGridY = targetMRow * macroSize;

            if (startGridX < 0 || startGridX >= cols || startGridY < 0 || startGridY >= rows) {
                break;
            }

            targetMacroSquares.add(`${targetMCol},${targetMRow}`);
        }
    });

    targetMacroSquares.forEach(coordStr => {
        let [targetMCol, targetMRow] = coordStr.split(',').map(Number);
        let startGridX = targetMCol * macroSize;
        let startGridY = targetMRow * macroSize;
        let endGridX = Math.min(cols - 1, startGridX + macroSize - 1);
        let endGridY = Math.min(rows - 1, startGridY + macroSize - 1);

        for (let r = startGridY; r <= endGridY; r++) {
            for (let c = startGridX; c <= endGridX; c++) {
                tiles.push({ c, r });
            }
        }
    });

    return tiles;
}

function getSuperunitsForTeamBase(teamName, allUnits) {
    let teamUnits = allUnits.filter(u => u.team === teamName);
    let combatUnits = teamUnits.filter(u => getUnitPower(u) > 0);
    let superunits = [];
    let visited = new Set();

    combatUnits.forEach(unit => {
        if (visited.has(unit)) return;
        let cluster = [];
        let queue = [unit];
        visited.add(unit);

        while (queue.length > 0) {
            let curr = queue.shift();
            cluster.push(curr);

            combatUnits.forEach(other => {
                if (!visited.has(other)) {
                    let touching = areUnitsAdjacent(curr, other);
                    let sharingEnemyBridge = false;
                    
                    if (!touching) {
                        // Enemy bridge check: if two friendly units touch the same opposing enemy unit, they connect[span_1](start_span)[span_1](end_span)
                        sharingEnemyBridge = allUnits.some(enemy => 
                            enemy.team !== teamName && areUnitsAdjacent(curr, enemy) && areUnitsAdjacent(other, enemy)
                        );
                    }

                    if (touching || sharingEnemyBridge) {
                        visited.add(other);
                        queue.push(other);
                    }
                }
            });
        }

        let totalPower = cluster.reduce((sum, u) => sum + getUnitPower(u), 0);
        let isStalemate = cluster.some(u => u.stalemate || stalematedUnits.has(u.id));
        superunits.push({
            units: cluster,
            power: totalPower,
            team: teamName,
            stalemate: isStalemate
        });
    });

    return superunits;
}

export function updateStalemates(unitsList) {
    if (!unitsList) return;
    
    unitsList.forEach(u => {
        u.stalemate = false;
    });
    stalematedUnits.clear();

    let blueSuperunits = getSuperunitsForTeamBase('blue', unitsList);
    let redSuperunits = getSuperunitsForTeamBase('red', unitsList);

    blueSuperunits.forEach(suBlue => {
        redSuperunits.forEach(suRed => {
            let isAdjacent = suBlue.units.some(uB => suRed.units.some(uR => areUnitsAdjacent(uB, uR)));
            if (isAdjacent && suBlue.power === suRed.power) {
                suBlue.units.forEach(u => { u.stalemate = true; stalematedUnits.add(u.id); });
                suRed.units.forEach(u => { u.stalemate = true; stalematedUnits.add(u.id); });
            }
        });
    });
}

export function getSuperunitsForTeam(teamName, allUnits) {
    updateStalemates(allUnits);
    return getSuperunitsForTeamBase(teamName, allUnits);
}

export function getMultiUnitPowerMap(unitsList) {
    let powerMap = new Map();
    if (!unitsList) return powerMap;

    updateStalemates(unitsList);
    ['blue', 'red'].forEach(teamName => {
        let suList = getSuperunitsForTeamBase(teamName, unitsList);
        suList.forEach(su => {
            if (su.units && su.units.length > 0) {
                su.units.forEach(u => {
                    powerMap.set(u.id, su.power);
                });
            }
        });
    });

    return powerMap;
}

export function resolveCombat(unitsList, logCallback) {
    unitsToDestroy = [];
    let destroyedIds = new Set();

    updateStalemates(unitsList);

    // 1. General Macro-Square Range Detection Logging
    unitsList.forEach(unit => {
        let rangeTiles = getUnitMacroRangeTiles(unit);
        if (rangeTiles.length > 0) {
            let detectedUnits = [];
            rangeTiles.forEach(tile => {
                let found = unitsList.find(u => u.gridX === tile.c && u.gridY === tile.r);
                if (found && found.id !== unit.id) {
                    detectedUnits.push(`${found.name} (${found.team}) at [${tile.c}, ${tile.r}]`);
                }
            });
            if (detectedUnits.length > 0 && logCallback) {
                logCallback(`Macro Range Detection: ${unit.name} (${unit.team}) at [${unit.gridX}, ${unit.gridY}] detected units in macro boundary: ${detectedUnits.join(', ')}`);
            }
        }
    });

    // 2. Ship Ranged Combat Resolution
    let ships = unitsList.filter(u => u.name === 'Ship');
    ships.forEach(ship => {
        let rangeTiles = getUnitMacroRangeTiles(ship);
        rangeTiles.forEach(tile => {
            let enemy = unitsList.find(u => u.gridX === tile.c && u.gridY === tile.r && u.team !== ship.team);
            if (enemy && shipVulnerableUnits.has(enemy.name)) {
                if (!destroyedIds.has(enemy.id) && !enemy.stalemate && !stalematedUnits.has(enemy.id)) {
                    destroyedIds.add(enemy.id);
                    unitsToDestroy.push({ 
                        unit: enemy, destroyedBy: 'Ship',
                        reason: `Ship (${ship.team}) ranged-attacked and destroyed vulnerable enemy unit ${enemy.name} (${enemy.team})` 
                    });
                    if (logCallback) {
                        logCallback(`Combat! Ship (${ship.team}) shelled and destroyed enemy ${enemy.name} (${enemy.team}) within range!`);
                    }
                }
            }
        });
    });

    // 3. Artillery Ranged Combat Resolution (50% Randomized Success Rate)
    let artilleries = unitsList.filter(u => u.name === 'Artillery');
    artilleries.forEach(artillery => {
        let rangeTiles = getUnitMacroRangeTiles(artillery);
        rangeTiles.forEach(tile => {
            let enemy = unitsList.find(u => u.gridX === tile.c && u.gridY === tile.r && u.team !== artillery.team);
            if (enemy && artilleryVulnerableUnits.has(enemy.name)) {
                if (!destroyedIds.has(enemy.id) && !enemy.stalemate && !stalematedUnits.has(enemy.id)) {
                    let success = Math.random() < 0.5;
                    if (success) {
                        destroyedIds.add(enemy.id);
                        unitsToDestroy.push({ 
                            unit: enemy, destroyedBy: 'Artillery',
                            reason: `Artillery (${artillery.team}) successfully shelled and destroyed enemy unit ${enemy.name} (${enemy.team}) (50% roll passed)` 
                        });
                        if (logCallback) {
                            logCallback(`Combat! Artillery (${artillery.team}) scored a direct hit and destroyed enemy ${enemy.name} (${enemy.team})!`);
                        }
                    } else {
                        if (logCallback) {
                            logCallback(`Combat! Artillery (${artillery.team}) shelled enemy ${enemy.name} (${enemy.team}), but the shot missed (failed 50% roll)!`);
                        }
                    }
                }
            }
        });
    });

    // 4. Anti-Air Ranged Combat Resolution
    let antiairs = unitsList.filter(u => u.name === 'Anti-Air');
    antiairs.forEach(antiair => {
        let rangeTiles = getUnitMacroRangeTiles(antiair);
        rangeTiles.forEach(tile => {
            let enemy = unitsList.find(u => u.gridX === tile.c && u.gridY === tile.r && u.team !== antiair.team);
            if (enemy && antiairVulnerableUnits.has(enemy.name)) {
                if (!destroyedIds.has(enemy.id) && !enemy.stalemate && !stalematedUnits.has(enemy.id)) {
                    destroyedIds.add(enemy.id);
                    unitsToDestroy.push({ 
                        unit: enemy, destroyedBy: 'Anti-Air',
                        reason: `Anti-Air (${antiair.team}) fired missiles and shot down enemy plane ${enemy.name} (${enemy.team}) within range` 
                    });
                    if (logCallback) {
                        logCallback(`Combat! Anti-Air (${antiair.team}) shot down enemy Plane (${enemy.team}) within range!`);
                    }
                }
            }
        });
    });

    // 5. Mine Ranged Combat Resolution (Terrain-Dependent Vulnerability)
    let mines = unitsList.filter(u => u.name === 'Mine');
    mines.forEach(mine => {
        let isOnWater = isWaterTerrain(mine.gridX, mine.gridY);
        let activeVulnerableSet = isOnWater ? mineWaterVulnerableUnits : mineLandVulnerableUnits;

        let rangeTiles = getUnitMacroRangeTiles(mine);
        rangeTiles.forEach(tile => {
            let enemy = unitsList.find(u => u.gridX === tile.c && u.gridY === tile.r && u.team !== mine.team);
            if (enemy && activeVulnerableSet.has(enemy.name)) {
                if (!destroyedIds.has(enemy.id) && !enemy.stalemate && !stalematedUnits.has(enemy.id)) {
                    destroyedIds.add(enemy.id);
                    unitsToDestroy.push({ 
                        unit: enemy, destroyedBy: 'Mine',
                        reason: `Mine (${mine.team}) detonated on ${isOnWater ? 'water' : 'land'} and destroyed enemy unit ${enemy.name} (${enemy.team})` 
                    });
                    if (logCallback) {
                        logCallback(`Combat! Mine (${mine.team}) triggered on ${isOnWater ? 'water' : 'land'} and destroyed enemy ${enemy.name} (${enemy.team})!`);
                    }
                }
            }
        });
    });

    // 6. Plane Adjacent Combat Resolution
    let planes = unitsList.filter(u => u.name === 'Plane');
    planes.forEach(plane => {
        let enemyUnits = unitsList.filter(u => u.team !== plane.team);
        enemyUnits.forEach(enemy => {
            if (planeVulnerableUnits.has(enemy.name)) {
                if (areUnitsAdjacent(plane, enemy)) {
                    if (!destroyedIds.has(enemy.id) && !enemy.stalemate && !stalematedUnits.has(enemy.id)) {
                        destroyedIds.add(enemy.id);
                        unitsToDestroy.push({ 
                            unit: enemy, destroyedBy: 'Plane',
                            reason: `Plane (${plane.team}) adjacently attacked and destroyed vulnerable enemy unit ${enemy.name} (${enemy.team})` 
                        });
                        if (logCallback) {
                            logCallback(`Combat! Plane (${plane.team}) destroyed adjacent enemy ${enemy.name} (${enemy.team})!`);
                        }
                    }
                }
            }
        });
    });

    // 7. Superunit Equal-Power Locks, Stalemates, and Reinforcement/Rescue Breaking
    let blueSuperunits = getSuperunitsForTeamBase('blue', unitsList);
    let redSuperunits = getSuperunitsForTeamBase('red', unitsList);

    blueSuperunits.forEach(suBlue => {
        redSuperunits.forEach(suRed => {
            let isAdjacent = suBlue.units.some(uB => suRed.units.some(uR => areUnitsAdjacent(uB, uR)));
            if (isAdjacent) {
                let blueReinforced = suBlue.units.some(u => !stalematedUnits.has(u.id) && !u.stalemate);
                let redReinforced = suRed.units.some(u => !stalematedUnits.has(u.id) && !u.stalemate);

                if (suBlue.stalemate || suRed.stalemate) {
                    if (blueReinforced && !redReinforced && suBlue.power !== suRed.power) {
                        suRed.units.forEach(u => {
                            if (!destroyedIds.has(u.id)) {
                                destroyedIds.add(u.id);
                                unitsToDestroy.push({
                                    unit: u, destroyedBy: 'Reinforced Superunit',
                                    reason: `Blue reinforcement broke stalemate and destroyed Red unit ${u.name} due to power advantage (${suBlue.power} vs ${suRed.power})`
                                });
                            }
                        });
                        suBlue.units.forEach(u => { u.stalemate = false; stalematedUnits.delete(u.id); });
                        suRed.units.forEach(u => { u.stalemate = false; stalematedUnits.delete(u.id); });
                        if (logCallback) logCallback(`Reinforcement! Blue forces broke the stalemate with superior power (${suBlue.power} vs ${suRed.power}) and destroyed Red forces!`);
                        return;
                    } else if (redReinforced && !blueReinforced && suRed.power !== suBlue.power) {
                        suBlue.units.forEach(u => {
                            if (!destroyedIds.has(u.id)) {
                                destroyedIds.add(u.id);
                                unitsToDestroy.push({
                                    unit: u, destroyedBy: 'Reinforced Superunit',
                                    reason: `Red reinforcement broke stalemate and destroyed Blue unit ${u.name} due to power advantage (${suRed.power} vs ${suBlue.power})`
                                });
                            }
                        });
                        suBlue.units.forEach(u => { u.stalemate = false; stalematedUnits.delete(u.id); });
                        suRed.units.forEach(u => { u.stalemate = false; stalematedUnits.delete(u.id); });
                        if (logCallback) logCallback(`Reinforcement! Red forces broke the stalemate with superior power (${suRed.power} vs ${suBlue.power}) and destroyed Blue forces!`);
                        return;
                    }
                }

                if (suBlue.power === suRed.power) {
                    suBlue.units.forEach(u => { u.stalemate = true; stalematedUnits.add(u.id); });
                    suRed.units.forEach(u => { u.stalemate = true; stalematedUnits.add(u.id); });
                    if (logCallback) {
                        logCallback(`Stalemate! Equal power detected between Blue (${suBlue.power}) and Red (${suRed.power}) superunits. Forces locked in place!`);
                    }
                } else if (suBlue.power > suRed.power) {
                    suRed.units.forEach(u => {
                        if (!destroyedIds.has(u.id) && !u.stalemate && !stalematedUnits.has(u.id)) {
                            destroyedIds.add(u.id);
                            unitsToDestroy.push({
                                unit: u, destroyedBy: 'Superunit Power',
                                reason: `Blue superunit power (${suBlue.power}) overpowered Red superunit power (${suRed.power})`
                            });
                            if (logCallback) {
                                logCallback(`Combat! Blue superunit (power ${suBlue.power}) destroyed Red ${u.name} (cluster power ${suRed.power})!`);
                            }
                        }
                    });
                } else {
                    suBlue.units.forEach(u => {
                        if (!destroyedIds.has(u.id) && !u.stalemate && !stalematedUnits.has(u.id)) {
                            destroyedIds.add(u.id);
                            unitsToDestroy.push({
                                unit: u, destroyedBy: 'Superunit Power',
                                reason: `Red superunit power (${suRed.power}) overpowered Blue superunit power (${suBlue.power})`
                            });
                            if (logCallback) {
                                logCallback(`Combat! Red superunit (power ${suRed.power}) destroyed Blue ${u.name} (cluster power ${suBlue.power})!`);
                            }
                        }
                    });
                }
            }
        });
    });

    // 8. Infantry & Tank Adjacent Combat Resolution
    let infantryAndTanks = unitsList.filter(u => (u.name === 'Infantry' || u.name === 'Tank') && !u.stalemate && !stalematedUnits.has(u.id));
    infantryAndTanks.forEach(attacker => {
        let enemyUnits = unitsList.filter(u => u.team !== attacker.team);
        enemyUnits.forEach(enemy => {
            if (infantryTankVulnerableUnits.has(enemy.name)) {
                if (areUnitsAdjacent(attacker, enemy)) {
                    if (!destroyedIds.has(enemy.id) && !enemy.stalemate && !stalematedUnits.has(enemy.id)) {
                        destroyedIds.add(enemy.id);
                        unitsToDestroy.push({ 
                            unit: enemy, destroyedBy: attacker.name,
                            reason: `${attacker.name} (${attacker.team}) adjacently engaged and destroyed vulnerable enemy unit ${enemy.name} (${enemy.team})` 
                        });
                        if (logCallback) {
                            logCallback(`Combat! ${attacker.name} (${attacker.team}) engaged and destroyed adjacent enemy ${enemy.name} (${enemy.team})!`);
                        }
                    }
                }
            }
        });
    });

    return unitsToDestroy.length > 0;
}

export function processDestructions(unitsList) {
    if (unitsToDestroy.length === 0) return false;
    let targetIds = new Set(unitsToDestroy.map(item => item.unit.id));

    for (let i = unitsList.length - 1; i >= 0; i--) {
        if (targetIds.has(unitsList[i].id)) {
            let u = unitsList[i];
            stalematedUnits.delete(u.id);
            unitsList.splice(i, 1);
        }
    }
    updateStalemates(unitsList);
    return true;
}