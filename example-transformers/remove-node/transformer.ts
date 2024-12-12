import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node | undefined => {
      if (ts.isImportDeclaration(node)) {
        return undefined;
      }

      return ts.visitEachChild(node, visitor, context);
    };

    const sourceFileVisitor = (sourceFile: ts.SourceFile): ts.SourceFile => {
      return ts.visitEachChild(sourceFile, visitor, context);
    };

    return ts.visitNode(sourceFile, sourceFileVisitor, ts.isSourceFile);
  };
};

export default transformer;
