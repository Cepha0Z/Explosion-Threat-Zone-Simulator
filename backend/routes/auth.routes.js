/**
 * Authentication Routes
 * Handles login and signup
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.util.js';
import { setAlertRecipient } from '../services/alertRecipient.service.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

// Initialize users file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = [
        { email: "admin@tmz.com", password: "admin123" }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    logger.auth('Created users.json with default admin');
}

// Helper functions
function getUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    } catch (e) {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// POST /api/login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    const users = getUsers();
    
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        const role = email === "admin@tmz.com" ? "admin" : "user";
        
        // Update global alert recipient
        setAlertRecipient(email);
        
        logger.auth(`Login successful: ${email} (${role})`);
        return res.json({ 
            token: `authorized_token_${Date.now()}`,
            role: role 
        });
    }
    
    logger.auth(`Login failed: ${email}`);
    return res.status(401).json({ error: "Invalid credentials" });
});

// POST /api/signup
router.post('/signup', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
    }
    
    const users = getUsers();
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: "User already exists" });
    }
    
    users.push({ email, password });
    saveUsers(users);
    
    logger.auth(`New user registered: ${email}`);
    res.json({ status: "ok", message: "User created successfully" });
});

export default router;
