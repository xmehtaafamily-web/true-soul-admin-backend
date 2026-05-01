const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.TRUECONNECT_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.TRUECONNECT_SUPABASE_SERVICE_ROLE_KEY ||
  "";
const FIREBASE_SERVICE_ACCOUNT_JSON =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  process.env.TRUECONNECT_FIREBASE_SERVICE_ACCOUNT_JSON ||
  "";
const VIP_COUPONS_TABLE = "vip_coupons";
const PROFILES_TABLE = "profiles";
const AI_RISK_ALERTS_TABLE = "ai_risk_alerts";
const PORT = process.env.PORT || 4000;

function getFirebaseServiceAccount() {
  if (FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON value");
    }
  }

  const localServiceAccountPath = path.join(
    __dirname,
    "firebase-service-account.json"
  );

  if (fs.existsSync(localServiceAccountPath)) {
    return JSON.parse(fs.readFileSync(localServiceAccountPath, "utf8"));
  }

  return null;
}

let firebaseMessagingEnabled = false;
try {
  const serviceAccount = getFirebaseServiceAccount();
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseMessagingEnabled = true;
    console.log("Firebase Admin initialized");
  } else {
    console.warn(
      "Firebase service account not found. Notification routes will return 503 until configured."
    );
  }
} catch (error) {
  console.error("Firebase Admin init failed:", error.message);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "trueconnect-admin-backend" });
});

function normalizeCouponCode(code) {
  return String(code || "").trim().toUpperCase();
}

function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseRequest(path, options = {}) {
  if (!hasSupabaseConfig()) {
    throw new Error(
      "Missing Supabase config. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Supabase request failed");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

app.get("/vip-coupons", async (_req, res) => {
  try {
    const coupons = await supabaseRequest(
      `${VIP_COUPONS_TABLE}?select=code,is_active,expires_in_days,redeemed_by,redeemed_at,expires_at,created_at&order=created_at.desc`
    );

    return res.json({ success: true, coupons });
  } catch (error) {
    console.error("VIP coupon list error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/vip-coupons", async (req, res) => {
  try {
    const code = normalizeCouponCode(req.body.code);
    const expiresInDays = Number(req.body.expiresInDays || 90);

    if (!code) {
      return res.status(400).json({ error: "Missing coupon code" });
    }

    if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) {
      return res
        .status(400)
        .json({ error: "expiresInDays must be a positive number" });
    }

    const payload = {
      code,
      expires_in_days: expiresInDays,
      is_active: true,
    };

    const created = await supabaseRequest(VIP_COUPONS_TABLE, {
      method: "POST",
      headers: {
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    });

    return res.json({
      success: true,
      coupon: Array.isArray(created) ? created[0] : created,
    });
  } catch (error) {
    console.error("VIP coupon create error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/vip-coupons/:code/disable", async (req, res) => {
  try {
    const code = normalizeCouponCode(req.params.code);

    if (!code) {
      return res.status(400).json({ error: "Missing coupon code" });
    }

    const updated = await supabaseRequest(
      `${VIP_COUPONS_TABLE}?code=eq.${encodeURIComponent(code)}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify({ is_active: false }),
      }
    );

    if (!Array.isArray(updated) || updated.length === 0) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    return res.json({ success: true, coupon: updated[0] });
  } catch (error) {
    console.error("VIP coupon disable error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/vip-coupons/:code/enable", async (req, res) => {
  try {
    const code = normalizeCouponCode(req.params.code);

    if (!code) {
      return res.status(400).json({ error: "Missing coupon code" });
    }

    const updated = await supabaseRequest(
      `${VIP_COUPONS_TABLE}?code=eq.${encodeURIComponent(code)}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify({ is_active: true }),
      }
    );

    if (!Array.isArray(updated) || updated.length === 0) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    return res.json({ success: true, coupon: updated[0] });
  } catch (error) {
    console.error("VIP coupon enable error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/trust/low-users", async (_req, res) => {
  try {
    const users = await supabaseRequest(
      `${PROFILES_TABLE}?select=id,full_name,name,trust_score,trust_review_status,ai_risk_score,ai_risk_label,verified,is_blocked,flagged&trust_score=lte.45&order=trust_score.asc`
    );
    return res.json({ success: true, users });
  } catch (error) {
    console.error("Low trust users error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/trust/ai-alerts", async (_req, res) => {
  try {
    const alerts = await supabaseRequest(
      `${AI_RISK_ALERTS_TABLE}?select=id,user_id,risk_type,risk_score,summary,status,created_at&order=created_at.desc`
    );
    return res.json({ success: true, alerts });
  } catch (error) {
    console.error("AI alerts error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/trust/users/:userId/review", async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    const status = String(req.body.status || "under_review").trim();
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const updated = await supabaseRequest(
      `${PROFILES_TABLE}?id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          trust_review_status: status,
        }),
      }
    );

    return res.json({ success: true, user: Array.isArray(updated) ? updated[0] : updated });
  } catch (error) {
    console.error("Trust review error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/trust/users/:userId/ban", async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const updated = await supabaseRequest(
      `${PROFILES_TABLE}?id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          is_blocked: true,
          flagged: true,
          trust_review_status: "banned",
        }),
      }
    );

    return res.json({ success: true, user: Array.isArray(updated) ? updated[0] : updated });
  } catch (error) {
    console.error("Trust ban error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/send-support-reply-notification", async (req, res) => {
  try {
    if (!firebaseMessagingEnabled) {
      return res.status(503).json({
        error:
          "Firebase messaging is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON in Render environment variables.",
      });
    }

    const { fcmToken, subject } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: "Missing fcmToken" });
    }

    const message = {
      token: fcmToken,
      notification: {
        title: "TrueConnect Support",
        body: subject
          ? `Support replied to: ${subject}`
          : "Support replied to your ticket",
      },
      data: {
        type: "support_reply",
        click_action: "OPEN_SUPPORT_TICKETS",
      },
    };

    const response = await admin.messaging().send(message);
    return res.json({ success: true, response });
  } catch (error) {
    console.error("Push send error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/send-message-notification", async (req, res) => {
  try {
    if (!firebaseMessagingEnabled) {
      return res.status(503).json({
        error:
          "Firebase messaging is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON in Render environment variables.",
      });
    }

    const { fcmToken, senderName, matchId, otherUserId } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: "Missing fcmToken" });
    }

    const message = {
      token: fcmToken,
      notification: {
        title: senderName ? `${senderName} sent a message` : "New message",
        body: "Tap to open chat",
      },
      data: {
        type: "new_message",
        match_id: matchId || "",
        other_user_id: otherUserId || "",
        sender_name: senderName || "",
      },
    };

    const response = await admin.messaging().send(message);
    return res.json({ success: true, response });
  } catch (error) {
    console.error("Message push send error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/send-match-notification", async (req, res) => {
  try {
    if (!firebaseMessagingEnabled) {
      return res.status(503).json({
        error:
          "Firebase messaging is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON in Render environment variables.",
      });
    }

    const { fcmToken, matchedName, otherUserId, matchId } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: "Missing fcmToken" });
    }

    const message = {
      token: fcmToken,
      notification: {
        title: "It's a Match!",
        body: matchedName
          ? `You matched with ${matchedName}`
          : "Someone liked you back",
      },
      data: {
        type: "new_match",
        other_user_id: otherUserId || "",
        matched_name: matchedName || "",
        match_id: matchId || "",
      },
    };

    const response = await admin.messaging().send(message);
    return res.json({ success: true, response });
  } catch (error) {
    console.error("Match push send error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
