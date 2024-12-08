import * as ts from 'typescript';
const transformer = () => {
    return sourceFile => {
        return ts.updateSourceFileNode(sourceFile, [
            ts.createImportDeclaration(
            /* decorators */ undefined, 
            /* modifiers */ undefined, ts.createImportClause(ts.createIdentifier('DefaultImport'), ts.createNamedImports([
                ts.createImportSpecifier(undefined, ts.createIdentifier('namedImport')),
            ])), ts.createLiteral('package')),
            // Ensures the rest of the source files statements are still defined.
            ...sourceFile.statements,
        ]);
    };
};
export default transformer;
