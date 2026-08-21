(function initializeDialogManager() {
    const stack = [];
    let originalInert = null;

    const focusableSelector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    function visibleFocusable(root) {
        return Array.from(root.querySelectorAll(focusableSelector)).filter((element) => {
            return !element.hidden && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
        });
    }

    function refreshInertState() {
        if (!stack.length) {
            originalInert?.forEach((wasInert, element) => { element.inert = wasInert; });
            originalInert = null;
            return;
        }
        if (!originalInert) originalInert = new Map();
        originalInert.forEach((wasInert, element) => { element.inert = wasInert; });
        const activeRoot = stack.at(-1).root;
        let branch = activeRoot;
        while (branch?.parentElement) {
            Array.from(branch.parentElement.children).forEach((sibling) => {
                if (sibling === branch || sibling.tagName === 'SCRIPT') return;
                if (!originalInert.has(sibling)) originalInert.set(sibling, sibling.inert);
                sibling.inert = true;
            });
            branch = branch.parentElement;
            if (branch === document.documentElement) break;
        }
        activeRoot.inert = false;
    }

    function open(root, options = {}) {
        if (!root) return;
        const existingIndex = stack.findIndex((entry) => entry.root === root);
        if (existingIndex >= 0) stack.splice(existingIndex, 1);
        stack.push({
            root,
            trigger: options.trigger || document.activeElement,
            closeOnEscape: options.closeOnEscape !== false,
            onRequestClose: options.onRequestClose || null
        });
        refreshInertState();
        const ensureFocus = () => {
            if (stack.at(-1)?.root !== root || root.contains(document.activeElement)) return;
            const target = options.initialFocus || visibleFocusable(root)[0] || root;
            if (!target.hasAttribute('tabindex') && target === root) target.setAttribute('tabindex', '-1');
            target.focus?.();
        };
        requestAnimationFrame(ensureFocus);
        window.setTimeout(ensureFocus, 75);
        window.setTimeout(ensureFocus, 200);
    }

    function close(root, options = {}) {
        const index = stack.findIndex((entry) => entry.root === root);
        if (index < 0) return;
        const [entry] = stack.splice(index, 1);
        refreshInertState();
        if (options.restoreFocus !== false && entry.trigger?.isConnected) entry.trigger.focus?.();
    }

    document.addEventListener('keydown', (event) => {
        const active = stack.at(-1);
        if (!active) return;
        if (event.key === 'Escape' && active.closeOnEscape) {
            event.preventDefault();
            active.onRequestClose?.();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = visibleFocusable(active.root);
        if (!focusable.length) {
            event.preventDefault();
            active.root.focus?.();
            return;
        }
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    document.addEventListener('focusin', (event) => {
        const active = stack.at(-1);
        if (!active || active.root.contains(event.target)) return;
        (visibleFocusable(active.root)[0] || active.root).focus?.();
    });

    document.addEventListener('focusout', () => {
        window.setTimeout(() => {
            const active = stack.at(-1);
            if (!active || active.root.contains(document.activeElement)) return;
            (visibleFocusable(active.root)[0] || active.root).focus?.();
        }, 0);
    });

    window.IndyDialogManager = { open, close, get activeRoot() { return stack.at(-1)?.root || null; } };
})();
