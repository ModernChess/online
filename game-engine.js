import { db, ref, update } from './network.js';
import { showScreen } from './ui-manager.js';
import { cols, rows, spawnTeamUnits } from './game-config.js';
import { initViewportControls, resetCamera, screenToWorldCoordinates, getCameraState } from './viewport.js';
import { listenToMatchUpdates, listenToMatchChat } from './game-sync.js';
import { drawGameScene, getRenderCoordinates } from './game-renderer.js';
import { getLegalMoves, getShowUnitRange, clearUnitRangeOverlayButton, updateUnitRangeOverlayButton } from './unit-movement.js';
import { resolveCombat, processDestructions, unitsToDestroy } from './combat-mechanics.js';
import { ensureBuyUnitsModal, handleUnitDeployment, getPendingUnitType, setPendingUnitType, cleanupUnitDeployerPopup, setTeamCoinsRef, setCurrentTeamRef, getTeamCoins } from './deployment.js';
import { tileCaptures, initTileCaptures, parseCoord, rbList, bbList, getGoldCoreCluster } from './team-logic.js';
import { createConsoleLogger, updateTurnButtonState, ensureGameActionButtons, updateGlobalCoinHUD, updateTurnTimerDisplay } from './game-controls.js';
import { triggerSelectSound, triggerMoveSound } from './sound.js';
import { initializeTileCapturesState } from './renderer-helpers.js';
import { checkVictoryConditions, checkBaseCaptureVictory } from './game-victory.js';

let currentMatchId = null;
let playerTeam = null;
let localTeam = 'blue';
let currentUser = null;
let currentTurn = 'blue';
let lastSeenTurn = null;
let selectedUnit = null;
let legalMoves = [];
let selectionAnimStartTime = null;
let animationFrameId = null;
let units = [];
let movedUnitsThisTurn = new Set();
let teamCoins = { blue: 0, red: 0 };
let hasInitializedState = false;
let isGameOver = false;

// Timer tracking variables
let turnStartTime = Date.now();
let turnTimerInterval = null;
const TURN_TIME_LIMIT_MS = 30000; // 30 seconds

const logToConsole = createConsoleLogger();
initTileCaptures();

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
    initTileCaptures();

    showScreen('game-screen');
    document.getElementById('playerTeamBadge').innerText = `Team: ${playerTeam.toUpperCase()}`;
    document.getElementById('statusBanner').innerText = "Match started! 30s turn timer active.";
    logToConsole(`Starting game session as team: ${playerTeam}`);

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

    ensureGameActionButtons(matchIdRef, teamRef, turnRef, movedUnitsThisTurn, animRef, onLeaveCallback, logToConsole, () => updateTurnButtonState(currentTurn, playerTeam));
    
    ensureBuyUnitsModal(
        logToConsole, 
        () => units, 
        () => playerTeam, 
        matchIdRef, 
        () => updateGlobalCoinHUD(teamCoins)
    );

    updateTurnButtonState(currentTurn, playerTeam);
    updateGlobalCoinHUD(teamCoins);
    initCanvasGame();
    startTurnTimer(matchIdRef);
    
    listenToMatchUpdates(currentMatchId, playerTeam, units, logToConsole,
        () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (turnTimerInterval) clearInterval(turnTimerInterval);
        },
        (turn, remoteData) => {
            const turnChanged = (turn !== currentTurn || turn !== lastSeenTurn);

            if (turnChanged) {
                logToConsole(`Turn changed to: ${turn}. Resetting turn timer.`);
                movedUnitsThisTurn.clear();
                units.forEach(u => u.hasMovedThisTurn = false);
                turnStartTime = Date.now(); // Reset timer on turn sync
            }
            
            currentTurn = turn;
            lastSeenTurn = turn;

            if (remoteData) {
                if (remoteData.status === 'ended' && !isGameOver) {
                    isGameOver = true;
                    if (remoteData.winner) {
                        alert(`Game Over! Team ${remoteData.winner.toUpperCase()} won the match!`);
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

            checkVictoryConditions(units, currentMatchId, logToConsole, isGameOver, (val) => { isGameOver = val; });
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

        // If the active player exceeds 30 seconds, automatically force turn change
        if (elapsed >= TURN_TIME_LIMIT_MS && currentTurn === playerTeam) {
            logToConsole(`Turn time limit (30s) reached! Automatically changing turn.`);
            movedUnitsThisTurn.clear();
            units.forEach(u => u.hasMovedThisTurn = false);
            
            let nextTurn = playerTeam === 'blue' ? 'red' : 'blue';
            currentTurn = nextTurn;
            lastSeenTurn = nextTurn;
            turnStartTime = Date.now();
            updateTurnButtonState(currentTurn, playerTeam);

            if (matchIdRef.current) {
                update(ref(db, `matches/${matchIdRef.current}`), {
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

        drawGameScene(ctx, canvas, units, selectedUnit, localTeam, legalMoves, selectionAnimStartTime);
        
        if (selectedUnit) {
            let renderPos = getRenderCoordinates(selectedUnit.gridX, selectedUnit.gridY, canvas.width, localTeam);
            let btn = document.getElementById('activeUnitRangeBtn');
            if (btn) {
                let cam = getCameraState();
                let screenX = (renderPos.x * cam.zoom + cam.x) * (canvas.clientWidth / canvas.width);
                let screenY = (renderPos.y * cam.zoom + cam.y) * (canvas.clientHeight / canvas.height);
                
                let scaledCellSize = renderPos.cellSize * cam.zoom * (canvas.clientWidth / canvas.width);
                let btnSize = Math.min(28, Math.max(16, scaledCellSize * 0.45));

                let offsetX = scaledCellSize - (btnSize * 0.3);
                let offsetY = -btnSize * 0.3;

                btn.style.left = `${screenX + offsetX}px`;
                btn.style.top = `${screenY + offsetY}px`;
                btn.style.width = `${btnSize}px`;
                btn.style.height = `${btnSize}px`;
                btn.style.fontSize = `${Math.max(9, btnSize * 0.45)}px`;
            }
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
                clearUnitRangeOverlayButton();
                return;
            }
        }

        const clickedUnit = units.find(u => u.gridX === clickedCol && u.gridY === clickedRow);

        if (clickedUnit) {
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
                selectionAnimStartTime = null;
                clearUnitRangeOverlayButton();
                return;
            }

            if (movedUnitsThisTurn.has(selectedUnit.id) || selectedUnit.hasMovedThisTurn) {
                logToConsole(`Movement Blocked: ${selectedUnit.name} already moved this turn.`);
                selectedUnit = null;
                legalMoves = [];
                selectionAnimStartTime = null;
                clearUnitRangeOverlayButton();
                return;
            }

            let isLegalMove = legalMoves.some(m => m.c === clickedCol && m.r === clickedRow);
            if (isLegalMove) {
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
                    if (checkBaseCaptureVictory(selectedUnit, moveKey, currentMatchId, logToConsole, isGameOver, (val) => { isGameOver = val; })) {
                        return;
                    }

                    if (tileCaptures[moveKey]) {
                        let tileInfo = tileCaptures[moveKey];
                        let cluster = getGoldCoreCluster(moveKey);

                        if (cluster) {
                            let gcKey = parseCoord(cluster.gc);
                            let gcTile = tileCaptures[gcKey];
                            if (gcTile && gcTile.capturedBy !== selectedUnit.team) {
                                gcTile.capturedBy = selectedUnit.team;
                                cluster.linked.forEach(l => {
                                    let lKey = parseCoord(l);
                                    if (tileCaptures[lKey]) {
                                        tileCaptures[lKey].capturedBy = selectedUnit.team;
                                    }
                                });

                                teamCoins[selectedUnit.team] = (teamCoins[selectedUnit.team] || 0) + 2;
                                logToConsole(`${selectedUnit.team.toUpperCase()} captured Gold Core (+2 coins)! Total: ${teamCoins[selectedUnit.team]}`);
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
                if (unitsToDestroy.length > 0) {
                    processDestructions(units);
                }

                checkVictoryConditions(units, currentMatchId, logToConsole, isGameOver, (val) => { isGameOver = val; });
                if (isGameOver) return;
                
                let nextTurn = currentTurn;
                let turnChanged = false;

                if (movedUnitsThisTurn.size >= 1) {
                    movedUnitsThisTurn.clear();
                    units.forEach(u => u.hasMovedThisTurn = false);
                    nextTurn = playerTeam === 'blue' ? 'red' : 'blue';
                    currentTurn = nextTurn;
                    lastSeenTurn = nextTurn;
                    turnStartTime = Date.now(); // Reset timer on turn change
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
                    update(ref(db, `matches/${currentMatchId}`), payload);
                }

                selectedUnit = null;
                legalMoves = [];
                selectionAnimStartTime = null;
                clearUnitRangeOverlayButton();
            }
        } else {
            selectedUnit = null;
            legalMoves = [];
            clearUnitRangeOverlayButton();
        }
    };
}
