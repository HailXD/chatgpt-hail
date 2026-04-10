// ==UserScript==
// @name         chatgpt-hail
// @version      1.0.3
// @match        https://chatgpt.com/?h
// ==/UserScript==

(function () {
    'use strict';

    const TARGET_NAME = 'hail';
    const CHECK_INTERVAL_MS = 500;
    const TIMEOUT_MS = 30000;
    const CLICKED_KEY = 'data-hail-clicked';
    let stopObserver = null;

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

    function collapseProjects() {
        const link = findTargetLink();
        if (!link) {
            return;
        }
        const section = link.closest('div[class*="sidebar-expando-section"]');
        const toggle = section?.querySelector('button[aria-expanded="true"]');
        toggle?.click();
    }

    function stopWatching() {
        if (stopObserver) {
            stopObserver();
            stopObserver = null;
        }
    }

    function tryClickTarget() {
        const link = findTargetLink();
        if (!link) {
            return false;
        }
        collapseProjects();
        link.setAttribute(CLICKED_KEY, 'true');
        link.click();
        stopWatching();
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

    window.addEventListener('DOMContentLoaded', watchForTarget);
    watchForTarget();
})();
