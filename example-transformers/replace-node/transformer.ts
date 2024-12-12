import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isFunctionDeclaration(node)) {
        // Will replace any function it finds with an arrow function.
        return ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              ts.factory.createIdentifier(node.name!.escapedText as string),
              undefined /* exclamation token */,
              undefined /* type */,
              ts.factory.createArrowFunction(
                undefined /* modifiers */,
                undefined /* typeParameters */,
                [] /* parameters */,
                undefined /* type */,
                ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                ts.factory.createBlock([], false)
              )
            ),
          ],
          ts.NodeFlags.Const
        );
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
  };
};

export default transformer;
