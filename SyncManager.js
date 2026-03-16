/**
 * SyncManager.js - Real-time Firebase Synchronization
 * Handles instant cloud sync for audit records and connectivity status.
 */

const SyncManager = {
    isConnected: false,
    userId: null,
    syncInterval: null,

    init: function () {
        console.log("SyncManager: Initializing...");

        // Listen for Firebase Auth changes
        if (typeof firebase !== 'undefined') {
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    // Prevent double listeners but handle user switch
                    if (SyncManager.userId !== user.uid) {
                        console.log('SyncManager: User switched or first login. Starting listeners...');
                        SyncManager.userId = user.uid;
                        SyncManager.isConnected = true;
                        console.log('SyncManager: Connected as', user.email);

                        // 1. Audit Records listener (Global collection)
                        SyncManager.listenForAuditUpdates();

                        // 2. All other data listener (User subcollection)
                        SyncManager.listenForAllData();

                        // 3. Bi-directional reconciliation (Push missing/Pull new)
                        if (typeof StorageManager !== 'undefined') {
                            StorageManager.syncFromCloud();
                        }
                    }

                    // UI Status update
                    SyncManager.updateOnlineStatus(true);
                } else {
                    SyncManager.isConnected = false;
                    SyncManager.userId = null;
                    console.log('SyncManager: Disconnected');
                    SyncManager.updateOnlineStatus(false);
                }
            });

            // Monitor browser online/offline status
            window.addEventListener('online', () => SyncManager.updateOnlineStatus(true));
            window.addEventListener('offline', () => SyncManager.updateOnlineStatus(false));
        }
    },

    updateOnlineStatus: function (online) {
        const indicator = document.getElementById('online-status-indicator');
        if (indicator) {
            indicator.style.display = 'flex';
            indicator.className = online ? 'status-online' : 'status-offline';
            indicator.title = online ? 'Bağlantı Aktif (Canlı Senkronizasyon)' : 'Çevrimdışı (Yerel Mod)';
            indicator.querySelector('span').textContent = online ? 'cloud_done' : 'cloud_off';
        }
    },

    // --- GENERIC DATA REAL-TIME SYNC ---
    listenForAllData: function () {
        if (!SyncManager.isConnected || !SyncManager.userId) {
            console.warn('SyncManager: Cannot listen for data, not connected or no userId.');
            return;
        }

        const uid = SyncManager.userId;
        console.log('SyncManager: [DEBUG] Starting listener for path: users/' + uid + '/data');

        firebase.firestore()
            .collection('users').doc(uid).collection('data')
            .onSnapshot((snapshot) => {
                // Ignore local-only snapshots that haven't hit the server yet
                if (snapshot.metadata.hasPendingWrites) return;

                console.log(`SyncManager: [DEBUG] Received cloud snapshot with ${snapshot.size} docs.`);
                let changedKeys = [];

                snapshot.docChanges().forEach(change => {
                    const key = change.doc.id;
                    const serverData = change.doc.data();

                    if (change.type === 'added' || change.type === 'modified') {
                        const localValue = localStorage.getItem(key);
                        const localTs = parseInt(localStorage.getItem(`_ts_${key}`) || '0');
                        const serverTs = serverData.clientUpdatedAt || 0;

                        // Only overwrite if Server is STRICTLY newer than local
                        if (serverTs > localTs && serverData.value && serverData.value !== localValue) {
                            console.log(`SyncManager: [CONFLICT] Cloud is newer for ${key} (${serverTs} > ${localTs}). Updating local storage.`);
                            localStorage.setItem(key, serverData.value);
                            localStorage.setItem(`_ts_${key}`, serverTs.toString());
                            changedKeys.push(key);
                        } else if (serverData.value !== localValue) {
                            console.log(`SyncManager: [CONFLICT] Local data is newer or identical for ${key} (${localTs} >= ${serverTs}). Ignoring cloud.`);
                        }
                    }
                });

                if (changedKeys.length > 0) {
                    console.log('SyncManager: Updated keys from cloud:', changedKeys);
                    if (typeof UIManager !== 'undefined' && typeof UIManager.refreshCurrentView === 'function') {
                        UIManager.refreshCurrentView(changedKeys);
                    }
                }
            }, (error) => {
                console.error("SyncManager: Data listener error (Detailed):", error);
            });
    },

    // --- AUDIT RECORDS REAL-TIME SYNC ---

    /**
     * Push a single audit record to the cloud.
     * Called by AuditManager whenever a record is saved.
     */
    syncAuditRecord: async function (record) {
        if (!SyncManager.isConnected || !SyncManager.userId) return;

        try {
            await firebase.firestore()
                .collection('audit_records')
                .doc(record.id)
                .set({
                    ...record,
                    userId: SyncManager.userId,
                    lastSyncedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

            console.log('SyncManager: Record pushed to cloud:', record.id);
        } catch (e) {
            console.error('SyncManager: Push failed:', e);
        }
    },

    /**
     * Delete a single audit record from the cloud.
     * Called by AuditManager.deleteAudit.
     */
    deleteAuditRecord: async function (id) {
        if (!SyncManager.isConnected || !SyncManager.userId) return;
        try {
            await firebase.firestore()
                .collection('audit_records')
                .doc(id)
                .delete();
            console.log('SyncManager: Record deleted from cloud:', id);
        } catch (e) {
            console.error('SyncManager: Delete failed:', e);
        }
    },

    /**
     * Listen for real-time changes in the audit_records collection.
     * Handles added/modified (merge) and removed (delete from local).
     */
    listenForAuditUpdates: function () {
        if (!SyncManager.isConnected || !SyncManager.userId) return;

        console.log('SyncManager: Listening for cloud updates...');

        firebase.firestore()
            .collection('audit_records')
            .where('userId', '==', SyncManager.userId)
            .onSnapshot((snapshot) => {
                let hasChanges = false;
                let localAudits = StorageManager.get('audit_records', []);

                snapshot.docChanges().forEach(change => {
                    const cloudRecord = change.doc.data();

                    if (change.type === 'added' || change.type === 'modified') {
                        const localIdx = localAudits.findIndex(a => a.id === cloudRecord.id);
                        if (localIdx === -1) {
                            localAudits.push(cloudRecord);
                            hasChanges = true;
                        } else {
                            const localDate = new Date(localAudits[localIdx].updatedAt || 0).getTime();
                            const cloudDate = new Date(cloudRecord.updatedAt || 0).getTime();
                            if (cloudDate > localDate) {
                                localAudits[localIdx] = cloudRecord;
                                hasChanges = true;
                            }
                        }
                    } else if (change.type === 'removed') {
                        const before = localAudits.length;
                        localAudits = localAudits.filter(a => a.id !== cloudRecord.id);
                        if (localAudits.length !== before) hasChanges = true;
                    }
                });

                if (hasChanges) {
                    localStorage.setItem('audit_records', JSON.stringify(localAudits));
                    if (typeof AuditManager !== 'undefined' && typeof AuditManager.initListView === 'function') {
                        AuditManager.initListView();
                    }
                    if (typeof Toast !== 'undefined') {
                        Toast.show('Denetim kayıtları senkronize edildi.', 'info');
                    }
                }
            }, (error) => {
                console.error("SyncManager: Snapshot listener error:", error);
            });
    }
};

// Auto-initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', SyncManager.init);
} else {
    SyncManager.init();
}
