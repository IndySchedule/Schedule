(function () {
    'use strict';

    const API_BASE = 'https://schoology-fetcher.bradyblackwell2009.workers.dev';
    const CACHE_MAX_AGE = 15 * 60 * 1000;
    const state = { assignments: [], connected: false, loadedAt: 0, loading: false, showingCompleted: false };

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
        const todayKey = localDateKey(new Date());
        const count = state.assignments.filter((item) => !item.completed && localDateKey(item.dueAt) === todayKey).length;
        badge.textContent = String(count);
        badge.hidden = count === 0;
        badge.setAttribute('aria-label', `${count} incomplete assignment${count === 1 ? '' : 's'} due today`);
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
            icon.className = 'fas fa-circle-check';
            icon.setAttribute('aria-hidden', 'true');
            const heading = document.createElement('strong');
            heading.textContent = state.assignments.length ? 'Everything here is marked done' : 'No upcoming assignments';
            const copy = document.createElement('span');
            copy.textContent = state.assignments.length ? 'Turn on “Show completed” to review or restore one.' : 'Schoology has no upcoming calendar events to show.';
            empty.append(icon, heading, copy);
            list.appendChild(empty);
            updateBadge();
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
                course.textContent = item.course || 'Schoology calendar';
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
    }

    function showAssignmentStatus(message, kind = '') {
        const status = $('assignments-status');
        if (!status) return;
        status.textContent = message;
        status.dataset.state = kind;
        status.hidden = !message;
    }

    async function refreshAssignments(force = false) {
        if (state.loading) return;
        if (!force && state.loadedAt && Date.now() - state.loadedAt < CACHE_MAX_AGE) return;
        if (!authUser()) {
            state.assignments = [];
            renderAssignments();
            showAssignmentStatus('Sign in to connect and view your Schoology calendar.', 'signed-out');
            return;
        }
        state.loading = true;
        $('assignments-refresh')?.setAttribute('aria-busy', 'true');
        showAssignmentStatus(state.assignments.length ? 'Refreshing assignments…' : 'Loading assignments…', 'loading');
        try {
            const result = await request('/api/assignments');
            state.connected = true;
            state.assignments = Array.isArray(result.assignments) ? result.assignments : [];
            state.loadedAt = Date.now();
            renderAssignments();
            showAssignmentStatus(result.fetchedAt ? `Updated ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(result.fetchedAt))}` : '', 'success');
        } catch (error) {
            if (error.code === 'not-connected') {
                state.connected = false;
                state.assignments = [];
                renderAssignments();
                showAssignmentStatus('Connect your Schoology calendar in Settings to see assignments.', 'not-connected');
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
            if (disconnected) disconnected.hidden = true;
            if (connected) connected.hidden = true;
            return;
        }
        try {
            const result = await request('/api/schoology/status');
            state.connected = !!result.connected;
            if (disconnected) disconnected.hidden = state.connected;
            if (connected) connected.hidden = !state.connected;
            const refreshed = $('schoology-last-refresh');
            if (refreshed) refreshed.textContent = result.lastSuccessfulRefresh
                ? `Last refreshed ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(result.lastSuccessfulRefresh))}`
                : 'The calendar will refresh when you open Assignments.';
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
            state.loadedAt = 0;
            renderAssignments();
            showSchoologyMessage('Schoology calendar disconnected.', 'success');
            showAssignmentStatus('Connect your Schoology calendar in Settings to see assignments.', 'not-connected');
            await updateConnectionUI();
        } catch (error) { showSchoologyMessage(error.message, 'error'); }
    }

    function initialize() {
        $('assignments-toggle')?.addEventListener('click', () => setAssignmentsOpen($('assignments-view')?.hidden !== false));
        $('assignments-close')?.addEventListener('click', () => setAssignmentsOpen(false));
        $('assignments-refresh')?.addEventListener('click', () => refreshAssignments(true));
        $('assignments-show-completed')?.addEventListener('change', (event) => { state.showingCompleted = event.target.checked; renderAssignments(); });
        $('assignments-list')?.addEventListener('click', (event) => {
            const button = event.target.closest('.assignment-complete-button');
            if (button) toggleComplete(button.dataset.assignmentId);
        });
        $('schoology-connect-form')?.addEventListener('submit', connectCalendar);
        $('schoology-replace-button')?.addEventListener('click', () => {
            $('schoology-connected').hidden = true;
            $('schoology-disconnected').hidden = false;
            $('schoology-calendar-url')?.focus();
        });
        $('schoology-disconnect-button')?.addEventListener('click', disconnectCalendar);
        $('schoology-refresh-button')?.addEventListener('click', () => refreshAssignments(true));
        window.addEventListener('indy-account-authenticated', updateConnectionUI);
        window.addEventListener('online', () => { if (!$('assignments-view')?.hidden) refreshAssignments(false); });
        updateConnectionUI();
    }

    window.IndyAssignments = { refresh: refreshAssignments, updateConnectionUI, setOpen: setAssignmentsOpen, groupFor };
    document.addEventListener('DOMContentLoaded', initialize);
})();
