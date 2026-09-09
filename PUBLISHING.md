# Publication preparation

Source repository: https://github.com/yes4it/dotnet-dependency-explorer

The extension has not been published to the Marketplace. Your Marketplace publisher ID still needs to be configured.

## 1. Create the public identities

- Create a publisher at https://marketplace.visualstudio.com/manage. Choose the ID carefully: it becomes part of the extension identity.
- The GitHub repository is configured. `.gitignore` excludes dependencies, temporary tests and VSIX artifacts.

## 2. Set the metadata

From this directory:

```powershell
npm run configure:release -- --publisher YOUR_PUBLISHER_ID --repository https://github.com/yes4it/dotnet-dependency-explorer
```

This updates `package.json`, the README screenshot URLs and the support link. It only edits local files.
The placeholder publisher `publisher-id-required` is for preview packages and must not be used for the public release.

## 3. Build the release package

```powershell
npm ci
npm test
npm run package
```

The last command checks publication metadata and creates the release `.vsix` under `artifacts/`.
The package includes the compiled runtime, English UI, PNG assets, MIT license and third-party notices. It excludes example data, backend data, source tests and development dependencies.

Before account setup, `npm run package:preview` produces an installable preview in `artifacts/`. Its placeholder publisher must be replaced before publishing to the Marketplace.

## 4. Upload manually

Open your publisher's Marketplace management page, choose **New extension → Visual Studio Code**, and upload the release `.vsix`.
For later releases, increase the version, update `CHANGELOG.md`, rebuild and upload a new version to the same listing.

Official instructions: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

## Validation

- `npm test`: build and analyzer regression tests.
- `npm run check`: TypeScript validation.
- `npm run demo`: generate a standalone example using fictional projects.
- `npm run test:host`: activation, graph command, refresh and project-context smoke test in an isolated VS Code profile. Set `VSCODE_EXECUTABLE` first.

The current analysis reads declared project references. Keep the documented MSBuild and runtime-analysis limitations visible on the listing.
