import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import console from 'node:console';
const root = path.resolve('src/app');
const phrases = new Map();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!file.endsWith('.tsx') || file.includes('.test.')) continue;
    const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxText(node) || (ts.isStringLiteral(node) && ts.isJsxAttribute(node.parent) && ['label','title','placeholder','aria-label','alt'].includes(node.parent.name.text))) {
        const value = node.text.replace(/\s+/g, ' ').trim();
        if (/[a-zA-Z]{2}/.test(value)) phrases.set(value, (phrases.get(value) || []).concat(path.relative(root, file)));
      }
      ts.forEachChild(node, visit);
    }
    visit(src);
  }
}
walk(root);
console.log(JSON.stringify(Object.fromEntries(phrases), null, 2));
