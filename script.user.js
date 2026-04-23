// ==UserScript==
// @name         chatgpt-hail
// @version      1.1.0
// @match        https://chatgpt.com/?h
// ==/UserScript==

(function () {
    'use strict';

    const TARGET_NAME = 'hail';
    const CHECK_INTERVAL_MS = 500;
    const TIMEOUT_MS = 30000;
    const CLICKED_KEY = 'data-hail-clicked';
    const CACHE_KEY = 'chatgpt-hail:href';
    let stopObserver = null;
    let redirected = false;

    function getCachedHref() {
        try {
            return localStorage.getItem(CACHE_KEY);
        } catch {
            return null;
        }
    }

    function setCachedHref(href) {
        try {
            localStorage.setItem(CACHE_KEY, href);
        } catch {
            /* ignore */
        }
    }

    function clearCachedHref() {
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch {
            /* ignore */
        }
    }

    function extractGizmoId(href) {
        const match = href?.match(/\/g\/(g-p-[a-z0-9]+)/i);
        return match ? match[1] : null;
    }

    function redirectTo(href) {
        if (redirected) {
            return;
        }
        redirected = true;
        stopWatching();
        window.location.href = new URL(href, window.location.origin).href;
    }

    async function isGizmoAvailable(gizmoId) {
        try {
            const res = await fetch(`https://chatgpt.com/backend-api/gizmos/${gizmoId}`, {
                credentials: 'include',
                headers: { accept: 'application/json' },
            });
            return res.status !== 404;
        } catch {
            // Network/auth error: assume available to avoid an unnecessary fallback loop.
            return true;
        }
    }

    function getProjectLinks() {
        const headings = Array.from(document.querySelectorAll('h2.__menu-label'));
        const projectsHeading = headings.find((heading) => heading.textContent?.trim().toLowerCase() === 'projects');
        if (!projectsHeading) {
            return [];
        }
        const section = projectsHeading.closest('div[class*="sidebar-expando-section"]');
        if (!section) {
            return [];
        }
        return Array.from(section.querySelectorAll('a[data-sidebar-item="true"][href*="/project"]'));
    }

    function findTargetLink() {
        return getProjectLinks().find((link) => {
            if (link.getAttribute(CLICKED_KEY) === 'true') {
                return false;
            }
            const name = link.querySelector('.truncate')?.textContent?.trim().toLowerCase();
            return name === TARGET_NAME;
        }) ?? null;
    }

    function stopWatching() {
        if (stopObserver) {
            stopObserver();
            stopObserver = null;
        }
    }

    function tryClickTarget() {
        if (redirected) {
            return true;
        }
        const link = findTargetLink();
        if (!link) {
            return false;
        }
        link.setAttribute(CLICKED_KEY, 'true');
        const href = link.getAttribute('href');
        if (href) {
            setCachedHref(href);
            redirectTo(href);
        } else {
            link.click();
            stopWatching();
        }
        return true;
    }

    function watchForTarget() {
        stopWatching();
        const startedAt = Date.now();
        const intervalId = window.setInterval(() => {
            if (tryClickTarget() || Date.now() - startedAt >= TIMEOUT_MS) {
                window.clearInterval(intervalId);
                observer.disconnect();
            }
        }, CHECK_INTERVAL_MS);
        const observer = new MutationObserver(() => {
            if (tryClickTarget()) {
                window.clearInterval(intervalId);
                observer.disconnect();
            }
        });
        const root = document.documentElement || document;
        observer.observe(root, {
            childList: true,
            subtree: true,
        });
        stopObserver = () => {
            window.clearInterval(intervalId);
            observer.disconnect();
        };
        tryClickTarget();
    }

    async function bootstrap() {
        const cached = getCachedHref();
        const gizmoId = extractGizmoId(cached);
        if (cached && gizmoId) {
            if (await isGizmoAvailable(gizmoId)) {
                redirectTo(cached);
                return;
            }
            clearCachedHref();
        }
        window.addEventListener('DOMContentLoaded', watchForTarget);
        watchForTarget();
    }

    bootstrap();
})();
