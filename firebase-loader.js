(function loadOptionalFirebase() {
    const sources = [
        'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
        'https://www.gstatic.com/firebasejs/9.6.1/firebase-analytics-compat.js',
        'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js'
    ];

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.addEventListener('load', resolve, { once: true });
            script.addEventListener('error', reject, { once: true });
            document.head.appendChild(script);
        });
    }

    sources.reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve())
        .then(() => window.dispatchEvent(new CustomEvent('indy-firebase-ready')))
        .catch(() => window.dispatchEvent(new CustomEvent('indy-auth-unavailable')));
})();
