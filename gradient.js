// Four-color palette system for Indy Schedule.
const COLOR_PALETTES = Object.freeze({
    indy: {
        name: 'Indy',
        colors: ['#000035', '#1B2455', '#C4AD62', '#FFFFFF'],
        angle: 90
    },
    ocean: {
        name: 'Ocean',
        colors: ['#112D4E', '#3F72AF', '#DBE2EF', '#F9F7F7'],
        angle: 120
    },
    'dark-teal': {
        name: 'Dark Teal',
        colors: ['#222831', '#393E46', '#00ADB5', '#EEEEEE'],
        angle: 125
    },
    earth: {
        name: 'Earth',
        colors: ['#2C3639', '#3F4E4F', '#A27B5C', '#DCD7C9'],
        angle: 120
    },
    neon: {
        name: 'Neon',
        colors: ['#252A34', '#08D9D6', '#FF2E63', '#EAEAEA'],
        angle: 135
    },
    pastel: {
        name: 'Pastel',
        colors: ['#F38181', '#95E1D3', '#FCE38A', '#EAFFD0'],
        angle: 120
    },
    midnight: {
        name: 'Midnight',
        colors: ['#070F2B', '#1B1A55', '#9290C3', '#535C91'],
        angle: 120
    },
    'dark-plum': {
        name: 'Dark Plum',
        colors: ['#030637', '#3C0753', '#910A67', '#720455'],
        angle: 125
    },
    graphite: {
        name: 'Graphite',
        colors: ['#222831', '#76ABAE', '#EEEEEE', '#31363F'],
        angle: 130
    },
    'forest-night': {
        name: 'Forest Night',
        colors: ['#12372A', '#ADBC9F', '#FBFADA', '#436850'],
        angle: 125
    }
});

const DEFAULT_PALETTE_ID = 'indy';
const PALETTE_ROLES = ['primary', 'secondary', 'accent', 'surface'];

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

const buildGradient = (angle, colors) => (
    `linear-gradient(${angle}deg, ${colors[0]} 0%, ${colors[1]} 100%)`
);

class GradientManager {
    constructor() {
        const defaultPalette = COLOR_PALETTES[DEFAULT_PALETTE_ID];
        this.paletteId = DEFAULT_PALETTE_ID;
        this.colors = [...defaultPalette.colors];
        this.angle = defaultPalette.angle;
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

        const preset = COLOR_PALETTES[settings.paletteId];
        if (preset) {
            this.paletteId = settings.paletteId;
            this.colors = [...preset.colors];
            this.angle = Number.isFinite(Number(settings.angle)) ? Number(settings.angle) : preset.angle;
        } else if (Array.isArray(settings.colors) && settings.colors.length === 4) {
            this.paletteId = 'custom';
            this.colors = settings.colors.map((color, index) => normalizeColor(color, COLOR_PALETTES.indy.colors[index]));
            this.angle = Number.isFinite(Number(settings.angle)) ? Number(settings.angle) : 90;
        } else if (settings.startColor || settings.endColor) {
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
        if (paletteId === 'custom') {
            this.paletteId = 'custom';
        } else {
            const palette = COLOR_PALETTES[paletteId];
            if (!palette) return;
            this.paletteId = paletteId;
            this.colors = [...palette.colors];
            this.angle = palette.angle;
        }
        this.commitChange();
        window.trackAnalyticsEvent?.('palette_selected', { palette_id: this.paletteId });
    }

    activateCustomPalette() {
        this.paletteId = 'custom';
        this.commitChange();
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

        PALETTE_ROLES.forEach((role, index) => {
            const color = this.colors[index];
            const onColor = readableTextColor(color);
            root.style.setProperty(`--theme-${role}`, color);
            root.style.setProperty(`--theme-${role}-rgb`, hexToChannels(color).join(', '));
            root.style.setProperty(`--theme-on-${role}`, onColor);
            root.style.setProperty(`--theme-on-${role}-rgb`, hexToChannels(onColor).join(', '));
        });
        const panelColor = supportingPanelColor(this.colors[1]);
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
        const dashboardBase = mixColors(this.colors[0], '#000014', 0.5);
        const uiAccent = visibleRoleColor(
            settingsCard,
            [this.colors[2], this.colors[1], this.colors[0]]
        );
        const dashboardAccent = visibleRoleColor(
            dashboardBase,
            [this.colors[2], this.colors[3], this.colors[1], '#FFFFFF']
        );
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
        root.style.setProperty('--theme-dashboard-accent', dashboardAccent);
        root.style.setProperty('--theme-dashboard-accent-rgb', hexToChannels(dashboardAccent).join(', '));
        root.style.setProperty('--theme-panel-accent', panelAccent);
        root.style.setProperty('--theme-panel-accent-rgb', hexToChannels(panelAccent).join(', '));
        root.style.setProperty('--theme-frame-border', mixColors(this.colors[0], readableTextColor(this.colors[0]), 0.9));
        root.style.setProperty('--page-gradient', gradient);
        root.dataset.palette = this.paletteId;
        document.body.style.background = gradient;
        document.body.style.backgroundAttachment = 'fixed';

        const preview = document.getElementById('gradient-preview');
        if (preview) {
            preview.style.background = `linear-gradient(110deg, ${this.colors.join(', ')})`;
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
            paletteName: COLOR_PALETTES[this.paletteId]?.name || 'Custom',
            colors: this.colors,
            angle: this.angle,
            startColor: this.colors[0],
            endColor: this.colors[1],
            stops: this.stops
        }));
    }
}

window.IndyPalettes = COLOR_PALETTES;
window.gradientManager = window.gradientManager || new GradientManager();
window.gradientManager.init();
