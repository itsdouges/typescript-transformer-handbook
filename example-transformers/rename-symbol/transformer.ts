import * as ts from 'typescript';

// Renames all references to the first identifier with the text "foo"
const identifierText = 'foo';
const identifierMatchIndex = 1;
const newIdentifierText = 'bar';

const transformerProgram = (program: ts.Program) => {
  const typeChecker = program.getTypeChecker();

  const transformerFactory: ts.TransformerFactory<ts.SourceFile> = context => {
    return sourceFile => {
      // 1. Find the symbol, if any
      let identifierCurrentIndex = -1;
      const findSymbolVisitor = (node: ts.Node): ts.Symbol | undefined => {
        if (ts.isIdentifier(node)) {
          const relatedSymbol = typeChecker.getSymbolAtLocation(node);

          console.log(relatedSymbol.escapedName);
          if (relatedSymbol.escapedName === identifierText) {
            identifierCurrentIndex += 1;
            if (identifierCurrentIndex === identifierMatchIndex) {
              console.log('found');
              return relatedSymbol;
            }
          }
        }

        return ts.forEachChild(node, findSymbolVisitor);
      };

      // 2. Mark the identifiers, if any
      const foundIdentifiers = new Array<ts.Identifier>();
      const findIdentifiersVisitor = (node: ts.Node): true | undefined => {
        if (ts.isIdentifier(node)) {
          const relatedSymbol = typeChecker.getSymbolAtLocation(node);

          if (relatedSymbol === foundSymbol) {
            foundIdentifiers.push(node);
            // Stop finding
            return true;
          }
        }

        ts.forEachChild(node, findIdentifiersVisitor);
        return undefined;
      };

      // 3. Modify the identifiers
      const modifyIdentifiersVisitor = (node: ts.Node): ts.Node => {
        if (ts.isIdentifier(node) && foundIdentifiers.includes(node)) {
          return ts.updateIdentifier(ts.createIdentifier(newIdentifierText));
        }

        return ts.visitEachChild(node, modifyIdentifiersVisitor, context);
      };

      // Execute step 1
      const foundSymbol = ts.forEachChild(sourceFile, findSymbolVisitor);

      // Execute step 2, if step 1 passed
      if (foundSymbol) {
        ts.forEachChild(sourceFile, findIdentifiersVisitor);
      }

      // Execute step 3, if step 2 passed
      if (foundIdentifiers.length > 0) {
        return ts.visitNode(sourceFile, modifyIdentifiersVisitor);
      }

      return sourceFile;
    };
  };

  return transformerFactory;
};

export default transformerProgram;
