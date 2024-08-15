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
    { headers }
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
    { headers }
  );

  const data = await response.json();

  return data.merge_commit_sha;
}

export async function isContain(
  branch: string,
  commit: string
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
