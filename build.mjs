import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
await build({entryPoints:['src/extension.ts'],bundle:true,platform:'node',format:'cjs',target:'node20',external:['vscode'],outfile:'dist/extension.js'});
await build({entryPoints:['src/analyzer.ts'],bundle:true,platform:'node',format:'cjs',target:'node20',outfile:'.test/analyzer.cjs'});
