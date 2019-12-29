import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isVariableDeclaration(node)) {
        const newNode = ts.getMutableClone(node) as ts.VariableDeclaration;
        newNode.initializer = ts.createStringLiteral('mutable-world');
        return newNode;
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor);
  };
};

export default transformer;
