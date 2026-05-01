const SUPABASE_URL = "https://elvplhwavgluglnnhyxe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdnBsaHdhdmdsdWdsbm5oeXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTg1MzAsImV4cCI6MjA4OTQ5NDUzMH0.GaQ2hydoq_qMfmt5v8gK-KxkZO0zZf_HeiHbl3q4_GM";
const BACKEND_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:4000"
    : "https://YOUR-BACKEND.onrender.com";
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  appId: "YOUR_FIREBASE_APP_ID",
};

const CONFIG = {
  dashboardPage: "dashboard.html",
  loginPage: "index.html",
  usersPage: "users.html",
  auditLogsPage: "audit-logs.html",
  usersTable: "profiles",
  reportsTable: "reports",
  supportTable: "support_tickets",
  deleteRequestsTable: "account_deletion_requests",
  matchesTable: "matches",
  revenueTable: "payments",
  revenueAmountColumn: "amount",
  revenueStatusColumn: "status",
  revenuePaidValue: "paid",
  auditLogsTable: "audit_logs",
  userBlockedColumn: "is_blocked",
  userEmailColumns: ["email", "user_email", "contact_email"],
  userPhoneColumns: ["phone", "phone_number", "mobile", "mobile_number", "contact_phone"],
  adminRoleColumns: ["is_admin", "role", "user_role"],
  adminRoleValues: ["admin", "super_admin", "owner", "moderator", "support"],
  reportResolvedColumn: "is_resolved",
  reportStatusColumn: "status",
  reportUserIdColumns: ["reported_user_id", "user_id", "reportedUserId"],
};

const clientReady =
  window.supabase &&
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_PROJECT_ID") &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY");

const supabaseClient = clientReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const firebaseReady =
  window.firebase &&
  FIREBASE_CONFIG.apiKey !== "YOUR_FIREBASE_API_KEY" &&
  FIREBASE_CONFIG.authDomain !== "YOUR_FIREBASE_AUTH_DOMAIN";

let firebaseAuth = null;
let firebaseAuthReadyPromise = null;
if (firebaseReady) {
  if (!window.firebase.apps.length) {
    window.firebase.initializeApp(FIREBASE_CONFIG);
  }
  firebaseAuth = window.firebase.auth();
  firebaseAuthReadyPromise = new Promise((resolve) => {
    const unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

let reportsChannel = null;
let supportChannel = null;
let deleteRequestsChannel = null;
let dashboardReportsChannel = null;
let dashboardUsersChannel = null;
let dashboardMatchesChannel = null;
let dashboardRevenueChannel = null;
let usersChannel = null;
let auditLogsChannel = null;
let reportsCache = [];
let supportTicketsCache = [];
let deleteRequestsCache = [];
let usersCache = [];
let auditLogsCache = [];
let currentAdminProfile = null;
let auditLogsFallbackActive = false;
const ACTIVITY_LOG_KEY = "trueconnect_admin_activity_log";
const PAGE_SIZE = 8;
const paginationState = {
  users: 1,
  reports: 1,
  support: 1,
  deleteRequests: 1,
  auditLogs: 1,
};
const selectedUsers = new Set();
const selectedReports = new Set();
const selectedSupportTickets = new Set();
const selectedDeleteRequests = new Set();
const AUTH_NOTICE_KEY = "trueconnect_admin_auth_notice";

const usersFilters = {
  search: "",
  status: "all",
};

const reportsFilters = {
  search: "",
  status: "all",
};

const supportFilters = {
  search: "",
  status: "all",
};

const deleteFilters = {
  search: "",
  status: "all",
};

const auditFilters = {
  search: "",
  role: "all",
};

function buildBackendUrl(path) {
  return `${BACKEND_URL}${path}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  bindLoginForm();
  bindLogoutButton();
  bindUsersRefresh();
  bindReportsRefresh();
  bindSupportRefresh();
  bindDeleteRequestsRefresh();
  bindAuditLogsRefresh();
  bindUsersFilters();
  bindReportsFilters();
  bindSupportFilters();
  bindDeleteFilters();
  bindAuditFilters();
  bindBulkActions();
  bindExports();
  bindActivityLogControls();
  bindUserModal();
  showStoredAuthNotice();

  if (isProtectedPage()) {
    const isAuthenticated = await requireAuth();
    if (!isAuthenticated) return;
  }

  if (document.querySelector("#total-users")) {
    loadDashboard();
    startDashboardRealtime();
    renderActivityLog();
  }

  if (document.querySelector("#users-table-body")) {
    loadUsers();
    startUsersRealtime();
  }

  if (document.querySelector("#reports-table-body")) {
    loadReports();
    startReportsRealtime();
  }

  if (document.querySelector("#support-list")) {
    loadSupportTickets();
    startSupportRealtime();
  }

  if (document.querySelector("#delete-requests-list")) {
    loadDeleteRequests();
    startDeleteRequestsRealtime();
  }

  if (document.querySelector("#audit-log-feed")) {
    loadAuditLogs();
    startAuditLogsRealtime();
  }
});

function bindLoginForm() {
  const form = document.querySelector("#login-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("#auth-message");
    const submitButton = form.querySelector("button[type='submit']");
    setMessage(message, "Signing in...", "neutral");
    setLoading(submitButton, true);

    if (!supabaseClient && !firebaseAuth) {
      setLoading(submitButton, false);
      setMessage(message, "Add your auth configuration in app.js first.", "error");
      return;
    }

    const email = form.email.value.trim();
    const password = form.password.value;
    const { error } = await signInAdmin(email, password);

    setLoading(submitButton, false);

    if (error) {
      setMessage(message, error.message, "error");
      return;
    }

    window.location.href = CONFIG.dashboardPage;
  });
}

function showStoredAuthNotice() {
  const message = document.querySelector("#auth-message");
  if (!message) return;

  const notice = sessionStorage.getItem(AUTH_NOTICE_KEY);
  if (!notice) return;

  setMessage(message, notice, "error");
  sessionStorage.removeItem(AUTH_NOTICE_KEY);
}

function bindLogoutButton() {
  const button = document.querySelector("#logout-button");
  if (!button) return;

  button.addEventListener("click", async () => {
    setLoading(button, true);
    await signOutAdmin();
    window.location.href = CONFIG.loginPage;
  });
}

function bindUsersRefresh() {
  const button = document.querySelector("#refresh-users");
  if (!button) return;

  button.addEventListener("click", () => loadUsers());
}

function bindReportsRefresh() {
  const button = document.querySelector("#refresh-reports");
  if (!button) return;

  button.addEventListener("click", () => loadReports());
}

function bindSupportRefresh() {
  const button = document.querySelector("#refresh-support");
  if (!button) return;

  button.addEventListener("click", () => loadSupportTickets());
}

function bindDeleteRequestsRefresh() {
  const button = document.querySelector("#refresh-delete-requests");
  if (!button) return;

  button.addEventListener("click", () => loadDeleteRequests());
}

function bindAuditLogsRefresh() {
  const button = document.querySelector("#refresh-audit-logs");
  if (!button) return;

  button.addEventListener("click", () => loadAuditLogs());
}

function bindUsersFilters() {
  const searchInput = document.querySelector("#users-search");
  const statusInput = document.querySelector("#users-filter-status");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      usersFilters.search = searchInput.value.trim().toLowerCase();
      paginationState.users = 1;
      applyUsersFilters();
    });
  }

  if (statusInput) {
    statusInput.addEventListener("change", () => {
      usersFilters.status = statusInput.value;
      paginationState.users = 1;
      applyUsersFilters();
    });
  }
}

function bindReportsFilters() {
  const searchInput = document.querySelector("#reports-search");
  const statusInput = document.querySelector("#reports-filter-status");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      reportsFilters.search = searchInput.value.trim().toLowerCase();
      paginationState.reports = 1;
      applyReportsFilters();
    });
  }

  if (statusInput) {
    statusInput.addEventListener("change", () => {
      reportsFilters.status = statusInput.value;
      paginationState.reports = 1;
      applyReportsFilters();
    });
  }
}

function bindSupportFilters() {
  const searchInput = document.querySelector("#support-search");
  const statusInput = document.querySelector("#support-filter-status");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      supportFilters.search = searchInput.value.trim().toLowerCase();
      paginationState.support = 1;
      applySupportFilters();
    });
  }

  if (statusInput) {
    statusInput.addEventListener("change", () => {
      supportFilters.status = statusInput.value;
      paginationState.support = 1;
      applySupportFilters();
    });
  }
}

function bindDeleteFilters() {
  const searchInput = document.querySelector("#delete-search");
  const statusInput = document.querySelector("#delete-filter-status");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      deleteFilters.search = searchInput.value.trim().toLowerCase();
      paginationState.deleteRequests = 1;
      applyDeleteFilters();
    });
  }

  if (statusInput) {
    statusInput.addEventListener("change", () => {
      deleteFilters.status = statusInput.value;
      paginationState.deleteRequests = 1;
      applyDeleteFilters();
    });
  }
}

function bindAuditFilters() {
  const searchInput = document.querySelector("#audit-search");
  const roleInput = document.querySelector("#audit-filter-role");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      auditFilters.search = searchInput.value.trim().toLowerCase();
      paginationState.auditLogs = 1;
      applyAuditFilters();
    });
  }

  if (roleInput) {
    roleInput.addEventListener("change", () => {
      auditFilters.role = roleInput.value;
      paginationState.auditLogs = 1;
      applyAuditFilters();
    });
  }
}

async function signInAdmin(email, password) {
  try {
    if (firebaseAuth) {
      await firebaseAuth.signInWithEmailAndPassword(email, password);
      return { error: null };
    }

    if (supabaseClient) {
      return await supabaseClient.auth.signInWithPassword({ email, password });
    }

    return { error: new Error("No auth provider configured.") };
  } catch (error) {
    return { error };
  }
}

async function signOutAdmin() {
  if (firebaseAuth) {
    await firebaseAuth.signOut();
    return;
  }

  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
}

async function getAuthenticatedUser() {
  if (firebaseAuth) {
    if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
    return firebaseAuthReadyPromise;
  }

  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    return data.session?.user || null;
  }

  return null;
}

function bindBulkActions() {
  const selectAllReports = document.querySelector("#select-all-reports");
  const bulkResolveReports = document.querySelector("#bulk-resolve-reports");
  const selectAllSupport = document.querySelector("#select-all-support");
  const bulkResolveSupport = document.querySelector("#bulk-resolve-support");
  const selectAllDelete = document.querySelector("#select-all-delete-requests");
  const bulkApproveDelete = document.querySelector("#bulk-approve-delete-requests");
  const bulkRejectDelete = document.querySelector("#bulk-reject-delete-requests");

  if (selectAllReports) {
    selectAllReports.addEventListener("click", () => toggleSelectPage("reports"));
  }
  if (bulkResolveReports) {
    bulkResolveReports.addEventListener("click", () => bulkResolveReportsAction(bulkResolveReports));
  }
  if (selectAllSupport) {
    selectAllSupport.addEventListener("click", () => toggleSelectPage("support"));
  }
  if (bulkResolveSupport) {
    bulkResolveSupport.addEventListener("click", () => bulkResolveSupportAction(bulkResolveSupport));
  }
  if (selectAllDelete) {
    selectAllDelete.addEventListener("click", () => toggleSelectPage("deleteRequests"));
  }
  if (bulkApproveDelete) {
    bulkApproveDelete.addEventListener("click", () => bulkUpdateDeleteRequests("approved", bulkApproveDelete));
  }
  if (bulkRejectDelete) {
    bulkRejectDelete.addEventListener("click", () => bulkUpdateDeleteRequests("rejected", bulkRejectDelete));
  }
}

function bindExports() {
  const usersButton = document.querySelector("#export-users");
  const reportsButton = document.querySelector("#export-reports");
  const supportButton = document.querySelector("#export-support");
  const deleteButton = document.querySelector("#export-delete-requests");
  const auditButton = document.querySelector("#export-audit-logs");

  if (usersButton) {
    usersButton.addEventListener("click", () => {
      const data = getFilteredUsers();
      exportCsv("users-export.csv", data.map((user) => ({
        id: user.id || "",
        full_name: user.full_name || user.name || user.username || "",
        email: user.email || "",
        phone: user.phone || "",
        blocked: Boolean(user[CONFIG.userBlockedColumn]),
        created_at: user.created_at || "",
      })));
    });
  }

  if (reportsButton) {
    reportsButton.addEventListener("click", () => {
      const data = getFilteredReports();
      exportCsv("reports-export.csv", data.map((report) => ({
        id: report.id || report.report_id || "",
        reported_user: getReportedUserId(report),
        reason: report.reason || report.type || report.category || "",
        description: report.description || report.details || report.message || "",
        reporter: report.reporter_id || report.created_by || report.reported_by || "",
        status: isReportResolved(report) ? "resolved" : "open",
        created_at: report.created_at || "",
      })));
    });
  }

  if (supportButton) {
    supportButton.addEventListener("click", () => {
      const data = getFilteredSupportTickets();
      exportCsv("support-tickets-export.csv", data.map((ticket) => ({
        id: ticket.id || "",
        user_id: ticket.user_id || "",
        issue_type: ticket.issue_type || "",
        subject: ticket.subject || "",
        message: ticket.message || "",
        admin_reply: ticket.admin_reply || "",
        status: ticket.status || "",
        created_at: ticket.created_at || "",
      })));
    });
  }

  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      const data = getFilteredDeleteRequests();
      exportCsv("delete-requests-export.csv", data.map((request) => ({
        id: request.id || "",
        user_id: request.user_id || "",
        reason: request.reason || "",
        status: request.status || "",
        created_at: request.created_at || "",
      })));
    });
  }

  if (auditButton) {
    auditButton.addEventListener("click", () => {
      const data = getFilteredAuditLogs();
      exportCsv("audit-logs-export.csv", data.map((entry) => ({
        action: entry.action || "",
        details: entry.details || "",
        role: entry.role || entry.admin_role || "",
        actor: entry.admin_label || entry.admin_email || entry.admin_id || "",
        target_type: entry.target_type || "",
        target_id: entry.target_id || "",
        created_at: entry.created_at || "",
      })));
    });
  }
}

function bindActivityLogControls() {
  const clearButton = document.querySelector("#clear-activity-log");
  if (!clearButton) return;

  clearButton.addEventListener("click", () => {
    localStorage.removeItem(ACTIVITY_LOG_KEY);
    renderActivityLog();
    showToast("Activity log cleared", "success");
  });
}

function bindUserModal() {
  const closeButton = document.querySelector("#close-user-modal");
  const backdrop = document.querySelector("#user-modal");

  if (closeButton) {
    closeButton.addEventListener("click", closeUserModal);
  }

  if (backdrop) {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeUserModal();
    });
  }
}

async function requireAuth() {
  if (!supabaseClient) {
    showPageConfigError();
    return false;
  }

  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) {
    window.location.href = CONFIG.loginPage;
    return false;
  }

  const userId = authenticatedUser.uid || authenticatedUser.id;
  if (!userId) {
    window.location.href = CONFIG.loginPage;
    return false;
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from(CONFIG.usersTable)
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profile || !hasPageAccess(profile, getCurrentPage())) {
    const authErrorMessage = profileError
      ? `Admin profile check failed: ${profileError.message}`
      : "Access denied for this role. Update the user role in profiles.";
    sessionStorage.setItem(AUTH_NOTICE_KEY, authErrorMessage);
    await signOutAdmin();
    window.location.href = CONFIG.loginPage;
    return false;
  }

  currentAdminProfile = profile;
  return true;
}

function isAdminProfile(profile) {
  if (!profile) return false;
  if (profile.is_admin === true) return true;

  return CONFIG.adminRoleColumns.some((column) => {
    const value = profile[column];
    return typeof value === "string" && CONFIG.adminRoleValues.includes(value.toLowerCase());
  });
}

function getAdminRole(profile) {
  if (!profile) return "";
  if (profile.is_admin === true) return "admin";

  for (const column of CONFIG.adminRoleColumns) {
    const value = profile[column];
    if (typeof value === "string" && value.trim()) {
      return value.toLowerCase();
    }
  }

  return "";
}

function hasPageAccess(profile, page) {
  const role = getAdminRole(profile);
  if (!role) return false;

  const permissions = {
    admin: ["dashboard.html", "users.html", "reports.html", "support.html", "delete-requests.html", "audit-logs.html"],
    super_admin: ["dashboard.html", "users.html", "reports.html", "support.html", "delete-requests.html", "audit-logs.html"],
    owner: ["dashboard.html", "users.html", "reports.html", "support.html", "delete-requests.html", "audit-logs.html"],
    moderator: ["dashboard.html", "users.html", "reports.html", "audit-logs.html"],
    support: ["dashboard.html", "support.html", "delete-requests.html", "audit-logs.html"],
  };

  return (permissions[role] || []).includes(page);
}

function isProtectedPage() {
  const page = getCurrentPage();
  return (
    page === "dashboard.html" ||
    page === "users.html" ||
    page === "reports.html" ||
    page === "support.html" ||
    page === "delete-requests.html" ||
    page === "audit-logs.html"
  );
}

async function loadDashboard() {
  const status = document.querySelector("#dashboard-status");
  setStatus(status, "Loading", "neutral");

  const [usersResult, reportsResult, openReportsResult, blockedUsersResult, openSupportResult, pendingDeleteResult, matchesResult, revenueResult] = await Promise.all([
    getTableCount(CONFIG.usersTable),
    getTableCount(CONFIG.reportsTable),
    getTableCountWhereNot(CONFIG.reportsTable, CONFIG.reportStatusColumn, "resolved"),
    getTableCountWhereEq(CONFIG.usersTable, CONFIG.userBlockedColumn, true),
    getTableCountWhereEq(CONFIG.supportTable, "status", "open"),
    getTableCountWhereEq(CONFIG.deleteRequestsTable, "status", "pending"),
    getOptionalTableCount(CONFIG.matchesTable),
    getOptionalRevenueTotal(),
  ]);

  if (usersResult.error || reportsResult.error || openReportsResult.error || blockedUsersResult.error || openSupportResult.error || pendingDeleteResult.error) {
    document.querySelector("#total-users").textContent = "--";
    document.querySelector("#total-reports").textContent = "--";
    setText("#open-reports", "--");
    setText("#blocked-users", "--");
    setText("#open-support", "--");
    setText("#pending-delete-requests", "--");
    setText("#total-matches", "--");
    setText("#total-revenue", "--");
    setStatus(status, "Check config", "error");
    return;
  }

  document.querySelector("#total-users").textContent = formatNumber(usersResult.count);
  document.querySelector("#total-reports").textContent = formatNumber(reportsResult.count);
  setText("#open-reports", formatNumber(openReportsResult.count));
  setText("#blocked-users", formatNumber(blockedUsersResult.count));
  setText("#open-support", formatNumber(openSupportResult.count));
  setText("#pending-delete-requests", formatNumber(pendingDeleteResult.count));
  setText("#total-matches", matchesResult.error ? "--" : formatNumber(matchesResult.count));
  setText("#total-revenue", revenueResult.error ? "--" : formatCurrency(revenueResult.total));
  setStatus(status, "Live", "success");
}

async function getTableCount(tableName) {
  const { count, error } = await supabaseClient
    .from(tableName)
    .select("*", { count: "exact", head: true });

  return { count: count || 0, error };
}

async function getOptionalTableCount(tableName) {
  if (!tableName) return { count: 0, error: new Error("Missing table name") };
  try {
    return await getTableCount(tableName);
  } catch (error) {
    return { count: 0, error };
  }
}

async function getTableCountWhereEq(tableName, column, value) {
  const { count, error } = await supabaseClient
    .from(tableName)
    .select("*", { count: "exact", head: true })
    .eq(column, value);

  return { count: count || 0, error };
}

async function getTableCountWhereNot(tableName, column, value) {
  const { count, error } = await supabaseClient
    .from(tableName)
    .select("*", { count: "exact", head: true })
    .neq(column, value);

  return { count: count || 0, error };
}

async function getOptionalRevenueTotal() {
  if (!CONFIG.revenueTable || !CONFIG.revenueAmountColumn) {
    return { total: 0, error: new Error("Revenue config missing") };
  }

  try {
    let query = supabaseClient
      .from(CONFIG.revenueTable)
      .select(CONFIG.revenueAmountColumn);

    if (CONFIG.revenueStatusColumn && CONFIG.revenuePaidValue) {
      query = query.eq(CONFIG.revenueStatusColumn, CONFIG.revenuePaidValue);
    }

    const { data, error } = await query;
    if (error) return { total: 0, error };

    const total = (data || []).reduce((sum, row) => sum + Number(row[CONFIG.revenueAmountColumn] || 0), 0);
    return { total, error: null };
  } catch (error) {
    return { total: 0, error };
  }
}

function startDashboardRealtime() {
  stopDashboardRealtime();
  if (!supabaseClient) return;

  dashboardReportsChannel = supabaseClient
    .channel("dashboard-reports-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: CONFIG.reportsTable },
      async () => {
        await loadDashboard();
        pulseLiveStatus(document.querySelector("#dashboard-status"));
      }
    )
    .subscribe();

  dashboardUsersChannel = supabaseClient
    .channel("dashboard-users-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: CONFIG.usersTable },
      async () => {
        await loadDashboard();
        pulseLiveStatus(document.querySelector("#dashboard-status"));
      }
    )
    .subscribe();

  if (CONFIG.matchesTable) {
    dashboardMatchesChannel = supabaseClient
      .channel("dashboard-matches-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CONFIG.matchesTable },
        async () => {
          await loadDashboard();
          pulseLiveStatus(document.querySelector("#dashboard-status"));
        }
      )
      .subscribe();
  }

  if (CONFIG.revenueTable) {
    dashboardRevenueChannel = supabaseClient
      .channel("dashboard-revenue-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CONFIG.revenueTable },
        async () => {
          await loadDashboard();
          pulseLiveStatus(document.querySelector("#dashboard-status"));
        }
      )
      .subscribe();
  }
}

function stopDashboardRealtime() {
  if (dashboardReportsChannel) {
    supabaseClient.removeChannel(dashboardReportsChannel);
    dashboardReportsChannel = null;
  }

  if (dashboardUsersChannel) {
    supabaseClient.removeChannel(dashboardUsersChannel);
    dashboardUsersChannel = null;
  }

  if (dashboardMatchesChannel) {
    supabaseClient.removeChannel(dashboardMatchesChannel);
    dashboardMatchesChannel = null;
  }

  if (dashboardRevenueChannel) {
    supabaseClient.removeChannel(dashboardRevenueChannel);
    dashboardRevenueChannel = null;
  }
}

async function loadUsers() {
  const tableBody = document.querySelector("#users-table-body");
  const status = document.querySelector("#users-status");
  const summary = document.querySelector("#users-summary");
  const refreshButton = document.querySelector("#refresh-users");

  if (!tableBody) return;

  setLoading(refreshButton, true);
  setStatus(status, "Loading", "neutral");
  tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Loading users...</td></tr>`;

  const { data, error } = await supabaseClient
    .from(CONFIG.usersTable)
    .select("*")
    .order("created_at", { ascending: false });

  setLoading(refreshButton, false);

  if (error) {
    usersCache = [];
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
    summary.textContent = "Unable to load users.";
    setStatus(status, "Error", "error");
    return;
  }

  if (!data || !data.length) {
    usersCache = [];
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No users found.</td></tr>`;
    summary.textContent = "There are no users in the database.";
    setStatus(status, "Empty", "success");
    return;
  }

  usersCache = data;
  applyUsersFilters();
  setStatus(status, "Live", "success");
}

function startUsersRealtime() {
  stopUsersRealtime();
  if (!supabaseClient) return;

  usersChannel = supabaseClient
    .channel("users-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: CONFIG.usersTable },
      async () => {
        await loadUsers();
        pulseLiveStatus(document.querySelector("#users-status"));
      }
    )
    .subscribe();
}

function stopUsersRealtime() {
  if (usersChannel) {
    supabaseClient.removeChannel(usersChannel);
    usersChannel = null;
  }
}

async function loadReports() {
  const tableBody = document.querySelector("#reports-table-body");
  const status = document.querySelector("#reports-status");
  const summary = document.querySelector("#reports-summary");
  const refreshButton = document.querySelector("#refresh-reports");

  setLoading(refreshButton, true);
  setStatus(status, "Loading", "neutral");
  tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Loading reports...</td></tr>`;

  const { data, error } = await supabaseClient
    .from(CONFIG.reportsTable)
    .select("*")
    .order("created_at", { ascending: false });

  setLoading(refreshButton, false);

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
    summary.textContent = "Unable to load reports. Check table names, columns, and Row Level Security policies.";
    setStatus(status, "Error", "error");
    return;
  }

  if (!data.length) {
    reportsCache = [];
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No reports found.</td></tr>`;
    summary.textContent = "There are no reports in the queue.";
    setStatus(status, "Empty", "success");
    return;
  }

  reportsCache = data;
  applyReportsFilters();
  setStatus(status, "Live", "success");
}

function startReportsRealtime() {
  stopReportsRealtime();
  if (!supabaseClient) return;

  reportsChannel = supabaseClient
    .channel("reports-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: CONFIG.reportsTable },
      async () => {
        await loadReports();
        pulseLiveStatus(document.querySelector("#reports-status"));
      }
    )
    .subscribe();
}

function stopReportsRealtime() {
  if (reportsChannel) {
    supabaseClient.removeChannel(reportsChannel);
    reportsChannel = null;
  }
}

function renderUserRow(user) {
  const userId = user.id || "";
  const fullName = user.full_name || user.name || user.username || "Unknown";
  const email = getFirstAvailableValue(user, CONFIG.userEmailColumns);
  const phone = getFirstAvailableValue(user, CONFIG.userPhoneColumns);
  const blocked = Boolean(user[CONFIG.userBlockedColumn]);
  const createdAt = user.created_at ? new Date(user.created_at).toLocaleString() : "Unknown";

  return `
    <tr>
      <td>
        <div class="primary-cell">${escapeHtml(String(fullName))}</div>
        <div class="muted-cell">${escapeHtml(String(userId))}</div>
      </td>
      <td>
        <div class="primary-cell ${email ? "" : "data-missing"}">${escapeHtml(String(email || "Email not provided"))}</div>
        <div class="muted-cell ${phone ? "" : "data-missing"}">${escapeHtml(String(phone || "Phone not provided"))}</div>
      </td>
      <td><span class="badge ${blocked ? "open" : "resolved"}">${blocked ? "Blocked" : "Active"}</span></td>
      <td>${escapeHtml(createdAt)}</td>
      <td>
        <div class="actions">
          <button class="btn btn-secondary" data-action="user-view" data-user-id="${escapeHtml(String(userId))}" ${userId ? "" : "disabled"}>View</button>
          <button class="btn btn-danger" data-action="user-ban" data-user-id="${escapeHtml(String(userId))}" ${blocked || !userId ? "disabled" : ""}>Ban</button>
          <button class="btn btn-danger" data-action="user-delete" data-user-id="${escapeHtml(String(userId))}" ${!userId ? "disabled" : ""}>Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function applyUsersFilters() {
  const tableBody = document.querySelector("#users-table-body");
  const summary = document.querySelector("#users-summary");
  if (!tableBody || !summary) return;

  const filteredUsers = getFilteredUsers();
  const pagedUsers = getPaginatedItems(filteredUsers, "users");

  if (!filteredUsers.length) {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No users match the current filters.</td></tr>`;
  } else {
    tableBody.innerHTML = pagedUsers.map(renderUserRow).join("");
    tableBody.querySelectorAll("[data-action='user-view']").forEach((button) => {
      button.addEventListener("click", () => openUserModal(button.dataset.userId));
    });
    tableBody.querySelectorAll("[data-action='user-ban']").forEach((button) => {
      button.addEventListener("click", () => banUser(button.dataset.userId, button));
    });
    tableBody.querySelectorAll("[data-action='user-delete']").forEach((button) => {
      button.addEventListener("click", () => deleteUser(button.dataset.userId, button));
    });
  }

  summary.textContent = `${filteredUsers.length} of ${usersCache.length} user${usersCache.length === 1 ? "" : "s"} shown.`;
  renderPagination("users-pagination", filteredUsers.length, "users");
}

function getFilteredUsers() {
  return usersCache.filter((user) => {
    const blocked = Boolean(user[CONFIG.userBlockedColumn]);
    const statusMatch =
      usersFilters.status === "all" ||
      (usersFilters.status === "blocked" && blocked) ||
      (usersFilters.status === "active" && !blocked);

    const haystack = [
      user.id,
      user.full_name,
      user.name,
      user.username,
      user.email,
      user.phone,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const searchMatch = !usersFilters.search || haystack.includes(usersFilters.search);
    return statusMatch && searchMatch;
  });
}

function renderReportRow(report) {
  const reportId = report.id || report.report_id || "";
  const reportedUserId = getReportedUserId(report);
  const reason = report.reason || report.type || report.category || "No reason provided";
  const description = report.description || report.details || report.message || "";
  const createdAt = report.created_at ? new Date(report.created_at).toLocaleString() : "Unknown";
  const resolved = isReportResolved(report);
  const statusText = resolved ? "Resolved" : "Open";
  const reporter = report.reporter_id || report.created_by || report.reported_by || "Unknown";

  return `
    <tr>
      <td class="select-cell">
        <input class="row-check" type="checkbox" data-select-report="${escapeHtml(String(reportId || ""))}" ${selectedReports.has(String(reportId)) ? "checked" : ""}>
      </td>
      <td>
        <div class="primary-cell">#${escapeHtml(String(reportId || "Unknown"))}</div>
        <div class="muted-cell">Reporter: ${escapeHtml(String(reporter))}</div>
      </td>
      <td>${escapeHtml(String(reportedUserId || "Unknown"))}</td>
      <td>
        <div class="primary-cell">${escapeHtml(String(reason))}</div>
        <div class="muted-cell">${escapeHtml(String(description))}</div>
      </td>
      <td><span class="badge ${resolved ? "resolved" : "open"}">${statusText}</span></td>
      <td>${escapeHtml(createdAt)}</td>
      <td>
        <div class="actions">
          <button class="btn btn-danger" data-action="ban" data-user-id="${escapeHtml(String(reportedUserId || ""))}" ${reportedUserId ? "" : "disabled"}>Ban user</button>
          <button class="btn btn-success" data-action="resolve" data-report-id="${escapeHtml(String(reportId || ""))}" ${resolved || !reportId ? "disabled" : ""}>Resolve</button>
          <button class="btn btn-secondary" data-action="view-user" data-user-id="${escapeHtml(String(reportedUserId || ""))}" ${reportedUserId ? "" : "disabled"}>View user</button>
        </div>
      </td>
    </tr>
  `;
}

function applyReportsFilters() {
  const tableBody = document.querySelector("#reports-table-body");
  const summary = document.querySelector("#reports-summary");
  if (!tableBody || !summary) return;

  const filteredReports = getFilteredReports();
  const pagedReports = getPaginatedItems(filteredReports, "reports");

  if (!filteredReports.length) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No reports match the current filters.</td></tr>`;
  } else {
    tableBody.innerHTML = pagedReports.map(renderReportRow).join("");
    tableBody.querySelectorAll("[data-action='ban']").forEach((button) => {
      button.addEventListener("click", () => banUser(button.dataset.userId, button));
    });

    tableBody.querySelectorAll("[data-action='resolve']").forEach((button) => {
      button.addEventListener("click", () => resolveReport(button.dataset.reportId, button));
    });

    tableBody.querySelectorAll("[data-action='view-user']").forEach((button) => {
      button.addEventListener("click", () => openUserModal(button.dataset.userId));
    });

    tableBody.querySelectorAll("[data-select-report]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => toggleSelection(selectedReports, checkbox.dataset.selectReport, checkbox.checked));
    });
  }

  summary.textContent = `${filteredReports.length} of ${reportsCache.length} report${reportsCache.length === 1 ? "" : "s"} shown.`;
  renderPagination("reports-pagination", filteredReports.length, "reports");
}

function getFilteredReports() {
  return reportsCache.filter((report) => {
    const resolved = isReportResolved(report);
    const statusMatch =
      reportsFilters.status === "all" ||
      (reportsFilters.status === "resolved" && resolved) ||
      (reportsFilters.status === "open" && !resolved);

    const haystack = [
      report.id,
      report.report_id,
      getReportedUserId(report),
      report.reason,
      report.type,
      report.category,
      report.description,
      report.details,
      report.message,
      report.reporter_id,
      report.created_by,
      report.reported_by,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const searchMatch = !reportsFilters.search || haystack.includes(reportsFilters.search);
    return statusMatch && searchMatch;
  });
}

async function banUser(userId, button) {
  if (!userId) return;

  setLoading(button, true);
  const { error } = await supabaseClient
    .from(CONFIG.usersTable)
    .update({ [CONFIG.userBlockedColumn]: true })
    .eq("id", userId);

  setLoading(button, false);

  if (error) {
    showToast(`Unable to ban user: ${error.message}`, "error");
    return;
  }

  button.textContent = "Banned";
  button.disabled = true;
  logAdminActivity("Blocked user", `User ${userId} was blocked from the reports queue.`);
  showToast("User blocked successfully", "success");
}

async function resolveReport(reportId, button) {
  if (!reportId) return;

  setLoading(button, true);
  const { error } = await supabaseClient
    .from(CONFIG.reportsTable)
    .update({ [CONFIG.reportStatusColumn]: "resolved" })
    .eq("id", reportId);

  setLoading(button, false);

  if (error) {
    showToast(`Unable to resolve report: ${error.message}`, "error");
    return;
  }

  logAdminActivity("Resolved report", `Report ${reportId} was marked as resolved.`);
  showToast("Report resolved", "success");
  await loadReports();
}

async function deleteUser(userId, button) {
  if (!userId) return;

  const confirmed = window.confirm(`Delete user ${userId}? This removes the profile row from ${CONFIG.usersTable}.`);
  if (!confirmed) return;

  setLoading(button, true);
  const { error } = await supabaseClient
    .from(CONFIG.usersTable)
    .delete()
    .eq("id", userId);
  setLoading(button, false);

  if (error) {
    showToast(`Unable to delete user: ${error.message}`, "error");
    return;
  }

  await logAdminActivity("Deleted user profile", `User ${userId} was removed from ${CONFIG.usersTable}.`, {
    targetType: "user",
    targetId: userId,
  });
  showToast("User deleted", "success");
  await loadUsers();
}

function getReportedUserId(report) {
  for (const column of CONFIG.reportUserIdColumns) {
    if (report[column]) return report[column];
  }
  return "";
}

function isReportResolved(report) {
  return Boolean(report[CONFIG.reportResolvedColumn]) || report[CONFIG.reportStatusColumn] === "resolved";
}

async function loadSupportTickets() {
  const container = document.querySelector("#support-list");
  const status = document.querySelector("#support-status");
  const summary = document.querySelector("#support-summary");
  const refreshButton = document.querySelector("#refresh-support");

  if (!container) return;

  setLoading(refreshButton, true);
  setStatus(status, "Loading", "neutral");
  container.innerHTML = `<div class="empty-state" style="padding:24px;">Loading tickets...</div>`;

  const { data, error } = await supabaseClient
    .from(CONFIG.supportTable)
    .select("*")
    .order("created_at", { ascending: false });

  setLoading(refreshButton, false);

  if (error) {
    container.innerHTML = `<div class="empty-state" style="padding:24px;">${escapeHtml(error.message)}</div>`;
    summary.textContent = "Unable to load support tickets.";
    setStatus(status, "Error", "error");
    return;
  }

  if (!data || !data.length) {
    supportTicketsCache = [];
    container.innerHTML = `<div class="empty-state" style="padding:24px;">No support tickets found.</div>`;
    summary.textContent = "There are no support tickets right now.";
    setStatus(status, "Empty", "success");
    return;
  }

  supportTicketsCache = data;
  applySupportFilters();
  setStatus(status, "Live", "success");
}

function renderSupportCard(ticket) {
  const id = ticket.id || "";
  const userId = ticket.user_id || "Unknown";
  const issueType = ticket.issue_type || "Unknown";
  const subject = ticket.subject || "No subject";
  const message = ticket.message || "";
  const adminReply = ticket.admin_reply || "";
  const statusText = ticket.status || "open";
  const createdAt = ticket.created_at ? new Date(ticket.created_at).toLocaleString() : "Unknown";
  const resolved = statusText === "resolved";

  return `
    <div class="support-ticket-card">
      <label class="card-select">
        <input class="row-check" type="checkbox" data-select-support="${escapeHtml(String(id))}" ${selectedSupportTickets.has(String(id)) ? "checked" : ""}>
        <span>Select ticket</span>
      </label>
      <div class="support-ticket-top">
        <div>
          <div class="support-ticket-title">${escapeHtml(String(subject))}</div>
          <div class="support-ticket-meta">
            <div><strong>User:</strong> ${escapeHtml(String(userId))}</div>
            <div><strong>Issue Type:</strong> ${escapeHtml(String(issueType))}</div>
            <div><strong>Created:</strong> ${escapeHtml(createdAt)}</div>
          </div>
        </div>

        <div>
          <span class="badge ${resolved ? "resolved" : "open"}">${escapeHtml(String(statusText))}</span>
        </div>
      </div>

      <div class="support-ticket-message">
        ${escapeHtml(String(message))}
      </div>

      ${
        adminReply
          ? `
          <div class="support-existing-reply">
            <h4>Existing Admin Reply</h4>
            <div>${escapeHtml(String(adminReply))}</div>
          </div>
        `
          : ""
      }

      <div class="support-reply-box">
        <h4>Write Reply</h4>
        <textarea
          data-reply-input="${escapeHtml(String(id))}"
          placeholder="Write a helpful reply for the user...">${escapeHtml(String(adminReply))}</textarea>

        <div class="support-reply-actions">
          <button class="action-btn btn-primary" data-action="support-save-reply" data-ticket-id="${escapeHtml(String(id))}">
            Save Reply
          </button>

          <button class="action-btn" data-action="support-resolve" data-ticket-id="${escapeHtml(String(id))}" ${resolved ? "disabled" : ""}>
            Mark Resolved
          </button>
        </div>
      </div>
    </div>
  `;
}

function applySupportFilters() {
  const container = document.querySelector("#support-list");
  const summary = document.querySelector("#support-summary");
  if (!container || !summary) return;

  const filteredTickets = getFilteredSupportTickets();
  const pagedTickets = getPaginatedItems(filteredTickets, "support");

  if (!filteredTickets.length) {
    container.innerHTML = `<div class="empty-state" style="padding:24px;">No support tickets match the current filters.</div>`;
  } else {
    container.innerHTML = pagedTickets.map(renderSupportCard).join("");

    container.querySelectorAll("[data-action='support-save-reply']").forEach((button) => {
      button.addEventListener("click", () => {
        const ticketId = button.dataset.ticketId;
        const textarea = document.querySelector(`[data-reply-input='${ticketId}']`);
        const reply = textarea?.value?.trim() || "";
        saveSupportReply(ticketId, reply, button);
      });
    });

    container.querySelectorAll("[data-action='support-resolve']").forEach((button) => {
      button.addEventListener("click", () => resolveSupportTicket(button.dataset.ticketId, button));
    });

    container.querySelectorAll("[data-select-support]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => toggleSelection(selectedSupportTickets, checkbox.dataset.selectSupport, checkbox.checked));
    });
  }

  summary.textContent = `${filteredTickets.length} of ${supportTicketsCache.length} support ticket${supportTicketsCache.length === 1 ? "" : "s"} shown.`;
  renderPagination("support-pagination", filteredTickets.length, "support");
}

function getFilteredSupportTickets() {
  return supportTicketsCache.filter((ticket) => {
    const statusText = (ticket.status || "open").toLowerCase();
    const statusMatch =
      supportFilters.status === "all" || statusText === supportFilters.status;

    const haystack = [
      ticket.user_id,
      ticket.issue_type,
      ticket.subject,
      ticket.message,
      ticket.admin_reply,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const searchMatch = !supportFilters.search || haystack.includes(supportFilters.search);
    return statusMatch && searchMatch;
  });
}

async function saveSupportReply(ticketId, reply, button) {
  if (!ticketId) return;

  if (!reply) {
    showToast("Reply likho pehle.", "error");
    return;
  }

  setLoading(button, true);

  const { data: ticketData, error: ticketFetchError } = await supabaseClient
    .from(CONFIG.supportTable)
    .select("*")
    .eq("id", ticketId)
    .single();

  if (ticketFetchError || !ticketData) {
    setLoading(button, false);
    showToast("Ticket fetch nahi hua", "error");
    return;
  }

  const { error } = await supabaseClient
    .from(CONFIG.supportTable)
    .update({
      admin_reply: reply,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) {
    setLoading(button, false);
    showToast(`Unable to save reply: ${error.message}`, "error");
    return;
  }

  const userId = ticketData.user_id;
  const subject = ticketData.subject || "your ticket";

  const { data: profileData, error: profileError } = await supabaseClient
    .from(CONFIG.usersTable)
    .select("fcm_token")
    .eq("id", userId)
    .single();

  if (!profileError && profileData?.fcm_token) {
    try {
      await fetch(buildBackendUrl("/send-support-reply-notification"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fcmToken: profileData.fcm_token,
          subject: subject,
        }),
      });
    } catch (pushError) {
      console.error("Push send failed", pushError);
    }
  }

  setLoading(button, false);
  logAdminActivity("Saved support reply", `Reply saved for support ticket ${ticketId}.`);
  showToast("Reply saved successfully", "success");
  await loadSupportTickets();
}

async function resolveSupportTicket(ticketId, button) {
  if (!ticketId) return;

  setLoading(button, true);

  const { error } = await supabaseClient
    .from(CONFIG.supportTable)
    .update({
      status: "resolved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  setLoading(button, false);

  if (error) {
    showToast(`Unable to resolve ticket: ${error.message}`, "error");
    return;
  }

  logAdminActivity("Resolved support ticket", `Support ticket ${ticketId} was marked resolved.`);
  showToast("Support ticket resolved", "success");
  await loadSupportTickets();
}

function startSupportRealtime() {
  stopSupportRealtime();
  if (!supabaseClient) return;

  supportChannel = supabaseClient
    .channel("support-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: CONFIG.supportTable },
      async () => {
        await loadSupportTickets();
        pulseLiveStatus(document.querySelector("#support-status"));
      }
    )
    .subscribe();
}

function stopSupportRealtime() {
  if (supportChannel) {
    supabaseClient.removeChannel(supportChannel);
    supportChannel = null;
  }
}

async function loadDeleteRequests() {
  const container = document.querySelector("#delete-requests-list");
  const status = document.querySelector("#delete-status");
  const summary = document.querySelector("#delete-summary");
  const refreshButton = document.querySelector("#refresh-delete-requests");

  if (!container) return;

  setLoading(refreshButton, true);
  setStatus(status, "Loading", "neutral");
  container.innerHTML = `<div class="empty-state" style="padding:24px;">Loading requests...</div>`;

  const { data, error } = await supabaseClient
    .from(CONFIG.deleteRequestsTable)
    .select("*")
    .order("created_at", { ascending: false });

  setLoading(refreshButton, false);

  if (error) {
    container.innerHTML = `<div class="empty-state" style="padding:24px;">${escapeHtml(error.message)}</div>`;
    summary.textContent = "Unable to load delete requests.";
    setStatus(status, "Error", "error");
    return;
  }

  if (!data || !data.length) {
    deleteRequestsCache = [];
    container.innerHTML = `<div class="empty-state" style="padding:24px;">No delete requests found.</div>`;
    summary.textContent = "There are no delete account requests right now.";
    setStatus(status, "Empty", "success");
    return;
  }

  deleteRequestsCache = data;
  applyDeleteFilters();
  setStatus(status, "Live", "success");
}

function renderDeleteRequestCard(request) {
  const id = request.id || "";
  const userId = request.user_id || "Unknown";
  const reason = request.reason || "No reason provided";
  const statusText = request.status || "pending";
  const createdAt = request.created_at ? new Date(request.created_at).toLocaleString() : "Unknown";
  const done = statusText === "approved" || statusText === "rejected";

  return `
    <div class="support-ticket-card">
      <label class="card-select">
        <input class="row-check" type="checkbox" data-select-delete-request="${escapeHtml(String(id))}" ${selectedDeleteRequests.has(String(id)) ? "checked" : ""}>
        <span>Select request</span>
      </label>
      <div class="support-ticket-top">
        <div>
          <div class="support-ticket-title">Delete Account Request</div>
          <div class="support-ticket-meta">
            <div><strong>User:</strong> ${escapeHtml(String(userId))}</div>
            <div><strong>Created:</strong> ${escapeHtml(createdAt)}</div>
          </div>
        </div>

        <div>
          <span class="badge ${done ? "resolved" : "open"}">${escapeHtml(String(statusText))}</span>
        </div>
      </div>

      <div class="support-ticket-message">
        ${escapeHtml(String(reason))}
      </div>

      <div class="support-reply-actions">
        <button
          class="action-btn btn-primary"
          data-action="approve-delete"
          data-request-id="${escapeHtml(String(id))}"
          ${done ? "disabled" : ""}>
          Approve
        </button>

        <button
          class="action-btn"
          data-action="reject-delete"
          data-request-id="${escapeHtml(String(id))}"
          ${done ? "disabled" : ""}>
          Reject
        </button>
      </div>
    </div>
  `;
}

function applyDeleteFilters() {
  const container = document.querySelector("#delete-requests-list");
  const summary = document.querySelector("#delete-summary");
  if (!container || !summary) return;

  const filteredRequests = getFilteredDeleteRequests();
  const pagedRequests = getPaginatedItems(filteredRequests, "deleteRequests");

  if (!filteredRequests.length) {
    container.innerHTML = `<div class="empty-state" style="padding:24px;">No delete requests match the current filters.</div>`;
  } else {
    container.innerHTML = pagedRequests.map(renderDeleteRequestCard).join("");

    container.querySelectorAll("[data-action='approve-delete']").forEach((button) => {
      button.addEventListener("click", () => updateDeleteRequestStatus(button.dataset.requestId, "approved", button));
    });

    container.querySelectorAll("[data-action='reject-delete']").forEach((button) => {
      button.addEventListener("click", () => updateDeleteRequestStatus(button.dataset.requestId, "rejected", button));
    });

    container.querySelectorAll("[data-select-delete-request]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => toggleSelection(selectedDeleteRequests, checkbox.dataset.selectDeleteRequest, checkbox.checked));
    });
  }

  summary.textContent = `${filteredRequests.length} of ${deleteRequestsCache.length} delete request${deleteRequestsCache.length === 1 ? "" : "s"} shown.`;
  renderPagination("delete-pagination", filteredRequests.length, "deleteRequests");
}

function getFilteredDeleteRequests() {
  return deleteRequestsCache.filter((request) => {
    const statusText = (request.status || "pending").toLowerCase();
    const statusMatch =
      deleteFilters.status === "all" || statusText === deleteFilters.status;

    const haystack = [request.user_id, request.reason, request.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const searchMatch = !deleteFilters.search || haystack.includes(deleteFilters.search);
    return statusMatch && searchMatch;
  });
}

async function updateDeleteRequestStatus(requestId, nextStatus, button) {
  if (!requestId) return;

  setLoading(button, true);

  const { error } = await supabaseClient
    .from(CONFIG.deleteRequestsTable)
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  setLoading(button, false);

  if (error) {
    showToast(`Unable to update request: ${error.message}`, "error");
    return;
  }

  logAdminActivity("Updated delete request", `Delete request ${requestId} was marked ${nextStatus}.`);
  showToast(`Delete request ${nextStatus}`, "success");
  await loadDeleteRequests();
}

function startDeleteRequestsRealtime() {
  stopDeleteRequestsRealtime();
  if (!supabaseClient) return;

  deleteRequestsChannel = supabaseClient
    .channel("delete-requests-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: CONFIG.deleteRequestsTable },
      async () => {
        await loadDeleteRequests();
        pulseLiveStatus(document.querySelector("#delete-status"));
      }
    )
    .subscribe();
}

function stopDeleteRequestsRealtime() {
  if (deleteRequestsChannel) {
    supabaseClient.removeChannel(deleteRequestsChannel);
    deleteRequestsChannel = null;
  }
}

async function loadAuditLogs() {
  const container = document.querySelector("#audit-log-feed");
  const summary = document.querySelector("#audit-summary");
  const status = document.querySelector("#audit-status");
  const refreshButton = document.querySelector("#refresh-audit-logs");

  if (!container) return;

  setLoading(refreshButton, true);
  setStatus(status, "Loading", "neutral");
  container.innerHTML = `<div class="empty-state">Loading audit logs...</div>`;

  const { data, error } = await supabaseClient
    .from(CONFIG.auditLogsTable)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(250);

  setLoading(refreshButton, false);

  if (error) {
    auditLogsFallbackActive = true;
    auditLogsCache = getActivityLog().map((item) => ({
      action: item.title,
      details: item.detail,
      role: getAdminRole(currentAdminProfile) || "admin",
      created_at: item.createdAt,
      admin_label: currentAdminProfile?.email || "Local session",
    }));
    applyAuditFilters();
    summary.textContent = auditLogsCache.length
      ? "Using local audit history until the Supabase audit_logs table is ready."
      : "No audit actions recorded yet. Create audit_logs in Supabase for persistent logs.";
    setStatus(status, "Local", "success");
    return;
  }

  auditLogsFallbackActive = false;
  auditLogsCache = data || [];
  applyAuditFilters();
  setStatus(status, "Live", "success");
}

function startAuditLogsRealtime() {
  stopAuditLogsRealtime();
  if (!supabaseClient) return;

  auditLogsChannel = supabaseClient
    .channel("audit-logs-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: CONFIG.auditLogsTable },
      async () => {
        await loadAuditLogs();
        pulseLiveStatus(document.querySelector("#audit-status"));
      }
    )
    .subscribe();
}

function stopAuditLogsRealtime() {
  if (auditLogsChannel) {
    supabaseClient.removeChannel(auditLogsChannel);
    auditLogsChannel = null;
  }
}

function applyAuditFilters() {
  const container = document.querySelector("#audit-log-feed");
  const summary = document.querySelector("#audit-summary");
  if (!container || !summary) return;

  const filteredLogs = getFilteredAuditLogs();
  const pagedLogs = getPaginatedItems(filteredLogs, "auditLogs");

  if (!filteredLogs.length) {
    container.innerHTML = `<div class="empty-state">${
      auditLogsFallbackActive
        ? "No local audit entries yet. Perform an admin action or create the Supabase audit_logs table."
        : "No audit logs match the current filters."
    }</div>`;
  } else {
    container.innerHTML = pagedLogs.map(renderAuditLogItem).join("");
  }

  summary.textContent = auditLogsFallbackActive
    ? `${filteredLogs.length} local audit entr${filteredLogs.length === 1 ? "y" : "ies"} shown.`
    : `${filteredLogs.length} of ${auditLogsCache.length} audit log${auditLogsCache.length === 1 ? "" : "s"} shown.`;
  renderPagination("audit-pagination", filteredLogs.length, "auditLogs");
}

function getFilteredAuditLogs() {
  return auditLogsCache.filter((entry) => {
    const role = String(entry.role || entry.admin_role || "").toLowerCase();
    const roleMatch = auditFilters.role === "all" || role === auditFilters.role;

    const haystack = [
      entry.admin_label,
      entry.admin_email,
      entry.action,
      entry.details,
      entry.target_type,
      entry.target_id,
      entry.role,
      entry.admin_role,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const searchMatch = !auditFilters.search || haystack.includes(auditFilters.search);
    return roleMatch && searchMatch;
  });
}

function renderAuditLogItem(entry) {
  const action = entry.action || "Unknown action";
  const details = entry.details || "No details";
  const actor = entry.admin_label || entry.admin_email || entry.admin_id || "Unknown admin";
  const role = entry.role || entry.admin_role || "admin";
  const createdAt = entry.created_at ? new Date(entry.created_at).toLocaleString() : "Unknown";

  return `
    <div class="activity-item">
      <strong>${escapeHtml(String(action))}</strong>
      <span>${escapeHtml(String(details))}</span>
      <span>${escapeHtml(String(actor))} · ${escapeHtml(String(role))} · ${escapeHtml(createdAt)}</span>
    </div>
  `;
}

function showPageConfigError() {
  const status = document.querySelector(".status-pill");
  if (status) setStatus(status, "Config needed", "error");
}

function setLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = "Please wait";
    button.disabled = true;
    return;
  }
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

function setStatus(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.className = `status-pill ${type === "success" ? "success" : ""} ${type === "error" ? "error" : ""}`.trim();
}

function pulseLiveStatus(element) {
  if (!element) return;
  setStatus(element, "Live", "success");
}

function setMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.style.color = type === "neutral" ? "#667085" : "var(--danger)";
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function exportCsv(filename, rows) {
  if (!rows.length) {
    showToast("No rows available for export", "error");
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
        .join(",")
    ),
  ];

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`${filename} downloaded`, "success");
}

function getActivityLog() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY) || "[]");
  } catch (_error) {
    return [];
  }
}

async function logAdminActivity(title, detail, meta = {}) {
  const items = getActivityLog();
  items.unshift({
    title,
    detail,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(items.slice(0, 25)));
  renderActivityLog();

  if (!supabaseClient || !CONFIG.auditLogsTable) return;

  try {
    await supabaseClient.from(CONFIG.auditLogsTable).insert({
      action: title,
      details: detail,
      target_type: meta.targetType || null,
      target_id: meta.targetId || null,
      admin_id: currentAdminProfile?.id || null,
      admin_email: currentAdminProfile?.email || null,
      admin_label:
        currentAdminProfile?.full_name ||
        currentAdminProfile?.name ||
        currentAdminProfile?.username ||
        currentAdminProfile?.email ||
        null,
      admin_role: getAdminRole(currentAdminProfile) || null,
    });
  } catch (_error) {
    // Keep local logging even if remote audit persistence is unavailable.
  }
}

function renderActivityLog() {
  const container = document.querySelector("#activity-log-list");
  if (!container) return;

  const items = getActivityLog();
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">No admin actions yet.</div>`;
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <div class="activity-item">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.detail)}</span>
          <span>${escapeHtml(new Date(item.createdAt).toLocaleString())}</span>
        </div>
      `
    )
    .join("");
}

async function openUserModal(userId) {
  if (!userId) return;

  const backdrop = document.querySelector("#user-modal");
  const content = document.querySelector("#user-modal-content");
  const subtitle = document.querySelector("#user-modal-subtitle");
  if (!backdrop || !content || !subtitle) return;

  backdrop.classList.remove("hidden");
  subtitle.textContent = `Loading profile for user ${userId}`;
  content.innerHTML = `<div class="empty-state">Loading user details...</div>`;

  const { data, error } = await supabaseClient
    .from(CONFIG.usersTable)
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) {
    subtitle.textContent = "Unable to load profile";
    content.innerHTML = `<div class="empty-state">${escapeHtml(error?.message || "User not found.")}</div>`;
    return;
  }

  subtitle.textContent = `Profile for user ${userId}`;
  const fields = [
    ["ID", data.id],
    ["Name", data.full_name || data.name || data.username],
    ["Email", getFirstAvailableValue(data, CONFIG.userEmailColumns)],
    ["Phone", getFirstAvailableValue(data, CONFIG.userPhoneColumns)],
    ["Blocked", String(Boolean(data[CONFIG.userBlockedColumn]))],
    ["FCM Token", data.fcm_token ? "Available" : "Missing"],
    ["Created At", data.created_at ? new Date(data.created_at).toLocaleString() : ""],
    ["Updated At", data.updated_at ? new Date(data.updated_at).toLocaleString() : ""],
  ].filter(([, value]) => value);

  content.innerHTML = `<div class="detail-grid">${fields
    .map(
      ([label, value]) => `
        <div class="detail-item">
          <strong>${escapeHtml(label)}</strong>
          <div>${escapeHtml(String(value))}</div>
        </div>
      `
    )
    .join("")}</div>`;
}

function closeUserModal() {
  const backdrop = document.querySelector("#user-modal");
  if (backdrop) backdrop.classList.add("hidden");
}

function getPaginatedItems(items, key) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  if (paginationState[key] > totalPages) paginationState[key] = totalPages;
  if (paginationState[key] < 1) paginationState[key] = 1;
  const start = (paginationState[key] - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

function renderPagination(containerId, totalItems, key) {
  const container = document.querySelector(`#${containerId}`);
  if (!container) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(paginationState[key], totalPages);
  paginationState[key] = currentPage;

  container.innerHTML = `
    <div class="pagination-info">Page ${currentPage} of ${totalPages} - ${totalItems} item${totalItems === 1 ? "" : "s"}</div>
    <div class="pagination-actions">
      <button class="btn btn-secondary" type="button" data-page-nav="${key}:prev" ${currentPage === 1 ? "disabled" : ""}>Previous</button>
      <button class="btn btn-secondary" type="button" data-page-nav="${key}:next" ${currentPage === totalPages ? "disabled" : ""}>Next</button>
    </div>
  `;

  container.querySelectorAll("[data-page-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const [, direction] = button.dataset.pageNav.split(":");
      paginationState[key] += direction === "next" ? 1 : -1;
      rerenderByKey(key);
    });
  });
}

function rerenderByKey(key) {
  if (key === "users") applyUsersFilters();
  if (key === "reports") applyReportsFilters();
  if (key === "support") applySupportFilters();
  if (key === "deleteRequests") applyDeleteFilters();
  if (key === "auditLogs") applyAuditFilters();
}

function toggleSelection(selectionSet, id, checked) {
  if (!id) return;
  if (checked) selectionSet.add(String(id));
  else selectionSet.delete(String(id));
}

function toggleSelectPage(key) {
  const config = {
    reports: { items: getPaginatedItems(getFilteredReports(), "reports"), set: selectedReports, id: (item) => item.id || item.report_id || "" },
    support: { items: getPaginatedItems(getFilteredSupportTickets(), "support"), set: selectedSupportTickets, id: (item) => item.id || "" },
    deleteRequests: { items: getPaginatedItems(getFilteredDeleteRequests(), "deleteRequests"), set: selectedDeleteRequests, id: (item) => item.id || "" },
  }[key];

  if (!config) return;
  const ids = config.items.map(config.id).filter(Boolean).map(String);
  const allSelected = ids.length > 0 && ids.every((id) => config.set.has(id));

  ids.forEach((id) => {
    if (allSelected) config.set.delete(id);
    else config.set.add(id);
  });

  rerenderByKey(key);
}

async function bulkResolveReportsAction(button) {
  const ids = Array.from(selectedReports);
  if (!ids.length) {
    showToast("Select reports first", "error");
    return;
  }

  setLoading(button, true);
  const { error } = await supabaseClient
    .from(CONFIG.reportsTable)
    .update({ [CONFIG.reportStatusColumn]: "resolved" })
    .in("id", ids);
  setLoading(button, false);

  if (error) {
    showToast(`Bulk resolve failed: ${error.message}`, "error");
    return;
  }

  selectedReports.clear();
  logAdminActivity("Bulk resolved reports", `${ids.length} reports were marked resolved.`);
  showToast(`${ids.length} reports resolved`, "success");
  await loadReports();
}

async function bulkResolveSupportAction(button) {
  const ids = Array.from(selectedSupportTickets);
  if (!ids.length) {
    showToast("Select support tickets first", "error");
    return;
  }

  setLoading(button, true);
  const { error } = await supabaseClient
    .from(CONFIG.supportTable)
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .in("id", ids);
  setLoading(button, false);

  if (error) {
    showToast(`Bulk resolve failed: ${error.message}`, "error");
    return;
  }

  selectedSupportTickets.clear();
  logAdminActivity("Bulk resolved support tickets", `${ids.length} support tickets were marked resolved.`);
  showToast(`${ids.length} support tickets resolved`, "success");
  await loadSupportTickets();
}

async function bulkUpdateDeleteRequests(nextStatus, button) {
  const ids = Array.from(selectedDeleteRequests);
  if (!ids.length) {
    showToast("Select delete requests first", "error");
    return;
  }

  setLoading(button, true);
  const { error } = await supabaseClient
    .from(CONFIG.deleteRequestsTable)
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .in("id", ids);
  setLoading(button, false);

  if (error) {
    showToast(`Bulk update failed: ${error.message}`, "error");
    return;
  }

  selectedDeleteRequests.clear();
  logAdminActivity("Bulk updated delete requests", `${ids.length} delete requests were marked ${nextStatus}.`);
  showToast(`${ids.length} delete requests marked ${nextStatus}`, "success");
  await loadDeleteRequests();
}

function getToastStack() {
  let stack = document.querySelector(".toast-stack");
  if (stack) return stack;

  stack = document.createElement("div");
  stack.className = "toast-stack";
  document.body.appendChild(stack);
  return stack;
}

function showToast(message, type = "success") {
  const stack = getToastStack();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`.trim();
  toast.textContent = message;
  stack.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getCurrentPage() {
  const page = window.location.pathname.split("/").pop();
  return page || CONFIG.loginPage;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFirstAvailableValue(record, columns) {
  for (const column of columns) {
    const value = record?.[column];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

window.addEventListener("beforeunload", () => {
  stopDashboardRealtime();
  stopUsersRealtime();
  stopReportsRealtime();
  stopSupportRealtime();
  stopDeleteRequestsRealtime();
  stopAuditLogsRealtime();
});
