import * as ts from 'typescript';

const transformerProgram = (program: ts.Program) => {
  const transformerFactory: ts.TransformerFactory<ts.SourceFile> = context => {
    return sourceFile => {
      const visitor = (node: ts.Node): ts.Node => {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          ts.isNamedImports(node.importClause.namedBindings)
        ) {
          const moduleImportName = node.moduleSpecifier.text;
          const { resolvedFileName } = (sourceFile as any).resolvedModules.get(moduleImportName);
          const moduleSourceFile = program.getSourceFile(resolvedFileName);

          (moduleSourceFile as any).symbol.exports.forEach((_, key) => {
            console.log(`found export ${key}`);
          });

          return node;
        }

        return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitNode(sourceFile, visitor);
    };
  };

  return transformerFactory;
};

export default transformerProgram;
