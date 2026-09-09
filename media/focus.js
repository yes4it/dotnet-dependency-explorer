// Dedicated three-column view. All geometry uses readable, unscaled text.
function focusGraph(nodes,edges){
    const current=nodes.find(n=>n.id===selected);
    if(!current){graph(nodes,edges);return;}
    const byId=new Map(nodes.map(n=>[n.id,n]));
    const structural=D.edges.filter(e=>byId.has(e.source)&&byId.has(e.target));
    const incoming=new Set(structural.filter(e=>e.target===selected&&e.source!==selected).map(e=>e.source));
    const outgoing=new Set(structural.filter(e=>e.source===selected&&e.target!==selected).map(e=>e.target));
    const sort=(a,b)=>a.domain.localeCompare(b.domain)||a.name.localeCompare(b.name);
    const left=nodes.filter(n=>incoming.has(n.id)&&!outgoing.has(n.id)).sort(sort);
    const right=nodes.filter(n=>outgoing.has(n.id)).sort(sort);
    const positions=new Map(),width=270,pitch=112;
    function wrap(value){const words=value.replace(/([a-z])([A-Z])/g,'$1 $2').split(/(?<=\.)|\s+/);const lines=[];let line='';for(let word of words){while(word.length>31){if(line){lines.push(line);line='';}lines.push(word.slice(0,31));word=word.slice(31);}if((line+word).length>31){lines.push(line);line='';}line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;}
    const heights=new Map(nodes.map(n=>[n.id,Math.max(88,wrap(label(n)).length*18+44)]));
    function place(list,x){let y=100;for(const n of list){positions.set(n.id,{x,y,w:width,h:heights.get(n.id)});y+=Math.max(pitch,heights.get(n.id)+24);}return y;}
    const bottom=Math.max(place(left,24),place(right,884),360);
    const centerHeight=Math.max(heights.get(selected),120,Math.max(left.length,right.length)*7+35);
    const initialCenter=Math.max(100,($('canvas').clientHeight-220-centerHeight)/2);
    positions.set(selected,{x:454,y:Math.max(100,Math.min(initialCenter,(bottom+76-centerHeight)/2)),w:width,h:centerHeight});
    size={width:1250,height:Math.max(bottom+30,positions.get(selected).y+centerHeight+40)};
    const svg=svgEl('svg',{id:'graph',xmlns:NS,viewBox:`0 0 ${size.width} ${size.height}`,'data-layout':'focus'},graphViewport());
    svg.style.background='#101827';
    const colors={normal:'#7186a6',out:'#78b6ff',in:'#79dac2',cycle:'#ff667a',redundant:'#f5b454'};
    const defs=svgEl('defs',{},svg);
    for(const [id,c]of Object.entries(colors)){const marker=svgEl('marker',{id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'},defs);svgEl('path',{d:'M0 0 L10 5 L0 10z',fill:c},marker);}
    for(const [x,title]of [[24,`Used by (${left.length})`],[454,'Selected project'],[884,`Depends on (${right.length})`]])svgEl('text',{x,y:42,fill:'#d9e4f4','font-family':'system-ui','font-size':16,'font-weight':600},svg).textContent=title;
    if(!left.length)svgEl('text',{x:24,y:122,fill:'#9eb0c9','font-size':14},svg).textContent='No users in this view';
    if(!right.length)svgEl('text',{x:884,y:122,fill:'#9eb0c9','font-size':14},svg).textContent='No dependencies in this view';
    const eligible=edges.filter(e=>positions.has(e.source)&&positions.has(e.target));
    const rendered=[],cards=new Map();let hoveredNode=null,hoveredEdge=null,pinned=null;
    const edgeKey=e=>`${e.source}:${e.target}`;
    const primary=e=>e.source===selected||e.target===selected;
    const peers=$('neighbors').checked;
    // A separate wide transparent stroke makes thin routes easy to select.
    const edgeLayer=svgEl('g',{},svg),cardLayer=svgEl('g',{},svg);
    const info=text('p','Hover an arrow to see its source and target. Click to pin the selection.',$('content'));
    info.id='edgeInfo';info.setAttribute('aria-live','polite');
    info.style.cssText='position:sticky;top:0;z-index:2;background:#101827;padding:10px 0;margin:0;min-height:42px';
    $('content').insertBefore(info,$('graphViewport'));
    const clear=text('button','Clear edge selection',$('content'));clear.onclick=()=>{pinned=null;refresh();};
    $('content').insertBefore(clear,$('graphViewport'));
    function port(id,other,side){const p=positions.get(id);const list=eligible.filter(e=>e.source===id||e.target===id).sort((a,b)=>{const otherA=a.source===id?a.target:a.source,otherB=b.source===id?b.target:b.source;return positions.get(otherA).y-positions.get(otherB).y||edgeKey(a).localeCompare(edgeKey(b));});const index=list.findIndex(e=>edgeKey(e)===edgeKey(other));return {x:p.x+(side==='right'?p.w:0),y:p.y+18+(index+1)*(p.h-36)/(list.length+1)};}
    for(const e of eligible){
        const a=positions.get(e.source),b=positions.get(e.target);
        const same=a.x===b.x,forward=a.x<b.x;
        const start=port(e.source,e,same||forward?'right':'left'),end=port(e.target,e,same||!forward?'right':'left');
        let d;
        if(same){if(e.source===e.target)end.y=Math.min(b.y+b.h-8,start.y+16);const lane=a.x+a.w+24+(rendered.length%8)*7;d=roundedRoute([start,{x:lane,y:start.y},{x:lane,y:end.y},end],7);}
        else if(Math.abs(a.x-b.x)<=430){const mid=(start.x+end.x)/2;d=`M${start.x} ${start.y} C${mid} ${start.y},${mid} ${end.y},${end.x} ${end.y}`;}
        else {const direction=forward?1:-1,rail=64+(rendered.length%4)*6;d=roundedRoute([start,{x:start.x+direction*40,y:start.y},{x:start.x+direction*40,y:rail},{x:end.x-direction*40,y:rail},{x:end.x-direction*40,y:end.y},end],6);}
        const kind=e.cycle?'cycle':e.redundant?'redundant':e.source===selected?'out':e.target===selected?'in':'normal';
        const group=svgEl('g',{'data-edge':edgeKey(e),'data-primary':primary(e),tabindex:0,role:'button','aria-label':`${byId.get(e.source).name} → ${byId.get(e.target).name}`},edgeLayer);
        const path=svgEl('path',{d,fill:'none',stroke:colors[kind],'stroke-width':1.6,'stroke-dasharray':e.redundant&&!e.cycle?'7 5':'none','marker-end':`url(#${kind})`,'stroke-linecap':'round'},group);
        const hit=svgEl('path',{d,fill:'none',stroke:'transparent','stroke-width':12,'pointer-events':'stroke'},group);
        const title=`${byId.get(e.source).name} → ${byId.get(e.target).name}${e.redundant?' · redundant reference':''}`;
        svgEl('title',{},hit).textContent=title;
        group.onmouseenter=()=>{hoveredEdge=e;refresh();};group.onmouseleave=()=>{hoveredEdge=null;refresh();};group.onfocus=()=>{hoveredEdge=e;refresh();};group.onblur=()=>{hoveredEdge=null;refresh();};
        const pin=()=>{pinned=pinned&&edgeKey(pinned)===edgeKey(e)?null:e;refresh();};group.onclick=pin;group.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();pin();}};
        rendered.push({e,group,path,title});
    }
    for(const [id,p]of positions){const n=byId.get(id),g=svgEl('g',{class:'node',tabindex:0,role:'button','aria-label':n.name,'data-node':id},cardLayer);
        const rect=svgEl('rect',{x:p.x,y:p.y,width:p.w,height:p.h,rx:9,fill:id===selected?'#195475':'#202f45',stroke:n.cycle?'#ff667a':color(n.domain),'stroke-width':id===selected?2.5:1.2},g);
        svgEl('title',{},g).textContent=n.name;
        const lines=wrap(label(n));lines.forEach((line,i)=>svgEl('text',{x:p.x+14,y:p.y+25+i*18,fill:'#eef4ff','font-family':'system-ui','font-size':14},g).textContent=line);
        svgEl('text',{x:p.x+14,y:p.y+p.h-15,fill:color(n.domain),'font-family':'system-ui','font-size':13},g).textContent=n.domain;
        if(incoming.has(id)&&outgoing.has(id))svgEl('title',{},rect).textContent='Reciprocal dependency: this project also uses the selected project.';
        g.onclick=()=>choose(id);g.onkeydown=event=>{if(event.key==='Enter')choose(id);};g.onmouseenter=()=>{hoveredNode=id;refresh();};g.onmouseleave=()=>{hoveredNode=null;refresh();};g.onfocus=()=>{hoveredNode=id;refresh();};g.onblur=()=>{hoveredNode=null;refresh();};cards.set(id,{g,rect});
    }
    function refresh(){
        const active=hoveredEdge||pinned;
        for(const item of rendered){const {e,group,path}=item;const touches=hoveredNode!==null&&(e.source===hoveredNode||e.target===hoveredNode);const exact=active&&edgeKey(active)===edgeKey(e);const visible=primary(e)||peers||touches||exact;
            group.style.display=visible?'':'none';group.setAttribute('tabindex',visible?'0':'-1');
            const emphasized=active?exact:hoveredNode!==null?touches:false;
            const dimmed=(active||hoveredNode!==null)&&!emphasized;
            path.setAttribute('opacity',dimmed?0.08:emphasized?1:e.redundant?0.38:primary(e)?0.75:0.25);path.setAttribute('stroke-width',emphasized?2.8:1.6);
        }
        for(const [id,{g,rect}]of cards){const lit=active&&(active.source===id||active.target===id);g.setAttribute('opacity',active&&!lit?0.35:1);rect.setAttribute('stroke-width',lit?3:id===selected?2.5:1.2);}
        info.textContent=active?`${pinned&&edgeKey(pinned)===edgeKey(active)?'Selected edge: ':''}${byId.get(active.source).name} → ${byId.get(active.target).name}${active.redundant?' · redundant reference':''}`:'Hover an arrow to see its source and target. Click to pin the selection.';
        clear.hidden=!pinned;
    }
    svg.onkeydown=event=>{if(event.key==='Escape'){pinned=null;hoveredEdge=null;refresh();}};
    refresh();zoom();
}
