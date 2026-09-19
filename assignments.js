(function () {
    'use strict';

    const IS_LOCAL_DEV = ['localhost', '127.0.0.1'].includes(location.hostname);
    const SCHOOLOGY_API_BASE = 'https://schoology-fetcher.netlify.app';
    const API_BASE = IS_LOCAL_DEV
        ? 'http://127.0.0.1:8787'
        : SCHOOLOGY_API_BASE;
    const CACHE_MAX_AGE = 15 * 60 * 1000;
    function savedConnectionPromptSeen() {
        try { return localStorage.getItem('indySchoologyPromptSeen_v1') === 'true'; }
        catch { return false; }
    }

    function dashboardDueTodayEnabled() {
        try { return localStorage.getItem('showDueTodayAssignments') !== 'false'; }
        catch { return true; }
    }

    const state = { assignments: [], connected: false, connectionChecked: false, connectionPromptSeen: savedConnectionPromptSeen(), loadedAt: 0, lastLoadAttemptAt: 0, loading: false, showingCompleted: false };

    const $ = (id) => document.getElementById(id);
    const authUser = () => window.authManager?.auth?.currentUser || null;

    async function request(path, options = {}) {
        const user = authUser();
        if (!user) throw Object.assign(new Error('Sign in to use Schoology assignments.'), { code: 'signed-out' });
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(body.message || 'Schoology could not be reached.');
            error.code = body.code || `http-${response.status}`;
            throw error;
        }
        return body;
    }

    function formatDue(dateValue, allDay) {
        const date = new Date(dateValue);
        const dateText = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
        if (allDay) return dateText;
        return `${dateText} · ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)}`;
    }

    function relativeDue(dateValue) {
        const milliseconds = new Date(dateValue).getTime() - Date.now();
        const absolute = Math.abs(milliseconds);
        if (milliseconds < 0) {
            if (absolute < 60 * 60 * 1000) return 'Due less than an hour ago';
            const hours = Math.round(absolute / 3600000);
            return hours < 24 ? `Due ${hours} hour${hours === 1 ? '' : 's'} ago` : `Due ${Math.round(hours / 24)} days ago`;
        }
        if (absolute < 60 * 60 * 1000) return 'Due in less than an hour';
        const hours = Math.round(absolute / 3600000);
        return hours < 24 ? `Due in ${hours} hour${hours === 1 ? '' : 's'}` : `Due in ${Math.round(hours / 24)} days`;
    }

    function localDateKey(value) {
        const date = new Date(value);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function formatDueTime(item) {
        if (item.allDay) return '';
        const date = new Date(item.dueAt);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
    }

    function groupFor(value) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(value);
        due.setHours(0, 0, 0, 0);
        const days = Math.round((due - today) / 86400000);
        if (days <= 0) return 'Due Today';
        if (days === 1) return 'Due Tomorrow';
        if (days <= 7) return 'This Week';
        return 'Later';
    }

    function updateBadge() {
        const badge = $('assignments-badge');
        if (!badge) return;
        if (authUser() && state.connectionChecked && !state.connected && !state.connectionPromptSeen) {
            badge.textContent = '1';
            badge.hidden = false;
            badge.setAttribute('aria-label', 'Connect your Schoology iCalendar');
            return;
        }
        const todayKey = localDateKey(new Date());
        const count = state.assignments.filter((item) => !item.completed && localDateKey(item.dueAt) === todayKey).length;
        badge.textContent = String(count);
        badge.hidden = count === 0;
        badge.setAttribute('aria-label', `${count} incomplete assignment${count === 1 ? '' : 's'} due today`);
    }

    function renderDashboardDueToday() {
        const section = $('dashboard-due-today');
        const list = $('dashboard-due-list');
        if (!section || !list) return;

        const canShow = dashboardDueTodayEnabled() && !!authUser() && state.connectionChecked && state.connected;
        section.hidden = !canShow;
        list.replaceChildren();
        if (!canShow) return;

        if (state.loading && !state.loadedAt) {
            const loading = document.createElement('p');
            loading.className = 'dashboard-due-empty';
            loading.textContent = 'Loading today’s assignments…';
            list.appendChild(loading);
            return;
        }

        const todayKey = localDateKey(new Date());
        const today = state.assignments.filter((item) => !item.completed && localDateKey(item.dueAt) === todayKey);
        if (!today.length) {
            const empty = document.createElement('p');
            empty.className = 'dashboard-due-empty';
            empty.textContent = 'Nothing due today';
            list.appendChild(empty);
            return;
        }

        const visible = today.slice(0, 3);
        visible.forEach((item) => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'dashboard-due-row';
            row.dataset.openAssignments = '';
            row.setAttribute('aria-label', `Open Assignments: ${item.title || 'Untitled Schoology event'}`);

            const title = document.createElement('strong');
            title.textContent = item.title || 'Untitled Schoology event';
            const details = [item.course, formatDueTime(item)].filter(Boolean);
            row.appendChild(title);
            if (details.length) {
                const meta = document.createElement('span');
                meta.textContent = details.join(' · ');
                row.appendChild(meta);
            }
            list.appendChild(row);
        });

        if (today.length > visible.length) {
            const more = document.createElement('button');
            more.type = 'button';
            more.className = 'dashboard-due-more';
            more.dataset.openAssignments = '';
            more.textContent = `View ${today.length - visible.length} more`;
            list.appendChild(more);
        }
    }

    function renderAssignments() {
        const list = $('assignments-list');
        if (!list) return;
        list.replaceChildren();
        const visible = state.assignments.filter((item) => state.showingCompleted || !item.completed);
        if (!visible.length) {
            const empty = document.createElement('div');
            empty.className = 'assignments-empty';
            const icon = document.createElement('i');
            const signedIn = !!authUser();
            const needsConnection = signedIn && state.connectionChecked && !state.connected;
            icon.className = `fas fa-${!signedIn ? 'user-lock' : needsConnection ? 'link' : 'circle-check'}`;
            icon.setAttribute('aria-hidden', 'true');
            const heading = document.createElement('strong');
            heading.textContent = !signedIn
                ? 'Sign in to view assignments'
                : needsConnection
                    ? 'Connect your Schoology iCalendar'
                    : state.assignments.length
                        ? 'Everything here is marked done'
                        : 'No upcoming assignments';
            const copy = document.createElement('span');
            copy.textContent = !signedIn
                ? 'Assignments require an Indy Schedule account so your private calendar stays protected.'
                : needsConnection
                    ? 'Open Schoology Calendar settings to securely connect your private calendar feed.'
                    : state.assignments.length
                        ? 'Turn on “Show completed” to review or restore one.'
                        : 'Schoology has no upcoming calendar events to show.';
            empty.append(icon, heading, copy);
            list.appendChild(empty);
            updateBadge();
            renderDashboardDueToday();
            return;
        }
        ['Due Today', 'Due Tomorrow', 'This Week', 'Later'].forEach((groupName) => {
            const items = visible.filter((item) => groupFor(item.dueAt) === groupName);
            if (!items.length) return;
            const section = document.createElement('section');
            section.className = 'assignment-group';
            const heading = document.createElement('h2');
            heading.textContent = groupName;
            section.appendChild(heading);
            items.forEach((item) => {
                const card = document.createElement('article');
                card.className = `assignment-card${item.completed ? ' is-complete' : ''}`;
                const content = document.createElement('div');
                content.className = 'assignment-card-copy';
                const title = document.createElement('h3');
                title.textContent = item.title || 'Untitled Schoology event';
                const course = document.createElement('p');
                course.className = 'assignment-course';
                course.textContent = item.course || 'Schoology';
                const due = document.createElement('p');
                due.className = 'assignment-due';
                due.textContent = `${formatDue(item.dueAt, item.allDay)} · ${relativeDue(item.dueAt)}`;
                content.append(title, course, due);
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'assignment-complete-button';
                button.dataset.assignmentId = item.id;
                button.setAttribute('aria-pressed', item.completed ? 'true' : 'false');
                button.innerHTML = `<i class="fas fa-${item.completed ? 'rotate-left' : 'check'}" aria-hidden="true"></i><span>${item.completed ? 'Restore' : 'Mark done'}</span>`;
                card.append(content, button);
                section.appendChild(card);
            });
            list.appendChild(section);
        });
        updateBadge();
        renderDashboardDueToday();
    }

    function showAssignmentStatus(message, kind = '') {
        const status = $('assignments-status');
        const connectLink = $('assignments-connect-link');
        if (!status) return;
        status.textContent = message;
        status.dataset.state = kind;
        status.hidden = !message;
        if (connectLink) connectLink.hidden = kind !== 'not-connected';
    }

    async function refreshAssignments(force = false) {
        if (state.loading) return;
        if (!force && state.loadedAt && Date.now() - state.loadedAt < CACHE_MAX_AGE) return;
        if (!authUser()) {
            state.connectionChecked = false;
            state.assignments = [];
            renderAssignments();
            showAssignmentStatus('Sign in to connect and view your Schoology calendar.', 'signed-out');
            return;
        }
        state.loading = true;
        state.lastLoadAttemptAt = Date.now();
        renderDashboardDueToday();
        $('assignments-refresh')?.setAttribute('aria-busy', 'true');
        showAssignmentStatus(state.assignments.length ? 'Refreshing assignments…' : 'Loading assignments…', 'loading');
        try {
            const result = await request('/api/assignments');
            state.connected = true;
            state.connectionChecked = true;
            state.assignments = Array.isArray(result.assignments) ? result.assignments : [];
            state.loadedAt = Date.now();
            renderAssignments();
            showAssignmentStatus(result.fetchedAt ? `Updated ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(result.fetchedAt))}` : '', 'success');
        } catch (error) {
            if (error.code === 'not-connected') {
                state.connected = false;
                state.connectionChecked = true;
                state.assignments = [];
                renderAssignments();
                showAssignmentStatus('Connect your Schoology iCalendar to see upcoming assignments.', 'not-connected');
                updateBadge();
            } else {
                showAssignmentStatus(state.assignments.length ? 'Refresh failed. Showing the last assignments loaded this session.' : error.message, 'error');
            }
        } finally {
            state.loading = false;
            $('assignments-refresh')?.removeAttribute('aria-busy');
            updateConnectionUI().catch(() => {});
        }
    }

    function setAssignmentsOpen(open) {
        const view = $('assignments-view');
        const dashboard = document.querySelector('.dashboard-main-view');
        const button = $('assignments-toggle');
        if (!view || !dashboard || !button) return;
        view.hidden = !open;
        dashboard.hidden = open;
        button.classList.toggle('is-open', open);
        button.setAttribute('aria-pressed', open ? 'true' : 'false');
        if (open) {
            if (!state.connectionPromptSeen) {
                state.connectionPromptSeen = true;
                try { localStorage.setItem('indySchoologyPromptSeen_v1', 'true'); } catch { /* browser storage unavailable */ }
                window.authManager?.scheduleUserSettingsSave(0).catch(() => {});
            }
            updateBadge();
            window.setTodayPopupOpen?.(false);
            refreshAssignments(false);
            $('assignments-heading')?.focus();
        }
    }

    async function toggleComplete(id) {
        const item = state.assignments.find((entry) => entry.id === id);
        if (!item) return;
        const next = !item.completed;
        item.completed = next;
        renderAssignments();
        try {
            await request(`/api/assignments/${encodeURIComponent(id)}/complete`, { method: next ? 'POST' : 'DELETE' });
        } catch (error) {
            item.completed = !next;
            renderAssignments();
            showAssignmentStatus('That change could not be saved. Please try again.', 'error');
        }
    }

    async function updateConnectionUI() {
        const signedIn = !!authUser();
        const signedOut = $('schoology-signed-out');
        const disconnected = $('schoology-disconnected');
        const connected = $('schoology-connected');
        if (signedOut) signedOut.hidden = signedIn;
        if (!signedIn) {
            state.connectionChecked = false;
            if (disconnected) disconnected.hidden = true;
            if (connected) connected.hidden = true;
            updateBadge();
            renderDashboardDueToday();
            return;
        }
        try {
            const result = await request('/api/schoology/status');
            state.connected = !!result.connected;
            state.connectionChecked = true;
            if (disconnected) disconnected.hidden = state.connected;
            if (connected) connected.hidden = !state.connected;
            const refreshed = $('schoology-last-refresh');
            if (refreshed) refreshed.textContent = result.lastSuccessfulRefresh
                ? `Last refreshed ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(result.lastSuccessfulRefresh))}`
                : 'Your assignments will refresh automatically when you open Assignments.';
            updateBadge();
            renderDashboardDueToday();
            if (state.connected && !state.loading && (!state.lastLoadAttemptAt || Date.now() - state.lastLoadAttemptAt >= CACHE_MAX_AGE)) {
                refreshAssignments(false);
            }
        } catch (error) {
            showSchoologyMessage(error.message, 'error');
        }
    }

    function showSchoologyMessage(message, kind = '') {
        const node = $('schoology-settings-message');
        if (!node) return;
        node.textContent = message;
        node.dataset.state = kind;
        node.hidden = !message;
    }

    async function connectCalendar(event) {
        event.preventDefault();
        const input = $('schoology-calendar-url');
        const button = $('schoology-connect-button');
        const calendarUrl = input?.value.trim();
        if (!calendarUrl) return showSchoologyMessage('Enter your full Schoology calendar link.', 'error');
        button.disabled = true;
        showSchoologyMessage('Checking and securely connecting your calendar…', 'loading');
        try {
            await request('/api/schoology/connect', { method: 'POST', body: JSON.stringify({ calendarUrl }) });
            input.value = '';
            state.loadedAt = 0;
            state.lastLoadAttemptAt = 0;
            showSchoologyMessage('Schoology calendar connected.', 'success');
            await updateConnectionUI();
            if (!$('assignments-view')?.hidden) await refreshAssignments(true);
        } catch (error) {
            showSchoologyMessage(error.message, 'error');
        } finally { button.disabled = false; }
    }

    async function disconnectCalendar() {
        if (!window.confirm('Disconnect your Schoology calendar and remove Indy Schedule completion records?')) return;
        try {
            await request('/api/schoology/disconnect', { method: 'DELETE' });
            state.assignments = [];
            state.connected = false;
            state.connectionChecked = true;
            state.loadedAt = 0;
            state.lastLoadAttemptAt = 0;
            renderAssignments();
            showSchoologyMessage('Schoology calendar disconnected.', 'success');
            showAssignmentStatus('Connect your Schoology iCalendar to see upcoming assignments.', 'not-connected');
            updateBadge();
            await updateConnectionUI();
        } catch (error) { showSchoologyMessage(error.message, 'error'); }
    }

    function initialize() {
        const dashboardToggle = $('show-due-today-assignments');
        if (dashboardToggle) {
            dashboardToggle.checked = dashboardDueTodayEnabled();
            dashboardToggle.addEventListener('change', () => {
                try { localStorage.setItem('showDueTodayAssignments', dashboardToggle.checked ? 'true' : 'false'); } catch { /* browser storage unavailable */ }
                renderDashboardDueToday();
                window.authManager?.scheduleUserSettingsSave(0).catch(() => {});
            });
        }
        $('assignments-toggle')?.addEventListener('click', () => setAssignmentsOpen($('assignments-view')?.hidden !== false));
        $('assignments-close')?.addEventListener('click', () => setAssignmentsOpen(false));
        $('assignments-refresh')?.addEventListener('click', () => refreshAssignments(true));
        $('assignments-show-completed')?.addEventListener('change', (event) => { state.showingCompleted = event.target.checked; renderAssignments(); });
        $('assignments-connect-link')?.addEventListener('click', () => {
            setAssignmentsOpen(false);
            $('settings-button')?.click();
            window.setTimeout(() => document.querySelector('.nav-item[data-target="schoology"]')?.click(), 60);
        });
        $('assignments-list')?.addEventListener('click', (event) => {
            const button = event.target.closest('.assignment-complete-button');
            if (button) toggleComplete(button.dataset.assignmentId);
        });
        $('dashboard-due-today')?.addEventListener('click', (event) => {
            if (event.target.closest('[data-open-assignments]')) setAssignmentsOpen(true);
        });
        $('schoology-connect-form')?.addEventListener('submit', connectCalendar);
        $('schoology-replace-button')?.addEventListener('click', () => {
            $('schoology-connected').hidden = true;
            $('schoology-disconnected').hidden = false;
            $('schoology-calendar-url')?.focus();
        });
        $('schoology-disconnect-button')?.addEventListener('click', disconnectCalendar);
        $('schoology-refresh-button')?.addEventListener('click', () => refreshAssignments(true));
        window.addEventListener('indy-account-authenticated', () => {
            state.connectionPromptSeen = savedConnectionPromptSeen();
            updateConnectionUI();
        });
        const bindAuthObserver = () => {
            const auth = window.authManager?.auth;
            if (!auth || auth._indyAssignmentsObserverBound) return;
            auth._indyAssignmentsObserverBound = true;
            auth.onAuthStateChanged((user) => {
                state.loadedAt = 0;
                state.lastLoadAttemptAt = 0;
                if (!user) {
                    state.connected = false;
                    state.connectionChecked = false;
                    state.assignments = [];
                    renderAssignments();
                    showAssignmentStatus('Sign in to connect and view your Schoology calendar.', 'signed-out');
                }
                updateConnectionUI();
                if (user && !$('assignments-view')?.hidden) refreshAssignments(true);
            });
        };
        window.addEventListener('indy-firebase-ready', () => window.setTimeout(bindAuthObserver, 0));
        bindAuthObserver();
        window.addEventListener('online', () => { if (!$('assignments-view')?.hidden) refreshAssignments(false); });
        updateConnectionUI();
    }

    window.IndyAssignments = { refresh: refreshAssignments, updateConnectionUI, setOpen: setAssignmentsOpen, groupFor };
    document.addEventListener('DOMContentLoaded', initialize);
})();
