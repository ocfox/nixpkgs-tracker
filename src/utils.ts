import Cookies from "js-cookie";

export const branches = [
  "staging-next",
  "master",
  "nixos-unstable-small",
  "nixpkgs-unstable",
  "nixos-unstable",
];

export function setToken(token: string) {
  Cookies.set("token", token, { expires: 365, sameSite: "strict" });
}

function getToken() {
  return Cookies.get("token");
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

type PRtitle = {
  title: string;
  status: number;
};

export async function getPRTitle(pr: string): Promise<PRtitle> {
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
