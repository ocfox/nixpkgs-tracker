import { NixpkgsTracker } from './NixpkgsTracker';

const App = () => (
  <>
    <NixpkgsTracker />
    <footer style="position:fixed;bottom:0;left:0;right:0;text-align:center;padding:12px;font-family:sans-serif;">
      <a href="https://github.com/ocfox/nixpkgs-tracker/" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;">
        check source
      </a>
    </footer>
  </>
);

export default App;
