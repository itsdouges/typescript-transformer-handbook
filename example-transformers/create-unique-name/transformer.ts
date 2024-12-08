import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isVariableDeclarationList(node)) {
        return ts.factory.updateVariableDeclarationList(node, [
          ...node.declarations,
          ts.factory.createVariableDeclaration(
            ts.factory.createUniqueName('hello'),
            undefined /* exclamation token */,
            undefined /* type */,
            ts.factory.createStringLiteral('world')
          ),
        ]);
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
  };
};

export default transformer;
