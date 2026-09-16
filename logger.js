// logger.js - Independent Global Error & Console Interceptor

(function () {
    // Create the console container and DOM elements if they don't already exist
    function ensureConsoleDOM() {
        if (document.getElementById('console-container')) return;

        const container = document.createElement('div');
        container.id = 'console-container';
        container.innerHTML = `
            <div class="console-header">
                <span>LIVE SYSTEM CONSOLE</span>
                <button id="clearConsole" style="background:none; border:none; color:#ff5252; cursor:pointer; font-size:0.7rem; font-weight:bold;">CLEAR</button>
            </div>
            <div id="console-logs"></div>
        `;

        // Style the logger box dynamically so it works out-of-the-box
        container.style.cssText = `
            width: 100%;
            background: #000;
            border: 1px solid #333;
            border-radius: 8px;
            margin-top: 5px;
            overflow: hidden;
            font-family: monospace;
            box-sizing: border-box;
        `;
        
        const header = container.querySelector('.console-header');
        header.style.cssText = `
            background: #1a1a1a;
            padding: 4px 8px;
            font-size: 0.7rem;
            color: #00ff66;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #333;
        `;

        const logs = container.querySelector('#console-logs');
        logs.style.cssText = `
            height: 70px;
            overflow-y: auto;
            padding: 6px;
            font-size: 0.65rem;
            color: #00ff66;
            text-align: left;
            line-height: 1.25;
            background: #080808;
            white-space: pre-wrap;
            word-break: break-all;
        `;

        // Append to app wrapper or body once DOM is ready
        const target = document.querySelector('.app-wrapper') || document.body;
        target.appendChild(container);

        document.getElementById('clearConsole')?.addEventListener('click', () => {
            logs.innerHTML = '';
        });
    }

    function appendLog(message, color = '#00ff66') {
        ensureConsoleDOM();
        const logsContainer = document.getElementById('console-logs');
        if (!logsContainer) return;

        const entry = document.createElement('div');
        entry.style.color = color;
        entry.textContent = message;
        logsContainer.appendChild(entry);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    // 1. Intercept Standard Console Methods
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = function (...args) {
        originalLog.apply(console, args);
        appendLog('[LOG] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '), '#00ff66');
    };

    console.warn = function (...args) {
        originalWarn.apply(console, args);
        appendLog('[WARN] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '), '#ffeb3b');
    };

    console.error = function (...args) {
        originalError.apply(console, args);
        appendLog('[ERROR] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '), '#ff5252');
    };

    // 2. Catch Global Runtime Exceptions
    window.onerror = function (msg, url, lineNo, columnNo, error) {
        const filePath = url ? url.split('/').pop() : 'unknown';
        appendLog(`[FATAL] ${msg} (${filePath}:${lineNo}:${columnNo})`, '#ff5252');
        return false; // Let default browser error handling run too
    };

    // 3. Catch Unhandled Promise Rejections (Async/Fetch errors)
    window.addEventListener('unhandledrejection', function (event) {
        appendLog(`[REJECTION] ${event.reason?.message || event.reason}`, '#ff5252');
    });

    // Ensure DOM binding hook runs safely
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureConsoleDOM);
    } else {
        ensureConsoleDOM();
    }
})();