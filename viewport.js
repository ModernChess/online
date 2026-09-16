// viewport.js - Handles Camera Transformations, Panning, and Zooming Controls with Advanced Pinch & Capture Support
let cameraZoom = 1.0;
let cameraX = 0;
let cameraY = 0;
let isDragging = false;
let panSensitivity = 1;

const activePointers = new Map();
let initialPinchDistance = null;
let initialZoom = 1.0;

export function getCameraState() {
    return {
        get zoom() { return cameraZoom; },
        get x() { return cameraX; },
        get y() { return cameraY; },
        get activePointers() { return activePointers; }
    };
}

export function resetCamera() {
    cameraZoom = 1.0;
    cameraX = 0;
    cameraY = 0;
    isDragging = false;
    activePointers.clear();
    initialPinchDistance = null;
}

function getPinchDistance(p1, p2) {
    const dx = p1.clientX - p2.clientX;
    const dy = p1.clientY - p2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getPinchCenter(p1, p2, rect) {
    return {
        x: ((p1.clientX + p2.clientX) / 2) - rect.left,
        y: ((p1.clientY + p2.clientY) / 2) - rect.top
    };
}

export function initViewportControls(canvas, onTransformUpdate) {
    canvas.addEventListener('pointerdown', (e) => {
        try {
            canvas.setPointerCapture(e.pointerId);
        } catch (err) {}
        
        activePointers.set(e.pointerId, e);
        
        if (activePointers.size === 1) {
            isDragging = true;
            initialPinchDistance = null;
        } else if (activePointers.size === 2) {
            isDragging = false;
            const pointers = Array.from(activePointers.values());
            const rect = canvas.getBoundingClientRect();
            initialPinchDistance = getPinchDistance(pointers[0], pointers[1]);
            initialZoom = cameraZoom;
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!activePointers.has(e.pointerId)) return;
        activePointers.set(e.pointerId, e);

        if (activePointers.size === 2 && initialPinchDistance !== null && initialPinchDistance > 0) {
            const pointers = Array.from(activePointers.values());
            const rect = canvas.getBoundingClientRect();
            const currentDistance = getPinchDistance(pointers[0], pointers[1]);
            const currentCenter = getPinchCenter(pointers[0], pointers[1], rect);
            
            const zoomFactor = currentDistance / initialPinchDistance;
            const newZoom = Math.min(Math.max(initialZoom * zoomFactor, 0.5), 4.0);

            cameraX = currentCenter.x - (currentCenter.x - cameraX) * (newZoom / cameraZoom);
            cameraY = currentCenter.y - (currentCenter.y - cameraY) * (newZoom / cameraZoom);
            cameraZoom = newZoom;
        } else if (isDragging && activePointers.size === 1) {
            cameraX += e.movementX * panSensitivity;
            cameraY += e.movementY * panSensitivity;
        }
        if (onTransformUpdate) onTransformUpdate();
    });

    const removePointer = (e) => {
        try {
            canvas.releasePointerCapture(e.pointerId);
        } catch (err) {}

        activePointers.delete(e.pointerId);

        if (activePointers.size === 1) {
            const remainingPointer = Array.from(activePointers.values())[0];
            activePointers.set(remainingPointer.pointerId, remainingPointer);
            initialPinchDistance = null;
            isDragging = true;
        } else if (activePointers.size < 2) {
            initialPinchDistance = null;
        }

        if (activePointers.size === 0) {
            isDragging = false;
        }
    };

    canvas.addEventListener('pointerup', removePointer);
    canvas.addEventListener('pointercancel', removePointer);

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let zoomIntensity = 0.1;
        let newZoom = cameraZoom;
        if (e.deltaY < 0) {
            newZoom = Math.min(cameraZoom * (1 + zoomIntensity), 4.0);
        } else {
            newZoom = Math.max(cameraZoom * (1 - zoomIntensity), 0.5);
        }

        cameraX = mouseX - (mouseX - cameraX) * (newZoom / cameraZoom);
        cameraY = mouseY - (mouseY - cameraY) * (newZoom / cameraZoom);
        cameraZoom = newZoom;

        if (onTransformUpdate) onTransformUpdate();
    }, { passive: false });
}

export function screenToWorldCoordinates(clientX, clientY, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return {
        x: (x - cameraX) / cameraZoom,
        y: (y - cameraY) / cameraZoom
    };
}

export function applyCameraTransform(ctx) {
    ctx.translate(cameraX, cameraY);
    ctx.scale(cameraZoom, cameraZoom);
}
