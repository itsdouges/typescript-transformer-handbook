import * as ts from 'typescript';
const transformer = context => {
    return sourceFile => {
        const visitor = (node) => {
            if (ts.isFunctionDeclaration(node)) {
                // Will replace any function it finds with an arrow function.
                return ts.createVariableDeclarationList([
                    ts.createVariableDeclaration(ts.createIdentifier(node.name.escapedText), undefined, ts.createArrowFunction(undefined, undefined, [], undefined, ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken), ts.createBlock([], false))),
                ], ts.NodeFlags.Const);
            }
            return ts.visitEachChild(node, visitor, context);
        };
        return ts.visitNode(sourceFile, visitor);
    };
};
export default transformer;
