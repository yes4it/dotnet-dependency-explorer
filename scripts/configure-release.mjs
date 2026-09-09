import fs from 'node:fs';
const args=process.argv.slice(2);
const value=flag=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1];};
const publisher=value('--publisher'), repository=value('--repository');
if(!publisher||!repository){console.error('Usage: npm run configure:release -- --publisher YOUR_ID --repository https://github.com/OWNER/REPOSITORY');process.exit(1);}
if(!/^[a-z0-9][a-z0-9-]*$/i.test(publisher)||publisher==='publisher-id-required')throw Error('Use your real Marketplace publisher ID.');
const match=/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(repository);
if(!match||/REPLACE_|YOUR_/i.test(repository))throw Error('Use the HTTPS URL of your actual GitHub repository.');
const [,owner,repo]=match,base=`https://github.com/${owner}/${repo}`;
const manifest=JSON.parse(fs.readFileSync('package.json','utf8'));
const previous=manifest.repository?.url?.replace(/\.git$/,'');
manifest.publisher=publisher;manifest.repository={type:'git',url:`${base}.git`};manifest.homepage=`${base}#readme`;manifest.bugs={url:`${base}/issues`};
fs.writeFileSync('package.json',JSON.stringify(manifest,null,2)+'\n');
for(const file of ['README.md','SUPPORT.md']){
 let text=fs.readFileSync(file,'utf8').replaceAll('https://github.com/REPLACE_OWNER/REPLACE_REPO',base).replaceAll('https://raw.githubusercontent.com/REPLACE_OWNER/REPLACE_REPO',`https://raw.githubusercontent.com/${owner}/${repo}`);
 if(previous){text=text.replaceAll(previous,base);const prior=previous.replace('https://github.com/','https://raw.githubusercontent.com/');text=text.replaceAll(prior,`https://raw.githubusercontent.com/${owner}/${repo}`);}
 fs.writeFileSync(file,text);
}
console.log(`Configured publisher ${publisher} and repository ${base}. Nothing was uploaded or published.`);
