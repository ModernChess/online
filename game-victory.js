// game-victory.js - Victory conditions and game state termination logic
import { db, ref, update } from './network.js';
import { rbList, bbList, parseCoord } from './team-logic.js';

export function checkVictoryConditions(currentUnits, matchId, logger, isGameOver, setGameOver) {
    if (isGameOver) return;

    const blueUnits = currentUnits.filter(u => u.team === 'blue');
    const redUnits = currentUnits.filter(u => u.team === 'red');

    if (blueUnits.length === 0 && redUnits.length > 0) {
        setGameOver(true);
        logger(`VICTORY! All Blue units have been destroyed! Red team wins!`);
        alert(`Game Over! Red team won because all Blue units were destroyed!`);
        endGameSessionState(matchId, 'red');
    } else if (redUnits.length === 0 && blueUnits.length > 0) {
        setGameOver(true);
        logger(`VICTORY! All Red units have been destroyed! Blue team wins!`);
        alert(`Game Over! Blue team won because all Blue units were destroyed!`);
        endGameSessionState(matchId, 'blue');
    }
}

export function checkBaseCaptureVictory(unit, moveKey, matchId, logger, isGameOver, setGameOver) {
    if (isGameOver) return false;
    let unitNameLower = (unit.name || '').toLowerCase();
    let isInfantryOrTank = unitNameLower.includes('infantry') || unitNameLower.includes('tank');
    if (!isInfantryOrTank) return false;

    const isRedBase = rbList.some(item => parseCoord(item) === moveKey);
    const isBlueBase = bbList.some(item => parseCoord(item) === moveKey);

    if (isRedBase && unit.team === 'blue') {
        setGameOver(true);
        logger(`VICTORY! Blue team captured the Red Base/Core! Blue wins!`);
        alert(`Game Over! Blue team won by capturing the Red Base!`);
        endGameSessionState(matchId, 'blue');
        return true;
    } else if (isBlueBase && unit.team === 'red') {
        setGameOver(true);
        logger(`VICTORY! Red team captured the Blue Base/Core! Red wins!`);
        alert(`Game Over! Red team won by capturing the Blue Base!`);
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
    }
}