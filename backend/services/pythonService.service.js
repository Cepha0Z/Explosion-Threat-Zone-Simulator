/**
 * Python Service Manager
 * Spawns and manages the Python Flask service
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonProcess = null;

/**
 * Setup process listeners for Python service
 * @param {ChildProcess} proc - Python process
 */
function setupProcessListeners(proc) {
    proc.stdout.on('data', (data) => {
        logger.python(data.toString().trim());
    });
    
    proc.stderr.on('data', (data) => {
        logger.error(`Python: ${data.toString().trim()}`);
    });
    
    proc.on('close', (code) => {
        logger.python(`Process exited with code ${code}`);
        pythonProcess = null;
    });
    
    // Kill Python when Node shuts down
    process.on('exit', () => {
        if (pythonProcess) {
            pythonProcess.kill();
        }
    });
}

/**
 * Start the Python news service
 */
export function startPythonService() {
    if (pythonProcess) {
        logger.python('Python service already running');
        return;
    }
    
    logger.python('Starting Python News Service...');
    
    const scriptPath = path.join(__dirname, '..', 'data', 'news_service.py');
    
    // Try 'python' first
    pythonProcess = spawn('python', [scriptPath]);
    
    pythonProcess.on('error', (err) => {
        logger.python("'python' command failed. Trying 'python3'...");
        pythonProcess = spawn('python3', [scriptPath]);
        setupProcessListeners(pythonProcess);
    });
    
    setupProcessListeners(pythonProcess);
}

/**
 * Stop the Python service
 */
export function stopPythonService() {
    if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
        logger.python('Stopped Python service');
    }
}
