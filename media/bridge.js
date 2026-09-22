const vscodeApi=typeof acquireVsCodeApi==='function'?acquireVsCodeApi():null;
const controlIds=['mode','domain','search','tests','cycles','direction','depth','reduce','layout','neighbors','cytoLayout'];
let restoring=true;
function saveView(){
    if(restoring||!vscodeApi)return;
    const state={selectedUri:selected===null?null:D.nodes[selected]?.uri,scale,pan:{...graphPan},controlsCollapsed:document.querySelector('header').classList.contains('collapsed'),detailsCollapsed:document.querySelector('main').classList.contains('narrow'),controls:Object.fromEntries(controlIds.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),scrollLeft:($('graphViewport')||$('canvas')).scrollLeft,scrollTop:($('graphViewport')||$('canvas')).scrollTop};
    vscodeApi.setState(state);vscodeApi.postMessage({type:'state',state});
}
const baseSidebar=sidebar;
sidebar=function(){baseSidebar();if(selected!==null&&vscodeApi){const button=text('button','Open .csproj',$('details'));button.id='openProject';button.onclick=()=>vscodeApi.postMessage({type:'openProject',uri:D.nodes[selected].uri});}};
const baseRender=render;
render=function(){baseRender();saveView();};
const baseSetControlsCollapsed=setControlsCollapsed;
setControlsCollapsed=function(collapsed){baseSetControlsCollapsed(collapsed);saveView();};
const baseSetDetailsCollapsed=setDetailsCollapsed;
setDetailsCollapsed=function(collapsed){baseSetDetailsCollapsed(collapsed);saveView();};
const baseZoom=zoom;
zoom=function(){baseZoom();saveView();};
$('refresh').onclick=()=>{saveView();if(vscodeApi)vscodeApi.postMessage({type:'refresh'});else window.location.reload();};
$('export').onclick=()=>{if(!$('graph'))return;const svg=serializeGraph();if(vscodeApi)vscodeApi.postMessage({type:'export',svg});};
// Webviews cannot download through an anchor, so the host writes the file.
const browserSaveGraphImage=saveGraphImage;
saveGraphImage=function(dataUri){if(vscodeApi)vscodeApi.postMessage({type:'exportPng',png:dataUri});else browserSaveGraphImage(dataUri);};
const state=window.initialState||vscodeApi?.getState()||{};
for(const id of controlIds){const value=state.controls?.[id];if(value!==undefined){if($(id).type==='checkbox')$(id).checked=Boolean(value);else $(id).value=String(value);}}
setControlsCollapsed(Boolean(state.controlsCollapsed));
setDetailsCollapsed(Boolean(state.detailsCollapsed));
const savedNode=D.nodes.find(n=>n.uri===state.selectedUri);
selected=savedNode?.id??null;
if(savedNode?.test)$('tests').checked=true;
graphPan={x:Number.isFinite(state.pan?.x)?state.pan.x:0,y:Number.isFinite(state.pan?.y)?state.pan.y:0};
scale=typeof state.scale==='number'?Math.max(0.15,Math.min(3,state.scale)):1;
render();
($('graphViewport')||$('canvas')).scrollLeft=Number(state.scrollLeft)||0;($('graphViewport')||$('canvas')).scrollTop=Number(state.scrollTop)||0;
restoring=false;saveView();
$('canvas').addEventListener('graphpanchange',saveView);
$('canvas').addEventListener('scroll',saveView,{passive:true,capture:true});
if(D.diagnostics?.length){text('p',`${D.diagnostics.length} project file(s) could not be analyzed.`, $('warnings'));for(const issue of D.diagnostics)text('p',issue,$('warnings'));}
for(const item of D.unresolved||[])text('p',`${item.project}: ${item.reference}`,$('warnings'));
