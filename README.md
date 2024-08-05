### How this works

With Github API:
get pr merged commit hash ->  compare target branch HEAD ... commit -> get status

nixpkgs-tracker not same as [nixpk.gs/pr-tracker](https://nixpk.gs/pr-tracker.html),
it does not pass any requests through server to get PR status.

Therefore, there is no need to worry about any performance issues.

### Features

- [x] Show PR status
- [x] Stable link (e.g. https://nixpkgs-tracker.ocfox.me/?pr=331928)
- [x] Github token for more requests limit (Cookie) (optional)
- [x] Click `Nixpkgs-Tracker` to switch light / dark

<img width="1552" alt="image" src="https://github.com/user-attachments/assets/d247eb27-0320-4384-ad3f-36daca4d0ac0">

