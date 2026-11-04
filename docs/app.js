const REGIONS = {
  IE: { apiUrl: "https://api.tpro.io", nlpApi: "https://rexapi.tpro.io" },
  UK: { apiUrl: "https://api.tpro-uk.com", nlpApi: "https://rexapi.tpro-uk.com" },
  AU: { apiUrl: "https://api.tpro-au.com", nlpApi: "https://rexapi.tpro-au.com" },
  SG: { apiUrl: "https://api.tpro-sg.com", nlpApi: "https://rexapi.tpro-sg.com" },
};

const STORE_KEY = "swMattersSession.v1";

const el = {
  status: document.getElementById("status"),
  subtitle: document.getElementById("subtitle"),
  loginView: document.getElementById("loginView"),
  listView: document.getElementById("listView"),
  detailView: document.getElementById("detailView"),
  signInBtn: document.getElementById("signInBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  backBtn: document.getElementById("backBtn"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  mfa: document.getElementById("mfa"),
  mfaWrap: document.getElementById("mfaWrap"),
  draftList: document.getElementById("draftList"),
  detailTitle: document.getElementById("detailTitle"),
  detailSub: document.getElementById("detailSub"),
  detailTags: document.getElementById("detailTags"),
  detailTranscript: document.getElementById("detailTranscript"),
  openScribeBtn: document.getElementById("openScribeBtn"),
};

let session = loadSession();

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(next) {
  session = next;
  if (!next) localStorage.removeItem(STORE_KEY);
  else localStorage.setItem(STORE_KEY, JSON.stringify(next));
}

function setStatus(text, kind) {
  el.status.textContent = text || "";
  el.status.classList.toggle("show", !!text);
  el.status.classList.toggle("ok", kind === "ok");
  el.status.classList.toggle("err", kind === "err");
}

function regionOf(code) {
  const key = String(code || "IE").toUpperCase();
  return REGIONS[key] || REGIONS.IE;
}

function useApiProxy() {
  const host = location.hostname;
  return host && host !== "localhost" && host !== "127.0.0.1";
}

async function api(url, token, options = {}) {
  let res;
  if (useApiProxy()) {
    // Cloudflare Pages Function avoids browser CORS on phone installs.
    res = await fetch("/api/proxy", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        method: options.method || "GET",
        headers: {
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(options.headers || {}),
        },
        body: options.body != null ? options.body : undefined,
      }),
      cache: "no-store",
    });
  } else {
    res = await fetch(url, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  }
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = (body && (body.message || body.error)) || ("Request failed (" + res.status + ")");
    const err = new Error(typeof msg === "string" ? msg : "Request failed");
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function asList(body) {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return null;
  for (const key of ["data", "dictations", "items", "results", "rows", "docs", "encounters"]) {
    if (Array.isArray(body[key])) return body[key];
  }
  return null;
}

function copilotOf(row) {
  return row && row.copilot && typeof row.copilot === "object" ? row.copilot : {};
}

function subjectOf(row) {
  const c = copilotOf(row);
  return {
    name: String(c.subject_name || row.subject_name || row.subjectName || row.clientName || "").trim(),
    id: String(c.subject_id || row.subject_id || row.subjectId || "").trim(),
    alt: String(c.subject_alternative_id || row.subject_alternative_id || "").trim(),
  };
}

function sourceHint(row) {
  const c = copilotOf(row);
  const alt = subjectOf(row).alt;
  const hasAs = /^as:/i.test(alt);
  const encounter = String(c.type || "").toLowerCase() === "encounter";
  const ver = String(row.version || "");
  if (!hasAs && !encounter) return "mobile";
  if (/^1\./.test(ver) && !hasAs) return "mobile";
  if (hasAs || encounter) return "desktop";
  return "unknown";
}

function isOpenDraft(row) {
  if (!row || !(row._id || row.id)) return false;
  const app = String(row.application || "").toLowerCase();
  if (app && app !== "copilot") return false;
  const status = String(copilotOf(row).status || row.status || "").toLowerCase();
  if (!status) return true;
  return /draft|recording|author_p|incomplete|in[- ]?progress/.test(status);
}

function whenLabel(iso) {
  const ms = Date.parse(String(iso || ""));
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleString(undefined, {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function showLogin() {
  el.loginView.classList.remove("hidden");
  el.listView.classList.add("hidden");
  el.detailView.classList.add("hidden");
  el.signOutBtn.classList.add("hidden");
  el.subtitle.textContent = "Sign in to continue drafts on your phone";
}

function showList() {
  el.loginView.classList.add("hidden");
  el.listView.classList.remove("hidden");
  el.detailView.classList.add("hidden");
  el.signOutBtn.classList.remove("hidden");
  el.subtitle.textContent = session?.email || "Signed in";
}

function showDetail() {
  el.loginView.classList.add("hidden");
  el.listView.classList.add("hidden");
  el.detailView.classList.remove("hidden");
  el.signOutBtn.classList.remove("hidden");
}

async function signIn() {
  setStatus("Signing in…");
  el.signInBtn.disabled = true;
  try {
    const email = el.email.value.trim();
    const password = el.password.value;
    const code = el.mfa.value.trim();
    if (!email || !password) throw new Error("Enter email and password");
    const body = { email, password, sourceApplication: "Copilot" };
    if (code) body.verificationCode = code;
    const payload = await api("https://auth.tpro.io/v1/auth/login", null, { method: "POST", body });
    const auth = payload && payload.data && typeof payload.data === "object" ? payload.data : payload;
    if (auth && (auth.mfaMode || auth.mfa) && !code) {
      el.mfaWrap.classList.remove("hidden");
      setStatus("Enter the verification code", "err");
      return;
    }
    const token = auth && (auth.accessToken || auth.token);
    const id = auth && auth.id;
    if (!token || !id) throw new Error((auth && auth.message) || "Sign-in failed");
    const env = String(auth.environment || "IE").toUpperCase();
    const region = regionOf(env);
    const profile = await api(region.apiUrl + "/v1/users/" + encodeURIComponent(id) + "?type=web", token);
    const user = profile && profile.data ? profile.data : profile;
    const nlpUser = user && user.settings && user.settings.nlpUser;
    saveSession({
      email,
      token,
      refreshToken: auth.refreshToken || auth.refresh_token || "",
      id,
      environment: env,
      nlpUser: nlpUser || "",
      name: [user && user.firstName, user && user.lastName].filter(Boolean).join(" ") || email,
    });
    setStatus("Signed in", "ok");
    showList();
    await refreshDrafts();
  } catch (error) {
    setStatus(error.message || "Sign-in failed", "err");
  } finally {
    el.signInBtn.disabled = false;
  }
}

async function listDictations() {
  const region = regionOf(session.environment);
  const author = session.nlpUser;
  const urls = [];
  if (author) {
    urls.push(region.nlpApi + "/api/v1/dictations?author=" + encodeURIComponent(author) + "&application=Copilot&limit=50");
    urls.push(region.nlpApi + "/api/v1/dictations?author=" + encodeURIComponent(author) + "&limit=50");
    urls.push(region.nlpApi + "/api/v1/dictations?author=" + encodeURIComponent(author) + "&status=recording&limit=50");
  }
  urls.push(region.nlpApi + "/api/v1/dictations?application=Copilot&type=frontend&limit=50");

  let lastEmpty = null;
  for (const url of urls) {
    try {
      const body = await api(url, session.token);
      const list = asList(body);
      if (list && list.length) return list;
      if (list && !lastEmpty) lastEmpty = list;
    } catch {
      // try next
    }
  }
  return lastEmpty || [];
}

function renderDrafts(rows) {
  el.draftList.textContent = "";
  const open = rows.filter(isOpenDraft);
  open.sort((a, b) => {
    const aMobile = sourceHint(a) === "mobile" ? 1 : 0;
    const bMobile = sourceHint(b) === "mobile" ? 1 : 0;
    if (aMobile !== bMobile) return bMobile - aMobile;
    const ta = Date.parse(String(a.updatedAt || a.createdAt || "")) || 0;
    const tb = Date.parse(String(b.updatedAt || b.createdAt || "")) || 0;
    return tb - ta;
  });
  if (!open.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = rows.length
      ? "Found sessions, but none look like open drafts."
      : "No drafts found. If this persists, the API may be blocking this origin (CORS) — we can add a Cloudflare proxy next.";
    el.draftList.appendChild(empty);
    return;
  }
  open.slice(0, 30).forEach((row) => {
    const id = String(row._id || row.id);
    const subject = subjectOf(row);
    const source = sourceHint(row);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "row-btn";
    const meta = document.createElement("div");
    meta.className = "row-meta";
    const title = document.createElement("div");
    title.className = "row-title";
    title.textContent = (subject.name || "Untitled") + (subject.id ? " · " + subject.id : "");
    const sub = document.createElement("div");
    sub.className = "row-sub";
    const when = whenLabel(row.updatedAt || row.createdAt);
    const preview = String(copilotOf(row).transcription || "").replace(/\s+/g, " ").trim().slice(0, 100);
    sub.textContent = when + (preview ? " · " + preview : "");
    meta.append(title, sub);
    const tags = document.createElement("div");
    tags.className = "tags";
    const tag = document.createElement("span");
    tag.className = "tag " + (source === "mobile" ? "mobile" : "desktop");
    tag.textContent = source === "mobile" ? "Mobile" : "Desktop";
    tags.appendChild(tag);
    btn.append(meta, tags);
    btn.addEventListener("click", () => openDraft(id));
    el.draftList.appendChild(btn);
  });
}

async function refreshDrafts() {
  if (!session) return;
  setStatus("Loading drafts…");
  el.refreshBtn.disabled = true;
  try {
    const rows = await listDictations();
    renderDrafts(rows);
    setStatus(rows.length ? ("Loaded " + rows.length + " session(s)") : "No sessions returned", rows.length ? "ok" : "err");
  } catch (error) {
    el.draftList.innerHTML = '<div class="empty"></div>';
    el.draftList.firstChild.textContent = error.message || "Could not load drafts";
    setStatus(error.message || "Could not load drafts", "err");
  } finally {
    el.refreshBtn.disabled = false;
  }
}

async function openDraft(id) {
  setStatus("Opening draft…");
  try {
    const region = regionOf(session.environment);
    const row = await api(region.nlpApi + "/api/v1/dictations/" + encodeURIComponent(id), session.token);
    const subject = subjectOf(row);
    const source = sourceHint(row);
    const transcript = String(copilotOf(row).transcription || "").trim() || "No transcript on this draft yet.";
    el.detailTitle.textContent = subject.name || "Draft";
    el.detailSub.textContent = [subject.id, whenLabel(row.updatedAt || row.createdAt), "v" + (row.version || "?")].filter(Boolean).join(" · ");
    el.detailTags.innerHTML = "";
    const tag = document.createElement("span");
    tag.className = "tag " + (source === "mobile" ? "mobile" : "desktop");
    tag.textContent = source === "mobile" ? "Mobile" : "Desktop";
    el.detailTags.appendChild(tag);
    el.detailTranscript.textContent = transcript;
    el.openScribeBtn.href = "https://scribe.speechwrite.com/document/" + encodeURIComponent(id);
    showDetail();
    setStatus("", "ok");
  } catch (error) {
    setStatus(error.message || "Could not open draft", "err");
  }
}

function signOut() {
  saveSession(null);
  setStatus("Signed out", "ok");
  showLogin();
}

el.signInBtn.addEventListener("click", signIn);
el.signOutBtn.addEventListener("click", signOut);
el.refreshBtn.addEventListener("click", refreshDrafts);
el.backBtn.addEventListener("click", () => { showList(); setStatus(""); });
el.password.addEventListener("keydown", (e) => { if (e.key === "Enter") signIn(); });
el.mfa.addEventListener("keydown", (e) => { if (e.key === "Enter") signIn(); });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

if (session && session.token) {
  showList();
  refreshDrafts();
} else {
  showLogin();
}
