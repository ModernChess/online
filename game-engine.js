// game-engine.js - Game Loop and Core Cluster Capture Logic (OnlinePlus Version)
import { db, ref, update } from './network.js';
import { showScreen } from './ui-manager.js';
import { cols, rows, spawnTeamUnits } from './game-config.js';
import { initViewportControls, resetCamera, screenToWorldCoordinates, getCameraState } from './viewport.js';
import { listenToMatchUpdates, listenToMatchChat } from './game-sync.js';
import { drawGameScene, getRenderCoordinates } from './game-renderer.js';
import { getLegalMoves, getShowUnitRange, clearUnitRangeOverlayButton, updateUnitRangeOverlayButton } from './unit-movement.js';
import { resolveCombat, processDestructions, unitsToDestroy, getUnitMacroRangeTiles, artilleryVulnerableUnits } from './combat-mechanics.js';
import { ensureBuyUnitsModal, handleUnitDeployment, getPendingUnitType, setPendingUnitType, cleanupUnitDeployerPopup, setTeamCoinsRef, setCurrentTeamRef, getTeamCoins } from './deployment.js';
import { tileCaptures, initTileCaptures, parseCoord, rbList, bbList, getGoldCoreCluster } from './team-logic.js';
import { createConsoleLogger, updateTurnButtonState, ensureGameActionButtons, updateGlobalCoinHUD, updateTurnTimerDisplay } from './game-controls.js';
import { triggerSelectSound, triggerMoveSound, startMatchMusic, stopMatchMusic } from './sound.js';
import { initializeTileCapturesState, triggerFrontalExplosion, triggerFarDestructionTrails } from './renderer-helpers.js';
import { checkVictoryConditions, checkBaseCaptureVictory } from './game-victory.js';

let currentMatchId = null;
let playerTeam = null;
let localTeam = 'blue';
let currentUser = null;
let currentTurn = 'blue';
let lastSeenTurn = null;
let selectedUnit = null;
let legalMoves = [];
let stagedMove = null;
let selectionAnimStartTime = null;
let animationFrameId = null;
let units = [];
let movedUnitsThisTurn = new Set();
let teamCoins = { blue: 0, red: 0 };
let hasInitializedState = false;
let isGameOver = false;

let turnStartTime = Date.now();
let turnTimerInterval = null;
let coinIncomeInterval = null;
const TURN_TIME_LIMIT_MS = 60000;

const logToConsole = createConsoleLogger();
initTileCaptures();

function clearArtilleryButtons() {
    document.querySelectorAll('.artillery-strike-btn').forEach(btn => btn.remove());
}

function updateArtilleryButtons(canvas, selectedUnit, localTeam) {
    clearArtilleryButtons();
    // Hide 'D' buttons if it's not the player's turn, or if unit criteria aren't met
    if (!selectedUnit || selectedUnit.name !== 'Artillery' || !getShowUnitRange(selectedUnit.id)) return;
    if (currentTurn !== playerTeam) return;

    const container = document.getElementById('canvas-container');
    if (!container) return;

    let rangeTiles = getUnitMacroRangeTiles(selectedUnit);
    let cam = getCameraState();
    let scaleX = canvas.clientWidth / canvas.width;
    let scaleY = canvas.clientHeight / canvas.height;

    rangeTiles.forEach(tile => {
        let enemy = units.find(u => u.gridX === tile.c && u.gridY === tile.r && u.team !== selectedUnit.team);
        if (enemy && artilleryVulnerableUnits.has(enemy.name)) {
            let renderPos = getRenderCoordinates(enemy.gridX, enemy.gridY, canvas.width, localTeam);
            
            let worldX = renderPos.x * cam.zoom + cam.x;
            let worldY = renderPos.y * cam.zoom + cam.y;
            let screenX = worldX * scaleX;
            let screenY = worldY * scaleY;
            
            let scaledCellSize = renderPos.cellSize * cam.zoom * scaleX;
            let btnSize = Math.min(32, Math.max(20, scaledCellSize * 0.5));

            let offsetX = scaledCellSize - (btnSize * 0.3);
            let offsetY = -btnSize * 0.2;

            let btn = document.createElement('button');
            btn.className = 'artillery-strike-btn';
            btn.innerText = 'D';
            btn.title = `Strike enemy ${enemy.name} with Artillery`;

            btn.style.left = `${screenX + offsetX}px`;
            btn.style.top = `${screenY + offsetY}px`;
            btn.style.width = `${btnSize}px`;
            btn.style.height = `${btnSize}px`;
            btn.style.fontSize = `${Math.max(10, btnSize * 0.45)}px`;

            btn.onclick = (e) => {
                e.stopPropagation();
                triggerArtilleryStrike(enemy, selectedUnit, canvas);
            };

            container.appendChild(btn);
        }
    });
}

function triggerArtilleryStrike(targetEnemy, artilleryUnit, canvas) {
    // Calculate Chebyshev distance (8-directional distance)
    let chebyshevDist = Math.max(
        Math.abs(artilleryUnit.gridX - targetEnemy.gridX),
        Math.abs(artilleryUnit.gridY - targetEnemy.gridY)
    );

    // Dynamic success rate based on distance:
    // 60% at <= 4 squares away, scaling down to 18% at >= 8 squares away
    let successRate = 0.60;
    if (chebyshevDist >= 8) {
        successRate = 0.18;
    } else if (chebyshevDist > 4) {
        successRate = 0.60 - (chebyshevDist - 4) * 0.105;
    }

    let success = Math.random() < successRate;
    let triggeredDestructions = [];
    let destructionTimestamp = Date.now();

    if (success) {
        unitsToDestroy.push({
            unit: targetEnemy,
            destroyedBy: 'Artillery',
            reason: `Artillery (${artilleryUnit.team}) successfully shelled and destroyed target ${targetEnemy.name} at distance ${chebyshevDist} (chance: ${(successRate * 100).toFixed(1)}%)`
        });
        triggeredDestructions.push({
            targetId: targetEnemy.id,
            targetX: targetEnemy.gridX,
            targetY: targetEnemy.gridY,
            attackerX: artilleryUnit.gridX,
            attackerY: artilleryUnit.gridY,
            isFarAttack: true
        });
        triggerFarDestructionTrails(artilleryUnit.gridX, artilleryUnit.gridY, targetEnemy.gridX, targetEnemy.gridY, getRenderCoordinates, canvas, localTeam);
        logToConsole(`Artillery Strike 'D' Success! (${(successRate * 100).toFixed(1)}% chance at dist ${chebyshevDist}) Direct hit destroyed ${targetEnemy.name}!`);
    } else {
        triggerFarDestructionTrails(artilleryUnit.gridX, artilleryUnit.gridY, targetEnemy.gridX, targetEnemy.gridY, getRenderCoordinates, canvas, localTeam);
        logToConsole(`Artillery Strike 'D' Missed! (${(successRate * 100).toFixed(1)}% chance at dist ${chebyshevDist}) Shot fired at ${targetEnemy.name} missed.`);
    }

    processDestructions(units);
    clearArtilleryButtons();
    checkVictoryConditions(units, currentMatchId, logToConsole, isGameOver, (val) => { isGameOver = val; });

    artilleryUnit.hasMovedThisTurn = true;
    movedUnitsThisTurn.add(artilleryUnit.id);

    // Switch turn automatically after executing D strike
    movedUnitsThisTurn.clear();
    units.forEach(u => u.hasMovedThisTurn = false);
    let nextTurn = playerTeam === 'blue' ? 'red' : 'blue';
    currentTurn = nextTurn;
    lastSeenTurn = nextTurn;
    turnStartTime = Date.now();
    updateTurnButtonState(currentTurn, playerTeam);

    if (currentMatchId) {
        let sanitizedTileCaptures = {};
        Object.keys(tileCaptures).forEach(k => {
            sanitizedTileCaptures[k] = {
                type: tileCaptures[k].type,
                capturedBy: tileCaptures[k].capturedBy != null ? tileCaptures[k].capturedBy : null
            };
        });

        update(ref(db, `matches_plus/${currentMatchId}`), {
            units: units,
            tileCaptures: sanitizedTileCaptures,
            coins: teamCoins,
            turn: nextTurn,
            lastDestructions: triggeredDestructions.length > 0 ? {
                timestamp: destructionTimestamp,
                events: triggeredDestructions
            } : null,
            lastAction: {
                type: 'ARTILLERY_STRIKE_D',
                unitName: artilleryUnit.name,
                team: artilleryUnit.team,
                timestamp: Date.now()
            }
        });
    }

    selectedUnit = null;
    legalMoves = [];
    clearUnitRangeOverlayButton();
}


export function startGameSession(matchId, team, user, onLeaveCallback) {
    currentMatchId = matchId;
    playerTeam = team;
    localTeam = team;
    currentUser = user;
    currentTurn = 'blue';
    lastSeenTurn = null;
    teamCoins = { blue: 0, red: 0 };
    hasInitializedState = false;
    isGameOver = false;
    turnStartTime = Date.now();
    
    setTeamCoinsRef(teamCoins);
    setCurrentTeamRef(playerTeam);

    movedUnitsThisTurn.clear();
    setPendingUnitType(null);
    clearUnitRangeOverlayButton();
    clearArtilleryButtons();
    initTileCaptures();

    showScreen('game-screen');
    document.getElementById('playerTeamBadge').innerText = `Team: ${playerTeam.toUpperCase()}`;
    document.getElementById('statusBanner').innerText = "Match started! 60s turn timer active.";
    logToConsole(`Starting game session as team: ${playerTeam}`);

    startMatchMusic();

    if (coinIncomeInterval) clearInterval(coinIncomeInterval);
    coinIncomeInterval = setInterval(() => {
        if (isGameOver) return;

        let updated = false;

        if ((teamCoins.blue || 0) < 3) {
            teamCoins.blue = parseFloat(Math.min(3, (teamCoins.blue || 0) + 0.1).toFixed(1));
            updated = true;
        }

        if ((teamCoins.red || 0) < 3) {
            teamCoins.red = parseFloat(Math.min(3, (teamCoins.red || 0) + 0.1).toFixed(1));
            updated = true;
        }

        if (updated) {
            updateGlobalCoinHUD(teamCoins);

            if (currentMatchId) {
                update(ref(db, `matches_plus/${currentMatchId}`), { 
                    coins: teamCoins 
                });
            }
        }
    }, 2000);

    if (units.length === 0) {
        spawnTeamUnits('blue', units);
        spawnTeamUnits('red', units);
        units.forEach(u => {
            u.animFromX = u.gridX;
            u.animFromY = u.gridY;
            u.animStartTime = 0;
            u.lastKnownGridX = u.gridX;
            u.lastKnownGridY = u.gridY;
            u.hasMovedThisTurn = false;
        });
    }

    const matchIdRef = { get current() { return currentMatchId; }, set current(v) { currentMatchId = v; } };
    const teamRef = { get current() { return playerTeam; } };
    const turnRef = { get current() { return currentTurn; }, set current(v) { currentTurn = v; } };
    const animRef = { get current() { return animationFrameId; }, set current(v) { animationFrameId = v; } };

    const wrappedLeaveCallback = () => {
        stopMatchMusic();
        clearArtilleryButtons();
        if (typeof onLeaveCallback === 'function') {
            onLeaveCallback();
        }
    };

    ensureGameActionButtons(matchIdRef, teamRef, turnRef, movedUnitsThisTurn, animRef, wrappedLeaveCallback, logToConsole, () => updateTurnButtonState(currentTurn, playerTeam));
    ensureBuyUnitsModal(logToConsole, () => units, () => playerTeam, matchIdRef, () => updateGlobalCoinHUD(teamCoins));

    updateTurnButtonState(currentTurn, playerTeam);
    updateGlobalCoinHUD(teamCoins);
    initCanvasGame();
    startTurnTimer(matchIdRef);
    
    listenToMatchUpdates(currentMatchId, playerTeam, units, logToConsole,
        () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (turnTimerInterval) clearInterval(turnTimerInterval);
            if (coinIncomeInterval) clearInterval(coinIncomeInterval);
            stopMatchMusic();
            clearArtilleryButtons();
        },
        (turn, remoteData) => {
            const turnChanged = (turn !== currentTurn || turn !== lastSeenTurn);

            if (turnChanged) {
                logToConsole(`Turn changed to: ${turn}. Resetting turn timer.`);
                movedUnitsThisTurn.clear();
                units.forEach(u => u.hasMovedThisTurn = false);
                turnStartTime = Date.now();
            }
            
            currentTurn = turn;
            lastSeenTurn = turn;

            if (remoteData) {
                if (remoteData.status === 'ended' && !isGameOver) {
                    isGameOver = true;
                    stopMatchMusic();
                    
                    selectedUnit = null;
                    legalMoves = [];
                    stagedMove = null;
                    clearUnitRangeOverlayButton();
                    clearArtilleryButtons();

                    if (remoteData.winner) {
                        logToConsole(`Match ended remotely. Winner: ${remoteData.winner.toUpperCase()}`);
                    }
                }
                if (remoteData.coins) {
                    teamCoins.blue = remoteData.coins.blue || 0;
                    teamCoins.red = remoteData.coins.red || 0;
                    updateGlobalCoinHUD(teamCoins);
                }
                if (remoteData.tileCaptures) {
                    Object.keys(remoteData.tileCaptures).forEach(key => {
                        let remoteTile = remoteData.tileCaptures[key];
                        if (tileCaptures[key]) {
                            tileCaptures[key].capturedBy = (remoteTile && remoteTile.capturedBy != null) ? remoteTile.capturedBy : null;
                        } else if (remoteTile) {
                            tileCaptures[key] = {
                                type: remoteTile.type || 'unknown',
                                capturedBy: (remoteTile.capturedBy != null) ? remoteTile.capturedBy : null
                            };
                        }
                    });
                }
            }

            if (!hasInitializedState) {
                initializeTileCapturesState(tileCaptures);
                hasInitializedState = true;
            }

            checkVictoryConditions(units, currentMatchId, logToConsole, isGameOver, (val) => { 
                isGameOver = val; 
                if (val) {
                    stopMatchMusic();
                    selectedUnit = null;
                    legalMoves = [];
                    stagedMove = null;
                    clearUnitRangeOverlayButton();
                    clearArtilleryButtons();
                }
            });
            updateTurnButtonState(currentTurn, playerTeam);
        }
    );
    
    listenToMatchChat(currentMatchId, currentUser);
}

function startTurnTimer(matchIdRef) {
    if (turnTimerInterval) clearInterval(turnTimerInterval);

    turnTimerInterval = setInterval(() => {
        if (isGameOver) return;

        let elapsed = Date.now() - turnStartTime;
        let timeLeftSec = Math.ceil((TURN_TIME_LIMIT_MS - elapsed) / 1000);
        updateTurnTimerDisplay(timeLeftSec);

        if (elapsed >= TURN_TIME_LIMIT_MS && currentTurn === playerTeam) {
            logToConsole(`Turn time limit (60s) reached! Automatically changing turn.`);
            movedUnitsThisTurn.clear();
            units.forEach(u => u.hasMovedThisTurn = false);
            clearArtilleryButtons();
            
            let nextTurn = playerTeam === 'blue' ? 'red' : 'blue';
            currentTurn = nextTurn;
            lastSeenTurn = nextTurn;
            turnStartTime = Date.now();
            updateTurnButtonState(currentTurn, playerTeam);

            if (matchIdRef.current) {
                update(ref(db, `matches_plus/${matchIdRef.current}`), {
                    turn: nextTurn,
                    lastAction: {
                        type: 'TIMEOUT_TURN_CHANGE',
                        team: playerTeam,
                        timestamp: Date.now()
                    }
                });
            }
        }
    }, 1000);
}

function initCanvasGame() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 600;
    canvas.width = parentWidth > 0 ? parentWidth : 600;
    canvas.height = canvas.width * (rows / cols);

    resetCamera();
    initViewportControls(canvas);

    function renderGameLoop() {
        units.forEach(u => {
            if (u.gridX !== u.lastKnownGridX || u.gridY !== u.lastKnownGridY) {
                u.animFromX = u.lastKnownGridX !== undefined ? u.lastKnownGridX : u.gridX;
                u.animFromY = u.lastKnownGridY !== undefined ? u.lastKnownGridY : u.gridY;
                u.animStartTime = performance.now();
                u.lastKnownGridX = u.gridX;
                u.lastKnownGridY = u.gridY;
            }
        });

        drawGameScene(ctx, canvas, units, selectedUnit, localTeam, legalMoves, selectionAnimStartTime, stagedMove);
        
        if (selectedUnit) {
            let renderPos = getRenderCoordinates(selectedUnit.gridX, selectedUnit.gridY, canvas.width, localTeam);
            let scaleX = canvas.clientWidth / canvas.width;
            let scaleY = canvas.clientHeight / canvas.height;
            let cam = getCameraState();
            let worldX = renderPos.x * cam.zoom + cam.x;
            let worldY = renderPos.y * cam.zoom + cam.y;
            let screenX = worldX * scaleX;
            let screenY = worldY * scaleY;
            
            let scaledCellSize = renderPos.cellSize * cam.zoom * scaleX;
            let btnSize = Math.min(28, Math.max(16, scaledCellSize * 0.45));

            let btn = document.getElementById('activeUnitRangeBtn');
            if (btn) {
                let offsetX = scaledCellSize - (btnSize * 0.3);
                let offsetY = -btnSize * 0.3;

                btn.style.left = `${screenX + offsetX}px`;
                btn.style.top = `${screenY + offsetY}px`;
                btn.style.width = `${btnSize}px`;
                btn.style.height = `${btnSize}px`;
                btn.style.fontSize = `${Math.max(9, btnSize * 0.45)}px`;
            }

            if (selectedUnit.name === 'Artillery' && getShowUnitRange(selectedUnit.id)) {
                updateArtilleryButtons(canvas, selectedUnit, localTeam);
            } else {
                clearArtilleryButtons();
            }
        } else {
            clearArtilleryButtons();
        }

        animationFrameId = requestAnimationFrame(renderGameLoop);
    }

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    renderGameLoop();

    canvas.onclick = (e) => {
        if (isGameOver) return;
        if (getCameraState().activePointers.size > 0) return;

        const world = screenToWorldCoordinates(e.clientX, e.clientY, canvas);
        let cellSize = canvas.width / cols;
        let clickedCol = Math.floor(world.x / cellSize);
        let clickedRow = Math.floor(world.y / cellSize);

        if (clickedCol < 0 || clickedCol >= cols || clickedRow < 0 || clickedRow >= rows) return;

        if (localTeam === 'red') {
            clickedCol = cols - 1 - clickedCol;
            clickedRow = rows - 1 - clickedRow;
        }

        if (getPendingUnitType()) {
            let placed = handleUnitDeployment(clickedCol, clickedRow, playerTeam, units, currentMatchId, logToConsole, teamCoins, () => updateGlobalCoinHUD(teamCoins));
            if (placed) {
                cleanupUnitDeployerPopup();
                selectedUnit = null;
                legalMoves = [];
                stagedMove = null;
                clearUnitRangeOverlayButton();
                clearArtilleryButtons();
                return;
            }
        }

        const clickedUnit = units.find(u => u.gridX === clickedCol && u.gridY === clickedRow);

        if (clickedUnit) {
            stagedMove = null;
            if (clickedUnit.team === playerTeam) {
                selectedUnit = clickedUnit;
                selectionAnimStartTime = performance.now();
                triggerSelectSound(selectedUnit.name);

                if (currentTurn !== playerTeam) {
                    legalMoves = [];
                    logToConsole(`Inspecting own unit out-of-turn: ${selectedUnit.name} (${selectedUnit.team}) at [${clickedCol}, ${clickedRow}]`);
                } else if (movedUnitsThisTurn.has(selectedUnit.id) || clickedUnit.hasMovedThisTurn) {
                    legalMoves = [];
                    logToConsole(`Unit ${selectedUnit.name} has already moved this turn and cannot move again.`);
                } else {
                    legalMoves = getLegalMoves(selectedUnit, units);
                    logToConsole(`Selected unit: ${selectedUnit.name} (${selectedUnit.team}) at [${clickedCol}, ${clickedRow}]`);
                }

                updateUnitRangeOverlayButton(canvas, selectedUnit, localTeam, logToConsole);
            } else {
                selectedUnit = clickedUnit;
                selectionAnimStartTime = performance.now();
                triggerSelectSound(selectedUnit.name);
                legalMoves = [];
                updateUnitRangeOverlayButton(canvas, selectedUnit, localTeam, logToConsole);
                logToConsole(`Inspecting enemy unit: ${selectedUnit.name} (${selectedUnit.team}) at [${clickedCol}, ${clickedRow}]`);
            }
        } else if (selectedUnit) {
            if (selectedUnit.team !== playerTeam || currentTurn !== playerTeam) {
                selectedUnit = null;
                legalMoves = [];
                stagedMove = null;
                selectionAnimStartTime = null;
                clearUnitRangeOverlayButton();
                clearArtilleryButtons();
                return;
            }

            if (movedUnitsThisTurn.has(selectedUnit.id) || selectedUnit.hasMovedThisTurn) {
                logToConsole(`Movement Blocked: ${selectedUnit.name} already moved this turn.`);
                selectedUnit = null;
                legalMoves = [];
                stagedMove = null;
                selectionAnimStartTime = null;
                clearUnitRangeOverlayButton();
                clearArtilleryButtons();
                return;
            }

            let isLegalMove = legalMoves.some(m => m.c === clickedCol && m.r === clickedRow);
            if (isLegalMove) {
                if (!stagedMove || stagedMove.c !== clickedCol || stagedMove.r !== clickedRow) {
                    stagedMove = { c: clickedCol, r: clickedRow };
                    logToConsole(`Staged move for ${selectedUnit.name} to [${clickedCol}, ${clickedRow}]. Click again to confirm.`);
                    return;
                }

                stagedMove = null;
                triggerMoveSound(selectedUnit.name);

                selectedUnit.animFromX = selectedUnit.gridX;
                selectedUnit.animFromY = selectedUnit.gridY;
                selectedUnit.animStartTime = performance.now();
                
                selectedUnit.gridX = clickedCol;
                selectedUnit.gridY = clickedRow;
                selectedUnit.lastKnownGridX = clickedCol;
                selectedUnit.lastKnownGridY = clickedRow;
                
                selectedUnit.hasMovedThisTurn = true;

                let moveKey = `${clickedCol},${clickedRow}`;
                let unitNameLower = (selectedUnit.name || '').toLowerCase();
                let isInfantryOrTank = unitNameLower.includes('infantry') || unitNameLower.includes('tank');

                if (isInfantryOrTank) {
                    if (checkBaseCaptureVictory(selectedUnit, moveKey, currentMatchId, logToConsole, isGameOver, (val) => { 
                        isGameOver = val; 
                        if (val) {
                            stopMatchMusic();
                            selectedUnit = null;
                            legalMoves = [];
                            stagedMove = null;
                            clearUnitRangeOverlayButton();
                            clearArtilleryButtons();
                        }
                    })) {
                        return;
                    }

                    if (tileCaptures[moveKey]) {
                        let tileInfo = tileCaptures[moveKey];
                        let cluster = getGoldCoreCluster(moveKey);

                        if (cluster) {
                            let gcKey = parseCoord(cluster.gc);
                            let gcTile = tileCaptures[gcKey];
                            
                            let needsCapture = false;
                            if (gcTile && gcTile.capturedBy !== selectedUnit.team) needsCapture = true;
                            
                            if (!needsCapture) {
                                for (let linkItem of cluster.linked) {
                                    let lKey = parseCoord(linkItem);
                                    if (lKey && tileCaptures[lKey] && tileCaptures[lKey].capturedBy !== selectedUnit.team) {
                                        needsCapture = true;
                                        break;
                                    }
                                }
                            }
                            if (!needsCapture && cluster.units) {
                                for (let uItem of cluster.units) {
                                    let uKey = parseCoord(uItem.coordinates);
                                    if (uKey && tileCaptures[uKey] && tileCaptures[uKey].capturedBy !== selectedUnit.team) {
                                        needsCapture = true;
                                        break;
                                    }
                                }
                            }

                            if (needsCapture) {
                                if (gcTile) gcTile.capturedBy = selectedUnit.team;

                                cluster.linked.forEach(linkItem => {
                                    let linkKey = parseCoord(linkItem);
                                    if (linkKey && tileCaptures[linkKey]) {
                                        tileCaptures[linkKey].capturedBy = selectedUnit.team;
                                    }
                                });

                                if (cluster.units) {
                                    cluster.units.forEach(uItem => {
                                        let uKey = parseCoord(uItem.coordinates);
                                        if (uKey && tileCaptures[uKey]) {
                                            tileCaptures[uKey].capturedBy = selectedUnit.team;
                                        }
                                    });
                                }

                                teamCoins[selectedUnit.team] = (teamCoins[selectedUnit.team] || 0) + 2;
                                logToConsole(`${selectedUnit.team.toUpperCase()} captured Gold Core cluster centrally (+2 coins)! Total: ${teamCoins[selectedUnit.team]}`);
                                updateGlobalCoinHUD(teamCoins);
                            }
                        } else if (tileInfo.capturedBy !== selectedUnit.team) {
                            tileInfo.capturedBy = selectedUnit.team;
                            let tileType = (tileInfo.type || '').toLowerCase();
                            let earnedCoins = 0;
                            if (['gold', 'artillery', 'tank', 'port'].includes(tileType)) earnedCoins = 0.5;

                            if (earnedCoins > 0) {
                                teamCoins[selectedUnit.team] = (teamCoins[selectedUnit.team] || 0) + earnedCoins;
                                logToConsole(`${selectedUnit.team.toUpperCase()} captured ${tileInfo.type} (+${earnedCoins} coins)! Total: ${teamCoins[selectedUnit.team]}`);
                                updateGlobalCoinHUD(teamCoins);
                            }
                        }
                    }
                }

                if (!movedUnitsThisTurn.has(selectedUnit.id)) {
                    movedUnitsThisTurn.add(selectedUnit.id);
                }

                resolveCombat(units, logToConsole);

                let triggeredDestructions = [];
                let destructionTimestamp = Date.now();

                if (unitsToDestroy && unitsToDestroy.length > 0) {
                    unitsToDestroy.forEach(item => {
                        let targetUnit = item.unit;
                        let attackerType = (item.destroyedBy || '').toLowerCase();
                        let isFarAttack = attackerType.includes('artillery') || attackerType.includes('ship') || attackerType.includes('anti-air');

                        let startX = item.attackerX !== undefined ? item.attackerX : targetUnit.gridX;
                        let startY = item.attackerY !== undefined ? item.attackerY : targetUnit.gridY;
                        
                        triggeredDestructions.push({
                            targetId: targetUnit.id,
                            targetX: targetUnit.gridX,
                            targetY: targetUnit.gridY,
                            attackerX: startX,
                            attackerY: startY,
                            isFarAttack: isFarAttack
                        });

                        if (isFarAttack) {
                            triggerFarDestructionTrails(startX, startY, targetUnit.gridX, targetUnit.gridY, getRenderCoordinates, canvas, localTeam);
                        } else {
                            triggerFrontalExplosion(targetUnit.gridX, targetUnit.gridY, getRenderCoordinates, canvas, localTeam);
                        }
                    });

                    processDestructions(units);
                }

                checkVictoryConditions(units, currentMatchId, logToConsole, isGameOver, (val) => { 
                    isGameOver = val; 
                    if (val) {
                        stopMatchMusic();
                        selectedUnit = null;
                        legalMoves = [];
                        stagedMove = null;
                        clearUnitRangeOverlayButton();
                        clearArtilleryButtons();
                    }
                });
                if (isGameOver) return;
                
                let nextTurn = currentTurn;
                let turnChanged = false;

                if (movedUnitsThisTurn.size >= 1) {
                    movedUnitsThisTurn.clear();
                    units.forEach(u => u.hasMovedThisTurn = false);
                    nextTurn = playerTeam === 'blue' ? 'red' : 'blue';
                    currentTurn = nextTurn;
                    lastSeenTurn = nextTurn;
                    turnStartTime = Date.now();
                    turnChanged = true;
                    updateTurnButtonState(currentTurn, playerTeam);
                }

                if (currentMatchId) {
                    let sanitizedTileCaptures = {};
                    Object.keys(tileCaptures).forEach(k => {
                        sanitizedTileCaptures[k] = {
                            type: tileCaptures[k].type,
                            capturedBy: tileCaptures[k].capturedBy != null ? tileCaptures[k].capturedBy : null
                        };
                    });

                    let payload = { 
                        units: units,
                        tileCaptures: sanitizedTileCaptures,
                        coins: teamCoins,
                        lastDestructions: triggeredDestructions.length > 0 ? {
                            timestamp: destructionTimestamp,
                            events: triggeredDestructions
                        } : null,
                        lastAction: {
                            type: 'MOVE',
                            unitName: selectedUnit.name,
                            team: selectedUnit.team,
                            timestamp: Date.now()
                        }
                    };
                    if (turnChanged) {
                        payload.turn = nextTurn;
                    }
                    update(ref(db, `matches_plus/${currentMatchId}`), payload);
                }

                selectedUnit = null;
                legalMoves = [];
                stagedMove = null;
                selectionAnimStartTime = null;
                clearUnitRangeOverlayButton();
                clearArtilleryButtons();
            } else {
                stagedMove = null;
                selectedUnit = null;
                legalMoves = [];
                clearUnitRangeOverlayButton();
                clearArtilleryButtons();
            }
        } else {
            stagedMove = null;
            selectedUnit = null;
            legalMoves = [];
            clearUnitRangeOverlayButton();
            clearArtilleryButtons();
        }
    };
}






