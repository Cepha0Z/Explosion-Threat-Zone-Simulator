/**
 * Admin Module
 * Handles admin panel functionality (threat creation/deletion)
 */

export const AdminModule = {
    /**
     * Check if current user is admin
     * @returns {boolean}
     */
    isAdmin() {
        return window.AuthModule && window.AuthModule.isAdmin();
    },

    /**
     * Setup admin UI
     * @param {google.maps.Map} map
     */
    setupAdminUI(map) {
        if (!this.isAdmin()) return;

        const adminBtn = document.getElementById('admin-mode-btn');
        if (adminBtn) adminBtn.classList.remove('hidden');

        this.setupThreatForm(map);
        this.setupGetLocationButton(map);
    },

    /**
     * Setup threat creation form
     * @param {google.maps.Map} map
     */
    setupThreatForm(map) {
        const form = document.getElementById('admin-threat-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('admin-threat-name').value;
            const lat = parseFloat(document.getElementById('admin-threat-lat').value);
            const lng = parseFloat(document.getElementById('admin-threat-lng').value);
            const yieldVal = parseFloat(document.getElementById('admin-threat-yield').value);
            const details = document.getElementById('admin-threat-details').value;
            const durationMinutes = document.getElementById('admin-threat-duration').value;

            let expiresAt = null;
            if (durationMinutes) {
                const now = new Date();
                now.setMinutes(now.getMinutes() + parseInt(durationMinutes));
                expiresAt = now.toISOString();
            }

            const threat = {
                name,
                location: { lat, lng },
                locationName: "Custom Location",
                yield: yieldVal,
                details,
                timestamp: new Date().toISOString(),
                source: "admin",
                expiresAt: expiresAt
            };

            try {
                const res = await fetch('/api/threats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(threat)
                });

                if (res.ok) {
                    alert('Threat Broadcasted Successfully');
                    form.reset();
                    
                    // Trigger threat update
                    if (window.ThreatsModule) {
                        await window.ThreatsModule.autoUpdate(map);
                    }
                } else {
                    alert('Failed to broadcast threat');
                }
            } catch (err) {
                console.error(err);
                alert('Error broadcasting threat');
            }
        });
    },

    /**
     * Setup "Use Current Map Center" button
     * @param {google.maps.Map} map
     */
    setupGetLocationButton(map) {
        const getLocBtn = document.getElementById('admin-get-loc-btn');
        if (!getLocBtn) return;

        getLocBtn.addEventListener('click', () => {
            const center = map.getCenter().toJSON();
            document.getElementById('admin-threat-lat').value = center.lat.toFixed(6);
            document.getElementById('admin-threat-lng').value = center.lng.toFixed(6);
        });
    },

    /**
     * Update admin threat list
     * @param {Array} threats
     */
    updateThreatList(threats) {
        const list = document.getElementById('admin-threats-list');
        if (!list) return;

        list.innerHTML = '';

        if (threats.length === 0) {
            list.innerHTML = '<p class="text-xs text-gray-500 text-center">No active threats</p>';
            return;
        }

        threats.forEach(threat => {
            const item = document.createElement('div');
            item.className = "flex justify-between items-center bg-gray-900 p-2 rounded border border-gray-700";

            let expiryText = "Permanent";
            let expiryClass = "text-green-500";

            if (threat.expiresAt) {
                const expiryDate = new Date(threat.expiresAt);
                const now = new Date();
                const diffMs = expiryDate - now;

                if (diffMs > 0) {
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffSecs = Math.floor((diffMs % 60000) / 1000);
                    expiryText = `Expires in ${diffMins}m ${diffSecs}s`;
                    expiryClass = "text-yellow-500";
                } else {
                    expiryText = "Expired";
                    expiryClass = "text-red-500";
                }
            }

            const infoDiv = document.createElement('div');
            infoDiv.innerHTML = `
                <div class="font-bold text-sm text-red-400">${threat.name} <span class="text-[10px] bg-gray-800 text-gray-400 px-1 rounded ml-2">${threat.source || 'unknown'}</span></div>
                <div class="text-xs text-gray-500">${new Date(threat.timestamp).toLocaleTimeString()} • <span class="${expiryClass}">${expiryText}</span></div>
            `;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = "text-red-500 hover:text-red-400 p-1 transition";
            deleteBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
            deleteBtn.onclick = () => this.deleteThreat(threat.id);

            item.appendChild(infoDiv);
            item.appendChild(deleteBtn);
            list.appendChild(item);
        });

        lucide.createIcons();
    },

    /**
     * Delete a threat
     * @param {string} id
     */
    async deleteThreat(id) {
        if (!confirm("Are you sure you want to delete this threat?")) return;

        try {
            const res = await fetch(`/api/threats/${id}`, { method: 'DELETE' });
            if (res.ok) {
                // Force update immediately
                if (window.ThreatsModule) {
                    await window.ThreatsModule.loadThreats();
                    const map = window.MapModule.getMap();
                    window.ThreatsModule.displayThreats(map);
                    this.updateThreatList(window.ThreatsModule.liveThreats);
                }
            } else {
                alert("Failed to delete threat");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting threat");
        }
    }
};
