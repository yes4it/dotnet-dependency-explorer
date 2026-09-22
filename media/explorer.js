const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
const domains = [...new Set(D.nodes.map(n => n.domain))].sort();
const palette = ['#78b6ff','#e8b87b','#b69aff','#79dac2','#f58ba8','#afca78','#91c8d5','#d6a5cc','#e2ce8b','#9eaaff','#e69b77'];
const color = d => palette[domains.indexOf(d) % palette.length];
let selected = null, scale = 1, size = {width:1000,height:600};
let graphPan={x:0,y:0};
document.querySelector('header').innerHTML = `<h1>.NET Dependency Explorer</h1><div id="status"></div><button id="toggleControls" class="icon-button" type="button" aria-expanded="true" aria-controls="controls" title="Hide filters and options" aria-label="Hide filters and options"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg></button>
<div id="controls">
<nav><button id="refresh" class="icon-button" title="Refresh project dependencies" aria-label="Refresh project dependencies"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg></button><label>View <select id="mode"><option value="domains">Domains</option><option value="graph">Project graph</option><option value="cytoscape">Cytoscape graph</option><option value="matrix">Project matrix</option></select></label><label>Domain <select id="domain"><option value="">All</option></select></label><input id="search" placeholder="Search projects…" aria-label="Search projects"><label><input id="tests" type="checkbox"> Tests</label><label><input id="cycles" type="checkbox"> Cycles only</label><button id="reset">Reset</button></nav>
<nav id="graphOptions"><label>Layout <select id="layout"><option value="focus">Project focus</option><option value="levels">By level</option></select></label><label id="neighborsOption"><input id="neighbors" type="checkbox"> Relations between neighbors</label><label>Explore <select id="direction"><option value="both">Both directions</option><option value="out">Dependencies</option><option value="in">Used by</option></select></label><label>Depth <select id="depth"><option value="1">1 hop</option><option value="2">2 hops</option><option value="99">Transitive</option></select></label><label title="Hide A → C when another visible path connects A to C."><input id="reduce" type="checkbox"> Hide redundant links</label><button id="fit">Fit</button><button id="minus" aria-label="Zoom out">−</button><output id="zoomLevel" aria-live="polite">100%</output><button id="plus" aria-label="Zoom in">+</button><button id="export">Export SVG</button></nav>
<nav id="cytoOptions"><label title="How the canvas arranges projects. Each layout answers a different question.">Cytoscape layout <select id="cytoLayout"></select></label><button id="cytoRelayout" title="Compute the layout again from scratch. Force-directed produces a different arrangement each time.">Re-run layout</button><button id="cytoFit" title="Zoom and centre so every visible project fits the viewport.">Fit</button><button id="cytoMinus" aria-label="Zoom out">−</button><output id="cytoZoom" aria-live="polite">100%</output><button id="cytoPlus" aria-label="Zoom in">+</button><button id="cytoFocus" title="Open the selected project in the three-column focus view.">Open focus view</button><button id="cytoPng" title="Save the whole graph as a PNG image, not only the visible part.">Export PNG</button></nav>
</div>`;
$('canvas').innerHTML = '<div id="count" aria-live="polite"></div><div id="content"></div>';
document.querySelector('aside').innerHTML = `<div id="detailsBar"><button id="toggleDetails" class="icon-button" type="button" aria-expanded="true" title="Hide the details panel" aria-label="Hide the details panel"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg></button></div><section id="architecture"></section><h2 id="detailTitle">Most referenced projects</h2><div id="details"></div><details><summary>How to read this view</summary><p>A → B means A references B. Blue: a dependency of the selected project. Green: a project that uses it. Red: an edge in a project cycle. Dashed orange: a redundant reference because another path exists in the filtered view. It is still a real project reference.</p><p>Labels show complete project names unless you configure label prefixes. Hover a card or open its details for the full name.</p><p>Domains are inferred from project names. Reciprocal domain relationships do not prove that individual projects form a cycle.</p><p>Declared ProjectReference items across the open workspace. MSBuild conditions and imported files are not evaluated. NuGet, classes, namespaces and network calls are outside this analysis.</p><div id="warnings"></div></details>`;
const style = document.createElement('style');
style.textContent = `.icon-button{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;padding:7px;flex-shrink:0}.icon-button svg{pointer-events:none}#canvas:has(#graph){cursor:grab}#canvas.panning,#canvas.panning *{cursor:grabbing!important;user-select:none!important}#graph{touch-action:none;transform-origin:0 0}body{height:100vh;display:flex;flex-direction:column}header{padding:18px 24px}main{flex:1;height:auto;min-height:0}#canvas{padding:18px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.card{text-align:left;padding:20px;min-height:130px;border-top:4px solid var(--color)}.card strong{display:block;font-size:18px;margin-bottom:12px}.card span{display:block;color:#b5c2d6;margin-top:8px}#detailTitle{overflow-wrap:anywhere}#count{padding-bottom:14px;color:#b5c2d6}table{border-collapse:collapse;font-size:12px}th,td{padding:8px;border:1px solid #344156;text-align:center}th{background:#202f45}th:first-child{text-align:left;position:sticky;left:0;min-width:230px}td button{padding:5px;min-width:30px;background:transparent;border:0}details{margin-top:24px}summary{cursor:pointer}button:hover{border-color:#83e0b7}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #83e0b7}@media(max-width:900px){main{grid-template-columns:minmax(0,1fr) 250px}}`;
style.textContent+="#canvas:has(#graph){display:flex;flex-direction:column;overflow:hidden;cursor:auto}#content:has(#graph){display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}#content:has(#graph)>p,#content:has(#graph)>button{flex-shrink:0}#graphViewport{position:relative;isolation:isolate;contain:paint;overflow:auto;flex:1;min-height:100px;border:1px solid #344156;border-radius:8px;cursor:grab;background:#101827}#graphViewport #graph{position:relative}#edgeInfo{position:static!important;z-index:auto!important} ";
style.textContent+="#detailsBar{text-align:right;margin-bottom:4px}main.narrow{grid-template-columns:minmax(0,1fr) 44px}main.narrow aside{padding:12px 5px}main.narrow aside>*:not(#detailsBar){display:none}main.narrow #detailsBar{text-align:center;margin:0}#toggleDetails svg{transition:transform .15s;transform:rotate(90deg)}main.narrow #toggleDetails svg{transform:rotate(-90deg)}";
style.textContent+="#scale{position:fixed;inset:0;z-index:10;display:flex;align-items:flex-start;justify-content:center;padding:36px 20px;overflow:auto;background:rgba(9,14,24,.74)}#scale[hidden]{display:none}#scaleCard{position:relative;width:min(760px,100%);padding:26px 30px 24px;border:1px solid #52637d;border-radius:12px;background:#16233a}#scaleClose{position:absolute;top:13px;right:13px;width:32px;height:32px;padding:0;font-size:17px;line-height:1}#gauge{position:relative;height:8px;margin:18px 0 6px;border-radius:999px;background:#202f45}#gaugeMark{position:absolute;top:-4px;width:4px;height:16px;border-radius:2px;background:currentColor}.rung{display:grid;grid-template-columns:130px 1fr auto;gap:14px;align-items:baseline;padding:9px 10px;border-radius:8px}.rung.current{background:#1d2e47;outline:1px solid var(--color)}.rung b{color:var(--color)}.rung small{color:#b5c2d6;line-height:1.4}.rung .measured{text-align:right}.move{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:baseline;padding:11px 10px;border-top:1px solid #344156}.move strong{display:block}.move small,.move div small{color:#b5c2d6}.gain{color:#83e0b7;font-size:17px;font-weight:700;text-align:right}#scaleCard h2{font-size:12px;margin:22px 0 8px;color:#b5c2d6;text-transform:uppercase;letter-spacing:.05em}";
style.textContent+="#pastaBadge{display:inline-block;margin-right:12px;padding:2px 10px;border:1px solid;border-radius:999px;font:inherit;font-weight:600;background:none;cursor:pointer}#architecture{margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #344156}.pasta{display:flex;align-items:center;gap:14px}.pastaScore{flex:none;width:auto;min-width:58px;padding:7px 12px;border:2px solid;border-radius:10px;text-align:center;font-size:25px;font-weight:700;line-height:1.1;background:none}button.pastaScore{cursor:pointer}.pasta div{min-width:0}#whyGrade{margin:12px 0 0}#whyGrade summary{color:#b5c2d6;font-size:13px}.pasta strong{display:block;font-size:17px}.pasta small{color:#b5c2d6}#architecture h2{font-size:12px;margin:17px 0 6px;color:#b5c2d6;text-transform:uppercase;letter-spacing:.05em}#architecture ul{margin:0;padding-left:18px}#architecture li{margin:5px 0;line-height:1.45}#architecture li b{color:#f5b454}#architecture>small{display:block;margin-top:14px;line-height:1.45}";
style.textContent+="header{position:relative}#toggleControls{position:absolute;top:14px;right:24px}#toggleControls svg{transition:transform .15s}header.collapsed{padding:8px 24px}header.collapsed h1{display:none}header.collapsed #controls{display:none}header.collapsed #status{padding-right:44px}header.collapsed #toggleControls{top:5px}header.collapsed #toggleControls svg{transform:rotate(180deg)}";
document.head.append(style);
for (const d of domains) {const o=document.createElement('option');o.value=d;o.textContent=d;$('domain').append(o);}
for (const [value,name,help] of cytoscapeLayouts) {const o=document.createElement('option');o.value=value;o.textContent=name;o.title=help;$('cytoLayout').append(o);}
const layoutHelp=new Map(cytoscapeLayouts.map(([value,,help])=>[value,help]));
function describeCytoLayout(){$('cytoLayout').title=layoutHelp.get($('cytoLayout').value)||'';}
const percent=value=>Math.round(value*100)+'%';
$('status').replaceChildren();
if(D.metrics&&D.metrics.graded){
    const badge=text('button',`${D.metrics.shape.emoji} ${D.metrics.score} · ${D.metrics.shape.name}`,$('status'));
    badge.id='pastaBadge';badge.style.color=D.metrics.shape.color;badge.style.borderColor=D.metrics.shape.color;
    badge.title='Open the pasta scale: every shape, the rule behind it and what your graph measures against it.';
    badge.onclick=()=>toggleScale(true);
}
text('span',`${D.nodes.length} projects · ${D.edges.length} references · ${D.cycles.length} project cycle group(s)`,$('status'));
$('warnings').textContent = D.unresolved.length ? `${D.unresolved.length} unresolved project references (missing files or unevaluated expressions).` : 'All project references were resolved.';
// The scale is the answer to "what are the other levels": every rung, the rule
// behind it, and what this graph measures against that rule. The moves below it
// are priced by replaying the score, so none of the figures is an estimate.
function scalePanel(){
    const m=D.metrics,box=$('scaleCard');if(!m)return;
    box.replaceChildren();
    const close=text('button','×',box);close.id='scaleClose';
    close.title='Close';close.setAttribute('aria-label','Close the pasta scale');
    close.onclick=()=>toggleScale(false);
    const head=text('div','',box);head.className='pasta';
    const score=text('div',m.graded?String(m.score):'—',head);
    score.className='pastaScore';score.style.borderColor=m.shape.color;score.style.color=m.shape.color;
    const title=text('div','',head);
    text('strong',`${m.shape.emoji} ${m.shape.name}`,title).style.color=m.shape.color;
    text('small',m.shape.summary,title);
    if(m.graded){
        const gauge=text('div','',box);gauge.id='gauge';
        const mark=text('div','',gauge);mark.id='gaugeMark';
        mark.style.left=`calc(${Math.max(0,Math.min(100,m.score))}% - 2px)`;mark.style.color=m.shape.color;
        text('small','0 means everything reaches everything. 100 means no cycle, no redundant reference, and a change that stays where you put it.',box);
    }
    text('h2','Where you sit on the scale',box);
    for(const rung of m.scale){
        const row=text('div','',box);row.className='rung'+(rung.current?' current':'');
        row.style.setProperty('--color',rung.color);
        text('b',`${rung.emoji} ${rung.name}`,row);
        text('small',rung.rule,row);
        text('small',rung.measured,row).className='measured';
    }
    text('small','The first rule that matches wins, so a cycle always outranks anything else the same graph would satisfy.',box);
    if(m.moves.length){
        text('h2','What the next move is worth',box);
        for(const move of m.moves){
            const row=text('div','',box);row.className='move';
            const left=text('div','',row);text('strong',move.label,left);text('small',move.detail,left);
            const right=text('div','',row);
            text('div',`+${move.gain}`,right).className='gain';
            text('small',`${move.emoji} ${move.shape} · ${move.score}`,right);
        }
        text('small','Each figure is the score recomputed on the graph the change would leave behind, not a projection.',box);
    }
}
function toggleScale(open){
    const panel=$('scale');if(!panel)return;
    if(open)scalePanel();
    panel.hidden=!open;
    if(open)$('scaleClose').focus();else $('pastaBadge')?.focus();
}
function architecture(){
    const m=D.metrics,box=$('architecture');if(!box||!m)return;
    box.replaceChildren();
    const head=text('div','',box);head.className='pasta';
    const score=text('button',m.graded?String(m.score):'—',head);
    score.className='pastaScore';score.style.borderColor=m.shape.color;score.style.color=m.shape.color;
    score.title='Open the pasta scale. The score runs from 0 to 100: cycles weigh most, then how far a change travels, then references that duplicate an existing path.';
    score.onclick=()=>toggleScale(true);
    const title=text('div','',head);
    text('strong',`${m.shape.emoji} ${m.shape.name}`,title).style.color=m.shape.color;
    text('small','Pasta index',title);
    text('p',m.shape.summary,box);
    const why=text('details','',box);why.id='whyGrade';
    text('summary','Why this grade',why);
    if(m.drivers.length){
        text('h2','What costs you points',why);
        const list=text('ul','',why);
        for(const driver of m.drivers){const item=text('li',driver.label,list);text('b',` −${Math.round(driver.cost)}`,item);}
    }else if(m.graded)text('p','Nothing measurable is holding the score down.',why);
    text('h2','Next step',why);text('p',m.shape.advice,why);
    if(m.graded){
        text('h2','Shape',why);
        const facts=text('ul','',why);
        text('li',`Propagation cost ${percent(m.propagationCost)}: the share of the solution an average change can reach.`,facts);
        text('li',`${m.depth} dependency layer${m.depth>1?'s':''} deep.`,facts);
        if(m.modular)text('li',`Modularity ${m.modularity.toFixed(2)} against the declared domains: above 0.30 the domains are structural, at or below 0 the references ignore them.`,facts);
        if(m.hub)text('li',`Most referenced: ${m.hub}, used by ${percent(m.hubShare)} of the others.`,facts);
    }
    text('small',`Graded on ${m.projects} production project${m.projects>1?'s':''} across the whole workspace: test projects and the filters above are excluded. Project references only, so coupling through dependency injection, reflection or a shared database stays invisible.`,why);
}
function text(tag,value,parent){const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;}
function svgEl(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
function label(n){const prefix=(D.labelPrefixes||[]).find(p=>n.name.startsWith(p));return prefix?n.name.slice(prefix.length):n.name;}
// Breaks after a dot or before a camel-case hump, so a long namespace runs onto
// the next line instead of losing characters. Joining the lines restores the
// exact name; a segment is only cut when it alone is wider than one line.
function wrapLabel(value,max){
    const parts=value.split(/(?<=\.)|(?<=[a-z0-9])(?=[A-Z])/).filter(Boolean);
    const lines=[];let line='';
    for(let part of parts){
        while(part.length>max){if(line){lines.push(line);line='';}lines.push(part.slice(0,max));part=part.slice(max);}
        if(line&&line.length+part.length>max){lines.push(line);line='';}
        line+=part;
    }
    if(line)lines.push(line);
    return lines.length?lines:[value];
}
function choose(id){graphPan={x:0,y:0};selected=id;scale=1;$('layout').value='focus';$('depth').value='1';$('mode').value='graph';$('domain').value='';$('search').value='';$('cycles').checked=false;if(D.nodes[id].test)$('tests').checked=true;render();$('canvas').scrollTo(0,0);}
function baseNodes(){return D.nodes.filter(n=>($('tests').checked||!n.test)&&(!$('cycles').checked||n.cycle));}
function view(){
    let nodes=baseNodes();const valid=new Set(nodes.map(n=>n.id));
    const all=D.edges.filter(e=>valid.has(e.source)&&valid.has(e.target));
    if(selected!==null){const seen=new Set([selected]);let frontier=[selected];
        for(let step=0;step<Number($('depth').value)&&frontier.length;step++){
            const next=[];for(const id of frontier)for(const e of all){
                const target=e.source===id&&$('direction').value!=='in'?e.target:e.target===id&&$('direction').value!=='out'?e.source:null;
                if(target!==null&&!seen.has(target)){seen.add(target);next.push(target);}
            }frontier=next;
        }nodes=nodes.filter(n=>seen.has(n.id));
    }
    nodes=nodes.filter(n=>(!$('domain').value||n.domain===$('domain').value)&&n.name.toLowerCase().includes($('search').value.toLowerCase()));
    const ids=new Set(nodes.map(n=>n.id));return {nodes,edges:all.filter(e=>ids.has(e.source)&&ids.has(e.target))};
}
function reduced(edges){
    // Keep cycle edges; remove other edges sequentially so reachability is preserved.
    let kept=[...edges];
    for(const skip of edges){if(skip.cycle)continue;const seen=new Set([skip.source]),todo=[skip.source];let found=false;
        while(todo.length&&!found){const a=todo.pop();for(const e of kept){if(e===skip||e.source!==a)continue;if(e.target===skip.target){found=true;break;}if(!seen.has(e.target)){seen.add(e.target);todo.push(e.target);}}}
        if(found)kept=kept.filter(e=>e!==skip);
    }return kept;
}
function sidebar(){
    const box=$('details');box.replaceChildren();$('detailTitle').textContent=selected===null?'Most referenced projects':D.nodes[selected].name;
    function links(title,ids){text('h2',`${title} (${ids.length})`,box);for(const id of ids){const b=text('button',D.nodes[id].name,box);b.onclick=()=>choose(id);}}
    if(selected===null){const valid=new Set(baseNodes().map(n=>n.id));const ranking=baseNodes().map(n=>({n,count:D.edges.filter(e=>e.target===n.id&&valid.has(e.source)).length})).sort((a,b)=>b.count-a.count).slice(0,10);for(const {n,count}of ranking){const b=text('button',`${label(n)} · ${count} users`,box);b.title=n.name;b.onclick=()=>choose(n.id);}return;}
    const n=D.nodes[selected];text('p',n.path,box);text('p',n.domain,box);
    links('Depends on',D.edges.filter(e=>e.source===selected).map(e=>e.target));links('Used by',D.edges.filter(e=>e.target===selected).map(e=>e.source));text('small','Complete lists, independent of graph filters.',box);
}
function overview(nodes,edges){
    const cards=text('div','',$('content'));cards.className='cards';
    for(const d of domains){const members=nodes.filter(n=>n.domain===d);if(!members.length)continue;const ids=new Set(members.map(n=>n.id));const internal=edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).length;const outgoing=edges.filter(e=>ids.has(e.source)&&!ids.has(e.target));const targets=[...new Set(outgoing.map(e=>D.nodes[e.target].domain))];
        const b=text('button','',cards);b.className='card';b.style.setProperty('--color',color(d));text('strong',d,b);text('span',`${members.length} projects · ${internal} internal links`,b);text('span',`${outgoing.length} references to ${targets.length} other domains`,b);b.title=targets.join(', ');b.onclick=()=>{selected=null;$('domain').value=d;$('mode').value='graph';render();$('canvas').scrollTo(0,0);};
    }text('p','Open a domain, then select a project to explore its external dependencies too. Counts respect the active filters.',$('content'));
}
function matrix(nodes,edges){
    nodes=[...nodes].sort((a,b)=>a.domain.localeCompare(b.domain)||a.name.localeCompare(b.name));const table=text('table','',$('content'));const head=text('tr','',text('thead','',table));text('th','Row → column',head);nodes.forEach((n,i)=>{const h=text('th',String(i+1),head);h.title=n.name;});const pairs=new Map(edges.map(e=>[`${e.source}:${e.target}`,e]));const body=text('tbody','',table);
    nodes.forEach((n,i)=>{const row=text('tr','',body);const h=text('th',`${i+1}. ${label(n)}`,row);h.title=n.name;h.style.borderLeft=`4px solid ${color(n.domain)}`;for(const m of nodes){const cell=text('td','',row),edge=pairs.get(`${n.id}:${m.id}`);if(edge){cell.style.background=edge.cycle?'#763544':edge.redundant?'#65451f':'#244965';const b=text('button','●',cell);b.title=`${n.name} → ${m.name}`;b.onclick=()=>choose(n.id);}else if(n.id===m.id)cell.textContent='—';}});
}
// Cards share aligned rows (76 px pitch, 56 px height). Route long links
// through the 20 px gaps and vertical gutters; never through another card.
function roundedRoute(points, radius=4){
    let d=`M${points[0].x} ${points[0].y}`;
    for(let i=1;i<points.length-1;i++){
        const previous=points[i-1],corner=points[i],next=points[i+1];
        const before=Math.hypot(corner.x-previous.x,corner.y-previous.y);
        const after=Math.hypot(next.x-corner.x,next.y-corner.y);
        if(!before||!after)continue;
        const r=Math.min(radius,before/2,after/2);
        const enter={x:corner.x+(previous.x-corner.x)*r/before,y:corner.y+(previous.y-corner.y)*r/before};
        const leave={x:corner.x+(next.x-corner.x)*r/after,y:corner.y+(next.y-corner.y)*r/after};
        d+=` L${enter.x} ${enter.y} Q${corner.x} ${corner.y} ${leave.x} ${leave.y}`;
    }
    const end=points[points.length-1];return d+` L${end.x} ${end.y}`;
}
function routeEdge(a,b,seed=0){
    const start={x:a.x+320,y:a.y+27};
    const lane=((seed%5)+5)%5;
    if(a.x===b.x){
        // Same-level edges and self-loops enter the right side as well.
        const end={x:b.x+320,y:b.y+(a.y===b.y?43:27)};
        const rail=start.x+24+lane*6;
        return roundedRoute([start,{x:rail,y:start.y},{x:rail,y:end.y},end]);
    }
    const end={x:b.x,y:b.y+27};
    if(b.x-a.x===400){
        // Adjacent levels have no intervening cards: keep the simple curve.
        return `M${start.x} ${start.y} C${start.x+40} ${start.y},${end.x-40} ${end.y},${end.x} ${end.y}`;
    }
    // The midpoint gap minimizes vertical travel; small lane offsets separate links.
    const middle=(start.y+end.y)/2;
    const gap=126+76*Math.max(-1,Math.round((middle-126)/76))+(lane-2)*2;
    const exitX=start.x+20+lane*5,entryX=end.x-20-lane*5;
    return roundedRoute([start,{x:exitX,y:start.y},{x:exitX,y:gap},
        {x:entryX,y:gap},{x:entryX,y:end.y},end]);
}
function graphViewport(){const viewport=text('div','',$('content'));viewport.id='graphViewport';viewport.setAttribute('aria-label','Dependency graph canvas');return viewport;}
function graph(nodes,edges){
    const svg=svgEl('svg',{id:'graph',xmlns:NS},graphViewport());svg.style.background='#101827';const defs=svgEl('defs',{},svg);
    const colors={normal:'#7186a6',out:'#78b6ff',in:'#79dac2',cycle:'#ff667a',redundant:'#f5b454'};
    for(const [id,c]of Object.entries(colors)){const m=svgEl('marker',{id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},defs);svgEl('path',{d:'M0 0 L10 5 L0 10z',fill:c},m);}
    const levels=[...new Set(nodes.map(n=>n.level))].sort((a,b)=>b-a);const columns=levels.map(l=>nodes.filter(n=>n.level===l).sort((a,b)=>a.name.localeCompare(b.name)));const row=new Map();columns.forEach(col=>col.forEach((n,i)=>row.set(n.id,i)));
    // Barycentric sweeps reduce crossings without an external layout library.
    for(let pass=0;pass<6;pass++){const order=pass%2?[...columns].reverse():columns;for(const col of order){const score=n=>{const neighbors=edges.filter(e=>e.source===n.id||e.target===n.id).map(e=>row.get(e.source===n.id?e.target:e.source));return neighbors.length?neighbors.reduce((a,b)=>a+b,0)/neighbors.length:row.get(n.id);};const scores=new Map(col.map(n=>[n.id,score(n)]));col.sort((a,b)=>scores.get(a.id)-scores.get(b.id)||a.name.localeCompare(b.name));col.forEach((n,i)=>row.set(n.id,i));}}
    const pos=new Map();columns.forEach((col,c)=>col.forEach((n,r)=>pos.set(n.id,{x:25+c*400,y:60+r*76})));size={width:Math.max(600,columns.length*400+20),height:Math.max(300,Math.max(0,...columns.map(c=>c.length))*76+100)};svg.setAttribute('viewBox',`0 0 ${size.width} ${size.height}`);
    columns.forEach((col,c)=>svgEl('text',{x:25+c*400,y:28,fill:'#b5c2d6','font-family':'system-ui','font-size':13},svg).textContent=levels[c]===0?'Foundations':`Level ${levels[c]}`);
    const paths=[];for(const e of edges){const a=pos.get(e.source),b=pos.get(e.target);const kind=e.cycle?'cycle':e.redundant?'redundant':e.source===selected?'out':e.target===selected?'in':'normal';const d=routeEdge(a,b,e.source*31+e.target);const opacity=kind==='normal'?0.45:0.95;const path=svgEl('path',{d,fill:'none',stroke:colors[kind],'stroke-width':kind==='normal'?1.3:2,opacity,'marker-end':`url(#${kind})`,'stroke-linejoin':'round','stroke-linecap':'round','stroke-dasharray':e.redundant&&!e.cycle?'7 5':'none','data-redundant':Boolean(e.redundant)},svg);svgEl('title',{},path).textContent=`${D.nodes[e.source].name} → ${D.nodes[e.target].name}`;paths.push({path,e,opacity});}
    for(const n of nodes){const p=pos.get(n.id),g=svgEl('g',{class:'node',tabindex:0,role:'button','aria-label':n.name},svg);g.onclick=()=>choose(n.id);g.onkeydown=e=>{if(e.key==='Enter')choose(n.id);};g.onmouseenter=()=>paths.forEach(({path,e})=>path.setAttribute('opacity',e.source===n.id||e.target===n.id?1:0.06));g.onmouseleave=()=>paths.forEach(({path,opacity})=>path.setAttribute('opacity',opacity));svgEl('title',{},g).textContent=n.name;svgEl('rect',{x:p.x,y:p.y,width:320,height:56,rx:8,fill:n.id===selected?'#195475':'#202f45',stroke:n.cycle?'#ff667a':color(n.domain),'stroke-width':n.id===selected?3:1.3},g);const lines=wrapLabel(label(n),38),shown=lines.slice(0,2);if(lines.length>2)shown[1]=shown[1].slice(0,35)+'\u2026';const top=shown.length>1?14:23;shown.forEach((line,i)=>svgEl('text',{x:p.x+12,y:p.y+top+i*16,fill:'#eef4ff','font-family':'system-ui','font-size':14},g).textContent=line);svgEl('text',{x:p.x+12,y:p.y+43,fill:color(n.domain),'font-family':'system-ui','font-size':13},g).textContent=n.domain;}zoom();
}
function zoom(){applyGraphPan();if($('zoomLevel'))$('zoomLevel').textContent=Math.round(scale*100)+'%';const svg=$('graph');if(svg){svg.setAttribute('width',size.width*scale);svg.setAttribute('height',size.height*scale);}}
function fit(){graphPan={x:0,y:0};scale=Math.max(0.15,Math.min(1,(($('graphViewport')||$('canvas')).clientWidth-20)/size.width));zoom();$('graphViewport')?.scrollTo(0,0);$('canvas').scrollTo(0,0);}
function render(){
    const cytoGraph=$('mode').value==='cytoscape';
    const focused=!cytoGraph&&selected!==null&&$('layout').value==='focus';
    if(focused)$('depth').value='1';
    $('depth').disabled=focused;$('neighborsOption').style.display=focused?'':'none';
    // The canvas renderer brings its own layout, zoom and export controls.
    for(const el of [$('layout').closest('label'),$('fit'),$('minus'),$('zoomLevel'),$('plus'),$('export')])el.style.display=cytoGraph?'none':'';
    const {nodes,edges}=view(),mode=$('mode').value;
    destroyCytoscape();
    $('content').replaceChildren();$('graphOptions').style.display=(mode==='graph'||cytoGraph)?'flex':'none';
    $('cytoOptions').style.display=cytoGraph?'flex':'none';describeCytoLayout();
    const kept=new Set(mode==='domains'?edges:reduced(edges));
    const marked=edges.map(e=>({...e,redundant:!kept.has(e)}));
    const redundantCount=marked.filter(e=>e.redundant).length;
    const hidden=(mode==='graph'||cytoGraph)&&$('reduce').checked;
    const drawn=hidden?marked.filter(e=>!e.redundant):marked;
    $('count').textContent=`${nodes.length} visible projects · ${edges.length} references${mode!=='domains'?` · ${redundantCount} redundant links ${hidden?'hidden':'in orange'}`:''}${selected!==null?` · Focus : ${D.nodes[selected].name}`:''}`;
    if(mode!=='domains'){
        const legend=text('p','',$('content'));
        const key=text('span','Orange: redundant reference',legend);
        key.style.color='#f5b454';
        if(mode==='graph'||cytoGraph)key.textContent='Dashed orange: redundant reference · other colors: standard reference or cycle';
    }
    if(cytoGraph)text('p','Canvas view: drag to pan, scroll to zoom, drag a project to move it. Click a project to filter around it, click the background to clear. Hover for full names.',$('content'));
    if(!nodes.length)text('p','No projects match these filters.',$('content'));
    else if(mode==='domains')overview(nodes,edges);
    else if(mode==='matrix')matrix(nodes,marked);
    else if(cytoGraph)cytoscapeGraph(nodes,drawn);
    else if(focused)focusGraph(nodes,drawn);
    else graph(nodes,drawn);
    sidebar();
}
for(const id of ['search','tests','cycles','direction','depth','reduce','layout','neighbors','cytoLayout'])$(id).oninput=render;
$('domain').onchange=()=>{selected=null;render();$('canvas').scrollTo(0,0);};$('mode').onchange=()=>{selected=null;render();$('canvas').scrollTo(0,0);};
$('reset').onclick=()=>{graphPan={x:0,y:0};cytoscapeMemo=null;selected=null;$('search').value='';$('domain').value='';$('cycles').checked=false;$('tests').checked=false;$('mode').value='domains';$('direction').value='both';$('depth').value='1';$('reduce').checked=false;$('layout').value='focus';$('neighbors').checked=false;$('cytoLayout').value='levels';scale=1;render();};
$('refresh').onclick=()=>window.location.reload();
// The toolbars cost three rows; collapsing them gives the height back to the graph.
function setControlsCollapsed(collapsed){
    document.querySelector('header').classList.toggle('collapsed',collapsed);
    const label=collapsed?'Show filters and options':'Hide filters and options';
    $('toggleControls').setAttribute('aria-expanded',String(!collapsed));
    $('toggleControls').title=label;$('toggleControls').setAttribute('aria-label',label);
    resizeCytoscape();
}
$('toggleControls').onclick=()=>setControlsCollapsed(!document.querySelector('header').classList.contains('collapsed'));
function setDetailsCollapsed(collapsed){
    document.querySelector('main').classList.toggle('narrow',collapsed);
    const label=collapsed?'Show the details panel':'Hide the details panel';
    $('toggleDetails').setAttribute('aria-expanded',String(!collapsed));
    $('toggleDetails').title=label;$('toggleDetails').setAttribute('aria-label',label);
    resizeCytoscape();
}
$('toggleDetails').onclick=()=>setDetailsCollapsed(!document.querySelector('main').classList.contains('narrow'));
document.body.insertAdjacentHTML('beforeend','<div id="scale" hidden><div id="scaleCard" role="dialog" aria-modal="true" aria-label="Pasta index scale"></div></div>');
$('scale').onclick=event=>{if(event.target===$('scale'))toggleScale(false);};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('scale').hidden)toggleScale(false);});
$('fit').onclick=fit;$('plus').onclick=()=>{scale=Math.min(3,scale+0.15);zoom();};$('minus').onclick=()=>{scale=Math.max(0.15,scale-0.15);zoom();};
$('export').onclick=()=>{if(!$('graph'))return;const blob=new Blob([serializeGraph()],{type:'image/svg+xml'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dotnet-dependencies.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
function applyGraphPan(){const svg=$('graph');if(svg)svg.style.transform=`translate(${graphPan.x}px, ${graphPan.y}px)`;}
function serializeGraph(){const clone=$('graph').cloneNode(true);clone.style.removeProperty('transform');return new XMLSerializer().serializeToString(clone);}
let drag=null,suppressPanClick=false;
const panCanvas=$('canvas');
panCanvas.addEventListener('pointerdown',event=>{
    const viewport=$('graphViewport');if(!viewport||!viewport.contains(event.target)||![0,1].includes(event.button))return;
    if(event.button===0&&event.target.closest('.node,[data-edge],[role="button"],a,button'))return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:{...graphPan},moved:false};
    event.preventDefault();panCanvas.classList.add('panning');
    try{panCanvas.setPointerCapture(event.pointerId);}catch{}
});
panCanvas.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)<4)return;
    drag.moved=true;graphPan={x:drag.start.x+dx,y:drag.start.y+dy};applyGraphPan();event.preventDefault();
});
function finishPan(event){
    if(!drag||drag.id!==event.pointerId)return;
    suppressPanClick=drag.moved;drag=null;panCanvas.dispatchEvent(new Event('graphpanchange'));panCanvas.classList.remove('panning');
    if(panCanvas.hasPointerCapture(event.pointerId))panCanvas.releasePointerCapture(event.pointerId);
    setTimeout(()=>{suppressPanClick=false;},0);
}
for(const type of ['pointerup','pointercancel','lostpointercapture'])panCanvas.addEventListener(type,finishPan);
panCanvas.addEventListener('click',event=>{if(suppressPanClick){event.preventDefault();event.stopImmediatePropagation();}},true);
panCanvas.addEventListener('auxclick',event=>{if(event.button===1&&$('graph')?.contains(event.target))event.preventDefault();});
architecture();
render();
