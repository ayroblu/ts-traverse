import fs from 'fs';

import ts from 'typescript';

interface DocEntry {
  name?: string;
  fileName?: string;
  documentation?: string;
  type?: string;
  constructors?: DocEntry[];
  parameters?: DocEntry[];
  returnType?: string;
}

/** Generate documentation for all classes in a set of .ts files */
function generateDocumentation(
  fileNames: string[],
  options: ts.CompilerOptions
): void {
  // Build a program using the set of root file names in fileNames
  let program = ts.createProgram(fileNames, options);

  // const diagnostics = ts.getPreEmitDiagnostics(program);

  // for (const diagnostic of diagnostics) {
  //   const message = diagnostic.messageText;
  //   const file = diagnostic.file;
  //   const filename = file.fileName;

  //   const lineAndChar = file.getLineAndCharacterOfPosition(diagnostic.start);

  //   const line = lineAndChar.line + 1;
  //   const character = lineAndChar.character + 1;

  //   console.log(message);
  //   console.log(`(${filename}:${line}:${character})`);
  // }

  // Get the checker, we will use it to find more about classes
  let checker = program.getTypeChecker();
  let output: DocEntry[] = [];

  // Visit every sourceFile in the program
  for (const sourceFile of program.getSourceFiles()) {
    // console.log('sourceFile', sourceFile.fileName);
    if (!sourceFile.isDeclarationFile) {
      // Walk the tree to search for classes
      ts.forEachChild(sourceFile, visit);
    }
  }

  // print out the doc
  // fs.writeFileSync('classes.json', JSON.stringify(output, undefined, 4));

  return;

  /** visit nodes finding exported classes */
  function visit(node: ts.Node) {
    // Only consider exported nodes
    if (!isNodeExported(node)) {
      return;
    }
    // node.forEachChild((n) => {
    //   console.log(n.getText());
    // });
    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
      removeComments: true,
    });

    // This is an incomplete set of AST nodes which could have a top level identifier
    // it's left to you to expand this list, which you can do by using
    // https://ts-ast-viewer.com/ to see the AST of a file then use the same patterns
    // as below
    let name = '';
    if (ts.isFunctionDeclaration(node)) {
      name = node.name.text;
      // Hide the method body when printing
      node.body = undefined;
    } else if (ts.isVariableStatement(node)) {
      name = node.declarationList.declarations[0].name.getText(
        node.getSourceFile()
      );
    } else if (ts.isInterfaceDeclaration(node)) {
      name = node.name.text;
    }

    if (name && node.name) {
      let symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        // console.log(serializeClass(symbol));
      }
      console.log(node.getSourceFile().fileName);
      console.log('### ' + name);
      console.log(
        printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
      );
    }

    if (ts.isClassDeclaration(node) && node.name) {
      // This is a top level class, get its symbol
      let symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        output.push(serializeClass(symbol));
      }
      // No need to walk any further, class expressions/inner declarations
      // cannot be exported
    } else if (ts.isModuleDeclaration(node)) {
      // This is a namespace, visit its children
      ts.forEachChild(node, visit);
    }
  }

  /** Serialize a symbol into a json object */
  function serializeSymbol(symbol: ts.Symbol): DocEntry {
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

  /** Serialize a class symbol information */
  function serializeClass(symbol: ts.Symbol) {
    let details = serializeSymbol(symbol);

    // Get the construct signatures
    let constructorType = checker.getTypeOfSymbolAtLocation(
      symbol,
      symbol.valueDeclaration!
    );
    details.constructors = constructorType
      .getCallSignatures()
      .map(serializeSignature);
    return details;
  }

  /** Serialize a signature (call or construct) */
  function serializeSignature(signature: ts.Signature) {
    return {
      parameters: signature.parameters.map(serializeSymbol),
      returnType: checker.typeToString(signature.getReturnType()),
      documentation: ts.displayPartsToString(
        signature.getDocumentationComment(checker)
      ),
    };
  }

  /** True if this is visible outside this file, false otherwise */
  function isNodeExported(node: ts.Node): boolean {
    return (
      (ts.getCombinedModifierFlags(node as ts.Declaration) &
        ts.ModifierFlags.Export) !==
      0
    );
  }
}

const parseConfigHost: ts.ParseConfigHost = {
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  useCaseSensitiveFileNames: true,
};

const configFileName = ts.findConfigFile(
  './',
  ts.sys.fileExists,
  'tsconfig.json'
);
const configFile = ts.readConfigFile(configFileName!, ts.sys.readFile);
const { options: compilerOptions } = ts.parseJsonConfigFileContent(
  configFile.config,
  parseConfigHost,
  './'
);
console.log(compilerOptions);
generateDocumentation(process.argv.slice(2), compilerOptions);
