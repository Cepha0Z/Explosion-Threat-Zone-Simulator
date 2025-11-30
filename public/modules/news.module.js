/**
 * News Module
 * Handles news fetching and display
 */

export const NewsModule = {
    currentNewsMode: 'nearme',
    userCity: null,

    /**
     * Initialize news module
     */
    initialize() {
        this.getUserLocation(true);
        this.setupModeButtons();
    },

    /**
     * Setup news mode buttons (Near Me / Global)
     */
    setupModeButtons() {
        const btnNear = document.getElementById('btn-nearme');
        const btnGlobal = document.getElementById('btn-global');

        if (btnNear) {
            btnNear.addEventListener('click', () => this.setNewsMode('nearme'));
        }

        if (btnGlobal) {
            btnGlobal.addEventListener('click', () => this.setNewsMode('global'));
        }
    },

    /**
     * Set news mode (nearme or global)
     * @param {string} mode
     */
    setNewsMode(mode) {
        this.currentNewsMode = mode;
        const btnNear = document.getElementById('btn-nearme');
        const btnGlobal = document.getElementById('btn-global');
        const heading = document.getElementById('news-heading');
        const locStatus = document.getElementById('location-status');

        if (mode === 'nearme') {
            if (btnNear) btnNear.className = 'flex-1 py-2 text-sm font-medium rounded-md text-white bg-blue-600 shadow-sm transition-all';
            if (btnGlobal) btnGlobal.className = 'flex-1 py-2 text-sm font-medium rounded-md text-gray-400 hover:text-white transition-all';
            if (heading) heading.innerText = 'Local Intelligence';
            if (locStatus) locStatus.classList.remove('hidden');
        } else {
            if (btnNear) btnNear.className = 'flex-1 py-2 text-sm font-medium rounded-md text-gray-400 hover:text-white transition-all';
            if (btnGlobal) btnGlobal.className = 'flex-1 py-2 text-sm font-medium rounded-md text-white bg-blue-600 shadow-sm transition-all';
            if (heading) heading.innerText = 'Global Threat Monitor';
            if (locStatus) locStatus.classList.add('hidden');
        }

        this.refreshCurrentNews();
    },

    /**
     * Refresh current news based on mode
     */
    refreshCurrentNews() {
        if (this.currentNewsMode === 'nearme') {
            if (!this.userCity) {
                this.getUserLocation(false);
            } else {
                this.fetchNews(this.userCity, 'news-container');
            }
        } else {
            this.fetchNews('Global', 'news-container');
        }
    },

    /**
     * Get user location
     * @param {boolean} forAlertsOnly
     */
    getUserLocation(forAlertsOnly) {
        if (!navigator.geolocation) {
            this.userCity = 'India';
            if (forAlertsOnly) this.fetchNews(this.userCity, 'local-alerts-feed');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                try {
                    const res = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
                    );
                    const data = await res.json();
                    this.userCity = data.city || data.locality || 'India';

                    const el = document.getElementById('detected-city');
                    if (el) el.innerText = this.userCity;

                    this.fetchNews(this.userCity, 'local-alerts-feed');
                    if (!forAlertsOnly && this.currentNewsMode === 'nearme') {
                        this.fetchNews(this.userCity, 'news-container');
                    }
                } catch (e) {
                    this.userCity = 'India';
                    this.fetchNews(this.userCity, 'local-alerts-feed');
                }
            },
            () => {
                this.userCity = 'India';
                this.fetchNews(this.userCity, 'local-alerts-feed');
            }
        );
    },

    /**
     * Fetch news from Python service
     * Legacy News feed:
     * - Endpoint: GET http://localhost:5000/api/news
     * - Response shape: Array of objects [{ title, description, publishedAt, source, url, image, ... }]
     * - Client filtering: none (renders all articles)
     * @param {string} location
     * @param {string} containerId
     */
    async fetchNews(location, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div class="text-center text-blue-400 animate-pulse text-xs py-4">Scanning feeds...</div>';

        try {
            const response = await fetch(`http://localhost:5000/api/news?location=${location}`);
            if (!response.ok) throw new Error(`Error: ${response.status}`);
            
            const articles = await response.json();
            container.innerHTML = '';

            if (articles.length === 0 || articles.error) {
                container.innerHTML = '<p class="text-center text-gray-500 text-xs py-2">No high-priority threats reported.</p>';
                return;
            }

            const limit = containerId === 'local-alerts-feed' ? 3 : 100;
            articles.slice(0, limit).forEach(news => {
                const card = this.createNewsCard(news, containerId === 'local-alerts-feed');
                container.appendChild(card);
            });

            lucide.createIcons();
        } catch (error) {
            console.error(error);
            container.innerHTML = '<p class="text-center text-red-900/50 text-xs">Offline</p>';
        }
    },

    /**
     * Create news card element
     * @param {Object} news
     * @param {boolean} isMini
     * @returns {HTMLElement}
     */
    createNewsCard(news, isMini) {
        const card = document.createElement('div');
        const date = new Date(news.publishedAt).toLocaleDateString();

        if (isMini) {
            card.className = 'p-3 bg-red-900/10 border border-red-900/30 rounded hover:bg-red-900/20 transition cursor-pointer';
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <h4 class="text-sm font-bold text-red-200 leading-tight line-clamp-2">${news.title}</h4>
                    <span class="text-[10px] text-red-400 ml-2 whitespace-nowrap">${date}</span>
                </div>
            `;
        } else {
            card.className = 'news-card p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-blue-500 transition group overflow-hidden';
            const imageHtml = news.image
                ? `<div class="h-32 w-full bg-cover bg-center rounded mb-3" style="background-image: url('${news.image}');"></div>`
                : '';

            card.innerHTML = `
                ${imageHtml}
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] font-bold text-blue-400 bg-blue-900/30 px-2 py-1 rounded uppercase tracking-wider">${news.source}</span>
                    <span class="text-[10px] text-gray-500">${date}</span>
                </div>
                <h3 class="text-sm font-bold text-white mb-2 leading-tight">${news.title}</h3>
                <p class="text-xs text-gray-400 line-clamp-2 mb-3">${news.description || ''}</p>
                <div class="flex gap-2">
                    <a href="${news.url}" target="_blank" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 rounded transition flex items-center justify-center gap-1">
                        <i data-lucide="external-link" class="w-3 h-3"></i> Read
                    </a>
                </div>
            `;
        }

        return card;
    },

    /**
     * Trigger email alert
     */
    async triggerEmailAlert() {
        const email = prompt('Enter your email address to receive a threat report:');
        if (!email) return;

        const location = this.userCity || 'Global';
        const btn = document.querySelector('button[onclick="triggerEmailAlert()"]');
        
        if (btn) {
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<i class="animate-spin" data-lucide="loader-2"></i>';
            lucide.createIcons();

            try {
                const response = await fetch('http://localhost:5000/api/alert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, location: location })
                });

                const result = await response.json();

                if (response.ok) {
                    alert(`Report sent to ${email}!`);
                } else {
                    alert('Failed to send email: ' + result.error);
                }
            } catch (error) {
                alert('Error connecting to email service.');
            } finally {
                btn.innerHTML = originalContent;
                lucide.createIcons();
            }
        }
    }
};
