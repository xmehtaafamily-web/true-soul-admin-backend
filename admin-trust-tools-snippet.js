const ADMIN_BACKEND_BASE_URL = "http://localhost:4000";

async function loadLowTrustUsers() {
  const response = await fetch(`${ADMIN_BACKEND_BASE_URL}/trust/low-users`);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Low trust users load failed");
  }
  console.table(result.users || []);
  return result.users || [];
}

async function loadAiRiskAlerts() {
  const response = await fetch(`${ADMIN_BACKEND_BASE_URL}/trust/ai-alerts`);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "AI alerts load failed");
  }
  console.table(result.alerts || []);
  return result.alerts || [];
}

async function markUserUnderReview(userId) {
  const response = await fetch(`${ADMIN_BACKEND_BASE_URL}/trust/users/${encodeURIComponent(userId)}/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "under_review",
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Review action failed");
  }
  return result.user;
}

async function banUserFromTrustPanel(userId) {
  const response = await fetch(`${ADMIN_BACKEND_BASE_URL}/trust/users/${encodeURIComponent(userId)}/ban`, {
    method: "POST",
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Ban action failed");
  }
  return result.user;
}
