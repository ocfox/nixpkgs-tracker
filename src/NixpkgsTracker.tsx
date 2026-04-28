import { toPng } from "html-to-image";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import "./NixpkgsTracker.css";

const ALL_BRANCHES = [
  "staging-next",
  "master",
  "nixos-unstable-small",
  "nixpkgs-unstable",
  "nixos-unstable",
  "nixos-25.11",
];

const LS_TOKEN = "nixpkgs_tracker_token";
const LS_BRANCHES = "nixpkgs_tracker_branches";

type PRHeader = {
  title: string;
  closed: boolean;
  merged: boolean;
  base: string;
  mergeCommitSha: string;
};

type BranchStatus = {
  name: string;
  merged: boolean;
  checking: boolean;
};

function getToken(): string {
  return typeof localStorage !== "undefined"
    ? (localStorage.getItem(LS_TOKEN) ?? "")
    : "";
}

function getSavedBranches(): Set<string> {
  if (typeof localStorage === "undefined") return new Set(["nixos-unstable"]);
  try {
    const saved = localStorage.getItem(LS_BRANCHES);
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return new Set(parsed);
      }
    }
  } catch {
    /* ignore */
  }
  return new Set(["nixos-unstable"]);
}

function saveBranches(branches: Set<string>) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LS_BRANCHES, JSON.stringify([...branches]));
  }
}

async function fetchJSON<T>(url: string, token: string): Promise<T | null> {
  const headers: Record<string, string> = {
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }
  const r = await fetch(url, { headers });
  if (!r.ok) return null;
  return r.json() as Promise<T>;
}

async function getPRHeader(
  pr: string,
  token: string,
): Promise<PRHeader | { error: string; status: number }> {
  const data = await fetchJSON<{
    title: string;
    state: string;
    merged_at: string | null;
    base: { ref: string };
    merge_commit_sha: string;
  }>(`https://api.github.com/repos/nixos/nixpkgs/pulls/${pr}`, token);

  if (!data) {
    return { error: "PR not found or rate limited", status: 404 };
  }

  return {
    title: data.title,
    closed: data.state === "closed" && !data.merged_at,
    merged: data.merged_at !== null,
    base: data.base.ref,
    mergeCommitSha: data.merge_commit_sha,
  };
}

async function checkBranch(
  branch: string,
  commitSha: string,
  token: string,
): Promise<boolean> {
  const data = await fetchJSON<{ status: string }>(
    `https://api.github.com/repos/nixos/nixpkgs/compare/${branch}...${commitSha}`,
    token,
  );
  if (!data) return false;
  return data.status === "identical" || data.status === "behind";
}

function toggleBranch(set: Set<string>, branch: string): Set<string> {
  const next = new Set(set);
  if (next.has(branch)) {
    next.delete(branch);
  } else {
    next.add(branch);
  }
  return next;
}

function getPrFromURL(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("pr") ?? "";
}

function setPrToURL(pr: string) {
  history.replaceState(null, "", `?pr=${pr}`);
}

export function NixpkgsTracker() {
  const initialPR = getPrFromURL();
  const [prInput, setPrInput] = createSignal<string>(initialPR);
  const [selectedBranches, setSelectedBranches] = createSignal<Set<string>>(
    new Set(),
  );

  onMount(() => {
    setSelectedBranches(getSavedBranches());
    setToken(getToken());
  });

  const [token, setToken] = createSignal("");
  const [showToken, setShowToken] = createSignal(false);

  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  const [prTitle, setPrTitle] = createSignal("");
  const [prNumber, setPrNumber] = createSignal("");
  const [_prClosed, setPrClosed] = createSignal(false);
  const [_prMerged, setPrMerged] = createSignal(false);
  const [prBase, setPrBase] = createSignal("");
  const [branchStatuses, setBranchStatuses] = createSignal<BranchStatus[]>([]);
  const [copied, setCopied] = createSignal(false);

  const isRelease = createMemo(() => prBase().startsWith("release-"));

  const displayBranches = createMemo(() => {
    if (isRelease()) {
      return [prBase()];
    }
    return Array.from(selectedBranches());
  });

  function handleToggleBranch(branch: string) {
    setSelectedBranches((prev) => {
      const next = toggleBranch(prev, branch);
      saveBranches(next);
      return next;
    });
  }

  function saveToken(t: string) {
    localStorage.setItem(LS_TOKEN, t);
    setToken(t);
  }

  async function handleCheck() {
    const pr = prInput().trim();
    if (!pr) return;

    const match = pr.match(/\/pull\/(\d+)/);
    const prNum = match ? match[1] : pr;

    setPrToURL(prNum);
    setPrNumber(prNum);
    setLoading(true);
    setError("");
    setPrTitle("");
    setPrClosed(false);
    setPrMerged(false);
    setPrBase("");
    setBranchStatuses([]);

    const header = await getPRHeader(prNum, token());

    if (!header || "error" in header) {
      if (header && "status" in header && header.status === 403) {
        setError(
          "API rate limit exceeded — set a GitHub token to increase the limit",
        );
      } else if (header && "status" in header && header.status === 404) {
        setError("PR not found");
      } else {
        setError("Request failed — check the PR number or network");
      }
      setLoading(false);
      return;
    }

    setPrTitle(header.title);
    setPrClosed(header.closed);
    setPrMerged(header.merged);
    setPrBase(header.base);

    if (header.closed && !header.merged) {
      setError("This PR is closed and not merged");
      setLoading(false);
      return;
    }

    const branches = displayBranches();
    setBranchStatuses(
      branches.map((b) => ({ name: b, merged: false, checking: true })),
    );

    const results = await Promise.all(
      branches.map(async (b) => {
        const merged = await checkBranch(b, header.mergeCommitSha, token());
        return { name: b, merged, checking: false };
      }),
    );

    setBranchStatuses(results);
    setLoading(false);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") handleCheck();
  }

  let resultCardRef: HTMLDivElement | undefined;

  async function handleCopyImage() {
    if (!resultCardRef) return;
    const dataUrl = await toPng(resultCardRef, { cacheBust: true });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div class="tracker">
      <div class="main-row">
        <Show when={!isRelease()}>
          <div class="branch-section">
            <p class="branch-label">Branches</p>
            <div class="branch-checkboxes">
              <For each={ALL_BRANCHES}>
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
              placeholder="Enter PR number or full link"
              value={prInput()}
              onInput={(e) => setPrInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              disabled={loading()}
            />
          </div>

          <div class="btn-row">
            <button
              type="button"
              class="btn btn-primary"
              onClick={handleCheck}
              disabled={loading() || !prInput().trim()}
            >
              {loading() ? "Checking…" : "Check"}
            </button>

            <button
              type="button"
              class="btn"
              onClick={handleCopyImage}
              disabled={!prTitle()}
            >
              {copied() ? "Copied!" : "Copy image"}
            </button>
          </div>
        </div>
      </div>

      <Show when={error()}>
        <p class="error">{error()}</p>
      </Show>

      <Show when={prTitle()}>
        <div class="result-card" ref={resultCardRef}>
          <a
            class="pr-title"
            href={`https://github.com/nixos/nixpkgs/pull/${prNumber()}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            #{prNumber()} {prTitle()}
          </a>

          <Show when={isRelease()}>
            <p class="release-hint">
              Release branch detected, checking {prBase()} only
            </p>
          </Show>

          <div class="status-list">
            <For each={branchStatuses()}>
              {(bs) => (
                <div
                  class={`status-item ${bs.checking ? "checking" : bs.merged ? "merged" : "unmerged"}`}
                >
                  <input type="checkbox" class="status-icon" checked={bs.merged && !bs.checking} disabled />
                  <span class="status-name">{bs.name}</span>
                </div>
              )}
            </For>
          </div>

          <Show when={!loading() && branchStatuses().length > 0}>
            <p class="summary">
              Merged to {branchStatuses().filter((b) => b.merged).length} /{" "}
              {branchStatuses().length} branches
            </p>
          </Show>
        </div>
      </Show>

      <div class="token-section">
        <button
          type="button"
          class="token-toggle"
          onClick={() => setShowToken(!showToken())}
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
              placeholder="github_pat_xxx"
              value={token()}
              onInput={(e) => saveToken(e.currentTarget.value)}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}
