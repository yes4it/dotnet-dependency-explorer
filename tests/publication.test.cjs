const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
test('publication requires real metadata and configuration updates public URLs',()=>{
 const root=path.resolve(__dirname,'..'),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'dotnet-release-check-'));
 for(const file of ['package.json','README.md','SUPPORT.md','LICENSE','THIRD_PARTY_NOTICES.txt','assets/icon.png','assets/project-focus.png','assets/project-matrix.png']){
  const target=path.join(fixture,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);
 }
 // Keep this test independent of the real publisher chosen later.
 const manifest=JSON.parse(fs.readFileSync(path.join(fixture,'package.json'),'utf8'));manifest.publisher='publisher-id-required';delete manifest.repository;
 fs.writeFileSync(path.join(fixture,'package.json'),JSON.stringify(manifest));
 fs.writeFileSync(path.join(fixture,'README.md'),'![Focus](https://raw.githubusercontent.com/REPLACE_OWNER/REPLACE_REPO/main/assets/project-focus.png)');
 fs.writeFileSync(path.join(fixture,'SUPPORT.md'),'https://github.com/REPLACE_OWNER/REPLACE_REPO/issues');
 const run=(file,args=[])=>spawnSync(process.execPath,[path.join(root,'scripts',file),...args],{cwd:fixture,encoding:'utf8'});
 assert.notEqual(run('check-release.mjs').status,0);
 const result=run('configure-release.mjs',['--publisher','example-publisher','--repository','https://github.com/example-owner/example-repo']);
 assert.equal(result.status,0,result.stderr);
 assert.equal(run('check-release.mjs').status,0);
 const configured=JSON.parse(fs.readFileSync(path.join(fixture,'package.json'),'utf8'));
 assert.equal(configured.publisher,'example-publisher');assert.equal(configured.repository.url,'https://github.com/example-owner/example-repo.git');
 assert.ok(fs.readFileSync(path.join(fixture,'README.md'),'utf8').includes('https://raw.githubusercontent.com/example-owner/example-repo/main/assets/project-focus.png'));
 assert.equal(run('configure-release.mjs',['--publisher','second-publisher','--repository','https://github.com/another-owner/another-repo.git']).status,0);
 assert.ok(fs.readFileSync(path.join(fixture,'SUPPORT.md'),'utf8').includes('https://github.com/another-owner/another-repo/issues'));
});
