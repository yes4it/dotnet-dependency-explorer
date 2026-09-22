// Cytoscape view. The SVG views own routing and print-quality export; this one
// renders to canvas so large filtered graphs stay responsive, and it offers
// force-directed and tree layouts the hand-written geometry cannot produce.
// Third entry is the tooltip, shown on the option and on the closed select.
const cytoscapeLayouts = [
    ['levels', 'Levels (dependency order)',
        'Fixed columns by dependency level: applications on the left, foundation projects on the right. Same order as the level view, so both agree.'],
    ['cose', 'Force-directed',
        'Physics simulation: referenced projects attract, unrelated ones repel. Reveals clusters and loosely coupled groups. Slower on large graphs, and arranges differently on each run.'],
    ['breadthfirst', 'Breadth-first',
        'Hierarchical tree following the reference direction, one row per hop. Starts from the selected project when there is one.'],
    ['concentric', 'Concentric (most used at centre)',
        'Rings by number of users: the most referenced projects sit at the centre, the least used on the outer rings.'],
    ['circle', 'Circle',
        'Every project on a single circle. Shows all references at once on small graphs, but says nothing about structure.'],
    ['grid', 'Grid',
        'Even rows and columns, unrelated to the dependency structure. Predictable positions for reading long project names.'],
];
let cytoscapeInstance = null, cytoscapeSignature = '', cytoscapeMemo = null;
(function cytoscapeStyles(){
    const sheet=document.createElement('style');
    sheet.textContent=`#canvas:has(#cyViewport){display:flex;flex-direction:column;overflow:hidden}
#content:has(#cyViewport){display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
#content:has(#cyViewport)>p{flex-shrink:0}
#cyViewport{position:relative;flex:1;min-height:260px;border:1px solid #344156;border-radius:8px;background:#101827;overflow:hidden}
#cyTip{position:absolute;left:0;top:0;display:none;pointer-events:none;max-width:290px;padding:9px 11px;border-radius:6px;background:#0b1120;border:1px solid #52637d;color:#e8eef7;font-size:12px;line-height:1.45;overflow-wrap:anywhere;z-index:3}
#cyTip b{display:block;margin-bottom:4px;font-size:13px}
#cyTip span{display:block;color:#b5c2d6}`;
    document.head.append(sheet);
})();
// Reads the viewport while the instance is alive, then parks the toolbar, whose
// handlers would otherwise close over a dead instance.
function destroyCytoscape(){
    if(cytoscapeInstance){
        cytoscapeMemo={signature:cytoscapeSignature,zoom:cytoscapeInstance.zoom(),pan:cytoscapeInstance.pan()};
        cytoscapeInstance.destroy();cytoscapeInstance=null;
    }
    for(const id of ['cytoFit','cytoRelayout','cytoPng','cytoFocus']){
        const button=$(id);if(button){button.onclick=null;button.disabled=true;}
    }
    if($('cytoZoom'))$('cytoZoom').textContent='—';
}
// Collapsing the header resizes the viewport without a window resize event.
function resizeCytoscape(){if(cytoscapeInstance)cytoscapeInstance.resize();}
// Same barycentric sweeps as the SVG level view, so both agree on column order.
function cytoscapeLevelPositions(nodes,edges){
    const levels=[...new Set(nodes.map(n=>n.level))].sort((a,b)=>b-a);
    const columns=levels.map(l=>nodes.filter(n=>n.level===l).sort((a,b)=>a.name.localeCompare(b.name)));
    const row=new Map();columns.forEach(col=>col.forEach((n,i)=>row.set(n.id,i)));
    for(let pass=0;pass<6;pass++){
        for(const col of pass%2?[...columns].reverse():columns){
            const score=n=>{
                const neighbors=edges.filter(e=>e.source===n.id||e.target===n.id)
                    .map(e=>row.get(e.source===n.id?e.target:e.source)).filter(v=>v!==undefined);
                return neighbors.length?neighbors.reduce((a,b)=>a+b,0)/neighbors.length:row.get(n.id);
            };
            const scores=new Map(col.map(n=>[n.id,score(n)]));
            col.sort((a,b)=>scores.get(a.id)-scores.get(b.id)||a.name.localeCompare(b.name));
            col.forEach((n,i)=>row.set(n.id,i));
        }
    }
    const positions=new Map();
    columns.forEach((col,c)=>col.forEach((n,r)=>positions.set(n.id,{x:c*300,y:r*80})));
    return positions;
}
// Overridden by the VS Code bridge, where anchor downloads are unavailable.
function saveGraphImage(dataUri){
    const a=document.createElement('a');a.href=dataUri;a.download='bamboo-dependencies.png';a.click();
}
function cytoscapeGraph(nodes,edges){
    destroyCytoscape();
    const viewport=text('div','',$('content'));viewport.id='cyViewport';
    viewport.setAttribute('aria-label','Cytoscape dependency graph');
    if(typeof cytoscape!=='function'){text('p','The Cytoscape library is not loaded; use another view.',$('content'));return;}
    const tip=text('div','',viewport);tip.id='cyTip';
    const byId=new Map(nodes.map(n=>[n.id,n]));
    const colors={normal:'#7186a6',out:'#78b6ff',in:'#79dac2',cycle:'#ff667a',redundant:'#f5b454'};
    const key=id=>`n${id}`, idOf=node=>Number(node.id().slice(1));
    const elements=[
        ...nodes.map(n=>{const lines=wrapLabel(label(n),22);
            return {data:{id:key(n.id),label:lines.join('\n'),height:Math.max(46,lines.length*15+18),
                border:n.cycle?'#ff667a':color(n.domain)},classes:n.id===selected?'chosen':''};}),
        ...edges.map(e=>({data:{id:`e${e.source}_${e.target}`,source:key(e.source),target:key(e.target),
            color:colors[e.cycle?'cycle':e.redundant?'redundant':e.source===selected?'out':e.target===selected?'in':'normal'],
            redundant:e.redundant?1:0},
            classes:e.cycle||e.redundant||e.source===selected||e.target===selected?'primary':''})),
    ];
    const style=[
        {selector:'node',style:{shape:'round-rectangle','background-color':'#202f45','border-color':'data(border)','border-width':1.4,
            label:'data(label)',color:'#eef4ff','font-family':'system-ui','font-size':11,'text-valign':'center','text-halign':'center',
            'text-wrap':'wrap','text-max-width':140,width:162,height:'data(height)'}},
        {selector:'node.chosen',style:{'background-color':'#195475','border-color':'#83e0b7','border-width':3}},
        {selector:'edge',style:{width:1.3,'line-color':'data(color)','target-arrow-color':'data(color)','target-arrow-shape':'triangle',
            'arrow-scale':0.85,'curve-style':'bezier',opacity:0.45}},
        {selector:'edge.primary',style:{width:2,opacity:0.9}},
        {selector:'edge[redundant = 1]',style:{'line-style':'dashed','line-dash-pattern':[7,5]}},
        {selector:'edge.highlighted',style:{width:3,opacity:1,'z-index':10}},
        {selector:'.faded',style:{opacity:0.07,'text-opacity':0.07}},
    ];
    // fit:false keeps the constructor layout from racing the real one below, which
    // would otherwise centre the viewport on nodes still stacked at the origin.
    const cy=cytoscape({container:viewport,elements,style,layout:{name:'preset',fit:false,animate:false},
        wheelSensitivity:0.25,minZoom:0.04,maxZoom:3,textureOnViewport:nodes.length>400});
    const signature=`${$('cytoLayout').value}|${nodes.map(n=>n.id).join(',')}|${edges.length}`;
    cytoscapeInstance=cy;cytoscapeSignature=signature;
    function options(name){
        const base={padding:40,animate:false};
        if(name==='levels'){const positions=cytoscapeLevelPositions(nodes,edges);
            return {...base,name:'preset',positions:node=>positions.get(idOf(node))||{x:0,y:0}};}
        // Repulsion is tuned for 160x46 cards: the cose defaults assume dots and pile them up.
        if(name==='cose')return {...base,name:'cose',nodeDimensionsIncludeLabels:true,idealEdgeLength:220,
            nodeRepulsion:1000000,nodeOverlap:32,edgeElasticity:100,gravity:40,componentSpacing:200,
            numIter:1500,randomize:true};
        if(name==='breadthfirst')return {...base,name:'breadthfirst',directed:true,spacingFactor:1.15,
            roots:selected!==null&&byId.has(selected)?`#${key(selected)}`:undefined};
        if(name==='concentric')return {...base,name:'concentric',concentric:node=>node.indegree(),
            levelWidth:()=>2,minNodeSpacing:26};
        return {...base,name,spacingFactor:1.1};
    }
    // A re-render caused by a filter change keeps the viewport when the graph is
    // unchanged, so selecting a project does not throw away the current zoom.
    function runLayout(force){
        const restore=!force&&cytoscapeMemo&&cytoscapeMemo.signature===signature;
        const layout=cy.layout({...options($('cytoLayout').value),fit:!restore});
        layout.one('layoutstop',()=>{
            if(restore){cy.zoom(cytoscapeMemo.zoom);cy.pan(cytoscapeMemo.pan);}
            showZoom();
        });
        layout.run();
    }
    function showZoom(){if($('cytoZoom'))$('cytoZoom').textContent=Math.round(cy.zoom()*100)+'%';}
    cy.on('zoom',showZoom);
    function place(event){
        const p=event.renderedPosition||{x:0,y:0};
        tip.style.display='block';
        tip.style.left=Math.max(4,Math.min(p.x+16,viewport.clientWidth-tip.offsetWidth-8))+'px';
        tip.style.top=Math.max(4,Math.min(p.y+16,viewport.clientHeight-tip.offsetHeight-8))+'px';
    }
    cy.on('mouseover','node',event=>{
        const node=event.target,related=node.closedNeighborhood(),n=byId.get(idOf(node));
        cy.batch(()=>{cy.elements().difference(related).addClass('faded');related.edges().addClass('highlighted');});
        tip.replaceChildren();text('b',n.name,tip);
        text('span',`${n.domain} · level ${n.level}${n.cycle?' · in a cycle':''}`,tip);
        text('span',n.path,tip);
        text('span',`${D.edges.filter(e=>e.source===n.id).length} dependencies · ${D.edges.filter(e=>e.target===n.id).length} users`,tip);
        place(event);
    });
    cy.on('mouseover','edge',event=>{
        const edge=event.target,related=edge.union(edge.connectedNodes());
        cy.batch(()=>{cy.elements().difference(related).addClass('faded');edge.addClass('highlighted');});
        const source=byId.get(idOf(edge.source())),target=byId.get(idOf(edge.target()));
        tip.replaceChildren();text('b',`${source.name} → ${target.name}`,tip);
        text('span',edge.data('redundant')?'Redundant reference: another path already connects them.':'Direct project reference.',tip);
        place(event);
    });
    cy.on('mousemove','node, edge',place);
    cy.on('mouseout','node, edge',()=>{
        cy.batch(()=>{cy.elements().removeClass('faded highlighted');});
        tip.style.display='none';
    });
    cy.on('tap','node',event=>{const id=idOf(event.target);if(id!==selected){selected=id;render();}});
    cy.on('tap',event=>{if(event.target===cy&&selected!==null){selected=null;render();}});
    $('cytoFit').onclick=()=>cy.fit(undefined,40);
    $('cytoRelayout').onclick=()=>runLayout(true);
    // maxWidth/maxHeight keep a wide level layout from producing a multi-hundred-megapixel image.
    $('cytoPng').onclick=()=>saveGraphImage(cy.png({full:true,bg:'#101827',maxWidth:4096,maxHeight:4096}));
    $('cytoFocus').onclick=()=>{if(selected!==null)choose(selected);};
    for(const id of ['cytoFit','cytoRelayout','cytoPng'])$(id).disabled=false;
    $('cytoFocus').disabled=selected===null;
    runLayout(false);
}
