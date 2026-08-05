(function (global) {
    'use strict';

    const TIME_ZONE = 'America/Chicago';
    const SCHOOL_YEAR_START = '2026-08-10';
    const SCHOOL_YEAR_END = '2027-05-27';

    const SCHEDULES = Object.freeze({
        normal: Object.freeze([
            { name: 'Period 1', start: '07:40', end: '08:29' },
            { name: 'Period 2', start: '08:34', end: '09:21' },
            { name: 'Homeroom', start: '09:21', end: '09:31' },
            { name: 'Period 3', start: '09:36', end: '10:23' },
            { name: 'SOAR', start: '10:23', end: '10:51' },
            { name: 'Period 4', start: '10:56', end: '11:43' },
            { name: 'Period 5', start: '11:48', end: '13:02' },
            { name: 'Period 6', start: '13:07', end: '13:54' },
            { name: 'Period 7', start: '13:59', end: '14:47' }
        ]),
        normalNoSoar: Object.freeze([
            { name: 'Period 1', start: '07:40', end: '08:29' },
            { name: 'Period 2', start: '08:34', end: '09:21' },
            { name: 'Homeroom', start: '09:21', end: '09:31' },
            { name: 'Period 3', start: '09:36', end: '10:51' },
            { name: 'Period 4', start: '10:56', end: '11:43' },
            { name: 'Period 5', start: '11:48', end: '13:02' },
            { name: 'Period 6', start: '13:07', end: '13:54' },
            { name: 'Period 7', start: '13:59', end: '14:47' }
        ]),
        lateStart: Object.freeze([
            { name: 'Period 1', start: '08:25', end: '09:11' },
            { name: 'Period 2', start: '09:16', end: '10:00' },
            { name: 'Period 3', start: '10:05', end: '10:49' },
            { name: 'Period 4', start: '10:54', end: '11:38' },
            { name: 'Period 5', start: '11:43', end: '13:06' },
            { name: 'Period 6', start: '13:11', end: '13:55' },
            { name: 'Period 7', start: '14:00', end: '14:47' }
        ]),
        halfDay: Object.freeze([
            { name: 'Period 1', start: '07:40', end: '08:06' },
            { name: 'Period 2', start: '08:11', end: '08:37' },
            { name: 'Period 3', start: '08:42', end: '09:08' },
            { name: 'Period 4', start: '09:13', end: '09:39' },
            { name: 'Period 5', start: '09:44', end: '10:10' },
            { name: 'Period 6', start: '10:15', end: '10:41' },
            { name: 'Period 7', start: '10:46', end: '11:15' }
        ])
    });

    const LUNCHES = Object.freeze({
        normal: Object.freeze({
            A: Object.freeze({ name: 'Lunch A', start: '11:43', end: '12:08', isLunch: true }),
            B: Object.freeze({ name: 'Lunch B', start: '12:10', end: '12:35', isLunch: true }),
            C: Object.freeze({ name: 'Lunch C', start: '12:37', end: '13:02', isLunch: true })
        }),
        lateStart: Object.freeze({
            A: Object.freeze({ name: 'Lunch A', start: '11:38', end: '12:06', isLunch: true }),
            B: Object.freeze({ name: 'Lunch B', start: '12:08', end: '12:36', isLunch: true }),
            C: Object.freeze({ name: 'Lunch C', start: '12:38', end: '13:06', isLunch: true })
        })
    });

    const NO_SCHOOL_RANGES = [
        ['2026-09-07', '2026-09-07'],
        ['2026-10-12', '2026-10-16'],
        ['2026-11-03', '2026-11-03'],
        ['2026-11-23', '2026-11-27'],
        ['2026-12-21', '2027-01-04'],
        ['2027-01-18', '2027-01-18'],
        ['2027-02-12', '2027-02-15'],
        ['2027-03-15', '2027-03-19'],
        ['2027-03-26', '2027-03-26']
    ];

    const HALF_DAYS = new Set([
        '2026-08-10',
        '2026-12-18',
        '2027-05-27'
    ]);

    // WCS 6–12 late-start dates for the 2026–27 school year.
    const LATE_START_DAYS = new Set([
        '2026-08-18', '2026-08-24', '2026-08-31',
        '2026-09-08', '2026-09-14', '2026-09-21', '2026-09-28',
        '2026-10-05', '2026-10-19', '2026-10-26',
        '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-30',
        '2026-12-07',
        '2027-01-05', '2027-01-11', '2027-01-19', '2027-01-25',
        '2027-02-01', '2027-02-08', '2027-02-22',
        '2027-03-01', '2027-03-08', '2027-03-22', '2027-03-29',
        '2027-04-05'
    ]);

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23'
    });

    function parts(date = new Date()) {
        const values = {};
        formatter.formatToParts(date).forEach(({ type, value }) => {
            if (type !== 'literal') values[type] = value;
        });
        return {
            year: Number(values.year), month: Number(values.month), day: Number(values.day),
            hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second)
        };
    }

    function dateKey(date = new Date()) {
        const p = parts(date);
        return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    }

    function addDays(key, amount) {
        const date = new Date(`${key}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() + amount);
        return date.toISOString().slice(0, 10);
    }

    function weekday(key) {
        return new Date(`${key}T12:00:00Z`).getUTCDay();
    }

    function isInRange(key, start, end) {
        return key >= start && key <= end;
    }

    function getDayType(value = new Date()) {
        const key = value instanceof Date ? dateKey(value) : value;
        const day = weekday(key);
        if (day === 0 || day === 6) return 'noSchool';
        if (!isInRange(key, SCHOOL_YEAR_START, SCHOOL_YEAR_END)) return 'noSchool';
        if (NO_SCHOOL_RANGES.some(([start, end]) => isInRange(key, start, end))) return 'noSchool';
        if (HALF_DAYS.has(key)) return 'halfDay';
        if (LATE_START_DAYS.has(key)) return 'lateStart';
        return 'regular';
    }

    function getScheduleKey(value = new Date()) {
        const key = value instanceof Date ? dateKey(value) : value;
        const dayType = getDayType(key);
        if (dayType === 'halfDay') return 'halfDay';
        if (dayType === 'lateStart') return 'lateStart';
        const day = weekday(key);
        if (day === 1 || day === 5) return 'normalNoSoar';
        return 'normal';
    }

    function getLunchPeriod(scheduleKey, wave) {
        if (scheduleKey === 'halfDay') return null;
        const normalizedWave = String(wave || '').toUpperCase();
        const lunchSchedule = scheduleKey === 'lateStart' ? LUNCHES.lateStart : LUNCHES.normal;
        return lunchSchedule[normalizedWave] || null;
    }

    function getScheduleWithLunch(scheduleKey, wave) {
        const baseSchedule = SCHEDULES[scheduleKey];
        if (!baseSchedule) return null;

        const withPeriodNumber = (period) => {
            const match = period.name.match(/^Period\s+(\d+)$/i);
            return { ...period, periodNum: match ? match[1] : undefined };
        };
        const base = baseSchedule.map(withPeriodNumber);
        const lunch = getLunchPeriod(scheduleKey, wave);
        if (!lunch) return base;

        const fifthIndex = base.findIndex((period) => period.periodNum === '5');
        if (fifthIndex < 0) return base;
        const fifth = base[fifthIndex];
        const normalizedWave = String(wave).toUpperCase();
        const isLateStart = scheduleKey === 'lateStart';
        const segment = (start, end, segmentLabel) => ({
            name: 'Period 5', periodNum: '5', start, end, segmentLabel
        });
        // Keep the selected wave internal; the visible timeline only needs to say Lunch.
        const lunchEntry = { ...lunch, name: 'Lunch', periodNum: undefined };
        let replacement;

        if (normalizedWave === 'A') {
            replacement = [
                lunchEntry,
                segment(isLateStart ? '12:11' : '12:13', fifth.end)
            ];
        } else if (normalizedWave === 'B') {
            replacement = [
                segment(fifth.start, lunch.start, 'Part 1'),
                lunchEntry,
                segment(isLateStart ? '12:41' : '12:40', fifth.end, 'Part 2')
            ];
        } else {
            replacement = [
                segment(fifth.start, lunch.start),
                lunchEntry
            ];
        }

        return [...base.slice(0, fifthIndex), ...replacement, ...base.slice(fifthIndex + 1)];
    }

    function getNextInstructionalDateKey(value = new Date()) {
        let key = value instanceof Date ? dateKey(value) : value;
        for (let i = 0; i < 370; i += 1) {
            key = addDays(key, 1);
            if (getDayType(key) !== 'noSchool') return key;
        }
        return null;
    }

    function secondsSinceMidnight(date = new Date()) {
        const p = parts(date);
        return p.hour * 3600 + p.minute * 60 + p.second;
    }

    // Convert a school-local wall time into an epoch, accounting for CST/CDT.
    function epochForSchoolTime(key, time) {
        const [year, month, day] = key.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);
        let epoch = Date.UTC(year, month - 1, day, hour, minute, 0);
        for (let i = 0; i < 2; i += 1) {
            const actual = parts(new Date(epoch));
            const actualAsUTC = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
            const desiredAsUTC = Date.UTC(year, month - 1, day, hour, minute, 0);
            epoch += desiredAsUTC - actualAsUTC;
        }
        return epoch;
    }

    global.IndyCalendar = Object.freeze({
        TIME_ZONE,
        SCHOOL_YEAR_START,
        SCHOOL_YEAR_END,
        LATE_START_DATES: Object.freeze(Array.from(LATE_START_DAYS)),
        SCHEDULES,
        LUNCHES,
        dateKey,
        addDays,
        getDayType,
        getScheduleKey,
        getLunchPeriod,
        getScheduleWithLunch,
        getNextInstructionalDateKey,
        secondsSinceMidnight,
        epochForSchoolTime
    });
})(globalThis);
