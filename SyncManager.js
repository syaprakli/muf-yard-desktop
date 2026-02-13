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
                    SyncManager.userId = user.uid;
                    SyncManager.isConnected = true;
                    console.log('SyncManager: Connected as', user.email);

                    // Trigger initial cloud-to-local sync for storage blobs
                    // (Managed by StorageManager.syncFromCloud in AuthManager)

                    // Start Real-time listen for detailed audit records
                    SyncManager.listenForAuditUpdates();
                } else {
                    SyncManager.isConnected = false;
                    SyncManager.userId = null;
                    console.log('SyncManager: Disconnected');
                }
            });
        }
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
     * Listen for real-time changes in the audit_records collection.
     */
    listenForAuditUpdates: function () {
        if (!SyncManager.isConnected || !SyncManager.userId) return;

        console.log('SyncManager: Listening for cloud updates...');

        firebase.firestore()
            .collection('audit_records')
            .where('userId', '==', SyncManager.userId)
            .onSnapshot((snapshot) => {
                if (snapshot.empty) return;

                const cloudAudits = [];
                snapshot.forEach(doc => {
                    cloudAudits.push(doc.data());
                });

                SyncManager.mergeAuditData(cloudAudits);
            }, (error) => {
                console.error("SyncManager: Snapshot listener error:", error);
            });
    },

    /**
     * Merge cloud audit data with local data.
     */
    mergeAuditData: function (cloudAudits) {
        const localAudits = StorageManager.get('audit_records', []);
        let hasChanges = false;

        cloudAudits.forEach(cloudRecord => {
            const localIdx = localAudits.findIndex(a => a.id === cloudRecord.id);

            if (localIdx === -1) {
                // New record from cloud
                localAudits.push(cloudRecord);
                hasChanges = true;
                console.log('SyncManager: New record from cloud:', cloudRecord.id);
            } else {
                // Conflict resolution: Last Write Wins
                const localDate = new Date(localAudits[localIdx].updatedAt || 0).getTime();
                // Firestore client-side sometimes has pending timestamp, so we check updatedAt field primarily
                const cloudDate = new Date(cloudRecord.updatedAt || 0).getTime();

                if (cloudDate > localDate) {
                    localAudits[localIdx] = cloudRecord;
                    hasChanges = true;
                    console.log('SyncManager: Updated record from cloud:', cloudRecord.id);
                }
            }
        });

        if (hasChanges) {
            // Save to local storage without triggering syncToCloud loop
            // We use localStorage.setItem directly or a flag in StorageManager if available
            // For simplicity, we just save and let StorageManager know it's a sync update
            localStorage.setItem('audit_records', JSON.stringify(localAudits));

            // Notify UI if necessary
            if (typeof AuditManager !== 'undefined' && typeof AuditManager.initListView === 'function') {
                AuditManager.initListView();
            }

            if (typeof Toast !== 'undefined') {
                Toast.show('Denetim kayıtları güncellendi.', 'info');
            }
        }
    }
};

// Auto-initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', SyncManager.init);
} else {
    SyncManager.init();
}
