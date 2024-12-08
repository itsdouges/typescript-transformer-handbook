import * as ts from 'typescript';
const transformer = context => {
    return sourceFile => {
        const visitor = (node) => {
            // If it is a expression statement,
            if (ts.isExpressionStatement(node)) {
                // Return it twice.
                // Effectively duplicating the statement
                return [node, node];
            }
            return ts.visitEachChild(node, visitor, context);
        };
        return ts.visitNode(sourceFile, visitor);
    };
};
export default transformer;
