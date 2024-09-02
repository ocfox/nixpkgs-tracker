export const branches = [
  "staging-next",
  "master",
  "nixos-unstable-small",
  "nixpkgs-unstable",
  "nixos-unstable",
];

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

function getToken() {
  return localStorage.getItem("token");
}

export function hasToken(): boolean {
  return !!getToken();
}

function header() {
  const token = getToken();
  if (token) {
    return {
      Authorization: `token ${token}`,
    };
  }
}

const headers = header();

type PR = {
  title: string;
  status: number;
};

export async function getPR(pr: string): Promise<PR> {
  const response = await fetch(
    `https://api.github.com/repos/nixos/nixpkgs/pulls/${pr}`,
    { headers },
  );

  const data = await response.json();

  return {
    title: data.title,
    status: response.status,
  };
}

export async function getMeregeCommit(pr: string): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/nixos/nixpkgs/pulls/${pr}`,
    { headers },
  );

  const data = await response.json();

  return data.merge_commit_sha;
}

export async function isContain(
  branch: string,
  commit: string,
): Promise<boolean> {
  const url = `https://api.github.com/repos/nixos/nixpkgs/compare/${branch}...${commit}`;
  const response = await fetch(url, { headers });
  if (response.status === 404) {
    return false;
  }
  const data = await response.json();
  if (data.status === "identical" || data.status === "behind") {
    return true;
  }
  return false;
}

export type History = {
  pr: number;
  title: string;
  mergeCommit: string;
};

export function getHistoryList(): History[] {
  const history = localStorage.getItem("history");
  if (history) {
    return JSON.parse(history);
  }
  return [];
}

export function saveHistory(history: History) {
  const historyList = getHistoryList();
  historyList.push(history);
  localStorage.setItem("history", JSON.stringify(historyList));
}

export function getHistoryTitle(pr: number): string {
  const history = getHistoryList();
  const item = history.find((item) => item.pr === pr);
  if (item) {
    return item.title;
  }
  return "";
}

export function deleteHistory(pr: number) {
  const history = getHistoryList();
  const newHistory = history.filter((item) => item.pr !== pr);
  localStorage.setItem("history", JSON.stringify(newHistory));
}
