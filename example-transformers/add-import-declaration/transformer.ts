import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = () => {
  return sourceFile => {
    return ts.factory.updateSourceFile(sourceFile, [
      ts.factory.createImportDeclaration(
        /* modifiers */ undefined,
        ts.factory.createImportClause(
          false,
          ts.factory.createIdentifier('DefaultImport'),
          ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('namedImport')),
          ])
        ),
        ts.factory.createStringLiteral('package')
      ),
      // Ensures the rest of the source files statements are still defined.
      ...sourceFile.statements,
    ]);
  };
};

export default transformer;
