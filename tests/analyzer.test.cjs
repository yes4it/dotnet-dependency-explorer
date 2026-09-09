const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path').posix;
const {analyzeProjects}=require('../.test/analyzer.cjs');
const project=(name,body='')=>({key:`/repo/${name}/${name}.csproj`,path:`${name}/${name}.csproj`,name,xml:`<Project>${body}</Project>`});
const ref=name=>`<ProjectReference Include="../${name}/${name}.csproj" />`;
const analyze=projects=>analyzeProjects(projects,(p,r)=>path.resolve(path.dirname(p.key),r.replace(/\\/g,'/')));
test('resolves Windows separators, XML namespaces, duplicate references and conditions',()=>{
 const a=project('A');a.xml='<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><ItemGroup Condition="false"><ProjectReference Include="..\\B\\B.csproj"/><ProjectReference Include="../B/B.csproj"/></ItemGroup></Project>';
 const d=analyze([a,project('B')]);assert.equal(d.edges.length,1);assert.equal(d.unresolved.length,0);assert.equal(d.nodes[0].level,1);
});
test('finds indirect cycles and preserves outgoing non-cycle edges',()=>{
 const d=analyze([project('A',ref('B')),project('B',ref('C')),project('C',ref('A')+ref('D')),project('D')]);
 assert.equal(d.cycles.length,1);assert.equal(d.cycles[0].length,3);assert.equal(d.edges.filter(e=>e.cycle).length,3);
 assert.equal(d.nodes.find(n=>n.name==='D').cycle,false);
 assert.equal(d.nodes.find(n=>n.name==='A').level,1);
});
test('detects self cycles and disconnected projects',()=>{
 const d=analyze([project('A',ref('A')),project('B')]);assert.equal(d.cycles.length,1);assert.equal(d.edges[0].cycle,true);assert.equal(d.nodes[1].level,0);
});
test('reports unresolved expressions and missing references instead of dropping them silently',()=>{
 const d=analyze([project('A','<ItemGroup>'+ref('Missing')+'<ProjectReference Include="$(Root)/B.csproj;../*/C.csproj"/></ItemGroup>')]);
 assert.equal(d.unresolved.length,3);assert.equal(d.edges.length,0);
});
test('ignores commented references and records malformed XML without aborting other projects',()=>{
 const bad=project('Bad');bad.xml='<Project><ItemGroup></Project>';
 const d=analyze([bad,project('A',`<!-- ${ref('Missing')} --><PropertyGroup><IsTestProject>true</IsTestProject></PropertyGroup>`)]);
 assert.equal(d.diagnostics.length,1);assert.equal(d.unresolved.length,0);assert.equal(d.nodes.find(n=>n.name==='A').test,true);
});
test('does not expand DTD entities',()=>{
 const p=project('A');p.xml='<!DOCTYPE Project [<!ENTITY x "../B/B.csproj">]><Project/>';
 assert.equal(analyze([p]).diagnostics.length,1);
});
test('stable ids, multi-project includes and XML entity escaping',()=>{
 const a=project('A','<ProjectReference Include="../B/B.csproj;../C&amp;D/C&amp;D.csproj"/>');
 const d=analyze([project('C&D'),project('B'),a]);assert.equal(d.nodes[0].name,'A');assert.equal(d.edges.length,2);
 assert.deepEqual(d,analyze([a,project('B'),project('C&D')]));
});
test('custom domain rules use first case-insensitive match and preserve label prefixes',()=>{
 const input=project('Acme.Orders.Api');
 const d=analyzeProjects([input],()=>'',{domainRules:[{domain:'Orders',keywords:['ORDERS']},{domain:'Apps',keywords:['api']}],labelPrefixes:['Acme.']});
 assert.equal(d.nodes[0].domain,'Orders');assert.deepEqual(d.labelPrefixes,['Acme.']);
 assert.equal(analyzeProjects([input],()=>'',{domainRules:[]}).nodes[0].domain,'Other projects');
});
