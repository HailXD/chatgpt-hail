// ==UserScript==
// @name         chatgpt-hail
// @version      1.2.0
// @match        https://chatgpt.com/?h
// @match        https://chatgpt.com/g/*/*?h
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const TARGET_NAME = 'hail';
    const CHECK_INTERVAL_MS = 500;
    const TIMEOUT_MS = 30000;
    const CLICKED_KEY = 'data-hail-clicked';
    const CACHE_KEY = 'chatgpt-hail:href';
    const ROOT_HASH_URL = 'https://chatgpt.com/?h';

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

    function extractGizmoId(pathOrHref) {
        const match = pathOrHref?.match(/\/g\/(g-p-[a-z0-9]+)/i);
        return match ? match[1] : null;
    }

    function buildHashUrl(href) {
        const url = new URL(href, window.location.origin);
        return `${url.origin}${url.pathname}?h${url.hash || ''}`;
    }

    // --- Redirect flow: https://chatgpt.com/?h ---
    function runRootRedirect() {
        let redirected = false;
        let stopObserver = null;

        function redirectTo(href) {
            if (redirected) {
                return;
            }
            redirected = true;
            stopWatching();
            window.location.href = buildHashUrl(href);
        }

        function stopWatching() {
            if (stopObserver) {
                stopObserver();
                stopObserver = null;
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

        const cached = getCachedHref();
        if (cached) {
            redirectTo(cached);
            return;
        }
        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', watchForTarget, { once: true });
        }
        watchForTarget();
    }

    // --- Network intercept flow: https://chatgpt.com/g/*/*?h ---
    function runInterceptor() {
        const gizmoId = extractGizmoId(window.location.pathname);
        if (!gizmoId) {
            return;
        }
        const targetFragment = `/backend-api/gizmos/${gizmoId}`;
        const origFetch = window.fetch;
        let stopped = false;

        function stop() {
            if (stopped) {
                return;
            }
            stopped = true;
            window.fetch = origFetch;
        }

        function urlFromInput(input) {
            if (typeof input === 'string') {
                return input;
            }
            if (input && typeof input.url === 'string') {
                return input.url;
            }
            return '';
        }

        window.fetch = async function patchedFetch(input, init) {
            const url = urlFromInput(input);
            const isTarget = url.includes(targetFragment);
            const response = await origFetch.apply(this, arguments);
            if (isTarget && !stopped) {
                if (response.status === 404) {
                    clearCachedHref();
                    stop();
                    window.location.href = ROOT_HASH_URL;
                } else {
                    stop();
                }
            }
            return response;
        };
    }

    const path = window.location.pathname;
    if (path === '/') {
        runRootRedirect();
    } else if (/^\/g\//.test(path)) {
        runInterceptor();
    }
})();
