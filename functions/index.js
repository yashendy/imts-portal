// /functions/index.js
import { onCall } from "firebase-functions/v2/https";
import { onAuthUserCreate } from "firebase-functions/v2/identity";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/** ينشئ وثيقة المستخدم عند أول تسجيل */
export const onUserCreated = onAuthUserCreate(async (event) => {
  const user = event.data;
  const uid = user.uid;
  const ref = db.doc(`users/${uid}`);

  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      email: user.email || null,
      displayName: user.displayName || null,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await ref.update({ updatedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
  }
});

/** يقبل كود الدعوة ويعيّن الدور */
export const acceptInvite = onCall({ enforceAppCheck: false }, async (request) => {
  const ctx = request.auth;
  if (!ctx) throw new Error("FAILED_PRECONDITION: not authenticated");

  const uid = ctx.uid;
  const code = String(request.data?.code || "").trim();
  if (!code) throw new Error("INVALID_CODE");

  const inviteRef = db.doc(`invites/${code}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new Error("INVALID_CODE");

  const inv = inviteSnap.data();
  if (inv.active !== true) throw new Error("INVALID_CODE");
  if (inv.expiresAt && inv.expiresAt.toDate && inv.expiresAt.toDate() < new Date())
    throw new Error("EXPIRED_CODE");
  if (typeof inv.usageLimit === "number" && typeof inv.usedCount === "number") {
    if (inv.usedCount >= inv.usageLimit) throw new Error("ALREADY_USED");
  }

  const role = inv.role;
  if (!["teacher","admin"].includes(role)) throw new Error("INVALID_CODE");

  // اكتب الدور على وثيقة المستخدم
  const userRef = db.doc(`users/${uid}`);
  await userRef.set({
    role, status: "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // claims (اختياري)
  await admin.auth().setCustomUserClaims(uid, { role });

  // حدّث الدعوة
  await inviteRef.set({
    usedCount: (inv.usedCount || 0) + 1,
    lastUsedBy: uid,
    lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, role };
});
