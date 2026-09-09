import { XMLParser, XMLValidator } from 'fast-xml-parser';

export interface ProjectInput { key: string; path: string; name: string; xml: string }
export interface ProjectNode { id: number; name: string; path: string; uri: string; test: boolean; domain: string; level: number; cycle: boolean }
export interface Edge { source: number; target: number; cycle: boolean }
export interface DomainRule { domain: string; keywords: string[] }
export interface AnalyzerOptions { domainRules?: DomainRule[]; labelPrefixes?: string[] }
export interface GraphData { nodes: ProjectNode[]; edges: Edge[]; cycles: number[][]; unresolved: {project: string; reference: string}[]; diagnostics: string[]; labelPrefixes: string[] }
export const defaultDomainRules: DomainRule[] = [
  {domain:'Tests', keywords:['test','specs']},
  {domain:'Data access', keywords:['persistence','repository','storage','dataaccess']},
  {domain:'Contracts and models', keywords:['contracts','abstractions','models','dtos']},
  {domain:'Messaging', keywords:['messaging','outbox','eventbus']},
  {domain:'Workers', keywords:['worker','listener','scheduler']},
  {domain:'Infrastructure', keywords:['infrastructure','logging','telemetry','security']},
  {domain:'Applications', keywords:['.api','.web','.host','.app']}
];
export function analyzeProjects(inputs: ProjectInput[], resolve: (project: ProjectInput, reference: string) => string, options: AnalyzerOptions = {}): GraphData {
  const records = [...inputs].sort((a,b)=>a.key.localeCompare(b.key));
  const ids = new Map(records.map((p,i)=>[p.key,i]));
  const data: GraphData = { nodes: [], edges: [], cycles: [], unresolved: [], diagnostics: [], labelPrefixes: options.labelPrefixes ?? [] };
  const rules=options.domainRules??defaultDomainRules;
  const parser = new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,processEntities:true});
  const pairs = new Set<string>();
  records.forEach((record,id)=>{
    const node: ProjectNode = {id,name:record.name,path:record.path,uri:record.key,test:/test/i.test(record.name),domain:rules.find(rule=>rule.keywords.some(token=>record.name.toLowerCase().includes(token.toLowerCase())))?.domain ?? 'Other projects',level:0,cycle:false};
    data.nodes.push(node);
    try {
      if (/<!DOCTYPE/i.test(record.xml)) throw new Error('DTD declarations are not supported');
      const validation=XMLValidator.validate(record.xml);
      if(validation!==true)throw new Error(validation.err.msg);
      const doc=parser.parse(record.xml);
      const walk=(value: unknown): void=>{
        if(!value||typeof value!=='object')return;
        if(Array.isArray(value)){value.forEach(walk);return;}
        for(const [tag,child] of Object.entries(value)){
          if(tag==='IsTestProject' && String(typeof child==='object'&&child!==null?(child as Record<string,unknown>)['#text']:child).toLowerCase()==='true')node.test=true;
          if(tag==='ProjectReference'){
            for(const item of Array.isArray(child)?child:[child]){
              if(!item||typeof item!=='object')continue;
              const include=(item as Record<string,unknown>)['@_Include'];
              if(typeof include!=='string')continue;
              for(const reference of include.split(';').map(s=>s.trim()).filter(Boolean)){
                const target=/\$\(|[*?]/.test(reference)?undefined:ids.get(resolve(record,reference));
                if(target===undefined)data.unresolved.push({project:record.path,reference});
                else pairs.add(`${id}:${target}`);
              }
            }
          }else walk(child);
        }
      };
      walk(doc);
    }catch(error){data.diagnostics.push(`${record.path}: ${error instanceof Error?error.message:String(error)}`);}
  });
  data.edges=[...pairs].map(pair=>{const [source,target]=pair.split(':').map(Number);return {source,target,cycle:false};});
  const adjacency=data.nodes.map(()=>[] as number[]);
  for(const edge of data.edges)adjacency[edge.source].push(edge.target);
  const indices=new Map<number,number>(),low=new Map<number,number>(),stack:number[]=[],active=new Set<number>(),components:number[][]=[];
  function visit(v:number): void {
    indices.set(v,indices.size);low.set(v,indices.get(v)!);stack.push(v);active.add(v);
    for(const w of adjacency[v]){
      if(!indices.has(w)){visit(w);low.set(v,Math.min(low.get(v)!,low.get(w)!));}
      else if(active.has(w))low.set(v,Math.min(low.get(v)!,indices.get(w)!));
    }
    if(low.get(v)===indices.get(v)){
      const group:number[]=[];let w:number;
      do{w=stack.pop()!;active.delete(w);group.push(w);}while(w!==v);
      components.push(group);
    }
  }
  for(const node of data.nodes)if(!indices.has(node.id))visit(node.id);
  const component=new Map<number,number>();components.forEach((group,i)=>group.forEach(v=>component.set(v,i)));
  data.cycles=components.filter(group=>group.length>1||pairs.has(`${group[0]}:${group[0]}`));
  const cyclic=new Set(data.cycles.flat());
  const levels=new Map<number,number>();
  function level(c:number):number {
    if(!levels.has(c)){
      const targets=new Set(components[c].flatMap(v=>adjacency[v].map(w=>component.get(w)!)).filter(t=>t!==c));
      levels.set(c,1+Math.max(-1,...[...targets].map(level)));
    }
    return levels.get(c)!;
  }
  data.nodes.forEach(n=>{n.cycle=cyclic.has(n.id);n.level=level(component.get(n.id)!);});
  data.edges.forEach(e=>e.cycle=cyclic.has(e.source)&&component.get(e.source)===component.get(e.target));
  return data;
}
