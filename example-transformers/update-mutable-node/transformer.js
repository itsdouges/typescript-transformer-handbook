import * as ts from 'typescript';
const transformer = context => {
    return sourceFile => {
        const visitor = (node) => {
            if (ts.isVariableDeclaration(node)) {
                const newNode = ts.getMutableClone(node);
                newNode.initializer = ts.createStringLiteral('mutable-world');
                return newNode;
            }
            return ts.visitEachChild(node, visitor, context);
        };
        return ts.visitNode(sourceFile, visitor);
    };
};
export default transformer;
