import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isVariableDeclaration(node)) {
        return ts.factory.updateVariableDeclaration(
          node,
          node.name,
          undefined /* exclamation token */,
          node.type,
          ts.factory.createStringLiteral('updated-world')
        );
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
  };
};

export default transformer;
