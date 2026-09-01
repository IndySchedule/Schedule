import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

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
    indyReleaseNotice_v1_3_4: 'true',
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

    console.log('Firestore rules: owner isolation, migration, and validation passed.');
} finally {
    await testEnvironment.cleanup();
}
