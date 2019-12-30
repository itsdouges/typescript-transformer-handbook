import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const jsxPragma = (sourceFile as any).pragmas.get('jsx');
    if (jsxPragma) {
      console.log(`a jsx pragma was found using the factory "${jsxPragma.arguments.factory}"`);
    }

    return sourceFile;
  };
};

export default transformer;
