import admin from "firebase-admin";

admin.initializeApp({ projectId: "ais-dev-ffwjs6qulxekmakddbs7ua" });
const dbId = 'ai-studio-c8208f9a-b409-4e13-8593-bf7748b8d77e';
const db = (admin as any).firestore(admin.app(), dbId);

async function run() {
    try {
        const snap = await db.collection("intelligence").limit(1).get();
        console.log("Success! Docs:", snap.size);
    } catch(e: any) {
        console.log("Error:", e.message);
    }
}
run();
