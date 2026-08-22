// Four-color palette system for Indy Schedule.
const COLOR_PALETTES = Object.freeze({
    indy: {
        name: 'Indy',
        colors: ['#000035', '#1B2455', '#C4AD62', '#FFFFFF'],
        angle: 90
    },
    daylight: {
        name: 'Daylight',
        colors: ['#EEF6FF', '#D6E7FF', '#1D4ED8', '#FFFFFF'],
        angle: 120
    },
    monochrome: {
        name: 'Monochrome',
        colors: ['#F9FAFB', '#E5E7EB', '#111827', '#FFFFFF'],
        angle: 115
    },
    slate: {
        name: 'Slate',
        colors: ['#E2E8F0', '#CBD5E1', '#0F766E', '#F8FAFC'],
        angle: 125
    },
    'dark-mode': {
        name: 'Dark Mode',
        colors: ['#0F1115', '#1C2128', '#E5E7EB', '#171B22'],
        angle: 120
    },
    'coastal-sky': {
        name: 'Coastal Sky',
        colors: ['#E0F2FE', '#BAE6FD', '#0369A1', '#F8FCFF'],
        angle: 120
    },
    'lavender-mist': {
        name: 'Lavender Mist',
        colors: ['#F3E8FF', '#EDE9FE', '#7C3AED', '#FDFBFF'],
        angle: 125
    },
    'soft-sage': {
        name: 'Soft Sage',
        colors: ['#ECF4EA', '#D5E7D3', '#477A5A', '#FBFDF9'],
        angle: 125
    },
    blush: {
        name: 'Blush',
        colors: ['#FFF1F5', '#FCE7F3', '#DB2777', '#FFFBFC'],
        angle: 120
    },
    lemonade: {
        name: 'Lemonade',
        colors: ['#FFF8CC', '#FFD6A5', '#F97316', '#FFFEF5'],
        angle: 130
    },
    'prism-rush': {
        name: 'Prism Rush',
        colors: ['#DDD6FE', '#BFDBFE', '#E11D48', '#FAFAFF'],
        angle: 130
    },
    tropical: {
        name: 'Tropical',
        colors: ['#CCFBF1', '#99F6E4', '#F59E0B', '#FFF7ED'],
        angle: 125
    },
    'candy-pop': {
        name: 'Candy Pop',
        colors: ['#C4B5FD', '#F9A8D4', '#0F766E', '#FFF7FB'],
        angle: 135
    },
    sunset: {
        name: 'Sunset',
        colors: ['#FFE4D6', '#FECACA', '#EA580C', '#FFF8F3'],
        angle: 135
    },
    'mango-wave': {
        name: 'Mango Wave',
        colors: ['#FEF3C7', '#FED7AA', '#BE123C', '#FFFBEB'],
        angle: 130
    },
    midnight: {
        name: 'Midnight',
        colors: ['#080B21', '#19173B', '#A78BFA', '#11152E'],
        angle: 120
    },
    graphite: {
        name: 'Graphite',
        colors: ['#171717', '#2F3540', '#38BDF8', '#20242B'],
        angle: 130
    },
    'deep-ocean': {
        name: 'Deep Ocean',
        colors: ['#061826', '#0B3342', '#22D3EE', '#0D2633'],
        angle: 125
    },
    'plum-night': {
        name: 'Plum Night',
        colors: ['#1E0A26', '#3B164A', '#E879F9', '#281131'],
        angle: 130
    },
    'forest-night': {
        name: 'Forest Night',
        colors: ['#071B14', '#123A2A', '#6EE7B7', '#0C271D'],
        angle: 125
    }
});

// Keep previously saved palette IDs working after the preset collection was
// simplified. Retired choices move to the closest current visual style.
const PALETTE_ALIASES = Object.freeze({
    ocean: 'coastal-sky',
    aurora: 'soft-sage',
    'dark-teal': 'graphite',
    earth: 'soft-sage',
    neon: 'candy-pop',
    pastel: 'candy-pop',
    'dark-plum': 'midnight',
    'rose-quartz': 'blush',
    lavender: 'lavender-mist',
    'cherry-blossom': 'blush',
    'sunset-sorbet': 'sunset',
    'sage-rose': 'soft-sage',
    'cotton-candy': 'blush'
});

const DEFAULT_PALETTE_ID = 'indy';
const PALETTE_ROLES = ['primary', 'secondary', 'accent', 'surface'];
const SPECIAL_EDITIONS = Object.freeze({
    'friday-night-lights': {
        name: 'Friday Night Lights',
        badge: 'Friday Night Lights Edition',
        scheduleTitle: 'Today’s Lineup',
        colors: ['#020B18', '#102947', '#D99A2B', '#F4F7FB'],
        angle: 125
    },
    'historic-franklin': {
        name: 'Historic Franklin',
        badge: 'Historic Franklin Edition',
        scheduleTitle: 'Today on Main',
        colors: ['#071018', '#20252A', '#B8793E', '#F1D5A6'],
        angle: 120
    },
    'music-city': {
        name: 'Music City',
        badge: 'Music City Edition',
        scheduleTitle: 'Today’s Lineup',
        colors: ['#07052A', '#21104C', '#F04FB5', '#FFF0D2'],
        angle: 135
    }
});

const normalizeColor = (color, fallback) => (
    typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
        ? color.toUpperCase()
        : fallback
);

const hexToChannels = (hex) => {
    const value = normalizeColor(hex, '#000000').slice(1);
    return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
};

const mixColors = (first, second, firstWeight = 0.82) => {
    const firstChannels = hexToChannels(first);
    const secondChannels = hexToChannels(second);
    const mixed = firstChannels.map((channel, index) => (
        Math.round(channel * firstWeight + secondChannels[index] * (1 - firstWeight))
    ));
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

const readableTextColor = (background) => {
    const channels = hexToChannels(background).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    const whiteContrast = 1.05 / (luminance + 0.05);
    const darkContrast = (luminance + 0.05) / 0.055;
    return whiteContrast >= darkContrast ? '#FFFFFF' : '#111827';
};

const contrastRatio = (first, second) => {
    const luminance = (color) => {
        const channels = hexToChannels(color).map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.03928
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
};

const accessibleTextColor = (background, minimumContrast = 4.5) => {
    const preferred = readableTextColor(background);
    if (contrastRatio(background, preferred) >= minimumContrast) return preferred;
    return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#000000')
        ? '#FFFFFF'
        : '#000000';
};

const supportingPanelColor = (secondary) => {
    let panel = secondary;
    let secondaryWeight = 1;
    while (contrastRatio(panel, '#FFFFFF') < 7 && secondaryWeight > 0.36) {
        secondaryWeight -= 0.08;
        panel = mixColors(secondary, '#000000', secondaryWeight);
    }
    return panel;
};

const visibleRoleColor = (background, candidates, minimumContrast = 3) => (
    candidates.find((color) => contrastRatio(color, background) >= minimumContrast)
    || readableTextColor(background)
);

// Aim for the same subtle amount of visible separation on every dashboard.
// Bright accents need less opacity on dark backgrounds, while gentler palette
// combinations need more before the glow becomes perceptible.
const normalizedGlowOpacity = (glow, background, targetContrast = 1.22) => {
    for (let opacity = 0.08; opacity <= 0.3; opacity += 0.01) {
        if (contrastRatio(mixColors(glow, background, opacity), background) >= targetContrast) {
            return Number(opacity.toFixed(2));
        }
    }
    return 0.3;
};

const buildGradient = (angle, colors) => (
    `linear-gradient(${angle}deg, ${colors[0]} 0%, ${colors[1]} 100%)`
);

class GradientManager {
    constructor() {
        const defaultPalette = COLOR_PALETTES[DEFAULT_PALETTE_ID];
        this.paletteId = DEFAULT_PALETTE_ID;
        this.colors = [...defaultPalette.colors];
        this.angle = defaultPalette.angle;
        this.editionId = null;
        this.stops = [];
        this.initialized = false;

        localStorage.removeItem('bgImage');
        document.body.style.backgroundImage = '';
        this.loadSettings();
        this.syncStops();
    }

    loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem('gradientSettings') || 'null');
            if (!saved) return;
            this.loadExternalSettings(saved, false);
        } catch (error) {
            console.warn('Invalid saved palette; using Indy.', error);
        }
    }

    loadExternalSettings(settings, commit = true) {
        if (!settings || typeof settings !== 'object') return;

        const edition = SPECIAL_EDITIONS[settings.editionId];
        const paletteId = PALETTE_ALIASES[settings.paletteId] || settings.paletteId;
        const preset = COLOR_PALETTES[paletteId];
        if (edition) {
            this.editionId = settings.editionId;
            this.paletteId = `edition-${settings.editionId}`;
            this.colors = [...edition.colors];
            this.angle = Number.isFinite(Number(settings.angle)) ? Number(settings.angle) : edition.angle;
        } else if (preset) {
            this.editionId = null;
            this.paletteId = paletteId;
            this.colors = [...preset.colors];
            this.angle = Number.isFinite(Number(settings.angle)) ? Number(settings.angle) : preset.angle;
        } else if (Array.isArray(settings.colors) && settings.colors.length === 4) {
            this.editionId = null;
            this.paletteId = 'custom';
            this.colors = settings.colors.map((color, index) => normalizeColor(color, COLOR_PALETTES.indy.colors[index]));
            this.angle = Number.isFinite(Number(settings.angle)) ? Number(settings.angle) : 90;
        } else if (settings.startColor || settings.endColor) {
            this.editionId = null;
            // Migrate the previous two-color gradient into a custom four-color palette.
            const indy = COLOR_PALETTES.indy.colors;
            this.paletteId = 'custom';
            this.colors = [
                normalizeColor(settings.startColor, indy[0]),
                normalizeColor(settings.endColor, indy[1]),
                indy[2],
                indy[3]
            ];
            this.angle = Number.isFinite(Number(settings.angle)) ? Number(settings.angle) : 90;
        }

        this.syncStops();
        if (commit) this.commitChange();
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        document.querySelectorAll('.palette-option').forEach((button) => {
            button.addEventListener('click', () => this.selectPalette(button.dataset.palette));
        });
        document.querySelectorAll('.edition-option').forEach((button) => {
            button.addEventListener('click', () => this.selectEdition(button.dataset.edition));
        });

        document.getElementById('gradient-angle')?.addEventListener('input', (event) => {
            this.angle = Number(event.target.value);
            this.activateCustomPalette();
        });

        const colorInputs = [
            ['gradient-start-color', 0],
            ['gradient-end-color', 1],
            ['palette-accent-color', 2],
            ['palette-surface-color', 3]
        ];
        colorInputs.forEach(([id, index]) => {
            document.getElementById(id)?.addEventListener('input', (event) => {
                this.colors[index] = normalizeColor(event.target.value, this.colors[index]);
                this.activateCustomPalette();
            });
        });

        document.getElementById('reset-gradient')?.addEventListener('click', () => this.selectPalette(DEFAULT_PALETTE_ID));
        this.commitChange();
    }

    setupManager() {
        this.init();
    }

    selectPalette(paletteId) {
        this.editionId = null;
        if (paletteId === 'custom') {
            this.paletteId = 'custom';
        } else {
            const resolvedPaletteId = PALETTE_ALIASES[paletteId] || paletteId;
            const palette = COLOR_PALETTES[resolvedPaletteId];
            if (!palette) return;
            this.paletteId = resolvedPaletteId;
            this.colors = [...palette.colors];
            this.angle = palette.angle;
        }
        this.commitChange();
        window.trackAnalyticsEvent?.('palette_selected', { palette_id: this.paletteId });
    }

    activateCustomPalette() {
        this.editionId = null;
        this.paletteId = 'custom';
        this.commitChange();
    }

    selectEdition(editionId) {
        const edition = SPECIAL_EDITIONS[editionId];
        if (!edition) return;
        this.editionId = editionId;
        this.paletteId = `edition-${editionId}`;
        this.colors = [...edition.colors];
        this.angle = edition.angle;
        this.commitChange();
        window.trackAnalyticsEvent?.('special_edition_selected', { edition_id: editionId });
    }

    updateAngle(value) {
        this.angle = Number(value);
        this.activateCustomPalette();
    }

    syncStops() {
        this.stops = [
            { color: this.colors[0], position: 0 },
            { color: this.colors[1], position: 100 }
        ];
    }

    commitChange() {
        this.syncStops();
        this.applyGradient();
        this.updateUI();
        this.saveSettings();
    }

    applyGradient() {
        const root = document.documentElement;
        const gradient = buildGradient(this.angle, this.colors);
        const lightDashboard = readableTextColor(this.colors[0]) === '#111827'
            && readableTextColor(this.colors[1]) === '#111827';

        PALETTE_ROLES.forEach((role, index) => {
            const color = this.colors[index];
            const onColor = readableTextColor(color);
            root.style.setProperty(`--theme-${role}`, color);
            root.style.setProperty(`--theme-${role}-rgb`, hexToChannels(color).join(', '));
            root.style.setProperty(`--theme-on-${role}`, onColor);
            root.style.setProperty(`--theme-on-${role}-rgb`, hexToChannels(onColor).join(', '));
        });
        const panelColor = lightDashboard
            ? mixColors(this.colors[1], '#FFFFFF', 0.78)
            : supportingPanelColor(this.colors[1]);
        const onPanelColor = readableTextColor(panelColor);
        const rawSurfaceOn = readableTextColor(this.colors[3]);
        // Settings needs three visibly different layers even when a custom
        // palette supplies four very similar colors. Keep Surface as the main
        // card color, then derive a darker canvas and a subtly contrasting
        // inset color in the direction of the readable foreground.
        const settingsCard = rawSurfaceOn === '#FFFFFF'
            ? mixColors(this.colors[3], '#FFFFFF', 0.9)
            : this.colors[3];
        const onSettingsCard = accessibleTextColor(settingsCard);
        const settingsCanvas = mixColors(settingsCard, '#111827', 0.72);
        const onSettingsCanvas = accessibleTextColor(settingsCanvas);
        const settingsInset = mixColors(settingsCard, onSettingsCard, 0.92);
        const onSettingsInset = accessibleTextColor(settingsInset);
        const settingsAction = visibleRoleColor(
            settingsCard,
            [this.colors[0], this.colors[1], this.colors[2], onSettingsCard]
        );
        const onSettingsAction = accessibleTextColor(settingsAction);
        const dashboardBase = lightDashboard
            ? mixColors(this.colors[0], this.colors[1], 0.55)
            : mixColors(this.colors[0], '#000014', 0.5);
        const dashboardInk = accessibleTextColor(dashboardBase);
        const uiAccent = visibleRoleColor(
            settingsCard,
            [this.colors[2], this.colors[1], this.colors[0]]
        );
        const dashboardAccent = visibleRoleColor(
            dashboardBase,
            [this.colors[2], this.colors[3], this.colors[1], '#FFFFFF']
        );
        const dashboardGlow = dashboardAccent;
        const dashboardGlowOpacity = normalizedGlowOpacity(dashboardGlow, dashboardBase);
        const panelAccent = visibleRoleColor(
            panelColor,
            [this.colors[2], this.colors[0], this.colors[3], '#FFFFFF']
        );
        root.style.setProperty('--theme-panel', panelColor);
        root.style.setProperty('--theme-panel-rgb', hexToChannels(panelColor).join(', '));
        root.style.setProperty('--theme-on-panel', onPanelColor);
        root.style.setProperty('--theme-on-panel-rgb', hexToChannels(onPanelColor).join(', '));
        [
            ['settings-canvas', settingsCanvas, onSettingsCanvas],
            ['settings-card', settingsCard, onSettingsCard],
            ['settings-inset', settingsInset, onSettingsInset],
            ['settings-action', settingsAction, onSettingsAction]
        ].forEach(([role, color, onColor]) => {
            root.style.setProperty(`--theme-${role}`, color);
            root.style.setProperty(`--theme-${role}-rgb`, hexToChannels(color).join(', '));
            root.style.setProperty(`--theme-on-${role}`, onColor);
            root.style.setProperty(`--theme-on-${role}-rgb`, hexToChannels(onColor).join(', '));
        });
        root.style.setProperty('--theme-ui-accent', uiAccent);
        root.style.setProperty('--theme-ui-accent-rgb', hexToChannels(uiAccent).join(', '));
        root.style.setProperty('--theme-dashboard-base', dashboardBase);
        root.style.setProperty('--theme-dashboard-ink', dashboardInk);
        root.style.setProperty('--theme-dashboard-ink-rgb', hexToChannels(dashboardInk).join(', '));
        root.style.setProperty('--theme-dashboard-accent', dashboardAccent);
        root.style.setProperty('--theme-dashboard-accent-rgb', hexToChannels(dashboardAccent).join(', '));
        root.style.setProperty('--theme-dashboard-glow', dashboardGlow);
        root.style.setProperty('--theme-dashboard-glow-rgb', hexToChannels(dashboardGlow).join(', '));
        root.style.setProperty('--theme-dashboard-glow-opacity', String(dashboardGlowOpacity));
        root.style.setProperty('--theme-panel-accent', panelAccent);
        root.style.setProperty('--theme-panel-accent-rgb', hexToChannels(panelAccent).join(', '));
        root.style.setProperty('--theme-frame-border', mixColors(this.colors[0], readableTextColor(this.colors[0]), 0.9));
        root.style.setProperty('--page-gradient', gradient);
        root.dataset.palette = this.paletteId;
        root.dataset.dashboardTone = lightDashboard ? 'light' : 'dark';
        if (this.editionId) root.dataset.edition = this.editionId;
        else delete root.dataset.edition;
        if (this.editionId === 'music-city') {
            document.querySelectorAll('img[data-edition-src]').forEach((image) => {
                if (!image.hasAttribute('src')) image.src = image.dataset.editionSrc;
            });
        }
        document.body.style.background = gradient;
        document.body.style.backgroundAttachment = 'fixed';

        const preview = document.getElementById('gradient-preview');
        if (preview) {
            preview.style.background = `linear-gradient(110deg, ${this.colors.join(', ')})`;
        }
        this.updateEditionCopy();
    }

    updateEditionCopy() {
        const edition = SPECIAL_EDITIONS[this.editionId];
        const badge = document.getElementById('active-edition-badge');
        if (badge) {
            badge.hidden = !edition;
            badge.textContent = edition?.badge || '';
        }
        const scheduleHeading = document.getElementById('white-box-heading');
        const dashboardState = document.querySelector('.current-period')?.dataset.state;
        if (scheduleHeading && dashboardState !== 'no-school') {
            scheduleHeading.textContent = edition?.scheduleTitle || 'Today’s Schedule';
        }
    }

    resetToDefaults() {
        this.selectPalette(DEFAULT_PALETTE_ID);
    }

    updateUI() {
        const inputIds = [
            'gradient-start-color',
            'gradient-end-color',
            'palette-accent-color',
            'palette-surface-color'
        ];
        const hexIds = [
            'gradient-start-hex',
            'gradient-end-hex',
            'palette-accent-hex',
            'palette-surface-hex'
        ];

        inputIds.forEach((id, index) => {
            const input = document.getElementById(id);
            if (input) input.value = this.colors[index];
            const hex = document.getElementById(hexIds[index]);
            if (hex) hex.textContent = this.colors[index];
        });

        const angleInput = document.getElementById('gradient-angle');
        const angleValue = document.querySelector('#gradient-angle + .range-value');
        if (angleInput) angleInput.value = String(this.angle);
        if (angleValue) angleValue.textContent = `${this.angle}°`;

        document.querySelectorAll('.palette-option').forEach((button) => {
            const selected = button.dataset.palette === this.paletteId;
            button.classList.toggle('selected', selected);
            button.setAttribute('aria-checked', String(selected));
        });

        document.querySelectorAll('.edition-option').forEach((button) => {
            const selected = button.dataset.edition === this.editionId;
            button.classList.toggle('selected', selected);
            button.setAttribute('aria-checked', String(selected));
        });

        const customEditor = document.getElementById('gradient-settings');
        if (customEditor) customEditor.hidden = this.paletteId !== 'custom';

        const customSwatches = document.querySelectorAll('#custom-palette-swatches i');
        customSwatches.forEach((swatch, index) => {
            swatch.style.setProperty('--swatch', this.colors[index]);
        });
    }

    updateGradientSettingsVisibility() {
        this.updateUI();
    }

    saveSettings() {
        localStorage.setItem('gradientSettings', JSON.stringify({
            paletteId: this.paletteId,
            paletteName: SPECIAL_EDITIONS[this.editionId]?.name || COLOR_PALETTES[this.paletteId]?.name || 'Custom',
            editionId: this.editionId,
            colors: this.colors,
            angle: this.angle,
            startColor: this.colors[0],
            endColor: this.colors[1],
            stops: this.stops
        }));
    }
}

window.IndyPalettes = COLOR_PALETTES;
window.IndySpecialEditions = SPECIAL_EDITIONS;
window.gradientManager = window.gradientManager || new GradientManager();
window.gradientManager.init();
