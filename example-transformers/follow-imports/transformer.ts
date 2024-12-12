import * as ts from 'typescript';

const transformerProgram = (program: ts.Program) => {
  const transformerFactory: ts.TransformerFactory<ts.SourceFile> = context => {
    return sourceFile => {
      const visitor = (node: ts.Node): ts.Node => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const typeChecker = program.getTypeChecker();
          const importSymbol = typeChecker.getSymbolAtLocation(node.moduleSpecifier)!;
          const exportSymbols = typeChecker.getExportsOfModule(importSymbol);

          exportSymbols.forEach(symbol =>
            console.log(
              `found "${
                symbol.escapedName
              }" export with value "${symbol.valueDeclaration!.getText()}"`
            )
          );

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
