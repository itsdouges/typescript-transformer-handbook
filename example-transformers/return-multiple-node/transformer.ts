import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      // If it is a expression statement,
      if (ts.isExpressionStatement(node)) {
        // Clone it
        const newNode = ts.getMutableClone(node);
        // And return it twice.
        // Effectively duplicating the statement
        return [node, newNode];
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor);
  };
};

export default transformer;
