// ==UserScript==
// @name         script
// @namespace    chatgpt-hail
// @version      1.0.0
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const TARGET_PATH = '/';
    const TARGET_SEARCH = '?hail';
    const TARGET_NAME = 'hail';
    const CHECK_INTERVAL_MS = 500;
    const TIMEOUT_MS = 30000;
    const CLICKED_KEY = 'data-hail-clicked';
    let stopObserver = null;

    function isTargetUrl() {
        return location.pathname === TARGET_PATH && location.search === TARGET_SEARCH;
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
        if (!isTargetUrl()) {
            stopWatching();
            return true;
        }
        const link = findTargetLink();
        if (!link) {
            return false;
        }
        link.setAttribute(CLICKED_KEY, 'true');
        link.click();
        stopWatching();
        return true;
    }

    function watchForTarget() {
        stopWatching();
        if (!isTargetUrl()) {
            return;
        }
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

    function handleUrlChange() {
        watchForTarget();
    }

    const pushState = history.pushState.bind(history);
    const replaceState = history.replaceState.bind(history);

    history.pushState = function (...args) {
        pushState(...args);
        handleUrlChange();
    };

    history.replaceState = function (...args) {
        replaceState(...args);
        handleUrlChange();
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('DOMContentLoaded', handleUrlChange);
    handleUrlChange();
})();
