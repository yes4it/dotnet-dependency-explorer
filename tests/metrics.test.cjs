const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path').posix;
const {analyzeProjects}=require('../.test/analyzer.cjs');
const project=(name,body='')=>({key:`/repo/${name}/${name}.csproj`,path:`${name}/${name}.csproj`,name,xml:`<Project>${body}</Project>`});
const ref=name=>`<ProjectReference Include="../${name}/${name}.csproj" />`;
const analyze=projects=>analyzeProjects(projects,(p,r)=>path.resolve(path.dirname(p.key),r.replace(/\\/g,'/')));
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} is not ${expected}`);

test('propagation cost counts the projects a change can reach, not the direct references',()=>{
 // A -> B -> C: A reaches two projects, B reaches one, C none, over 3*2 ordered pairs.
 const m=analyze([project('A',ref('B')),project('B',ref('C')),project('C')]).metrics;
 assert.equal(m.graded,true);assert.equal(m.projects,3);
 close(m.propagationCost,0.5);close(m.cycleMass,0);close(m.redundancy,0);
 assert.equal(m.depth,3);
});
test('a reference that duplicates an existing path is counted as redundant',()=>{
 const m=analyze([project('A',ref('B')+ref('C')+ref('D')),project('B',ref('D')),project('C',ref('D')),project('D')]).metrics;
 close(m.redundancy,0.2);
 const clean=analyze([project('A',ref('B')+ref('C')),project('B',ref('D')),project('C',ref('D')),project('D')]).metrics;
 close(clean.redundancy,0);
 assert.ok(clean.score>m.score,'removing a redundant reference must raise the score');
});
test('cycles dominate the shape and every member counts towards the mass',()=>{
 const m=analyze([project('A',ref('B')),project('B',ref('C')),project('C',ref('A')),project('D')]).metrics;
 assert.equal(m.shape.key,'spaghetti');close(m.cycleMass,0.75);
 assert.equal(m.largestCycle,3);assert.equal(m.cycleGroups,1);
 assert.ok(m.drivers[0].label.includes('cycle'),'the cycle must be reported as the first driver');
 const broken=analyze([project('A',ref('B')),project('B',ref('C')),project('C'),project('D')]).metrics;
 assert.equal(broken.cycleGroups,0);
 assert.ok(broken.score-m.score>=30,'breaking the cycle must be worth far more than any other fix');
});
test('a single cycle in an otherwise clean graph is twisted, not broken',()=>{
 const m=analyze([project('A',ref('B')),project('B',ref('A')),project('C',ref('D')),project('D',ref('E')),
  project('E'),project('F',ref('E')),project('G',ref('E')),project('H',ref('E'))]).metrics;
 assert.equal(m.shape.key,'fusilli');assert.equal(m.cycleGroups,1);
});
test('test projects are excluded so they cannot change the grade',()=>{
 const production=[project('A',ref('B')),project('B',ref('C')),project('C')];
 const bare=analyze(production).metrics;
 const withTests=analyze([...production,project('A.Tests',ref('A')+ref('B')+ref('C')),
  project('B.Tests',ref('B')+ref('C'))]).metrics;
 assert.equal(withTests.projects,3);
 close(withTests.propagationCost,bare.propagationCost);
 assert.equal(withTests.score,bare.score);
});
test('a project flagged by IsTestProject is excluded even when the name says nothing',()=>{
 const spec=project('Verification','<PropertyGroup><IsTestProject>true</IsTestProject></PropertyGroup>'+ref('A'));
 const m=analyze([project('A',ref('B')),project('B',ref('C')),project('C'),spec]).metrics;
 assert.equal(m.projects,3);
});
test('two production projects are not graded',()=>{
 const m=analyze([project('A',ref('B')),project('B')]).metrics;
 assert.equal(m.graded,false);assert.equal(m.shape.key,'unmeasured');
});
test('modularity only applies once more than one domain exists',()=>{
 const plain=analyze([project('A',ref('B')),project('B',ref('C')),project('C')]).metrics;
 assert.equal(plain.modular,false);close(plain.modularity,0);
 const named=analyze([project('Shop.Api',ref('Shop.Contracts')),project('Shop.Contracts'),
  project('Shop.Infrastructure',ref('Shop.Contracts'))]).metrics;
 assert.equal(named.modular,true);
});
test('the hub is the most referenced production project',()=>{
 const m=analyze([project('Core'),project('A',ref('Core')),project('B',ref('Core')),project('C',ref('Core'))]).metrics;
 assert.equal(m.hub,'Core');close(m.hubShare,1);
});
test('a clean layered solution keeps a high score and reports no driver',()=>{
 const m=analyze([project('Api',ref('Domain')),project('Worker',ref('Domain')),project('Domain'),
  project('Reporting',ref('Domain'))]).metrics;
 assert.equal(m.drivers.length,0);assert.equal(m.score,100);
 assert.equal(m.cycleGroups,0);
});
test('the scale carries every shape, evaluated, with exactly one current rung',()=>{
 const m=analyze([project('A',ref('B')),project('B',ref('C')),project('C',ref('A')),project('D')]).metrics;
 assert.equal(m.scale.length,7);
 const current=m.scale.filter(rung=>rung.current);
 assert.equal(current.length,1);assert.equal(current[0].key,m.shape.key);
 assert.equal(current[0].met,true);
 assert.ok(m.scale.every(rung=>rung.rule&&rung.measured),'every rung states its rule and what the graph measures');
});
test('moves are priced by replaying the score, not estimated',()=>{
 const m=analyze([project('A',ref('B')),project('B',ref('A')),project('C',ref('A')),project('D',ref('A'))]).metrics;
 const best=m.moves[0];
 assert.ok(best,'a cycle must produce at least one move');
 assert.ok(best.gain>0&&best.score===m.score+best.gain,'the gain must be the difference to the replayed score');
 assert.ok(m.moves.every((move,i,list)=>i===0||list[i-1].gain>=move.gain),'moves are ranked by gain');
 assert.ok(m.moves.length<=5);
});
test('a graph with nothing to fix proposes no move',()=>{
 const m=analyze([project('Api',ref('Domain')),project('Worker',ref('Domain')),project('Domain'),
  project('Reporting',ref('Domain'))]).metrics;
 assert.equal(m.moves.length,0);
});
