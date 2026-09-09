import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import * as path from 'node:path';
import { analyzeProjects, GraphData, ProjectInput, DomainRule, defaultDomainRules } from './analyzer';

const viewType='dotnetDependencyExplorer.graph';
const stateKey='dotnetDependencyExplorer.viewState';
const exclude='**/{node_modules,bin,obj,.git,.vs,packages}/**';
export function activate(context:vscode.ExtensionContext):void {
  const sidebarActions=[
    {label:'Open dependency graph',command:'dotnetDependencyExplorer.open',icon:'type-hierarchy',description:'Explore project references'},
    {label:'Refresh dependencies',command:'dotnetDependencyExplorer.refresh',icon:'refresh',description:'Rescan project files'}
  ];
  context.subscriptions.push(vscode.window.createTreeView('dotnetDependencyExplorer.sidebar',{
    treeDataProvider:{
      getChildren:()=>sidebarActions,
      getTreeItem:action=>{
        const item=new vscode.TreeItem(action.label,vscode.TreeItemCollapsibleState.None);
        item.id=action.command;item.tooltip=action.description;
        item.iconPath=new vscode.ThemeIcon(action.icon);
        item.command={command:action.command,title:action.label};
        return item;
      }
    }
  }));
  let panel:vscode.WebviewPanel|undefined, data:GraphData|undefined, timer:ReturnType<typeof setTimeout>|undefined, generation=0;
  const canonical=(uri:vscode.Uri)=>process.platform==='win32'&&uri.scheme==='file'?uri.toString().toLowerCase():uri.toString();
  async function scan():Promise<GraphData> {
    const files=await vscode.workspace.findFiles('**/*.csproj',exclude);
    const failures:string[]=[];
    const records=await Promise.all(files.map(async uri=>{
      try{return {key:canonical(uri),name:path.posix.basename(uri.path,'.csproj'),path:vscode.workspace.asRelativePath(uri,true),xml:Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8')} satisfies ProjectInput;}
      catch(error){failures.push(`${vscode.workspace.asRelativePath(uri)}: ${String(error)}`);return undefined;}
    }));
    const config=vscode.workspace.getConfiguration('dotnetDependencyExplorer');
    const configuredRules=config.get<DomainRule[]>('domainRules',defaultDomainRules);
    const domainRules=Array.isArray(configuredRules)?configuredRules.filter(rule=>rule&&typeof rule.domain==='string'&&Array.isArray(rule.keywords)&&rule.keywords.every(word=>typeof word==='string'&&word.length>0)):defaultDomainRules;
    const configuredPrefixes=config.get<string[]>('labelPrefixes',[]);
    const labelPrefixes=Array.isArray(configuredPrefixes)?configuredPrefixes.filter(prefix=>typeof prefix==='string'&&prefix.length>0):[];
    const graph=analyzeProjects(records.filter((p):p is ProjectInput=>p!==undefined),(project,reference)=>{
      const base=vscode.Uri.parse(project.key);
      return canonical(base.with({path:path.posix.resolve(path.posix.dirname(base.path),reference.replace(/\\/g,'/'))}));
    },{domainRules,labelPrefixes});
    graph.diagnostics.push(...failures);return graph;
  }
  async function html(webview:vscode.Webview,graph:GraphData,focus?:string):Promise<string> {
    const root=vscode.Uri.joinPath(context.extensionUri,'media');
    let template=Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(root,'template.html'))).toString('utf8');
    const nonce=randomBytes(18).toString('hex');
    const safe=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
    const saved=context.workspaceState.get<Record<string,unknown>>(stateKey,{});
    const state=focus?{...saved,selectedUri:focus,scale:1,pan:{x:0,y:0},controls:{...(saved.controls as object||{}),mode:'graph',layout:'focus',depth:'1',domain:'',search:'',cycles:false}}:saved;
    const scripts=['focus.js','explorer.js','bridge.js'].map(file=>`<script nonce="${nonce}" src="${webview.asWebviewUri(vscode.Uri.joinPath(root,file))}"></script>`).join('\n');
    template=template.replace('<meta charset="utf-8">',`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src ${webview.cspSource} data:;">`);
    return template.replace(/<script>[\s\S]*?<\/script>/,()=>`<script nonce="${nonce}">let D=${safe(graph)};window.initialState=${safe(state)};</script>\n${scripts}`);
  }
  async function refresh(focus?:string):Promise<void> {
    const current=panel;if(!current)return;
    const request=++generation;
    try {
      const graph=await scan();
      if(request!==generation||panel!==current)return;
      const content=await html(current.webview,graph,focus);
      if(request!==generation||panel!==current)return;
      data=graph;current.webview.html=content;
    }catch(error){void vscode.window.showErrorMessage(`Dependency analysis failed: ${String(error)}`);}
  }
  function connect(current:vscode.WebviewPanel):void {
    current.webview.options={enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media')]};
    current.webview.html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\';"></head><body><p>Reading project references…</p></body></html>';
    current.onDidDispose(()=>{if(panel===current){panel=undefined;generation++;if(timer)clearTimeout(timer);}},null,context.subscriptions);
    current.webview.onDidReceiveMessage(async message=>{
      if(!message||typeof message!=='object')return;
      try {
        if(message.type==='state'&&message.state&&typeof message.state==='object'&&JSON.stringify(message.state).length<20000){await context.workspaceState.update(stateKey,message.state);}
        else if(message.type==='refresh'){await refresh();}
        else if(message.type==='openProject'&&typeof message.uri==='string'){
          const node=data?.nodes.find(n=>n.uri===message.uri);
          if(node)await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.parse(node.uri)),{preview:true,viewColumn:vscode.ViewColumn.Beside});
        }else if(message.type==='export'&&typeof message.svg==='string'&&message.svg.length<10_000_000&&message.svg.startsWith('<svg')){
          const destination=await vscode.window.showSaveDialog({title:'Export dependency graph',filters:{SVG:['svg']},saveLabel:'Export SVG'});
          if(destination)await vscode.workspace.fs.writeFile(destination,Buffer.from(message.svg,'utf8'));
        }
      }catch(error){void vscode.window.showErrorMessage(`Dependency Explorer: ${String(error)}`);}
    },null,context.subscriptions);
  }
  context.subscriptions.push(vscode.commands.registerCommand('dotnetDependencyExplorer.open',async (uri?:vscode.Uri)=>{
    if(!vscode.workspace.workspaceFolders?.length){void vscode.window.showInformationMessage('Open a folder containing .NET projects first.');return;}
    if(!panel){panel=vscode.window.createWebviewPanel(viewType,'.NET Project Dependencies',vscode.ViewColumn.Active,{enableScripts:true,retainContextWhenHidden:true});connect(panel);}
    panel.reveal();await refresh(uri instanceof vscode.Uri?canonical(uri):undefined);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('dotnetDependencyExplorer.refresh',()=>panel?refresh():vscode.commands.executeCommand('dotnetDependencyExplorer.open')));
  const watcher=vscode.workspace.createFileSystemWatcher('**/*.csproj');
  const schedule=()=>{if(!panel)return;if(timer)clearTimeout(timer);timer=setTimeout(()=>{void refresh();},450);};
  context.subscriptions.push(watcher,watcher.onDidCreate(schedule),watcher.onDidChange(schedule),watcher.onDidDelete(schedule),vscode.workspace.onDidChangeWorkspaceFolders(schedule));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event=>{if(event.affectsConfiguration('dotnetDependencyExplorer'))schedule();}));
  context.subscriptions.push({dispose:()=>{if(timer)clearTimeout(timer);}});
  context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(viewType,{async deserializeWebviewPanel(restored,state){
    panel=restored;connect(restored);if(state&&typeof state==='object')await context.workspaceState.update(stateKey,state);await refresh();
  }}));
}
