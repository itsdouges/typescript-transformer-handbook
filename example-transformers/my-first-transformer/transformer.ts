import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isIdentifier(node)) {
        switch (node.escapedText) {
          case 'babel':
            return ts.createIdentifier('typescript');

          case 'plugins':
            return ts.createIdentifier('transformers');
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor);
  };
};

export default transformer;
