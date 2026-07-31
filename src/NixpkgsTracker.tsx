import { toPng } from "html-to-image";
import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import "./NixpkgsTracker.css";

const ALL_BRANCHES = [
  "staging-next",
  "master",
  "nixos-unstable-small",
  "nixpkgs-unstable",
  "nixos-unstable",
  "nixos-26.05",
] as const;

const DEFAULT_BRANCHES = ["nixos-unstable"] as const;
const LS_TOKEN = "nixpkgs_tracker_token";
const LS_BRANCHES = "nixpkgs_tracker_branches";
const API_BASE = "https://api.github.com/repos/NixOS/nixpkgs";
const GH_API_VERSION = "2022-11-28";

type PRHeader = {
  title: string;
  closed: boolean;
  merged: boolean;
  base: string;
  mergeCommitSha: string | null;
};

type BranchStatus = {
  name: string;
  merged: boolean;
  checking: boolean;
  error?: boolean;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function canUseDOM(): boolean {
  return typeof window !== "undefined";
}

function getToken(): string {
  if (!canUseDOM()) return "";
  return localStorage.getItem(LS_TOKEN) ?? "";
}

function getSavedBranches(): Set<string> {
  if (!canUseDOM()) return new Set(DEFAULT_BRANCHES);
  try {
    const saved = localStorage.getItem(LS_BRANCHES);
    if (!saved) return new Set(DEFAULT_BRANCHES);

    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return new Set(DEFAULT_BRANCHES);

    const valid = parsed.filter(
      (b): b is string =>
        typeof b === "string" &&
        (ALL_BRANCHES as readonly string[]).includes(b),
    );
    return valid.length > 0 ? new Set(valid) : new Set(DEFAULT_BRANCHES);
  } catch {
    return new Set(DEFAULT_BRANCHES);
  }
}

function saveBranches(branches: Set<string>) {
  if (!canUseDOM()) return;
  localStorage.setItem(LS_BRANCHES, JSON.stringify([...branches]));
}

function authHeaders(token: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GH_API_VERSION,
  };
  if (token) {
    // Works for classic (ghp_) and fine-grained (github_pat_) tokens.
    headers.Authorization = token.startsWith("github_pat_")
      ? `Bearer ${token}`
      : `token ${token}`;
  }
  return headers;
}

async function fetchJSON<T>(
  url: string,
  token: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: authHeaders(token),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new HttpError(0, "Network error");
  }

  if (!response.ok) {
    throw new HttpError(
      response.status,
      response.statusText || "Request failed",
    );
  }

  return response.json() as Promise<T>;
}

async function getPRHeader(
  pr: string,
  token: string,
  signal?: AbortSignal,
): Promise<PRHeader> {
  const data = await fetchJSON<{
    title: string;
    state: string;
    merged_at: string | null;
    base: { ref: string };
    merge_commit_sha: string | null;
  }>(`${API_BASE}/pulls/${pr}`, token, signal);

  return {
    title: data.title,
    closed: data.state === "closed" && data.merged_at === null,
    merged: data.merged_at !== null,
    base: data.base.ref,
    mergeCommitSha: data.merge_commit_sha,
  };
}

async function checkBranch(
  branch: string,
  commitSha: string,
  token: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const data = await fetchJSON<{ status: string }>(
    `${API_BASE}/compare/${encodeURIComponent(branch)}...${encodeURIComponent(commitSha)}`,
    token,
    signal,
  );
  return data.status === "identical" || data.status === "behind";
}

function toggleBranch(set: Set<string>, branch: string): Set<string> {
  const next = new Set(set);
  if (next.has(branch)) next.delete(branch);
  else next.add(branch);
  return next;
}

function getPrFromURL(): string {
  if (!canUseDOM()) return "";
  return new URLSearchParams(window.location.search).get("pr") ?? "";
}

function setPrToURL(pr: string) {
  if (!canUseDOM()) return;
  const url = new URL(window.location.href);
  if (pr) url.searchParams.set("pr", pr);
  else url.searchParams.delete("pr");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

/** Accept bare numbers or GitHub PR URLs. */
function parsePrInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const fromUrl = value.match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/i);
  if (fromUrl) return fromUrl[1];

  const bare = value.match(/^#?(\d+)$/);
  if (bare) return bare[1];

  return null;
}

function errorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.status === 403 || err.status === 429) {
      return "API rate limit exceeded — set a GitHub token to increase the limit";
    }
    if (err.status === 404) return "PR not found";
    if (err.status === 401) return "Invalid GitHub token";
    if (err.status === 0) return "Network error — check your connection";
    return `Request failed (HTTP ${err.status})`;
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return "";
  }
  return "Request failed — check the PR number or network";
}

export function NixpkgsTracker() {
  const [prInput, setPrInput] = createSignal(getPrFromURL());
  const [selectedBranches, setSelectedBranches] = createSignal(
    getSavedBranches(),
  );
  const [token, setToken] = createSignal(getToken());
  const [showToken, setShowToken] = createSignal(false);

  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [copyError, setCopyError] = createSignal("");

  const [prTitle, setPrTitle] = createSignal("");
  const [prNumber, setPrNumber] = createSignal("");
  const [prClosed, setPrClosed] = createSignal(false);
  const [prMerged, setPrMerged] = createSignal(false);
  const [prBase, setPrBase] = createSignal("");
  const [branchStatuses, setBranchStatuses] = createSignal<BranchStatus[]>([]);
  const [copied, setCopied] = createSignal(false);

  let resultCardRef: HTMLDivElement | undefined;
  let activeController: AbortController | null = null;
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  const isRelease = createMemo(() => prBase().startsWith("release-"));

  const mergedCount = createMemo(
    () => branchStatuses().filter((b) => b.merged).length,
  );

  onCleanup(() => {
    activeController?.abort();
    if (copyResetTimer) clearTimeout(copyResetTimer);
  });

  function handleToggleBranch(branch: string) {
    setSelectedBranches((prev) => {
      const next = toggleBranch(prev, branch);
      saveBranches(next);
      return next;
    });
  }

  function saveToken(t: string) {
    const next = t.trim();
    localStorage.setItem(LS_TOKEN, next);
    setToken(next);
  }

  function clearToken() {
    localStorage.removeItem(LS_TOKEN);
    setToken("");
  }

  async function handleCheck() {
    const prNum = parsePrInput(prInput());
    if (!prNum) {
      setError("Enter a valid PR number or GitHub pull request URL");
      return;
    }

    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;

    setPrInput(prNum);
    setPrToURL(prNum);
    setPrNumber(prNum);
    setLoading(true);
    setError("");
    setCopyError("");
    setPrTitle("");
    setPrClosed(false);
    setPrMerged(false);
    setPrBase("");
    setBranchStatuses([]);

    try {
      const header = await getPRHeader(prNum, token(), controller.signal);

      if (controller.signal.aborted) return;

      setPrTitle(header.title);
      setPrClosed(header.closed);
      setPrMerged(header.merged);
      setPrBase(header.base);

      if (!header.merged) {
        setError(
          header.closed
            ? "This PR is closed and not merged"
            : "This PR is not merged yet",
        );
        setLoading(false);
        return;
      }

      if (!header.mergeCommitSha) {
        setError("PR is merged but merge commit SHA is missing");
        setLoading(false);
        return;
      }

      const branches = header.base.startsWith("release-")
        ? [header.base]
        : ALL_BRANCHES.filter((b) => selectedBranches().has(b));

      if (branches.length === 0) {
        setError("Select at least one branch to check");
        setLoading(false);
        return;
      }

      setBranchStatuses(
        branches.map((b) => ({ name: b, merged: false, checking: true })),
      );

      await Promise.all(
        branches.map(async (b) => {
          try {
            const merged = await checkBranch(
              b,
              header.mergeCommitSha!,
              token(),
              controller.signal,
            );
            if (controller.signal.aborted) return;
            setBranchStatuses((prev) =>
              prev.map((s) =>
                s.name === b ? { name: b, merged, checking: false } : s,
              ),
            );
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
            if (controller.signal.aborted) return;
            setBranchStatuses((prev) =>
              prev.map((s) =>
                s.name === b
                  ? { name: b, merged: false, checking: false, error: true }
                  : s,
              ),
            );
          }
        }),
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = errorMessage(err);
      if (message) setError(message);
    } finally {
      if (activeController === controller) {
        activeController = null;
        setLoading(false);
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCheck();
    }
  }

  async function handleCopyImage() {
    if (!resultCardRef || !prTitle()) return;
    setCopyError("");
    try {
      const dataUrl = await toPng(resultCardRef, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if (!navigator.clipboard?.write) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `nixpkgs-pr-${prNumber()}.png`;
        a.click();
        setCopied(true);
      } else {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopied(true);
      }

      if (copyResetTimer) clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(
        "Failed to copy image — try again or use a Chromium browser",
      );
    }
  }

  onMount(() => {
    setSelectedBranches(getSavedBranches());
    setToken(getToken());
    if (parsePrInput(prInput())) void handleCheck();
  });

  return (
    <div class="tracker">
      <header class="header">
        <h1 class="title">Nixpkgs Tracker</h1>
        <p class="subtitle">
          Check whether a nixpkgs PR has reached your branches
        </p>
      </header>

      <div class="main-row">
        <Show when={!isRelease()}>
          <div class="branch-section">
            <p class="branch-label" id="branch-label">
              Branches
            </p>
            <div
              class="branch-checkboxes"
              role="group"
              aria-labelledby="branch-label"
            >
              <For each={[...ALL_BRANCHES]}>
                {(b) => (
                  <label class="branch-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedBranches().has(b)}
                      onChange={() => handleToggleBranch(b)}
                      disabled={loading()}
                    />
                    <span>{b}</span>
                  </label>
                )}
              </For>
            </div>
          </div>
        </Show>

        <div class="input-col">
          <div class="input-group">
            <label class="label" for="tracker-pr-input">
              PR Number
            </label>
            <input
              id="tracker-pr-input"
              type="text"
              class="input"
              inputMode="numeric"
              autocomplete="off"
              spellcheck={false}
              placeholder="e.g. 512987 or GitHub PR URL"
              value={prInput()}
              onInput={(e) => setPrInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              disabled={loading()}
              aria-invalid={!!error() && !prTitle()}
              aria-describedby={error() ? "tracker-error" : undefined}
            />
          </div>

          <div class="btn-row">
            <button
              type="button"
              class="btn btn-primary"
              onClick={() => void handleCheck()}
              disabled={loading() || !prInput().trim()}
            >
              {loading() ? "Checking…" : "Check"}
            </button>

            <button
              type="button"
              class="btn"
              onClick={() => void handleCopyImage()}
              disabled={!prTitle() || loading()}
            >
              {copied() ? "Copied!" : "Copy image"}
            </button>
          </div>
        </div>
      </div>

      <Show when={error()}>
        <p class="error" id="tracker-error" role="alert">
          {error()}
        </p>
      </Show>
      <Show when={copyError()}>
        <p class="error" role="alert">
          {copyError()}
        </p>
      </Show>

      <Show when={prTitle()}>
        <div class="result-card" ref={resultCardRef}>
          <a
            class="pr-title"
            href={`https://github.com/NixOS/nixpkgs/pull/${prNumber()}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            #{prNumber()} {prTitle()}
          </a>

          <div class="pr-meta">
            <Show when={prMerged()}>
              <span class="badge badge-merged">Merged</span>
            </Show>
            <Show when={prClosed()}>
              <span class="badge badge-closed">Closed</span>
            </Show>
            <Show when={!prMerged() && !prClosed()}>
              <span class="badge badge-open">Open</span>
            </Show>
            <Show when={prBase()}>
              <span class="badge badge-base">base: {prBase()}</span>
            </Show>
          </div>

          <Show when={isRelease()}>
            <p class="release-hint">
              Release branch detected, checking {prBase()} only
            </p>
          </Show>

          <div class="status-list" role="list">
            <For each={branchStatuses()}>
              {(bs) => (
                <div
                  class={`status-item ${
                    bs.checking
                      ? "checking"
                      : bs.error
                        ? "error-state"
                        : bs.merged
                          ? "merged"
                          : "unmerged"
                  }`}
                  role="listitem"
                >
                  <input
                    type="checkbox"
                    class="status-icon"
                    checked={bs.merged && !bs.checking && !bs.error}
                    disabled
                    tabindex={-1}
                    aria-hidden="true"
                  />
                  <span class="status-name">{bs.name}</span>
                  <Show when={bs.checking}>
                    <span class="status-hint">checking…</span>
                  </Show>
                  <Show when={bs.error}>
                    <span class="status-hint">failed</span>
                  </Show>
                </div>
              )}
            </For>
          </div>

          <Show when={!loading() && branchStatuses().length > 0}>
            <p class="summary">
              Merged to {mergedCount()} / {branchStatuses().length} branches
            </p>
          </Show>
        </div>
      </Show>

      <div class="token-section">
        <button
          type="button"
          class="token-toggle"
          onClick={() => setShowToken(!showToken())}
          aria-expanded={showToken()}
        >
          {token()
            ? "Token set (click to change)"
            : "Set GitHub token to increase rate limit"}
        </button>
        <Show when={showToken()}>
          <div class="token-row">
            <input
              type="password"
              class="input token-input"
              placeholder="ghp_… or github_pat_…"
              value={token()}
              autocomplete="off"
              spellcheck={false}
              onInput={(e) => saveToken(e.currentTarget.value)}
              aria-label="GitHub personal access token"
            />
            <Show when={token()}>
              <button type="button" class="btn btn-small" onClick={clearToken}>
                Clear
              </button>
            </Show>
          </div>
          <p class="token-hint">
            Stored only in this browser's localStorage. Needs public repo read
            access.
          </p>
        </Show>
      </div>
    </div>
  );
}
