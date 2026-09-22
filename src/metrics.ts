// Architecture metrics over the project-reference graph. Every value is a pure
// function of the graph, so the same code can later score a hypothetical graph
// in a what-if simulation without rescanning the workspace.
//
// Scope, and it matters when reading the numbers: this measures coupling between
// assemblies. Projects with no reference between them can still be coupled by
// dependency injection, reflection, a shared database or HTTP, and a violation
// that lives between two folders of the same project is invisible here.
import type { ProjectNode, Edge } from './analyzer';

export interface PastaShape { key: string; name: string; emoji: string; color: string; summary: string; advice: string }
export interface Driver { label: string; cost: number }
export interface Architecture {
  graded: boolean; projects: number; references: number;
  propagationCost: number; cycleMass: number; largestCycle: number; cycleGroups: number;
  redundancy: number; modularity: number; modular: boolean; depth: number;
  hubShare: number; hub: string; score: number; shape: PastaShape; drivers: Driver[];
}

// Tarjan. Groups come out in reverse topological order: a component is emitted
// only once everything it reaches has been, which the reachability pass relies on.
export function stronglyConnected(count: number, adjacency: number[][]): number[][] {
  const indices=new Map<number,number>(),low=new Map<number,number>(),stack:number[]=[],active=new Set<number>(),groups:number[][]=[];
  function visit(v:number):void {
    indices.set(v,indices.size);low.set(v,indices.get(v)!);stack.push(v);active.add(v);
    for(const w of adjacency[v]){
      if(!indices.has(w)){visit(w);low.set(v,Math.min(low.get(v)!,low.get(w)!));}
      else if(active.has(w))low.set(v,Math.min(low.get(v)!,indices.get(w)!));
    }
    if(low.get(v)===indices.get(v)){
      const group:number[]=[];let w:number;
      do{w=stack.pop()!;active.delete(w);group.push(w);}while(w!==v);
      groups.push(group);
    }
  }
  for(let v=0;v<count;v++)if(!indices.has(v))visit(v);
  return groups;
}

// A healthy project depends on a handful of others, so the floor below which
// reach costs nothing is "about two other projects" and never less than 15%.
// Without it a four-project solution sharing one kernel would be marked down for
// a propagation cost it cannot avoid.
const rippleFloor=(projects:number):number=>Math.max(0.15,2/(projects-1));
const rippleCeiling=0.6;
// Only unambiguously bad properties carry weight: fixing any of them must raise
// the score. Depth, modularity and hub share describe the shape instead.
// Cycles carry two terms because their share and their size are independent
// problems: a cycle of six is structural whether the solution holds ten
// projects or a thousand.
const weights={cycles:50,tangle:25,ripple:25,redundancy:20};
const percent=(value:number):string=>`${Math.round(value*100)}%`;
const clamp=(value:number,low:number,high:number):number=>Math.min(high,Math.max(low,value));

// First matching rule wins, like the domain rules. Order encodes severity:
// a cycle outranks every other observation about the same graph.
const shapes:(PastaShape&{when:(m:Architecture)=>boolean})[]=[
  {key:'spaghetti',name:'Spaghetti',emoji:'🍝',color:'#ff667a',
    summary:'Dependency cycles run through a significant part of the solution. Build order, testing and extraction all fight you.',
    advice:'Break the largest cycle first: invert one reference through an interface placed in the project that both sides already use.',
    when:m=>m.largestCycle>=4||m.cycleGroups>=3||(m.cycleMass>=0.3&&m.largestCycle>=3)},
  {key:'fusilli',name:'Fusilli',emoji:'🌀',color:'#f5b454',
    summary:'The structure is twisted rather than broken: a few cycles, or many references that duplicate a path already present.',
    advice:'Remove the redundant references first. They cost nothing to delete and they hide the real shape of the graph.',
    when:m=>m.cycleGroups>0||m.redundancy>=0.3},
  {key:'gnocchi',name:'Gnocchi',emoji:'🥔',color:'#e8b87b',
    summary:'One project carries almost everything. The graph is a hub with satellites rather than a structure.',
    advice:'Split the hub along the lines of what its users actually consume, starting with the group that shares the fewest types.',
    when:m=>m.hubShare>=0.6&&m.depth<=2},
  {key:'ravioli',name:'Ravioli',emoji:'🥟',color:'#d6a5cc',
    summary:'Many small projects, barely connected. Encapsulation is not the problem; the project count is.',
    advice:'Merge projects that are always referenced together. A project boundary should buy you an independent build or an independent release.',
    when:m=>m.projects>=12&&m.references/m.projects<0.8&&m.propagationCost<0.08},
  {key:'penne',name:'Penne',emoji:'🧩',color:'#83e0b7',
    summary:'Real modules with thin connections between them. A change stays inside its tube.',
    advice:'Keep it there: watch the propagation cost when you add a reference across two modules.',
    when:m=>m.modular&&m.modularity>=0.3&&m.propagationCost<0.25},
  {key:'lasagne',name:'Lasagne',emoji:'🍰',color:'#78b6ff',
    summary:'Clean horizontal layers and no cycles, but the layers are wide: a change travels down through all of them.',
    advice:'Layering is working. The next gain is vertical: group projects by feature so a change touches one slice instead of every layer.',
    when:m=>m.depth>=4},
  {key:'macaroni',name:'Macaroni',emoji:'🍜',color:'#b5c2d6',
    summary:'Ordinary. No cycles, no dominant hub, no strong modular or layered signal either.',
    advice:'Decide which shape you want before the graph decides for you. The simulator compares your references against a target model.',
    when:()=>true},
];
const unmeasured:PastaShape={key:'unmeasured',name:'Not enough projects',emoji:'❔',color:'#b5c2d6',
  summary:'Three production projects are needed before coupling means anything.',
  advice:'Come back when the solution grows, or look at the dependency graph directly.'};

export function computeArchitecture(data:{nodes:ProjectNode[];edges:Edge[]}):Architecture {
  // Test projects reference production code without being part of the design.
  // Counting them makes every solution look worse and hides real movement.
  const kept=data.nodes.filter(n=>!n.test);
  const index=new Map(kept.map((n,i)=>[n.id,i]));
  const n=kept.length;
  const edges=data.edges.filter(e=>index.has(e.source)&&index.has(e.target))
    .map(e=>({source:index.get(e.source)!,target:index.get(e.target)!}));
  const empty:Architecture={graded:false,projects:n,references:edges.length,propagationCost:0,cycleMass:0,
    largestCycle:0,cycleGroups:0,redundancy:0,modularity:0,modular:false,depth:0,hubShare:0,hub:'',
    score:0,shape:unmeasured,drivers:[]};
  if(n<3)return empty;

  const adjacency=kept.map(()=>[] as number[]);
  for(const e of edges)adjacency[e.source].push(e.target);
  const groups=stronglyConnected(n,adjacency);
  const group=new Int32Array(n);groups.forEach((members,c)=>members.forEach(v=>{group[v]=c;}));
  const k=groups.length,words=Math.ceil(k/32);
  const selfLoop=new Set(edges.filter(e=>e.source===e.target).map(e=>e.source));
  const cyclic=groups.map((members,c)=>members.length>1||members.some(v=>selfLoop.has(v)));

  // Condensation, then reachability as bitsets. Tarjan's emission order is reverse
  // topological, so a component's successors are already resolved when we reach it.
  const successors=groups.map(()=>new Set<number>());
  for(const e of edges)if(group[e.source]!==group[e.target])successors[group[e.source]].add(group[e.target]);
  const reach=new Uint32Array(k*words);
  for(let c=0;c<k;c++)for(const d of successors[c]){
    reach[c*words+(d>>>5)]|=1<<(d&31);
    for(let w=0;w<words;w++)reach[c*words+w]|=reach[d*words+w];
  }
  const size=groups.map(members=>members.length);
  const reachable=new Array<number>(k).fill(0);
  for(let c=0;c<k;c++){let total=0;
    for(let d=0;d<k;d++)if(reach[c*words+(d>>>5)]&(1<<(d&31)))total+=size[d];
    // Every member of a cycle also reaches its own peers.
    reachable[c]=total+size[c]-1;
  }
  const propagationCost=kept.reduce((sum,_,v)=>sum+reachable[group[v]],0)/(n*(n-1));

  const inCycles=groups.reduce((sum,members,c)=>sum+(cyclic[c]?members.length:0),0);
  const cycleMass=inCycles/n;
  const largestCycle=Math.max(0,...groups.filter((_,c)=>cyclic[c]).map(members=>members.length));
  const cycleGroups=cyclic.filter(Boolean).length;

  // A reference is redundant when another visible path already connects the two
  // components. Edges inside a cycle are excluded: there the notion has no meaning.
  const crossing=edges.filter(e=>group[e.source]!==group[e.target]);
  const redundantPair=new Set<string>();
  for(let c=0;c<k;c++)for(const d of successors[c])
    for(const other of successors[c])
      if(other!==d&&(reach[other*words+(d>>>5)]&(1<<(d&31)))){redundantPair.add(`${c}:${d}`);break;}
  const redundant=crossing.filter(e=>redundantPair.has(`${group[e.source]}:${group[e.target]}`)).length;
  const redundancy=crossing.length?redundant/crossing.length:0;

  // Newman modularity on the declared domains: it answers whether the domains you
  // named exist structurally, not whether some other partition would score better.
  const domains=[...new Set(kept.map(p=>p.domain))];
  const degree=new Array<number>(n).fill(0);
  for(const e of crossing){degree[e.source]++;degree[e.target]++;}
  const m=crossing.length;
  const modular=domains.length>1&&m>0;
  let modularity=0;
  if(modular)for(const d of domains){
    const members=new Set(kept.map((p,i)=>[p,i] as const).filter(([p])=>p.domain===d).map(([,i])=>i));
    const inside=crossing.filter(e=>members.has(e.source)&&members.has(e.target)).length;
    const attached=[...members].reduce((sum,v)=>sum+degree[v],0);
    modularity+=inside/m-(attached/(2*m))**2;
  }

  const incoming=new Array<number>(n).fill(0);
  for(const e of crossing)incoming[e.target]++;
  const peak=Math.max(...incoming);
  const hubShare=peak/(n-1);
  const hub=kept[incoming.indexOf(peak)].name;
  const depth=Math.max(...kept.map(p=>p.level))+1;

  const floor=rippleFloor(n);
  const ripple=clamp((propagationCost-floor)/Math.max(0.1,rippleCeiling-floor),0,1);
  const tangle=clamp((largestCycle-1)/5,0,1);
  const drivers:Driver[]=[
    {label:`${percent(cycleMass)} of projects sit in a dependency cycle, the largest holding ${largestCycle}`,
      cost:weights.cycles*cycleMass+weights.tangle*tangle},
    {label:`a change reaches ${percent(propagationCost)} of the solution on average`,cost:weights.ripple*ripple},
    {label:`${percent(redundancy)} of references duplicate a path that already exists`,cost:weights.redundancy*redundancy},
  ].filter(driver=>driver.cost>=0.5).sort((a,b)=>b.cost-a.cost);
  const score=Math.round(clamp(100-drivers.reduce((sum,driver)=>sum+driver.cost,0),0,100));

  const metrics:Architecture={...empty,graded:true,propagationCost,cycleMass,largestCycle,cycleGroups,
    redundancy,modularity,modular,depth,hubShare,hub,score,drivers,shape:unmeasured};
  metrics.shape=shapes.find(shape=>shape.when(metrics))!;
  return metrics;
}
