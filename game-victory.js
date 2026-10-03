// game-victory.js - Victory conditions and game state termination logic
import { db, ref, update, get, remove } from './network.js';
import { rbList, bbList, parseCoord } from './team-logic.js';
import { stalematedUnits } from './combat-mechanics.js';

function isLandUnit(u) {
    let name = (u.name || '').toLowerCase();
    let type = (u.type || '').toLowerCase();
    return name !== 'ship' && name !== 'plane' && !type.includes('naval') && !type.includes('air');
}

export function checkVictoryConditions(currentUnits, matchId, logger, isGameOver, setGameOver, onGameOverCallback = null) {
    if (isGameOver) return;

    const blueUnits = currentUnits.filter(u => u.team === 'blue');
    const redUnits = currentUnits.filter(u => u.team === 'red');

    const blueLandUnits = blueUnits.filter(isLandUnit);
    const redLandUnits = redUnits.filter(isLandUnit);

    const blueAllLandStalemated = blueLandUnits.length > 0 && blueLandUnits.every(u => u.stalemate || stalematedUnits.has(u.id));
    const redAllLandStalemated = redLandUnits.length > 0 && redLandUnits.every(u => u.stalemate || stalematedUnits.has(u.id));

    if (blueAllLandStalemated && redAllLandStalemated) {
        setGameOver(true);
        if (onGameOverCallback) onGameOverCallback();
        logger(`GAME OVER! It's a draw because all land units for both teams are stalemated!`);
        endGameSessionState(matchId, 'draw');
        return;
    }

    const blueHasOnlyNonLand = blueUnits.length > 0 && blueLandUnits.length === 0;
    const redHasOnlyNonLand = redUnits.length > 0 && redLandUnits.length === 0;

    // Fixed conditions: properly checking that one team's units are 0 while the opposing team still has units alive (> 0)
    const redWins = (blueUnits.length === 0 && redUnits.length > 0) || blueHasOnlyNonLand || blueAllLandStalemated;
    const blueWins = (redUnits.length === 0 && blueUnits.length > 0) || redHasOnlyNonLand || redAllLandStalemated;

    if (redWins && !blueWins) {
        setGameOver(true);
        if (onGameOverCallback) onGameOverCallback();
        let reason = blueAllLandStalemated 
            ? "all Blue land units are stalemated" 
            : (blueHasOnlyNonLand ? "all Blue land units were destroyed (only ships/non-land units remain)" : "all Blue units have been destroyed");
        
        logger(`VICTORY! Red team wins because ${reason}!`);
        endGameSessionState(matchId, 'red');
    } else if (blueWins && !redWins) {
        setGameOver(true);
        if (onGameOverCallback) onGameOverCallback();
        let reason = redAllLandStalemated 
            ? "all Red land units are stalemated" 
            : (redHasOnlyNonLand ? "all Red land units were destroyed (only ships/non-land units remain)" : "all Red units have been destroyed");
        
        logger(`VICTORY! Blue team wins because ${reason}!`);
        endGameSessionState(matchId, 'blue');
    }
}

export function checkBaseCaptureVictory(unit, moveKey, matchId, logger, isGameOver, setGameOver, onGameOverCallback = null) {
    if (isGameOver) return false;
    let unitNameLower = (unit.name || '').toLowerCase();
    let isInfantryOrTank = unitNameLower.includes('infantry') || unitNameLower.includes('tank');
    if (!isInfantryOrTank) return false;

    const isRedBase = rbList.some(item => parseCoord(item) === moveKey);
    const isBlueBase = bbList.some(item => parseCoord(item) === matchId ? false : bbList.some(i => parseCoord(i) === moveKey)); // Safe fallback lookup

    if (isRedBase && unit.team === 'blue') {
        setGameOver(true);
        if (onGameOverCallback) onGameOverCallback();
        logger(`VICTORY! Blue team captured the Red Base/Core! Blue wins!`);
        endGameSessionState(matchId, 'blue');
        return true;
    } else if (isBlueBase && unit.team === 'red') {
        setGameOver(true);
        if (onGameOverCallback) onGameOverCallback();
        logger(`VICTORY! Red team captured the Blue Base/Core! Red wins!`);
        endGameSessionState(matchId, 'red');
        return true;
    }
    return false;
}

export function endGameSessionState(matchId, winnerTeam) {
    if (matchId) {
        update(ref(db, `matches/${matchId}`), {
            status: 'ended',
            winner: winnerTeam
        });

        const serversRef = ref(db, 'servers');
        get(serversRef).then((snapshot) => {
            const servers = snapshot.val() || {};
            for (let sId in servers) {
                if (servers[sId].matchId === matchId) {
                    remove(ref(db, `servers/${sId}`));
                    break;
                }
            }
        });
    }
}
