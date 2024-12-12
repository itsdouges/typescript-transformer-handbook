import * as ts from 'typescript';

const transformerProgram = () => {
  const transformerFactory: ts.TransformerFactory<ts.SourceFile> = context => {
    return sourceFile => {
      const visitor = (node: ts.Node): ts.Node => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          // Find the import location in the file system using require.resolve
          const pkgEntry = require.resolve(`${node.moduleSpecifier.text}`);

          // Create another program
          const innerProgram = ts.createProgram([pkgEntry], {
            // Important to set this to true!
            allowJs: true,
          });

          console.log(innerProgram.getSourceFile(pkgEntry)?.getText());

          return node;
        }

        return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
    };
  };

  return transformerFactory;
};

export default transformerProgram;
