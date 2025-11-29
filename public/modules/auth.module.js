/**
 * Authentication Module
 * Handles login/logout and token management
 */

export const AuthModule = {
    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return !!localStorage.getItem('authToken');
    },

    /**
     * Check if user is admin
     * @returns {boolean}
     */
    isAdmin() {
        return localStorage.getItem('userRole') === 'admin';
    },

    /**
     * Enforce authentication (redirect to login if not authenticated)
     */
    enforceAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
        }
    },

    /**
     * Logout user
     */
    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userRole');
        window.location.href = '/login.html';
    },

    /**
     * Get current user email
     * @returns {string|null}
     */
    getUserEmail() {
        return localStorage.getItem('userEmail');
    },

    /**
     * Setup logout button
     */
    setupLogoutButton() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }
};
