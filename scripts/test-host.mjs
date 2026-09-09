import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const executable=process.env.VSCODE_EXECUTABLE;
if(!executable){console.error('Set VSCODE_EXECUTABLE to your VS Code executable (for example .../Code.exe).');process.exit(1);}
const root=process.cwd(),test=path.join(root,'.test');
for(const name of ['A','B'])fs.mkdirSync(path.join(test,'workspace',name),{recursive:true});
fs.writeFileSync(path.join(test,'workspace/A/A.csproj'),'<Project><ItemGroup><ProjectReference Include="../B/B.csproj"/></ItemGroup></Project>');
fs.writeFileSync(path.join(test,'workspace/B/B.csproj'),'<Project/>');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const args=['--no-sandbox','--disable-gpu','--disable-workspace-trust','--skip-welcome','--skip-release-notes','--disable-extensions',`--user-data-dir=${path.join(test,'profile')}`,`--extensions-dir=${path.join(test,'extensions')}`,`--extensionDevelopmentPath=${root}`,`--extensionTestsPath=${path.join(root,'tests/host-smoke.cjs')}`,path.join(test,'workspace')];
const child=spawn(executable,args,{env,windowsHide:true,stdio:'inherit'});
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
