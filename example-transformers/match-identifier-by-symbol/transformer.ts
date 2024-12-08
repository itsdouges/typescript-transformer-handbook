import * as ts from 'typescript';

const transformerProgram = (program: ts.Program) => {
  const typeChecker = program.getTypeChecker();

  // Create array of found symbols
  const foundSymbols = new Array<ts.Symbol>();

  const transformerFactory: ts.TransformerFactory<ts.SourceFile> = context => {
    return sourceFile => {
      const visitor = (node: ts.Node): ts.Node => {
        if (ts.isIdentifier(node)) {
          const relatedSymbol = typeChecker.getSymbolAtLocation(node)!;

          // Check if array already contains same symbol - check by reference
          if (foundSymbols.includes(relatedSymbol)) {
            const foundIndex = foundSymbols.indexOf(relatedSymbol);
            console.log(
              `Found existing symbol at position = ${foundIndex} and name = "${relatedSymbol.name}"`
            );
          } else {
            // If not found, Add it to array
            foundSymbols.push(relatedSymbol);

            console.log(
              `Found new symbol with name = "${
                relatedSymbol.name
              }". Added at position = ${foundSymbols.length - 1}`
            );
          }

          return node;
        }

        return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
    };
  };

  return transformerFactory;
};

export default transformerProgram;
