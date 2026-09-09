import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('package.json','utf8'));
const errors=[];
if(!manifest.publisher||manifest.publisher==='publisher-id-required')errors.push('Set your real Marketplace publisher ID.');
if(!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(manifest.repository?.url||''))errors.push('Set the GitHub repository URL.');
for(const file of ['README.md','SUPPORT.md'])if(/REPLACE_OWNER|REPLACE_REPO|publisher-id-required/.test(fs.readFileSync(file,'utf8')))errors.push(`Replace publication placeholders in ${file}.`);
for(const file of ['LICENSE','THIRD_PARTY_NOTICES.txt','assets/icon.png','assets/project-focus.png','assets/project-matrix.png'])if(!fs.existsSync(file))errors.push(`Missing ${file}.`);
if(errors.length){console.error('Publication metadata is incomplete:\n'+errors.map(e=>'- '+e).join('\n')+'\nRun npm run configure:release -- --publisher YOUR_ID --repository https://github.com/OWNER/REPOSITORY');process.exit(1);}
console.log('Publication metadata and assets are ready.');
