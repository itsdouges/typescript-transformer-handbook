import * as ts from 'typescript';

const findParent = (node: ts.Node, predicate: (node: ts.Node) => boolean) => {
  if (!node.parent) {
    return undefined;
  }

  if (predicate(node.parent)) {
    return node.parent;
  }

  return findParent(node.parent, predicate);
};

const transformerFactory: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isStringLiteral(node)) {
        const parent = findParent(node, ts.isFunctionDeclaration);
        if (parent) {
          console.log('string literal has a function declaration parent');
        }

        return node;
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
  };
};

export default transformerFactory;
