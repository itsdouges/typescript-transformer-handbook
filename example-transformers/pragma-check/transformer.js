const transformer = context => {
    return sourceFile => {
        const jsxPragma = sourceFile.pragmas.get('jsx');
        if (jsxPragma) {
            console.log(`a jsx pragma was found using the factory "${jsxPragma.arguments.factory}"`);
        }
        return sourceFile;
    };
};
export default transformer;
