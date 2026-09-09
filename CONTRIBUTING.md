# Contributing

Use Node.js 22 or later. Run `npm ci`, `npm test` and `npm run check` before submitting a pull request.

The analyzer and host integration live in `src/`; the framework-free webview lives in `media/`. Changes to graph behavior should include a focused analyzer test or a reproducible UI case. Project names must be rendered as text, and workspace files must never be executed as part of analysis.

Use the synthetic example from `npm run demo` for screenshots. Keep backend-specific naming rules out of defaults; users can configure `dotnetDependencyExplorer.domainRules` and `dotnetDependencyExplorer.labelPrefixes`.
