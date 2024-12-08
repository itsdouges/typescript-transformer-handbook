import * as ts from 'typescript';
const transformer = context => {
    return sourceFile => {
        const visitor = (node) => {
            if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
                context.hoistVariableDeclaration(node.name);
                return node;
            }
            return ts.visitEachChild(node, visitor, context);
        };
        return ts.visitNode(sourceFile, visitor);
    };
};
export default transformer;
