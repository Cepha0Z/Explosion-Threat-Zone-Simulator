/**
 * TMZ 2.0 - Threat Intelligence Platform
 * Main Application Bootstrap
 * 
 * This file only handles:
 * - Module initialization
 * - Google Maps API loading
 * - Event coordination between modules
 */

// Import all modules
import { AuthModule } from './modules/auth.module.js';
import { MapModule } from './modules/map.module.js';
import { ThreatsModule } from './modules/threats.module.js';
import { EvacuationModule } from './modules/evacuation.module.js';
import { SimulationModule } from './modules/simulation.module.js';
import { AdminModule } from './modules/admin.module.js';
import { NewsModule } from './modules/news.module.js';

// Make modules globally accessible for cross-module communication
window.AuthModule = AuthModule;
window.MapModule = MapModule;
window.ThreatsModule = ThreatsModule;
window.EvacuationModule = EvacuationModule;
window.SimulationModule = SimulationModule;
window.AdminModule = AdminModule;
window.NewsModule = NewsModule;

/**
 * Initialize Google Maps and all modules
 */
async function initMap() {
    console.log('🗺️ Initializing Google Maps...');
    const map = await MapModule.initialize('map');
    
    console.log('⚙️ Initializing modules...');
    
    // Initialize simulation module
    SimulationModule.initialize(map);
    
    // Initialize admin module
    AdminModule.setupAdminUI(map);
    
    // Initialize news module
    NewsModule.initialize();
    
    // Start threat auto-updates
    ThreatsModule.startAutoUpdate(map);
    
    // Setup logout button
    AuthModule.setupLogoutButton();
    
    // Initialize Lucide icons
    lucide.createIcons();
    
    console.log('✅ Application initialized successfully');
}

// Make initMap globally accessible for Google Maps callback
window.initMap = initMap;

/**
 * Load Google Maps API on DOM ready
 */
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 TMZ 2.0 Starting...');
    
    // Enforce authentication
    AuthModule.enforceAuth();
    
    // Fetch Google Maps API key
    const res = await fetch('/config');
    const cfg = await res.json();
    
    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        cfg.googleMapsApiKey
    )}&libraries=places,geometry&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    
    // Sync user email for alerts
    const email = AuthModule.getUserEmail();
    if (email) {
        try {
            await fetch('/api/session/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            console.log(`📧 Synced alert email: ${email}`);
        } catch (e) {
            console.error('Failed to sync email for alerts', e);
        }
    }
});
