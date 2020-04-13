import { getCompilerOptions } from "./tshelper";
import path from "path";
import ts from "typescript";
import { readFileSync } from "fs";
import { AstInfo, BlockNode } from "../types";

const compilerOptions = getCompilerOptions();
const resolvedFileNames = new Set<string>();
const connectedFileNames = new Set<{ from: string; to: string }>();
const resolvedNodes: BlockNode[] = [];
const baseUrl = path.resolve(compilerOptions.baseUrl || process.cwd());

export function getAstInfo(tempFileName: string): AstInfo {
  const fileName = path.resolve(tempFileName);
  if (resolvedFileNames.has(fileName)) {
    // Recursion termination, reached a repeated node
    return { resolvedFileNames, connectedFileNames };
  }
  resolvedFileNames.add(fileName);
  resolvedNodes.push({
    name: fileName,
  });

  const sourceFile = ts.createSourceFile(
    fileName,
    readFileSync(fileName).toString(),
    ts.ScriptTarget.ES2015,
    /*setParentNodes */ true
  );
  if (!sourceFile.isDeclarationFile) {
    ts.forEachChild(sourceFile!, getImports);
  }
  return { resolvedFileNames, connectedFileNames };
}

function getImports(node: ts.Node) {
  // If you think this is missing something, you may want to inspect the node.kind
  // e.g. require
  switch (node.kind) {
    case ts.SyntaxKind.ImportDeclaration:
      ts.forEachChild(node, getImportName);
      return;
    case ts.SyntaxKind.ExportDeclaration:
      ts.forEachChild(node, getImportName);
      return;
  }
  getExportedMethods(node);
}
function getImportName(node: ts.Node) {
  switch (node.kind) {
    case ts.SyntaxKind.StringLiteral:
      const host = ts.createCompilerHost(compilerOptions);
      const fromFileName = node.getSourceFile().fileName;
      const res = ts.resolveModuleName(
        node.getText().slice(1, -1),
        fromFileName,
        compilerOptions,
        host
      );
      if (res.resolvedModule) {
        const { resolvedFileName } = res.resolvedModule;

        if (resolvedFileName.includes("node_modules")) return;

        connectedFileNames.add({
          from: getShortPath(fromFileName),
          to: getShortPath(path.resolve(resolvedFileName)),
        });

        getAstInfo(resolvedFileName);
      } else {
        console.error("fail", node.getText());
      }
  }
}

function getExportedMethods(node: ts.Node) {
  if (!isNodeExported(node)) {
    return;
  }
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: true,
  });
  const program = ts.createProgram(
    [node.getSourceFile().fileName],
    compilerOptions
  );
  const checker = program.getTypeChecker();
  let name = "";
  if (ts.isFunctionDeclaration(node)) {
    name = node.name!.text;
    // Hide the method body when printing
    node.body = undefined;
  } else if (ts.isVariableStatement(node)) {
    name = node.declarationList.declarations[0].name.getText(
      node.getSourceFile()
    );
  } else if (ts.isInterfaceDeclaration(node)) {
    name = node.name.text;
  }

  if (name && (node as any).name) {
    let symbol = checker.getSymbolAtLocation((node as any).name);
    if (symbol) {
      // console.log(serializeClass(symbol));
    }
    console.log(node.getSourceFile().fileName);
    console.log("### " + name);
    console.log(
      printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
    );
  }
}
/** True if this is visible outside this file, false otherwise */
function isNodeExported(node: ts.Node): boolean {
  return (
    (ts.getCombinedModifierFlags(node as ts.Declaration) &
      ts.ModifierFlags.Export) !==
    0
  );
}
export function getShortPath(path: string) {
  return "." + path.replace(baseUrl, "");
}
