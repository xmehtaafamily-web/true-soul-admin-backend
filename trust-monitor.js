const TRUST_MONITOR_BASE_URL = "http://localhost:4000";

const lowTrustBody = document.getElementById("lowTrustBody");
const aiAlertsBody = document.getElementById("aiAlertsBody");
const statLowTrust = document.getElementById("statLowTrust");
const statAlerts = document.getElementById("statAlerts");
const statBanned = document.getElementById("statBanned");
const statReview = document.getElementById("statReview");
const btnRefresh = document.getElementById("btnRefresh");
const btnRefreshAll = document.getElementById("btnRefreshAll");

btnRefresh?.addEventListener("click", () => {
  loadTrustMonitor();
});

btnRefreshAll?.addEventListener("click", () => {
  loadTrustMonitor();
});

async function requestJson(path, options = {}) {
  const response = await fetch(`${TRUST_MONITOR_BASE_URL}${path}`, options);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Request failed");
  }
  return result;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function chipClassForReview(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("ban")) return "danger";
  if (normalized.includes("review")) return "warning";
  if (normalized.includes("clear")) return "success";
  return "neutral";
}

function chipClassForRisk(value) {
  const score = Number(value || 0);
  if (score >= 70) return "danger";
  if (score >= 45) return "warning";
  return "success";
}

function renderLowTrustUsers(users) {
  if (!users.length) {
    lowTrustBody.innerHTML = `<tr><td colspan="6" class="empty-state">No low trust users right now.</td></tr>`;
    return;
  }

  lowTrustBody.innerHTML = users.map((user) => {
    const displayName = user.full_name || user.name || user.id || "Unknown user";
    const verification = user.verified ? "Verified" : "Unverified";
    const flags = [
      verification,
      user.flagged ? "Flagged" : null,
      user.is_blocked ? "Blocked" : null,
    ].filter(Boolean).join(" • ");

    return `
      <tr>
        <td>
          <strong>${escapeHtml(displayName)}</strong><br />
          <span class="inline-note">${escapeHtml(user.id || "-")}</span>
        </td>
        <td><span class="chip ${chipClassForRisk(user.trust_score)}">${escapeHtml(user.trust_score ?? 0)}</span></td>
        <td>
          <span class="chip ${chipClassForRisk(user.ai_risk_score)}">
            ${escapeHtml(user.ai_risk_label || "normal")} • ${escapeHtml(user.ai_risk_score ?? 0)}
          </span>
        </td>
        <td>
          <span class="chip ${chipClassForReview(user.trust_review_status)}">
            ${escapeHtml(user.trust_review_status || "clear")}
          </span>
        </td>
        <td>${escapeHtml(flags || "No major flags")}</td>
        <td>
          <div class="row-actions">
            <button class="btn-review" data-review-user="${escapeHtml(user.id || "")}">Mark review</button>
            <button class="btn-ban" data-ban-user="${escapeHtml(user.id || "")}">Ban user</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  lowTrustBody.querySelectorAll("[data-review-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.getAttribute("data-review-user");
      if (!userId) return;
      button.disabled = true;
      try {
        await requestJson(`/trust/users/${encodeURIComponent(userId)}/review`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "under_review",
          }),
        });
        await loadTrustMonitor();
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  lowTrustBody.querySelectorAll("[data-ban-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.getAttribute("data-ban-user");
      if (!userId) return;
      const confirmed = window.confirm("Ban this user from the app?");
      if (!confirmed) return;
      button.disabled = true;
      try {
        await requestJson(`/trust/users/${encodeURIComponent(userId)}/ban`, {
          method: "POST",
        });
        await loadTrustMonitor();
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function renderAiAlerts(alerts) {
  if (!alerts.length) {
    aiAlertsBody.innerHTML = `<tr><td colspan="4" class="empty-state">No active AI risk alerts right now.</td></tr>`;
    return;
  }

  aiAlertsBody.innerHTML = alerts.map((alert) => `
    <tr>
      <td>
        <strong>${escapeHtml(alert.user_id || "-")}</strong><br />
        <span class="inline-note">${escapeHtml(alert.created_at || "")}</span>
      </td>
      <td><span class="chip ${chipClassForRisk(alert.risk_score)}">${escapeHtml(alert.risk_type || "ai_risk")}</span></td>
      <td>${escapeHtml(alert.risk_score ?? 0)}</td>
      <td>${escapeHtml(alert.summary || "No summary")}</td>
    </tr>
  `).join("");
}

function updateStats(users, alerts) {
  statLowTrust.textContent = String(users.length);
  statAlerts.textContent = String(alerts.length);
  statBanned.textContent = String(users.filter((user) => user.is_blocked).length);
  statReview.textContent = String(
    users.filter((user) => String(user.trust_review_status || "").toLowerCase().includes("review")).length
  );
}

async function loadTrustMonitor() {
  lowTrustBody.innerHTML = `<tr><td colspan="6" class="loading-state">Loading trust signals...</td></tr>`;
  aiAlertsBody.innerHTML = `<tr><td colspan="4" class="loading-state">Loading AI alerts...</td></tr>`;

  try {
    const [lowTrustResult, alertsResult] = await Promise.all([
      requestJson("/trust/low-users"),
      requestJson("/trust/ai-alerts"),
    ]);

    const users = lowTrustResult.users || [];
    const alerts = alertsResult.alerts || [];

    renderLowTrustUsers(users);
    renderAiAlerts(alerts);
    updateStats(users, alerts);
  } catch (error) {
    const message = escapeHtml(error.message || "Unable to load trust monitor.");
    lowTrustBody.innerHTML = `<tr><td colspan="6" class="empty-state">${message}</td></tr>`;
    aiAlertsBody.innerHTML = `<tr><td colspan="4" class="empty-state">${message}</td></tr>`;
  }
}

loadTrustMonitor();
