import { readFileSync } from 'fs';
import path from 'path';

import _ from 'lodash';
import ts from 'typescript';

import { getCompilerOptions } from './tshelper';

const compilerOptions = getCompilerOptions();
const resolvedFileNames = new Set<string>();
const connectedFileNames = new Set<{ from: string; to: string }>();
const baseUrl = path.resolve(compilerOptions.baseUrl || process.cwd());
run(process.argv[2]);
function run(tempFileName: string): void {
  const fileName = path.resolve(tempFileName);
  if (resolvedFileNames.has(fileName)) {
    return;
  }
  resolvedFileNames.add(fileName);
  const sourceFile = ts.createSourceFile(
    fileName,
    readFileSync(fileName).toString(),
    ts.ScriptTarget.ES2015,
    /*setParentNodes */ true
  );
  ts.forEachChild(sourceFile!, getImports);
}

function getImports(node: ts.Node) {
  // console.log('getImports', node.name);
  switch (node.kind) {
    case ts.SyntaxKind.ImportDeclaration:
      ts.forEachChild(node, getImportName);
      break;
  }
}
function getImportName(node: ts.Node) {
  switch (node.kind) {
    case ts.SyntaxKind.StringLiteral:
      const host = ts.createCompilerHost(compilerOptions);
      const res = ts.resolveModuleName(
        node.getText().slice(1, -1),
        node.getSourceFile().fileName,
        compilerOptions,
        host
      );
      if (res.resolvedModule) {
        const { resolvedFileName } = res.resolvedModule;
        if (resolvedFileName.includes('node_modules')) return;
        // console.log(
        //   '- name',
        //   getShortPath(node.getSourceFile().fileName),
        //   node.getText()
        // );
        // console.log(getShortPath(path.resolve(resolvedFileName)));
        connectedFileNames.add({
          from: getShortPath(node.getSourceFile().fileName),
          to: getShortPath(path.resolve(resolvedFileName)),
        });
        run(resolvedFileName);
      } else {
        console.log('fail', node.getText());
      }
  }
}
function getShortPath(path: string) {
  return '.' + path.replace(baseUrl, '');
}

function clusterFolders(paths: string[]) {
  const splitPaths = paths.map((p) => ({
    original: p,
    split: p.split(path.sep).slice(1),
  }));
  return groupFolders([], splitPaths, 1);
}
function groupFolders(
  list: (string | (string | string[])[])[],
  paths: { original: string; split: string[] }[],
  depth: number
) {
  const sameFolder = paths.filter((p) => p.split.length === depth);
  list = list.concat(sameFolder.map(({ original }) => original));
  const grouped = _(paths.filter((p) => p.split.length > depth))
    .groupBy(({ split }) => split[depth - 1])
    .toPairs()
    .value();
  for (const [_key, values] of grouped) {
    // console.log(key);
    list = list.concat([groupFolders([], values, depth + 1)]);
  }
  return list;
}
// resolvedFileNames = nodes;
// connectedFileNames = arcs;
console.log(`
  graph[splines=polyline];
  node[shape=record];
  edge[color="#00000033"];
`);
console.log(
  Array.from(resolvedFileNames)
    .map(getShortPath)
    .sort()
    .map((path) => `"${path}" [label="${path}"]`)
    .map((path) => `  ${path}`)
    .join('\n')
);
console.log('\n');
console.log(
  Array.from(connectedFileNames)
    .map(({ from, to }) => `"${from}" -> "${to}"`)
    .sort()
    .map((path) => `  ${path}`)
    .join('\n')
);
let num = 0;
function recursePrint(list: (string | (string | string[])[])[]) {
  return list
    .map((l) => {
      if (Array.isArray(l)) {
        return `subgraph cluster_${num++} {
  ${recursePrint(l).split('\n').join('\n  ')}
  }`;
      } else {
        return `"${l}" [label="${l}"]`;
      }
    })
    .map((path) => `  ${path}`)
    .join('\n');
}
console.log('\nTrying grouping');
console.log(
  recursePrint(
    clusterFolders(Array.from(resolvedFileNames).map(getShortPath).sort())
  )
);
