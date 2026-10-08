import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
// 只提取跨文件重复的内联样式候选；布局相同是否应合并仍需人工判断。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ts = createRequire(path.join(root, 'package.json'))('typescript');
const files = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(path.join(directory,entry.name)) : [path.join(directory,entry.name)]);
const groups = new Map();
const targets = files(path.join(root,'components')).filter(file => /\.tsx?$/.test(file));
for (const file of targets) {
  const source = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'style' && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isObjectLiteralExpression(node.initializer.expression)) {
      const properties = node.initializer.expression.properties;
      if (properties.length >= 4 && properties.every(ts.isPropertyAssignment)) {
        const entries = properties.map(property => [property.name.getText(source), property.initializer.getText(source).replace(/\s+/g,' ') ]).sort(([a],[b]) => a.localeCompare(b));
        const key = JSON.stringify(entries);
        const group = groups.get(key) ?? {style:Object.fromEntries(entries), locations:[]};
        group.locations.push({file:path.relative(root,file).replaceAll('\\','/'),line:source.getLineAndCharacterOfPosition(node.pos).line+1});
        groups.set(key,group);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const duplicates = [...groups.values()].filter(group => new Set(group.locations.map(location => location.file)).size > 1).sort((a,b) => b.locations.length-a.locations.length);
const result = {date:'2026-10-08',filesScanned:targets.length,method:'TypeScript AST: exact normalized JSX style objects with at least 4 property assignments across multiple files; layout-only groups still require human classification',duplicateGroups:duplicates.length,groups:duplicates};
fs.writeFileSync(path.join(root,'overview/dev/verification/ui-style-duplicates.json'),JSON.stringify(result,null,2)+'\n','utf8');
console.log(JSON.stringify({filesScanned:result.filesScanned,duplicateGroups:duplicates.length,groups:duplicates.slice(0,8)},null,2));
