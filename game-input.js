// game-input.js - Utility helper functions for input coordinate mapping
import { cols, rows } from './game-config.js';

export function getGridCoordinatesFromClient(clientX, clientY, canvas, cameraX, cameraY, cameraZoom, localTeam) {
    const rect = canvas.getBoundingClientRect();
    const worldX = ((clientX - rect.left) - cameraX) / cameraZoom;
    const worldY = ((clientY - rect.top) - cameraY) / cameraZoom;

    let cellSize = canvas.width / cols;
    let clickedCol = Math.floor(worldX / cellSize);
    let clickedRow = Math.floor(worldY / cellSize);

    if (clickedCol < 0 || clickedCol >= cols || clickedRow < 0 || clickedRow >= rows) {
        return null;
    }

    if (localTeam === 'red') {
        clickedCol = cols - 1 - clickedCol;
        clickedRow = rows - 1 - clickedRow;
    }

    return { col: clickedCol, row: clickedRow };
}