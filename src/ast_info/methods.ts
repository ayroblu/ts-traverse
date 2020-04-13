import { getCompilerOptions } from "./tshelper";
import path from "path";
import ts from "typescript";
import { readFileSync } from "fs";
import { AstInfo, BlockNode, Method } from "../types";

const compilerOptions = getCompilerOptions();
const resolvedFileNames = new Set<string>();
const connectedFileNames = new Set<{ from: string; to: string }>();
const resolvedNodes: BlockNode[] = [];
const baseUrl = path.resolve(compilerOptions.baseUrl || process.cwd());

/** Something */
export const val = 1;

type TypeBundle = {
  compilerOptions: ts.CompilerOptions;
  resolvedFileNames: Set<string>;
  connectedFileNames: Set<{ from: string; to: string }>;
  resolvedNodes: BlockNode[];
  baseUrl: string;
  checker: ts.TypeChecker;
};
export function getAstInfo(
  inputFileName: string,
  bundle?: TypeBundle
): AstInfo {
  const fileName = path.resolve(inputFileName);
  if (!bundle) {
    bundle = {
      compilerOptions: getCompilerOptions(),
      resolvedFileNames: new Set(),
      connectedFileNames: new Set(),
      resolvedNodes: [],
      baseUrl: path.resolve(compilerOptions.baseUrl || process.cwd()),
      checker: {} as ts.TypeChecker,
    };
  }

  const program = ts.createProgram([fileName], bundle.compilerOptions);
  bundle.checker = program.getTypeChecker();

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile) {
      if (sourceFile.fileName.includes("node_modules")) continue;

      const node = addBlockNode(bundle, path.resolve(sourceFile.fileName));
      ts.forEachChild(sourceFile, getImports);
      ts.forEachChild(sourceFile, getExportedMethodsFn(node, bundle));
    }
  }
  return { resolvedFileNames, connectedFileNames, resolvedNodes };
}
function addBlockNode(bundle: TypeBundle, fileName: string) {
  bundle.resolvedFileNames.add(fileName);
  resolvedFileNames.add(fileName);
  const node: BlockNode = {
    name: fileName,
    methods: [],
    variables: [],
  };
  bundle.resolvedNodes.push(node);
  resolvedNodes.push(node);
  return node;
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
          from: getShortPath(path.resolve(fromFileName)),
          to: getShortPath(path.resolve(resolvedFileName)),
        });
      } else {
        console.error("fail", node.getText());
      }
  }
}

const getExportedMethodsFn = (
  lastExportedNode: BlockNode,
  bundle: TypeBundle
) => (node: ts.Node) => {
  if (!isNodeExported(node)) {
    return;
  }
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: true,
  });
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

  if (name && !(node as any).name) {
    lastExportedNode.variables.push(name);
  } else if (name && (node as any).name) {
    const method: Method = {
      name,
      symbolPrint: printer.printNode(
        ts.EmitHint.Unspecified,
        node,
        node.getSourceFile()
      ),
    };
    const symbol = bundle.checker.getSymbolAtLocation((node as any).name);
    if (symbol) {
      const { documentation } = serializeSymbol(symbol, bundle.checker);
      method.documentation = documentation;
      if (name === "val") {
        console.log(name, documentation, method);
      }
    }
    lastExportedNode.methods.push(method);
  }
};
/** Serialize a symbol into a json object */
function serializeSymbol(symbol: ts.Symbol, checker: ts.TypeChecker) {
  return {
    name: symbol.getName(),
    documentation: ts.displayPartsToString(
      symbol.getDocumentationComment(checker)
    ),
    type: checker.typeToString(
      checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!)
    ),
  };
}
// function serializeMySymbol(symbol: ts.Symbol) {
//   let details = serializeSymbol(symbol);

//   // Get the construct signatures
//   let constructorType = checker.getTypeOfSymbolAtLocation(
//     symbol,
//     symbol.valueDeclaration!
//   );
//   details.constructors = constructorType
//     .getCallSignatures()
//     .map(serializeSignature);
//   return details;
// }
/** True if this is visible outside this file, false otherwise */
function isNodeExported(node: ts.Node): boolean {
  return (
    (ts.getCombinedModifierFlags(node as ts.Declaration) &
      ts.ModifierFlags.Export) !==
    0
  );
}
/**
 * Some big comment
 */
export function getShortPath(path: string) {
  return "." + path.replace(baseUrl, "");
}
