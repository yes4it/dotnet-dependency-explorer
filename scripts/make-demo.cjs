const fs=require('node:fs');
const {analyzeProjects}=require('../.test/analyzer.cjs');
const path=require('node:path').posix;
const dependencies={
 'Sample.Web':['Sample.Orders'],
 'Sample.Worker':['Sample.Orders','Sample.Messaging'],
 'Sample.Orders':['Sample.Persistence','Sample.Contracts','Sample.Messaging','Sample.Telemetry'],
 'Sample.Persistence':['Sample.Contracts','Sample.Telemetry'],
 'Sample.Messaging':['Sample.Contracts'],
 'Sample.Contracts':[], 'Sample.Telemetry':[],
 'Sample.Tests':['Sample.Orders'],
 'Example.FeatureA':['Example.FeatureB'],
 'Example.FeatureB':['Example.FeatureA']
};
const inputs=Object.entries(dependencies).map(([name,refs])=>({key:`/example/${name}.csproj`,path:`${name}.csproj`,name,xml:`<Project><ItemGroup>${refs.map(ref=>`<ProjectReference Include="${ref}.csproj"/>`).join('')}</ItemGroup></Project>`}));
const graph=analyzeProjects(inputs,(p,r)=>path.resolve(path.dirname(p.key),r),{labelPrefixes:['Sample.']});
const script=['focus.js','cytoscape-view.js','explorer.js'].map(file=>fs.readFileSync(`media/${file}`,'utf8')).join('\n');
const template=fs.readFileSync('media/template.html','utf8').replace('__DATA__',JSON.stringify(graph).replace(/</g,'\\u003c')).replace('__EXPLORER__',()=>script);
fs.mkdirSync('.test',{recursive:true});
fs.writeFileSync('.test/demo-focus.html',template.replace('</html>',`<script>choose(D.nodes.find(n=>n.name==='Sample.Orders').id);</script></html>`));
fs.writeFileSync('.test/demo-matrix.html',template.replace('</html>',`<script>$('mode').value='matrix';render();</script></html>`));
console.log('Generated .test/demo-focus.html and .test/demo-matrix.html using fictional projects only.');
