import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isVariableDeclarationList(node)) {
        return ts.updateVariableDeclarationList(node, [
          ...node.declarations,
          ts.createVariableDeclaration(
            ts.createUniqueName('hello'),
            undefined,
            ts.createStringLiteral('world')
          ),
        ]);
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor);
  };
};

export default transformer;
