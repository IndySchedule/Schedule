import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'indy-schedule-rules-test';
const rules = await readFile('firestore.rules', 'utf8');
const testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: { rules }
});

const ownerId = 'owner-user';
const otherId = 'other-user';
const userPath = `users/${ownerId}`;
const schemaFields = [
    'schemaVersion', 'revision', 'updatedAt', 'updatedBy',
    'settingsUpdatedAt', 'settings'
];
const validSettings = {
    toastIconEnabled: 'false',
    fontFamily: 'Roboto',
    theme: 'light',
    showPeriodTimes: 'true',
    lunchWave: 'A',
    progressBarEnabled: 'true',
    progressBarColor: '#000000',
    progressBarOpacity: '10',
    gradientSettings: JSON.stringify({
        paletteId: 'indy',
        colors: ['#000035', '#1B2455', '#C4AD62', '#FFFFFF'],
        angle: 90
    }),
    currentScheduleName: 'lateStart',
    indyScheduleOverride_v1: null,
    indyOnboardingComplete_v2: 'true',
    indyAnalyticsConsent_v1: 'granted',
    indyReleaseNotice_v1_4_0: 'true',
    periodRenames: { 1: 'Example Class A', 2: 'Example Class B' },
    globalPeriodNames: { 1: 'Example Class A', 2: 'Example Class B' }
};

try {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
        // An interrupted older migration can leave the v2 marker with an
        // absent or invalid revision. The next save must repair it safely.
        await setDoc(doc(context.firestore(), userPath), {
            schemaVersion: 2,
            revision: 'legacy',
            settingsUpdatedAt: { retiredSetting: Date.now() },
            settings: { ...validSettings, retiredSetting: 'old-value' },
            unrelatedAccountData: 'preserve-me'
        });
    });

    const ownerDb = testEnvironment.authenticatedContext(ownerId).firestore();
    const otherDb = testEnvironment.authenticatedContext(otherId).firestore();
    const guestDb = testEnvironment.unauthenticatedContext().firestore();
    const settingsUpdatedAt = Object.fromEntries(Object.keys(validSettings).map((key) => [key, Date.now()]));

    await assertSucceeds(getDoc(doc(ownerDb, userPath)));
    await assertFails(getDoc(doc(otherDb, userPath)));
    await assertFails(getDoc(doc(guestDb, userPath)));
    await assertSucceeds(setDoc(doc(ownerDb, userPath), {
        schemaVersion: 2,
        revision: 1,
        updatedAt: serverTimestamp(),
        updatedBy: 'test-client',
        settingsUpdatedAt,
        settings: validSettings
    }, { mergeFields: schemaFields }));
    const migratedDocument = (await getDoc(doc(ownerDb, userPath))).data();
    assert.equal(migratedDocument.unrelatedAccountData, 'preserve-me');
    assert.equal(Object.hasOwn(migratedDocument.settings, 'retiredSetting'), false);
    assert.equal(Object.hasOwn(migratedDocument.settingsUpdatedAt, 'retiredSetting'), false);
    await assertSucceeds(setDoc(doc(ownerDb, userPath), {
        schemaVersion: 2,
        revision: 2,
        updatedAt: serverTimestamp(),
        updatedBy: 'test-client',
        settingsUpdatedAt,
        settings: { ...validSettings, theme: 'dark' }
    }, { mergeFields: schemaFields }));
    await assertFails(setDoc(doc(otherDb, userPath), {
        schemaVersion: 2,
        revision: 3,
        updatedAt: serverTimestamp(),
        updatedBy: 'other-client',
        settingsUpdatedAt,
        settings: validSettings
    }, { mergeFields: schemaFields }));
    await assertFails(setDoc(doc(ownerDb, userPath), {
        schemaVersion: 2,
        revision: 3,
        updatedAt: serverTimestamp(),
        updatedBy: 'test-client',
        settingsUpdatedAt: { ...settingsUpdatedAt, adminFlag: Date.now() },
        settings: { ...validSettings, adminFlag: 'not allowed' }
    }, { mergeFields: schemaFields }));
    await assertFails(setDoc(doc(ownerDb, userPath), {
        schemaVersion: 2,
        revision: 3,
        updatedAt: serverTimestamp(),
        updatedBy: 'test-client',
        settingsUpdatedAt,
        settings: { ...validSettings, progressBarColor: 'not-a-color' }
    }, { mergeFields: schemaFields }));

    const feedback = () => ({ category: 'schedule', message: 'Wrong bell time', name: '', email: '',
        uid: '', createdAt: serverTimestamp(), status: 'new', pageUrl: 'https://indyschedule.com/', appVersion: '1.4.0' });
    await assertSucceeds(setDoc(doc(guestDb, 'feedback/guest'), feedback()));
    await assertSucceeds(setDoc(doc(ownerDb, 'feedback/owner'), { ...feedback(), uid: ownerId }));
    for (const db of [guestDb, ownerDb, otherDb]) {
        await assertFails(getDoc(doc(db, 'feedback/owner')));
        await assertFails(getDocs(collection(db, 'feedback')));
        await assertFails(updateDoc(doc(db, 'feedback/owner'), { status: 'resolved' }));
        await assertFails(deleteDoc(doc(db, 'feedback/owner')));
    }
    const invalid = [
        { category: 'invalid' }, { message: '' }, { message: ' \n\t' }, { message: 'x'.repeat(2001) },
        { name: 'x'.repeat(101) }, { email: 'x'.repeat(255) }, { email: 'bad-email' },
        { uid: ownerId }, { status: 'reviewed' }, { createdAt: new Date(0) },
        { pageUrl: 'https://example.com/?token=secret' }, { appVersion: 'x'.repeat(33) },
        { notificationSent: true }, { extra: 'no' }, { message: 42 }, { name: null }
    ];
    for (const [index, patch] of invalid.entries()) {
        await assertFails(setDoc(doc(guestDb, `feedback/invalid-${index}`), { ...feedback(), ...patch }));
    }
    await assertFails(setDoc(doc(ownerDb, 'feedback/spoof'), { ...feedback(), uid: otherId }));
    await assertFails(setDoc(doc(ownerDb, 'feedback/missing-uid'), feedback()));
    const missing = feedback(); delete missing.status;
    await assertFails(setDoc(doc(guestDb, 'feedback/missing-field'), missing));
    await assertSucceeds(setDoc(doc(guestDb, 'feedback/boundary'), {
        ...feedback(), message: 'x'.repeat(2000), name: 'x'.repeat(100)
    }));
    console.log('Feedback rules: create validation, UID binding, and denied read/list/update/delete passed.');
    console.log('Firestore rules: owner isolation, migration, and validation passed.');
} finally {
    await testEnvironment.cleanup();
}
