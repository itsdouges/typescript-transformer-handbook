import * as ts from 'typescript';
const transformer = context => {
    return sourceFile => {
        const visitor = (node) => {
            if (ts.isVariableDeclaration(node)) {
                return ts.updateVariableDeclaration(node, node.name, node.type, ts.createStringLiteral('updated-world'));
            }
            return ts.visitEachChild(node, visitor, context);
        };
        return ts.visitNode(sourceFile, visitor);
    };
};
export default transformer;
