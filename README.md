### How this works

With Github API:
get pr merged commit hash -> compare target branch HEAD ... commit -> get status

nixpkgs-tracker not same as [nixpk.gs/pr-tracker](https://nixpk.gs/pr-tracker.html),
it does not pass any requests through server to get PR status.

Therefore, there is no need to worry about any performance issues.

You could get static files with:
```sh
  nix build github:ocfox/nixpkgs-tracker
```

### Features

- [x] Show PR status
- [x] Stable link (e.g. https://nixpkgs-tracker.ocfox.me/?pr=512987)
- [x] Github token for more requests limit (optional)
- [x] Check multiple branches at the same time

<img width="3696" height="1917" alt="nixpkgs-tracker ocfox me__pr=512987" src="https://github.com/user-attachments/assets/322eea55-0a77-4354-8962-c30244b6ac3f" />
