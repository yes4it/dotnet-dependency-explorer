const vscode=require('vscode');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
exports.run=async()=>{
 const report=path.join(__dirname,'../.test/host-result.json');
 try {
  const manifest=require('../package.json');
  const extension=vscode.extensions.getExtension(manifest.publisher+'.'+manifest.name);
  assert.ok(extension,'development extension registered');await extension.activate();
  await vscode.commands.executeCommand('workbench.view.extension.dotnetDependencyExplorer');
  await vscode.commands.executeCommand('dotnetDependencyExplorer.sidebar.focus');
  const commands=await vscode.commands.getCommands();assert.ok(commands.includes('dotnetDependencyExplorer.open'));
  await vscode.commands.executeCommand('dotnetDependencyExplorer.open');
  assert.ok(vscode.window.tabGroups.all.flatMap(g=>g.tabs).some(t=>t.input instanceof vscode.TabInputWebview),'graph tab opened');
  await vscode.commands.executeCommand('dotnetDependencyExplorer.refresh');
  const files=await vscode.workspace.findFiles('**/*.csproj');assert.ok(files.length>0);
  await vscode.commands.executeCommand('dotnetDependencyExplorer.open',files[0]);
  fs.writeFileSync(report,JSON.stringify({ok:true,checks:['activity bar container','sidebar focus','activation','commands','webview tab','refresh','project context command']}));
 }catch(error){fs.writeFileSync(report,JSON.stringify({ok:false,error:String(error)}));throw error;}
};
