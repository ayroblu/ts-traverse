import ts from 'typescript';

/**
 * https://stackoverflow.com/questions/53804566/how-to-get-compileroptions-from-tsconfig-json
 */
export function getCompilerOptions() {
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
  return compilerOptions;
}

export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
