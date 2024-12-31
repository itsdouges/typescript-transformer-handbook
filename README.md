# TypeScript Transformer Handbook

This document covers how to write a [TypeScript](https://typescriptlang.org/) [Transformer](https://basarat.gitbook.io/typescript/overview/ast).

# Table of contents

<!-- toc -->

- [Introduction](#introduction)
  - [Running examples](#running-examples)
- [The basics](#the-basics)
  - [What is a abstract syntax tree (AST)](#what-is-a-abstract-syntax-tree-ast)
  - [Stages](#stages)
    - [A Program according to TypeScript](#a-program-according-to-typescript)
    - [Parser](#parser)
    - [Scanner](#scanner)
    - [Binder](#binder)
    - [Transforms](#transforms)
    - [Emitting](#emitting)
  - [Traversal](#traversal)
    - [`visitNode()`](#visitnode)
    - [`visitEachChild()`](#visiteachchild)
    - [`visitor`](#visitor)
    - [`context`](#context)
  - [Scopes](#scopes)
    - [Bindings](#bindings)
- [Transformer API](#transformer-api)
  - [Visiting](#visiting)
  - [Nodes](#nodes)
  - [`context`](#context-1)
  - [`program`](#program)
  - [`typeChecker`](#typechecker)
- [Writing your first transformer](#writing-your-first-transformer)
- [Types of transformers](#types-of-transformers)
  - [Factory](#factory)
  - [Config](#config)
  - [Program](#program)
- [Consuming transformers](#consuming-transformers)
  - [`ttypescript`](#ttypescript)
  - [`webpack`](#webpack)
  - [`parcel`](#parcel)
- [Transformation operations](#transformation-operations)
  - [Visiting](#visiting-1)
    - [Checking a node is a certain type](#checking-a-node-is-a-certain-type)
    - [Check if two identifiers refer to the same symbol](#check-if-two-identifiers-refer-to-the-same-symbol)
    - [Find a specific parent](#find-a-specific-parent)
    - [Stopping traversal](#stopping-traversal)
  - [Manipulation](#manipulation)
    - [Updating a node](#updating-a-node)
    - [Replacing a node](#replacing-a-node)
    - [Replacing a node with multiple nodes](#replacing-a-node-with-multiple-nodes)
    - [Inserting a sibling node](#inserting-a-sibling-node)
    - [Removing a node](#removing-a-node)
    - [Adding new import declarations](#adding-new-import-declarations)
  - [Scope](#scope)
    - [Pushing a variable declaration to the top of its scope](#pushing-a-variable-declaration-to-the-top-of-its-scope)
    - [Pushing a variable declaration to a parent scope](#pushing-a-variable-declaration-to-a-parent-scope)
    - [Checking if a local variable is referenced](#checking-if-a-local-variable-is-referenced)
    - [Defining a unique variable](#defining-a-unique-variable)
    - [Rename a binding and its references](#rename-a-binding-and-its-references)
  - [Finding](#finding)
    - [Get line number and column](#get-line-number-and-column)
  - [Advanced](#advanced)
    - [Evaluating expressions](#evaluating-expressions)
    - [Following module imports](#following-module-imports)
    - [Following node module imports](#following-node-module-imports)
    - [Transforming jsx](#transforming-jsx)
    - [Determining the file pragma](#determining-the-file-pragma)
    - [Resetting the file pragma](#resetting-the-file-pragma)
- [Tips & tricks](#tips--tricks)
  - [Composing transformers](#composing-transformers)
  - [Throwing a syntax error to ease the developer experience](#throwing-a-syntax-error-to-ease-the-developer-experience)
- [Testing](#testing)
  - [`ts-transformer-testing-library`](#ts-transformer-testing-library)
- [Known bugs](#known-bugs)
  - [EmitResolver cannot handle `JsxOpeningLikeElement` and `JsxOpeningFragment` that didn't originate from the parse tree](#emitresolver-cannot-handle-jsxopeninglikeelement-and-jsxopeningfragment-that-didnt-originate-from-the-parse-tree)
  - [`getMutableClone(node)` blows up when used with `ts-loader`](#getmutableclonenode-blows-up-when-used-with-ts-loader)

<!-- tocstop -->

# Introduction

TypeScript is a typed superset of Javascript that compiles to plain Javascript.
TypeScript supports the ability for consumers to _transform_ code from one form to another,
similar to how [Babel](https://babeljs.io/) does it with _plugins_.

> Follow me [@itsmadou](https://twitter.com/itsmadou) for updates and general discourse

## Running examples

There are multiple examples ready for you to use through this handbook.
When you want to take the dive make sure to:

1. clone the repo
2. install deps with `yarn`
3. build the example you want `yarn build example_name`

# The basics

A transformer when boiled down is essentially a function that takes and returns some piece of code,
for example:

```js
const Transformer = code => code;
```

The difference though is that instead of `code` being of type `string` -
it is actually in the form of an abstract syntax tree (AST),
described below.
With it we can do powerful things like updating,
replacing,
adding,
& deleting `node`s.

## What is a abstract syntax tree (AST)

Abstract Syntax Trees,
or ASTs,
are a data structure that describes the code that has been parsed.
When working with ASTs in TypeScript I'd strongly recommend using an AST explorer -
such as [ts-ast-viewer.com](https://ts-ast-viewer.com).

Using such a tool we can see that the following code:

```js
function hello() {
  console.log('world');
}
```

In its AST representation looks like this:

```
-> SourceFile
  -> FunctionDeclaration
      - Identifier
  -> Block
    -> ExpressionStatement
      -> CallExpression
        -> PropertyAccessExpression
            - Identifier
            - Identifier
          - StringLiteral
  - EndOfFileToken
```

For a more detailed look check out the [AST yourself](https://ts-ast-viewer.com/#code/GYVwdgxgLglg9mABACwKYBt10QCgJSIDeAUImYhAgM5zqoB0WA5jgOQDucATugCat4A3MQC+QA)!
You can also see the code can be used to generate the same AST in the bottom left panel,
and the selected node metadata in the right panel.
Super useful!

When looking at the metadata you'll notice they all have a similar structure (some properties have been omitted):

```js
{
  kind: 307, // (SyntaxKind.SourceFile)
  pos: 0,
  end: 47,
  statements: [{...}],
}
```

```js
{
  kind: 262, // (SyntaxKind.FunctionDeclaration)
  pos: 0,
  end: 47,
  name: {...},
  body: {...},
}
```

```js
{
  kind: 244, // (SyntaxKind.ExpressionStatement)
  pos: 19,
  end: 45,
  expression: {...}
}
```

> `SyntaxKind` is a TypeScript enum which describes the kind of node.
> For [more information have a read of Basarat's AST tip](https://basarat.gitbook.io/typescript/overview/ast/ast-tip-syntaxkind).

And so on.
Each of these describe a `Node`.
ASTs can be made from one to many -
and together they describe the syntax of a program that can be used for static analysis.

Every node has a `kind` property which describes what kind of node it is,
as well as `pos` and `end` which describe where in the source they are.
We will talk about how to narrow the node to a specific type of node later in the handbook.

## Stages

Very similar to Babel -
TypeScript however has five stages,
**parser**,
_binder_,
_checker_,
**transform**,
**emitting**.

Two steps are exclusive to TypeScript,
_binder_ and _checker_.
We are going to gloss over _checker_ as it relates to TypeScripts type checking specifics.

> For a more in-depth understanding of the TypeScript compiler internals have a read of [Basarat's handbook](https://basarat.gitbook.io/typescript/).

### A Program according to TypeScript

Before we continue we need to quickly clarify exactly _what_ a `Program` is according to TypeScript.
A `Program` is a collection of one or more entrypoint source files which consume one or more modules.
The _entire_ collection is then used during each of the stages.

This is in contrast to how Babel processes files -
where Babel does file in file out,
TypeScript does _project_ in,
project out.
This is why enums don't work when parsing TypeScript with Babel for example,
it just doesn't have all the information available.

### Parser

The TypeScript parser actually has two parts,
the `scanner`,
and then the `parser`.
This step will convert source code into an AST.

```
SourceCode ~~ scanner ~~> Token Stream ~~ parser ~~> AST
```

The parser takes source code and tries to convert it into an in-memory AST representation which you can work with in the compiler. Also: see [Parser](https://basarat.gitbooks.io/typescript/content/docs/compiler/parser.html).

### Scanner

The scanner is used by the parser to convert a string into tokens in a linear fashion,
then it's up to a parser to tree-ify them.
Also: see [Scanner](https://basarat.gitbooks.io/typescript/docs/compiler/scanner.html).

### Binder

Creates a symbol map and uses the AST to provide the type system which is important to link references and to be able to know the nodes of imports and exports.
Also: see [Binder](https://basarat.gitbooks.io/typescript/docs/compiler/binder.html).

### Transforms

This is the step we're all here for.
It allows us,
the developer,
to change the code in any way we see fit.
Performance optimizations,
compile time behavior,
really anything we can imagine.

There are three stages of `transform` we care about:

- `before` - which run transformers before the TypeScript ones (code has not been compiled)
- `after` - which run transformers _after_ the TypeScript ones (code has been compiled)
- `afterDeclarations` - which run transformers _after_ the **declaration** step (you can transform type defs here)

Generally the 90% case will see us always writing transformers for the `before` stage,
but if you need to do some post-compilation transformation,
or modify types,
you'll end up wanting to use `after` and `afterDeclarations`.

> **Tip** - Type checking _should_ not happen after transforming.
> If it does it's more than likely a bug -
> file an issue!

### Emitting

This stage happens last and is responsible for _emitting_ the final code somewhere.
Generally this is usually to the file system -
but it could also be in memory.

## Traversal

When wanting to modify the AST in any way you need to traverse the tree -
recursively.
In more concrete terms we want to _visit each node_,
and then return either the same,
an updated,
or a completely new node.

If we take the previous example AST in JSON format (with some values omitted):

```js
{
  kind: 307, // (SyntaxKind.SourceFile)
  statements: [{
    kind: 262, // (SyntaxKind.FunctionDeclaration)
    name: {
      kind: 80 // (SyntaxKind.Identifier)
      escapedText: "hello"
    },
    body: {
      kind: 241, // (SyntaxKind.Block)
      statements: [{
        kind: 244, // (SyntaxKind.ExpressionStatement)
        expression: {
          kind: 213, // (SyntaxKind.CallExpression)
          expression: {
            kind: 211, // (SyntaxKind.PropertyAccessExpression)
            name: {
              kind: 80 // (SyntaxKind.Identifier)
              escapedText: "log",
            },
            expression: {
              kind: 80, // (SyntaxKind.Identifier)
              escapedText: "console",
            }
          }
        },
        arguments: [{
          kind: 11, // (SyntaxKind.StringLiteral)
          text: "world",
        }]
      }]
    }
  }]
}
```

If we were to traverse it we would start at the `SourceFile` and then work through each node.
You might think you could meticulously traverse it yourself,
like `source.statements[0].name` etc,
but you'll find it won't scale and is prone to breaking very easily -
so use it wisely.

Ideally for the 90% case you'll want to use the built in methods to traverse the AST.
TypeScript gives us two primary methods for doing this:

### `visitNode()`

Generally you'll only pass this the initial `SourceFile` node.
We'll go into what the `visitor` function is soon.

```ts
import * as ts from 'typescript';

ts.visitNode(sourceFile, visitor, test);
```

### `visitEachChild()`

This is a special function that uses `visitNode` internally.
It will handle traversing down to the inner most node -
and it knows how to do it without you having the think about it.
We'll go into what the `context` object is soon.

```ts
import * as ts from 'typescript';

ts.visitEachChild(node, visitor, context);
```

### `visitor`

The [`visitor` pattern](https://en.wikipedia.org/wiki/Visitor_pattern) is something you'll be using in every Transformer you write,
luckily for us TypeScript handles it so we need to only supply a callback function.
The simplest function we could write might look something like this:

```ts
import * as ts from 'typescript';

const transformer = sourceFile => {
  const visitor = (node: ts.Node): ts.Node => {
    console.log(node.kind, `\t# ts.SyntaxKind.${ts.SyntaxKind[node.kind]}`);
    return ts.visitEachChild(node, visitor, context);
  };

  return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
};
```

> **Note** - You'll see that we're _returning_ each node.
> This is required!
> If we didn't you'd see some funky errors.

If we applied this to the code example used before we would see this logged in our console (comments added afterwords):

```sh
307 	# ts.SyntaxKind.SourceFile
262 	# ts.SyntaxKind.FunctionDeclaration
80  	# ts.SyntaxKind.Identifier
241 	# ts.SyntaxKind.Block
244 	# ts.SyntaxKind.ExpressionStatement
213 	# ts.SyntaxKind.CallExpression
211 	# ts.SyntaxKind.PropertyAccessExpression
80  	# ts.SyntaxKind.Identifier
80  	# ts.SyntaxKind.Identifier
11  	# ts.SyntaxKind.StringLiteral
```

> **Tip** - You can see the source for this at [/example-transformers/log-every-node](/example-transformers/log-every-node) - if wanting to run locally you can run it via `yarn build log-every-node`.

It goes as deep as possible entering each node,
exiting when it bottoms out,
and then entering other child nodes that it comes to.

### `context`

Every transformer will receive the transformation `context`.
This context is used both for `visitEachChild`,
as well as doing some useful things like getting a hold of what the current TypeScript configuration is.
We'll see our first look at a simple TypeScript transformer soon.

## Scopes

> Most of this content is taken directly from the [Babel Handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#scopes) as the same principles apply.

Next let's introduce the concept of a [scope](<https://en.wikipedia.org/wiki/Scope_(computer_science)>).
Javascript has lexical scoping ([closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)),
which is a tree structure where blocks create new scope.

```js
// global scope

function scopeOne() {
  // scope 1

  function scopeTwo() {
    // scope 2
  }
}
```

Whenever you create a reference in Javascript,
whether that be by a variable,
function,
class,
param,
import,
label,
etc.,
it belongs to the current scope.

```js
var global = 'I am in the global scope';

function scopeOne() {
  var one = 'I am in the scope created by `scopeOne()`';

  function scopeTwo() {
    var two = 'I am in the scope created by `scopeTwo()`';
  }
}
```

Code within a deeper scope may use a reference from a higher scope.

```js
function scopeOne() {
  var one = 'I am in the scope created by `scopeOne()`';

  function scopeTwo() {
    one = 'I am updating the reference in `scopeOne` inside `scopeTwo`';
  }
}
```

A lower scope might also create a reference of the same name without modifying it.

```js
function scopeOne() {
  var one = 'I am in the scope created by `scopeOne()`';

  function scopeTwo() {
    var one = 'I am creating a new `one` but leaving reference in `scopeOne()` alone.';
  }
}
```

When writing a transform we want to be wary of scope.
We need to make sure we don't break existing code while modifying different parts of it.

We may want to add new references and make sure they don't collide with existing ones.
Or maybe we just want to find where a variable is referenced.
We want to be able to track these references within a given scope.

### Bindings

References all belong to a particular scope;
this relationship is known as a binding.

```js
function scopeOnce() {
  var ref = 'This is a binding';

  ref; // This is a reference to a binding

  function scopeTwo() {
    ref; // This is a reference to a binding from a lower scope
  }
}
```

# Transformer API

When writing your transformer you'll want to write it using TypeScript.
You'll be using the [`typescript`](https://www.npmjs.com/package/typescript) package to do most of the heavy lifting.
It is used for everything,
unlike Babel which has separate small packages.

First,
let's install it.

```sh
npm i typescript --save
```

And then let's import it:

```ts
import * as ts from 'typescript';
```

> **Tip** - I _strongly recommend_ using intellisense in VSCode to interrogate the API,
> it's super useful!

## Visiting

These methods are useful for visiting nodes -
we've briefly gone over a few of them above.

- `ts.visitNode(node, visitor, test)` - useful for visiting the root node, generally the `SourceFile`
- `ts.visitEachChild(node, visitor, context)` - useful for visiting each child of a node
- `ts.isXyz(node)` - useful for narrowing the type of a `node`, an example of this is `ts.isVariableDeclaration(node)`

## Nodes

These methods are useful for modifying a `node` in some form.

- `ts.factory.createXyz(...)` - useful for creating a new node (to then return), an example of this is `ts.factory.createIdentifier('world')`
- `ts.factory.updateXyz(node, ...)` - useful for updating a node (to then return), an example of this is `ts.factory.updateVariableDeclaration()`
- `ts.factory.updateSourceFile(sourceFile, ...)` - useful for updating a source file to then return
- `ts.setOriginalNode(newNode, originalNode)` - useful for setting a nodes original node
- `ts.setXyz(...)` - sets things
- `ts.addXyz(...)` - adds things

## `context`

Covered above,
this is supplied to every transformer and has some handy methods available (this is not an exhaustive list,
just the stuff we care about):

- `getCompilerOptions()` - Gets the compiler options supplied to the transformer
- `hoistFunctionDeclaration(node)` - Hoists a function declaration to the top of the containing scope
- `hoistVariableDeclaration(node)` - Hoists a variable declaration to the tope of the containing scope

## `program`

This is a special property that is available when writing a Program transformer.
We will cover this kind of transformer in [Types of transformers](#types-of-transformers).
It contains metadata about the _entire program_,
such as (this is not an exhaustive list,
just the stuff we care about):

- `getRootFileNames()` - get an array of file names in the project
- `getSourceFiles()` - gets all `SourceFile`s in the project
- `getCompilerOptions()` - compiler options from the `tsconfig.json`, command line, or other (can also get it from `context`)
- `getSourceFile(fileName: string)` - gets a `SourceFile` using its `fileName`
- `getSourceFileByPath(path: Path)` - gets a `SourceFile` using its `path`
- `getCurrentDirectory()` - gets the current directory string
- `getTypeChecker()` - gets ahold of the type checker, useful when doing things with [Symbols](https://basarat.gitbooks.io/typescript/content/docs/compiler/binder.html)

## `typeChecker`

This is the result of calling `program.getTypeChecker()`.
It has a lot of interesting things on in that we'll be interested in when writing transformers.

- `getSymbolAtLocation(node)` - useful for getting the symbol of a node
- `getExportsOfModule(symbol)` - will return the exports of a module symbol

# Writing your first transformer

It's the part we've all be waiting for!
Let's write out first transformer.

First let's import `typescript`.

```ts
import * as ts from 'typescript';
```

It's going to contain everything that we could use when writing a transformer.

Next let's create a default export that is going to be our transformer,
our initial transformer we be a transformer factory (because this gives us access to `context`) -
we'll go into the other kinds of transformers later.

```ts
import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    // transformation code here
  };
};

export default transformer;
```

Because we're using TypeScript to write out transformer -
we get all the type safety and more importantly intellisense!
If you're up to here you'll notice TypeScript complaining that we aren't returning a `SourceFile` -
let's fix that.

```diff
import * as ts from "typescript";

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    // transformation code here
+    return sourceFile;
  };
};

export default transformer;
```

Sweet we fixed the type error!

For our first transformer we'll take a hint from the [Babel Handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#writing-your-first-babel-plugin) and rename some identifiers.

Here's our source code:

```ts
babel === plugins;
```

Let's write a visitor function,
remember that a visitor function should take a `node` of a particular type (here a `SourceFile`),
and then return a `node` of the same type. Note that the `test` parameter of `visitNode` can be used
to ensure that nodes of a particular type are returned.

```diff
import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
+    const visitor = (node: ts.Node): ts.Node => {
+      return node;
+    };
+
+    return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
-
-    return sourceFile;
  };
};

export default transformer;
```

Okay that will visit the `SourceFile`...
and then just immediately return it.
That's a bit useless -
let's make sure we visit every node!

```diff
import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node => {
-      return node;
+      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
  };
};

export default transformer;
```

Now let's find identifiers so we can rename them:

```diff
import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node => {
+      if (ts.isIdentifier(node)) {
+        // transform here
+      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
  };
};

export default transformer;
```

And then let's target the specific identifiers we're interested in:

```diff
import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isIdentifier(node)) {
+        switch (node.escapedText) {
+          case 'babel':
+            // rename babel
+
+          case 'plugins':
+            // rename plugins
+        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
  };
};

export default transformer;
```

And then let's return new nodes that have been renamed!

```diff
import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isIdentifier(node)) {
        switch (node.escapedText) {
          case 'babel':
+            return ts.factory.createIdentifier('typescript');

          case 'plugins':
+            return ts.factory.createIdentifier('transformers');
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
  };
};

export default transformer;
```

Sweet!
When ran over our source code we get this output:

```ts
typescript === transformers;
```

> **Tip** - You can see the source for this at [/example-transformers/my-first-transformer](/example-transformers/my-first-transformer) - if wanting to run locally you can run it via `yarn build my-first-transformer`.

# Types of transformers

All transformers end up returning the `TransformerFactory` type signature.
These types of transformers are taken from [`ttypescript`](https://github.com/cevek/ttypescript).

## Factory

Also known as `raw`,
this is the same as the one used in writing your first transformer.

```ts
// ts.TransformerFactory
(context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => ts.SourceFile;
```

## Config

When your transformer needs config that can be controlled by consumers.

```ts
(config?: YourPluginConfigInterface) => ts.TransformerFactory;
```

## Program

When needing access to the `program` object this is the signature you should use,
it should return a `TransformerFactory`.
It also has configuration available as the second object,
supplied by consumers.

```ts
(program: ts.Program, config?: YourPluginConfigInterface) => ts.TransformerFactory;
```

# Consuming transformers

Amusingly TypeScript has no official support for consuming transformers via `tsconfig.json`.
There is a [GitHub issue](https://github.com/microsoft/TypeScript/issues/14419) dedicated to talking about introducing something for it.
Regardless you can consume transformers it's just a little round-about.

## [`ts-patch`](https://github.com/nonara/ts-patch)

> **This is the recommended approach**!
> Hopefully in the future this can be officially supported in `typescript`.

Essentially a wrapper over the top of the `tsc` CLI -
this gives first class support to transformers via the `tsconfig.json`.
It has `typescript` listed as a peer dependency so the theory is it isn't too brittle.

Install:

```sh
npm i ts-patch -D
```

Add your transformer into the compiler options:

```json
{
  "compilerOptions": {
    "plugins": [{ "transform": "my-first-transformer" }]
  }
}
```

Run `tspc`:

```sh
tspc
```

`ts-patch` supports `tsc` CLI,
Webpack,
Rollup,
Jest,
& VSCode.
Everything we would want to use TBH.

# Transformation operations

## Visiting

### Checking a node is a certain type

There is a wide variety of helper methods that can assert what type a node is.
When they return true they will _narrow_ the type of the `node`,
potentially giving you extra properties & methods based on the type.

> **Tip** - Abuse intellisense to interrogate the `ts` import for methods you can use,
> as well as [TypeScript AST Viewer](https://ts-ast-viewer.com/) to know what type a node is.

```ts
import * as ts from 'typescript';

const visitor = (node: ts.Node): ts.Node => {
  if (ts.isJsxAttribute(node.parent)) {
    // node.parent is a jsx attribute
    // ...
  }
};
```

### Check if two identifiers refer to the same symbol

Identifiers are created by the parser and are always unique.
Say, if you create a variable `foo` and use it in another line, it will create 2 separate identifiers with the same text `foo`.

Then, the linker runs through these identifiers and connects the identifiers referring to the same variable with a common symbol (while considering scope and shadowing). Think of symbols as what we intuitively think as variables.

So, to check if two identifiers refer to the same symbol - just get the symbols related to the identifier and check if they are the same (by reference).

**Short example** -

```ts
const symbol1 = typeChecker.getSymbolAtLocation(node1);
const symbol2 = typeChecker.getSymbolAtLocation(node2);

symbol1 === symbol2; // check by reference
```

**Full example** -

This will log all repeating symbols.

```ts
import * as ts from 'typescript';

const transformerProgram = (program: ts.Program) => {
  const typeChecker = program.getTypeChecker();

  // Create array of found symbols
  const foundSymbols = new Array<ts.Symbol>();

  const transformerFactory: ts.TransformerFactory<ts.SourceFile> = context => {
    return sourceFile => {
      const visitor = (node: ts.Node): ts.Node => {
        if (ts.isIdentifier(node)) {
          const relatedSymbol = typeChecker.getSymbolAtLocation(node);

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
```

> **Tip** - You can see the source for this at [/example-transformers/match-identifier-by-symbol](/example-transformers/match-identifier-by-symbol) - if wanting to run locally you can run it via `yarn build match-identifier-by-symbol`.

### Find a specific parent

While there doesn't exist an out of the box method you can basically roll your own.
Given a node:

```ts
const findParent = (node: ts.Node, predicate: (node: ts.Node) => boolean) => {
  if (!node.parent) {
    return undefined;
  }

  if (predicate(node.parent)) {
    return node.parent;
  }

  return findParent(node.parent, predicate);
};

const visitor = (node: ts.Node): ts.Node => {
  if (ts.isStringLiteral(node)) {
    const parent = findParent(node, ts.isFunctionDeclaration);
    if (parent) {
      console.log('string literal has a function declaration parent');
    }
    return node;
  }
};
```

Will log to console `string literal has a function declaration parent` with the following source:

```ts
function hello() {
  if (true) {
    'world';
  }
}
```

- Be careful when traversing after replacing a node with another - `parent` may not be set.
  If you need to traverse after transforming make sure to set `parent` on the node yourself.

> **Tip** - You can see the source for this at [/example-transformers/find-parent](/example-transformers/find-parent) - if wanting to run locally you can run it via `yarn build find-parent`.

### Stopping traversal

In the visitor function you can return early instead of continuing down children,
so for example if we hit a node and we know we don't need to go any further:

```ts
const visitor = (node: ts.Node): ts.Node => {
  if (ts.isArrowFunction(node)) {
    // return early
    return node;
  }
};
```

## Manipulation

### Updating a node

```ts
if (ts.isVariableDeclaration(node)) {
  return ts.updateVariableDeclaration(
    node, 
    node.name, 
    undefined, 
    node.type, 
    ts.createStringLiteral('world')
  );
}
```

```diff
-const hello = true;
+const hello = "updated-world";
```

> **Tip** - You can see the source for this at [/example-transformers/update-node](/example-transformers/update-node) - if wanting to run locally you can run it via `yarn build update-node`.

### Replacing a node

Maybe instead of updating a node we want to completely change it.
We can do that by just returning... a completely new node!

```ts
if (ts.isFunctionDeclaration(node)) {
  // Will replace any function it finds with an arrow function.
  return ts.factory.createVariableDeclarationList(
    [
      ts.factory.createVariableDeclaration(
        ts.factory.createIdentifier(node.name.escapedText),
        undefined,
        ts.factory.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          ts.factory.createBlock([], false)
        )
      ),
    ],
    ts.NodeFlags.Const
  );
}
```

```diff
-function helloWorld() {}
+const helloWorld = () => {};
```

> **Tip** - You can see the source for this at [/example-transformers/replace-node](/example-transformers/replace-node) - if wanting to run locally you can run it via `yarn build replace-node`.

### Replacing a node with multiple nodes

Interestingly, a visitor function can also return an array of nodes instead of just one node.
That means, even though it gets one node as input, it can return multiple nodes which replaces that input node.

```ts
type Visitor<TIn extends Node = Node, TOut extends Node | undefined = TIn | undefined> = 
  (node: TIn) => VisitResult<TOut>;
type VisitResult<T extends Node | undefined> = T | readonly Node[];
```

Let's just replace every expression statement with two copies of the same statement (duplicating it) -

```ts
const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      // If it is a expression statement,
      if (ts.isExpressionStatement(node)) {
        // Return it twice.
        // Effectively duplicating the statement
        return [node, node];
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
  };
};
```

So,

```ts
let a = 1;
a = 2;
```

becomes

```js
let a = 1;
a = 2;
a = 2;
```

> **Tip** - You can see the source for this at [/example-transformers/return-multiple-node](/example-transformers/return-multiple-node) - if wanting to run locally you can run it via `yarn build return-multiple-node`.

The declaration statement (first line) is ignored as it's not a `ExpressionStatement`.

_Note_ - Make sure that what you are trying to do actually makes sense in the AST. For ex., returning two expressions instead of one is often just invalid.

Say there is an assignment expression (BinaryExpression with with EqualToken operator), `a = b = 2`. Now returning two nodes instead of `b = 2` expression is invalid (because right hand side can not be multiple nodes). So, TS will throw an error - `Debug Failure. False expression: Too many nodes written to output.`

### Inserting a sibling node

This is effectively same as the [previous section](#replacing-a-node-with-multiple-nodes). Just return a array of nodes including itself and other sibling nodes.

### Removing a node

What if you don't want a specific node anymore?
Return an `undefined`!

```ts
if (ts.isImportDeclaration(node)) {
  // Will remove all import declarations
  return undefined;
}
```

```diff
import lodash from 'lodash';
-import lodash from 'lodash';
```

> **Tip** - You can see the source for this at [/example-transformers/remove-node](/example-transformers/remove-node) - if wanting to run locally you can run it via `yarn build remove-node`.

### Adding new import declarations

Sometimes your transformation will need some runtime part,
for that you can add your own import declaration.

```ts
ts.factory.updateSourceFile(sourceFile, [
  ts.factory.createImportDeclaration(
    /* modifiers */ undefined,
    ts.factory.createImportClause(
      false,
      ts.factory.createIdentifier('DefaultImport'),
      ts.factory.createNamedImports([
        ts.factory.createImportSpecifier(
          false, 
          undefined, 
          ts.factory.createIdentifier('namedImport')
        ),
      ])
    ),
    ts.factory.createStringLiteral('package')
  ),
  // Ensures the rest of the source files statements are still defined.
  ...sourceFile.statements,
]);
```

```diff
+import DefaultImport, { namedImport } from "package";
```

> **Tip** - You can see the source for this at [/example-transformers/add-import-declaration](/example-transformers/add-import-declaration) - if wanting to run locally you can run it via `yarn build add-import-declaration`.

## Scope

### Pushing a variable declaration to the top of its scope

Sometimes you may want to push a `VariableDeclaration` so you can assign to it.
Remember that this only hoists the variable -
the assignment will still be where it was in the source.

```ts
if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
  context.hoistVariableDeclaration(node.name);
  return node;
}
```

```diff
function functionOne() {
+  var innerOne;
+  var innerTwo;
  const innerOne = true;
  const innerTwo = true;
}
```

> **Tip** - You can see the source for this at [/example-transformers/hoist-variable-declaration](/example-transformers/hoist-variable-declaration) - if wanting to run locally you can run it via `yarn build hoist-variable-declaration`.

You can also do this with function declarations:

```ts
if (ts.isFunctionDeclaration(node)) {
  context.hoistFunctionDeclaration(node);
  return node;
}
```

```diff
+function functionOne() {
+    console.log('hello, world!');
+}
if (true) {
  function functionOne() {
    console.log('hello, world!');
  }
}
```

> **Tip** - You can see the source for this at [/example-transformers/hoist-function-declaration](/example-transformers/hoist-function-declaration) - if wanting to run locally you can run it via `yarn build hoist-function-declaration`.

### Pushing a variable declaration to a parent scope

> **TODO** - Is this possible?

### Checking if a local variable is referenced

> **TODO** - Is this possible?

### Defining a unique variable

Sometimes you want to add a new variable that has a unique name within its scope,
luckily it's possible without needing to go through any hoops.

```ts
if (ts.isVariableDeclarationList(node)) {
  return ts.factory.updateVariableDeclarationList(node, [
    ...node.declarations,
    ts.factory.createVariableDeclaration(
      ts.factory.createUniqueName('hello'),
      undefined /* exclamation token */,
      undefined /* type */,
      ts.factory.createStringLiteral('world')
    ),
  ]);
}

return ts.visitEachChild(node, visitor, context);
```

```diff
-const hello = 'world';
+const hello = 'world', hello_1 = "world";
```

> **Tip** - You can see the source for this at [/example-transformers/create-unique-name](/example-transformers/create-unique-name) - if wanting to run locally you can run it via `yarn build create-unique-name`.

### Rename a binding and its references

> **TODO** - Is this possible in a concise way?

## Finding

### Get line number and column

```
sourceFile.getLineAndCharacterOfPosition(node.getStart());
```

## Advanced

### Evaluating expressions

> **TODO** - Is this possible?

### Following module imports

It's possible!

```ts
// We need to use a Program transformer to get ahold of the program object.
const transformerProgram = (program: ts.Program) => {
  const transformerFactory: ts.TransformerFactory<ts.SourceFile> = context => {
    return sourceFile => {
      const visitor = (node: ts.Node): ts.Node => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const typeChecker = program.getTypeChecker();
          const importSymbol = typeChecker.getSymbolAtLocation(node.moduleSpecifier)!;
          const exportSymbols = typeChecker.getExportsOfModule(importSymbol);

          exportSymbols.forEach(symbol =>
            console.log(
              `found "${
                symbol.escapedName
              }" export with value "${symbol.valueDeclaration!.getText()}"`
            )
          );

          return node;
        }

        return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
    };
  };

  return transformerFactory;
};
```

Which will log this to the console:

```
found "hello" export with value "hello = 'world'"
found "default" export with value "export default 'hello';"
```

You can also traverse the imported node as well using `ts.visitChild` and the like.

> **Tip** - You can see the source for this at [/example-transformers/follow-imports](/example-transformers/follow-imports) - if wanting to run locally you can run it via `yarn build follow-imports`.

### Following node module imports

Like following TypeScript imports for the code that you own,
sometimes we may want to also interrogate the code inside a module we're importing.

Using the same code above except running on a `node_modules` import we get this logged to the console:

```
found "mixin" export with value:
export declare function mixin(): {
  color: string;
};"
found "constMixin" export with value:
export declare function constMixin(): {
  color: 'blue';
};"
```

Hmm what - we're getting the type def AST instead of source code...
Lame!

So it turns out it's a little harder for us to get this working (at least out of the box).
It turns out we have two options :

1. Turn on `allowJs` in the tsconfig and the **delete the type def**...
   which will give us the source AST...
   but we now won't have type defs...
   So this isn't desirable.
2. Create another TS program and do the dirty work ourselves

**Spoiler:** _We're going with option 2_.
It's more resilient and will work when type checking is turned off -
which is also how we'll follow TypeScript imports in that scenario!

```ts
const visitor = (node: ts.Node): ts.Node => {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    // Find the import location in the file system using require.resolve
    const pkgEntry = require.resolve(`${node.moduleSpecifier.text}`);

    // Create another program
    const innerProgram = ts.createProgram([pkgEntry], {
      // Important to set this to true!
      allowJs: true,
    });

    console.log(innerProgram.getSourceFile(pkgEntry)?.getText());

    return node;
  }

  return ts.visitEachChild(node, visitor, context);
};
```

Which will log this to the console:

```
export function mixin() {
  return { color: 'red' };
}

export function constMixin() {
  return { color: 'blue' }
}
```

Awesome!
The cool thing about this btw is that since we've made a _program_ we will get all of _its_ imports followed for free!
However it'll have the same problem as above if they have type defs -
so watch out if you need to jump through multiple imports -
you'll probably have to do something more clever.

> **Tip** - You can see the source for this at [/example-transformers/follow-node-modules-imports](/example-transformers/follow-node-modules-imports) - if wanting to run locally you can run it via `yarn build follow-node-modules-imports`.

### Transforming jsx

TypeScript can also transform [JSX](https://reactjs.org/docs/introducing-jsx.html) -
there are a handful of helper methods to get started.
All previous methods of visiting and manipulation apply.

- `ts.isJsxXyz(node)`
- `ts.factory.updateJsxXyz(node, ...)`
- `ts.factory.createJsxXyz(...)`

Interrogate the typescript import for more details.
The primary point is you need to create valid JSX -
however if you ensure the types are valid in your transformer it's very hard to get it wrong.

### Determining the file pragma

Useful when wanting to know what the file pragma is so you can do something in your transform.
Say for example we wanted to know if a custom `jsx` pragma is being used:

```ts
const transformer = sourceFile => {
  const jsxPragma = (sourceFile as any).pragmas.get('jsx'); // see below regarding the cast to `any`
  if (jsxPragma) {
    console.log(`a jsx pragma was found using the factory "${jsxPragma.arguments.factory}"`);
  }

  return sourceFile;
};
```

The source file below would cause `'a jsx pragma was found using the factory "jsx"'` to be logged to console.

```ts
/** @jsx jsx */
```

> **Tip** - You can see the source for this at [/example-transformers/pragma-check](/example-transformers/pragma-check) - if wanting to run locally you can run it via `yarn build pragma-check`.

Currently as of 29/12/2019 `pragmas` is not on the typings for `sourceFile` -
so you'll have to cast it to `any` to gain access to it.

### Resetting the file pragma

Sometimes during transformation you might want to change the pragma _back_ to the default (in our case React).
I've found success with the following code:

```ts
const transformer = sourceFile => {
  sourceFile.pragmas.clear();
  delete sourceFile.localJsxFactory;
};
```

# Tips & tricks

## Composing transformers

If you're like me sometimes you want to split your big transformer up into small more maintainable pieces.
Well luckily with a bit of coding elbow grease we can achieve this:

```ts
const transformers = [...];

function transformer(
  program: ts.Program,
): ts.TransformerFactory<ts.SourceFile> {
  return context => {
    const initializedTransformers = transformers.map(transformer => transformer(program)(context));

    return sourceFile => {
      return initializedTransformers.reduce((source, transformer) => {
        return transformer(source);
      }, sourceFile);
    };
  };
}
```

## Throwing a syntax error to ease the developer experience

> **TODO** - Is this possible like it is in Babel?
> Or we use a [language service plugin](https://github.com/Microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin)?

# Testing

Generally with transformers the the usefulness of unit tests is quite limited.
I recommend writing integration tests to allow your tests to be super useful and resilient.
This boils down to:

- **Write integration tests** over unit tests
- Avoid snapshot tests - only do it if it makes sense - **the larger the snapshot the less useful it is**
- Try to pick apart specific behavior for every test you write - and only **assert one thing per test**

If you want you can use the [TypeScript compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#a-simple-transform-function) to setup your transformer for testing,
but I'd recommend using a library instead.

## [`ts-transformer-testing-library`](https://github.com/marionebl/ts-transformer-testing-library)

This library makes testing transformers easy.
It is made to be used in conjunction with a test runner such as [`jest`](https://github.com/facebook/jest).
It simplifies the setup of your transformer,
but still allows you to write your tests as you would for any other piece of software.

Here's an example test using it:

```ts
import { Transformer } from 'ts-transformer-testing-library';
import transformerFactory from '../index';
import pkg from '../../../../package.json';

const transformer = new Transformer()
  .addTransformer(transformerFactory)
  .addMock({ name: pkg.name, content: `export const jsx: any = () => null` })
  .addMock({
    name: 'react',
    content: `export default {} as any; export const useState = {} as any;`,
  })
  .setFilePath('/index.tsx');

it('should add react default import if it only has named imports', () => {
  const actual = transformer.transform(`
    /** @jsx jsx */
    import { useState } from 'react';
    import { jsx } from '${pkg.name}';

    <div css={{}}>hello world</div>
  `);

  // We are also using `jest-extended` here to add extra matchers to the jest object.
  expect(actual).toIncludeRepeated('import React, { useState } from "react"', 1);
});
```

# Known bugs

## EmitResolver cannot handle `JsxOpeningLikeElement` and `JsxOpeningFragment` that didn't originate from the parse tree

If you replace a node with a new jsx element like this:

```tsx
const visitor = node => {
  return ts.factory.createJsxFragment(
    ts.factory.createJsxOpeningFragment(), 
    [], 
    ts.factory.createJsxJsxClosingFragment()
  );
};
```

It will blow up if there are any surrounding `const` or `let` variables.
A work around is to ensure the opening/closing elements are passed into `ts.setOriginalNode`:

```diff
ts.createJsxFragment(
-  ts.createJsxOpeningFragment(),
+  ts.setOriginalNode(ts.factory.createJsxOpeningFragment(), node),
  [],
-  ts.createJsxJsxClosingFragment()
+  ts.setOriginalNode(ts.factory.createJsxJsxClosingFragment(), node)
);
```

See https://github.com/microsoft/TypeScript/issues/35686 for more information.
