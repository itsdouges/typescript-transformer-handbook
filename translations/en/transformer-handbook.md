# Transformer Handbook

This document covers how to write a [Typescript](https://typescriptlang.org/) [Transformer](https://basarat.gitbooks.io/typescript/content/docs/compiler/ast.html).

## Table of contents

<!-- toc -->

- [Introduction](#introduction)
- [The basics](#the-basics)
  - [What is a abstract syntax tree (AST)](#what-is-a-abstract-syntax-tree-ast)
  - [Stages](#stages)
    - [A Program according to Typescript](#a-program-according-to-typescript)
    - [Parse](#parse)
    - [Transform](#transform)
    - [Emit](#emit)
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
    - [Check if an identifier is referenced](#check-if-an-identifier-is-referenced)
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
  - [Advanced](#advanced)
    - [Evaluating expressions](#evaluating-expressions)
    - [Following module imports](#following-module-imports)
    - [Transforming jsx](#transforming-jsx)
    - [Determining the file pragma](#determining-the-file-pragma)
- [Throwing a syntax error to ease the developer experience](#throwing-a-syntax-error-to-ease-the-developer-experience)
- [Testing](#testing)
  - [`ts-transformer-testing-library`](#ts-transformer-testing-library)

<!-- tocstop -->

## Introduction

Typescript is a typed superset of Javascript that compiles to plain Javascript.
Typescript supports the ability for consumers to _transform_ code from one form to another,
similar to how [Babel](https://babeljs.io/) does it with _plugins_.

> Follow me [@itsmadou](https://twitter.com/itsmadou) for updates and general discourse

## The basics

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

### What is a abstract syntax tree (AST)

Abstract Syntax Trees,
or ASTs,
are a data structure that describes the code that has been parsed.
When working with ASTs in Typescript I'd strongly recommend using an AST explorer -
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
You can see also see the code that you can use the generate the same AST in the bottom left panel,
and the selected node metadata in the right panel.
Super useful!

When looking at the metadata you'll notice they all have a similar structure (some properties have been omitted):

```js
{
  kind: 288, // (SyntaxKind.SourceFile)
  pos: 0,
  end: 47,
  statements: [{...}],
}
```

```js
{
  kind: 243, // (SyntaxKind.FunctionDeclaration)
  pos: 0,
  end: 47,
  name: {...},
  body: {...},
}
```

```js
{
  kind: 225, // (SyntaxKind.ExpressionStatement)
  pos: 19,
  end: 45,
  expression: {...}
}
```

> `SyntaxKind` is a Typescript enum which describes the kind of node.
> For [more information have a read of Basarat's AST tip](https://basarat.gitbooks.io/typescript/content/docs/compiler/ast-tip-syntaxkind.html).

And so on.
Each of these describe a `Node`.
ASTs can be made from one to many -
and together they describe the syntax of a program that can be used for static analysis.

Every node has a `kind` property which describes what kind of node it is,
as well as `pos` and `end` which describe where in the source they are.
We will talk about how to narrow the node to a specific type of node later in the handbook.

### Stages

Very similar to Babel -
Typescript has three primary stages,
**parse**,
**transform**,
**emit**.

With two extra steps that are exclusive to Typescript,
**binding** and **checking** (which relate to the _semantics_/type correctness,
which for the most part we're going to skimp over in this handbook).

> For a more in-depth understanding of the Typescript compiler internals have a read of [Basarat's handbook](https://basarat.gitbooks.io/typescript/content/docs/compiler/overview.html).

#### A Program according to Typescript

Before we continue we need to quickly clarify exactly _what_ a `Program` is according to Typescript.
A `Program` is a collection of one or more entrypoint source files which consume one or more modules.
The _entire_ collection is then used during each of the stages.

This is in contrast to how Babel processes files -
where Babel does file in file out,
Typescript does _project_ in,
project out.
This is why enums don't work when parsing Typescript with Babel for example,
it just doesn't have all the information available.

#### Parse

The Typescript parser actually has two parts,
the `scanner`,
and then the `parser`.
This step will convert source code into an AST.

```
SourceCode ~~ scanner ~~> Token Stream ~~ parser ~~> AST
```

I definitely recommend reading the [Parser section](https://basarat.gitbooks.io/typescript/content/docs/compiler/parser.html) in the Typescript Handbook.

#### Transform

This is the step we're all here for.
It allows us,
the developer,
to change the code in any way we see fit.
Performance optimizations,
compile time behavior,
really anything we can imagine.

There are three stages of `transform` we care about:

- `before` - which run transformers before the Typescript ones (code has not been compiled)
- `after` - which run transformers _after_ the Typescript ones (code has been compiled)
- `afterDeclarations` - which run transformers _after_ the **declaration** step (you can transform type defs here)

Generally the 90% case will see us always writing transformers for the `before` stage,
but if you need to do some post-compilation transformation,
or modify types,
you'll end up wanting to use `after` and `afterDeclarations`.

#### Emit

This stage happens last and is responsible for _emitting_ the final code somewhere.
Generally this is usually to the file system -
but it could also be in memory.

### Traversal

When wanting to modify the AST in any way you need to traverse the tree -
recursively.
In more concrete terms we want to _visit each node_,
and then return either the same,
an updated,
or a completely new node.

If we take the previous example AST in JSON format (with some values omitted):

```js
{
  kind: 288, // (SyntaxKind.SourceFile)
  statements: [{
    kind: 243, // (SyntaxKind.FunctionDeclaration)
    name: {
      kind: 75 // (SyntaxKind.Identifier)
      escapedText: "hello"
    },
    body: {
      kind: 222, // (SyntaxKind.Block)
      statements: [{
        kind: 225, // (SyntaxKind.ExpressionStatement)
        expression: {
          kind: 195, // (SyntaxKind.CallExpression)
          expression: {
            kind: 193, // (SyntaxKind.PropertyAccessExpression)
            name: {
              kind: 75 // (SyntaxKind.Identifier)
              escapedText: "log",
            },
            expression: {
              kind: 75, // (SyntaxKind.Identifier)
              escapedText: "console",
            }
          }
        },
        arguments: [{
          kind: 10, // (SyntaxKind.StringLiteral)
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
Typescript gives us two primary methods for doing this:

#### `visitNode()`

Generally you'll only pass this the initial `SourceFile` node.
We'll go into what the `visitor` function is soon.

```ts
import * as ts from 'typescript';

ts.visitNode(sourceFile, visitor);
```

#### `visitEachChild()`

This is a special function that uses `visitNode` internally.
It will handle traversing down to the inner most node -
and it knows how to do it without you having the think about it.
We'll go into what the `context` object is soon.

```ts
import * as ts from 'typescript';

ts.visitEachChild(node, visitor, context);
```

#### `visitor`

The [`visitor` pattern](https://en.wikipedia.org/wiki/Visitor_pattern) is something you'll be using in every Transformer you write,
luckily for us Typescript handles it so we need to only supply a callback function.
The simplest function we could write might look something like this:

```ts
import * as ts from 'typescript';

const transformer = sourceFile => {
  const visitor = (node: ts.Node): ts.Node => {
    console.log(node.kind, `\t# ts.SyntaxKind.${ts.SyntaxKind[node.kind]}`);
    return ts.visitEachChild(node, visitor, context);
  };

  return ts.visitNode(sourceFile, visitor);
};
```

> **Note** - You'll see that we're _returning_ each node.
> This is required!
> If we didn't you'd see some funky errors.

If we applied this to the code example used before we would see this logged in our console (comments added afterwords):

```sh
288 	# ts.SyntaxKind.SourceFile
243 	# ts.SyntaxKind.FunctionDeclaration
75  	# ts.SyntaxKind.Identifier
222 	# ts.SyntaxKind.Block
225 	# ts.SyntaxKind.ExpressionStatement
195 	# ts.SyntaxKind.CallExpression
193 	# ts.SyntaxKind.PropertyAccessExpression
75  	# ts.SyntaxKind.Identifier
75  	# ts.SyntaxKind.Identifier
10  	# ts.SyntaxKind.StringLiteral
```

> **Tip** - You can see the source for this at [/example-transformers/log-every-node](/example-transformers/log-every-node)

It goes as deep as possible entering each node,
exiting when it bottoms out,
and then entering other child nodes that it comes to.

#### `context`

Every transformer will receive the transformation `context`.
This context is used both for `visitEachChild`,
as well as doing some useful things like getting a hold of what the current Typescript configuration is.
We'll see our first look at a simple Typescript transformer soon.

### Scopes

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

> **TODO** - See how we can refer to a scope in a transformer.

#### Bindings

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

> **TODO** - See how we can refer to bindings in a transformer.

## Transformer API

When writing your transformer you'll want to write it using Typescript.
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

### Visiting

These methods are useful for visiting nodes -
we've briefly gone over a few of them above.

- `ts.visitNode(node, visitor)` - useful for visiting the root node, generally the `SourceFile`
- `ts.visitEachChild(node, visitor, context)` - useful for visiting each child of a node
- `ts.isXyz(node)` - useful for narrowing the type of a `node`, an example of this is `ts.isVariableDeclaration(node)`

### Nodes

These methods are useful for modifying a `node` in some form.

- `ts.createXyz(...)` - useful for creating a new node (to then return), an example of this is `ts.createIdentifier('world')`

  > **Tip** - Use [ts-creator](https://github.com/HearTao/ts-creator) to quickly get factory functions for a piece of Typescript source - instead of meticulously writing out an AST for a node you can write a code string and have it converted to AST for you.

- `ts.updateXyz(node, ...)` - useful for updating a node (to then return), an example of this is `ts.updateVariableDeclaration()`
- `ts.updateSourceFileNode(sourceFile, ...)` - useful for updating a source file to then return

### `context`

Covered above,
this is supplied to every transformer and has some handy methods available (this is not an exhaustive list,
just the stuff we care about):

- `getCompilerOptions()` - Gets the compiler options supplied to the transformer
- `hoistFunctionDeclaration(node)` - Hoists a function declaration to the top of the containing scope
- `hoistVariableDeclaration(node)` - Hoists a variable declaration to the tope of the containing scope

### `program`

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

## Writing your first transformer

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

Because we're using Typescript to write out transformer -
we get all the type safety and more importantly intellisense!
If you're up to here you'll notice Typescript complaining that we aren't returning a `SourceFile` -
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
remember that a visitor function should take a `node`,
and then return a `node`.

```diff
import * as ts from 'typescript';

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
+    const visitor = (node: ts.Node): ts.Node => {
+      return node;
+    };
+
+    return ts.visitNode(sourceFile, visitor);
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

    return ts.visitNode(sourceFile, visitor);
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

    return ts.visitNode(sourceFile, visitor);
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

    return ts.visitNode(sourceFile, visitor);
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
+            return ts.createIdentifier('typescript');

          case 'plugins':
+            return ts.createIdentifier('transformers');
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor);
  };
};

export default transformer;
```

Sweet!
When ran over our source code we get this output:

```ts
typescript === transformers;
```

> **Tip** - You can see the source for this at [/example-transformers/my-first-transformer](/example-transformers/my-first-transformer)

## Types of transformers

All transformers end up returning the `TransformerFactory` type signature.
These types of transformers are taken from [`ttypescript`](https://github.com/cevek/ttypescript).

### Factory

Also known as `raw`,
this is the same as the one used in writing your first transformer.

```ts
// ts.TransformerFactory
(context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => ts.SourceFile;
```

### Config

When your transformer needs config that can be controlled by consumers.

```ts
(config?: YourPluginConfigInterface) => ts.TransformerFactory;
```

### Program

When needing access to the `program` object this is the signature you should use,
it should return a `TransformerFactory`.
It also has configuration available as the second object,
supplied by consumers.

```ts
(program: ts.Program, config?: YourPluginConfigInterface) => ts.TransformerFactory;
```

## Consuming transformers

Amusingly Typescript has no official support for consuming transformers via `tsconfig.json`.
There is a [GitHub issue](https://github.com/microsoft/TypeScript/issues/14419) dedicated to talking about introducing something for it.
Regardless you can consume transformers it's just a little round-about.

### [`ttypescript`](https://github.com/cevek/ttypescript)

> **This is the recommended approach**!
> Hopefully in the future this can be officially supported in `typescript`.

Essentially a wrapper over the top of the `tsc` CLI -
this gives first class support to transformers vis the `tsconfig.json`.
It has `typescript` listed as a peer dependency so the theory is it isn't too brittle.

Install:

```sh
npm i ttypescript typescript -D
```

Add your transformer into the compiler options:

```json
{
  "compilerOptions": {
    "plugins": [{ "transform": "my-first-transformer" }]
  }
}
```

Run `ttsc`:

```sh
ttsc
```

`ttypescript` supports `tsc` CLI,
Webpack,
Parcel,
Rollup,
Jest,
& VSCode.
Everything we would want to use TBH.

### `webpack`

Using either [`awesome-typescript-loader`](https://github.com/s-panferov/awesome-typescript-loader#getcustomtransformers-string--program-tsprogram--tscustomtransformers--undefined-defaultundefined) or [`ts-loader`](https://github.com/TypeStrong/ts-loader#getcustomtransformers) you can either use the `getCustomTransformers()` option (they have the same signature) or you can use `ttypescript`:

```js
{
  test: /\.(ts|tsx)$/,
  loader: require.resolve('awesome-typescript-loader'),
  // or
  loader: require.resolve('ts-loader'),
  options: {
      compiler: 'ttypescript' // recommended, allows you to define transformers in tsconfig.json
      // or
      getCustomTransformers: program => {
        before: [yourBeforeTransformer(program, { customConfig: true })],
        after: [yourAfterTransformer(program, { customConfig: true })],
      }
  }
}
```

### `parcel`

Use `ttypescript` with the `parcel-plugin-ttypescript` plugin.
See: https://github.com/cevek/ttypescript#parcel

## Transformation operations

### Visiting

#### Checking a node is a certain type

There is a wide variety of helper methods that can assert what type a node is.
When they return true they will _narrow_ the type of the `node`,
potentially giving you extra properties & methods based on the type.

> **Tip** - Abuse intellisense to interrogate the `ts` import for methods you can use,
> as well as [Typescript AST Viewer](https://ts-ast-viewer.com/) to know what type a node is.

```ts
import * as ts from 'typescript';

const visitor = (node: ts.Node): ts.Node => {
  if (ts.isJsxAttribute(node.parent)) {
    // node.parent is a jsx attribute
    // ...
  }
};
```

#### Check if an identifier is referenced

> **TODO** - Is this possible?

#### Find a specific parent

> **TODO** - Is this possible?

#### Stopping traversal

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

> **TODO** - Is there a way to completely halt traversal?

### Manipulation

#### Updating a node

There are two ways we generally can update a node.
One is by creating a mutable clone,
the other is by calling `updateXyz` methods.

```ts
if (ts.isVariableDeclaration(node)) {
  const newNode = ts.getMutableClone(node) as ts.VariableDeclaration;
  newNode.initializer = ts.createStringLiteral('mutable-world');
  return newNode;
}
```

```diff
-const hello = true;
+const hello = "mutable-world";
```

> **Tip** - You can see the source for this at [/example-transformers/update-mutable-node](/example-transformers/update-mutable-node)

You'll notice that you can't mutate unless you `getMutableClone` -
**this is by design**.

Alternatively we can `update` the node via the helper methods:

```ts
if (ts.isVariableDeclaration(node)) {
  return ts.updateVariableDeclaration(node, node.name, node.type, ts.createStringLiteral('world'));
}
```

```diff
-const hello = true;
+const hello = "updated-world";
```

> **Tip** - You can see the source for this at [/example-transformers/update-node](/example-transformers/update-node)

#### Replacing a node

Maybe instead of updating a node we want to completely change it.
We can do that by just returning... a completely new node!

```ts
if (ts.isFunctionDeclaration(node)) {
  // Will replace any function it finds with an arrow function.
  return ts.createVariableDeclarationList(
    [
      ts.createVariableDeclaration(
        ts.createIdentifier(node.name.escapedText),
        undefined,
        ts.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          ts.createBlock([], false)
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

> **Tip** - You can see the source for this at [/example-transformers/replace-node](/example-transformers/replace-node)

#### Replacing a node with multiple nodes

> **TODO** - Is this possible?

#### Inserting a sibling node

> **TODO** - Is this possible?

#### Removing a node

One constraint of a transformer is you must _always_ return a node.
But what if you don't want a specific node anymore?
Return an empty statement!

```ts
if (ts.isImportDeclaration(node)) {
  // Will remove all import declarations
  return ts.createEmptyStatement();
}
```

```diff
import lodash from 'lodash';
-import lodash from 'lodash';
```

> **Tip** - You can see the source for this at [/example-transformers/remove-node](/example-transformers/remove-node)

#### Adding new import declarations

Sometimes your transformation will need some runtime part,
for that you can add your own import declaration.

```ts
ts.updateSourceFileNode(sourceFile, [
  ts.createImportDeclaration(
    /* decorators */ undefined,
    /* modifiers */ undefined,
    ts.createImportClause(
      ts.createIdentifier('DefaultImport'),
      ts.createNamedImports([
        ts.createImportSpecifier(undefined, ts.createIdentifier('namedImport')),
      ])
    ),
    ts.createLiteral('package')
  ),
  // Ensures the rest of the source files statements are still defined.
  ...sourceFile.statements,
]);
```

```diff
+import DefaultImport, { namedImport } from "package";
```

> **Tip** - You can see the source for this at [/example-transformers/add-import-declaration](/example-transformers/add-import-declaration)

### Scope

#### Pushing a variable declaration to the top of its scope

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

> **Tip** - You can see the source for this at [/example-transformers/hoist-variable-declaration](/example-transformers/hoist-variable-declaration)

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

> **Tip** - You can see the source for this at [/example-transformers/hoist-function-declaration](/example-transformers/hoist-function-declaration)

#### Pushing a variable declaration to a parent scope

> **TODO** - Is this possible?

#### Checking if a local variable is referenced

> **TODO** - Is this possible?

#### Defining a unique variable

Sometimes you want to add a new variable that has a unique name,
luckily it's possible without needing to go through any hoops.

```ts
if (ts.isVariableDeclarationList(node)) {
  return ts.updateVariableDeclarationList(node, [
    ...node.declarations,
    ts.createVariableDeclaration(
      ts.createUniqueName('hello'),
      undefined,
      ts.createStringLiteral('world')
    ),
  ]);
}

return ts.visitEachChild(node, visitor, context);
```

```diff
-const hello = 'world';
+const hello = 'world', hello_1 = "world";
```

> **Tip** - You can see the source for this at [/example-transformers/create-unique-name](/example-transformers/create-unique-name)

#### Rename a binding and its references

> **TODO** - Is this possible in a concise way?

### Advanced

#### Evaluating expressions

> **TODO** - Is this possible?

#### Following module imports

> **TODO** - Is this possible in a robust way?

#### Transforming jsx

Typescript can also transform [JSX](https://reactjs.org/docs/introducing-jsx.html) -
there are a handful of helper methods to get started.
All previous methods of visiting and manipulation apply.

- `ts.isJsxXyz(node)`
- `ts.updateJsxXyz(node, ...)`
- `ts.createJsxXyz(...)`

Interrogate the typescript import for more details.
The primary point is you need to create valid JSX -
however if you ensure the types are valid in your transformer it's very hard to get it wrong.

#### Determining the file pragma

Useful when wanting to know what the file pragma is so you can do something in your transform.
Say for example we wanted to know if a custom `jsx` pragma is being used:

```ts
const transformer = sourceFile => {
  const jsxPragma = sourceFile.pragmas.get('jsx');
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

> **Tip** - You can see the source for this at [/example-transformers/pragma-check](/example-transformers/pragma-check)

Currently as of 29/12/2019 `pragmas` is not on the typings for `sourceFile` -
so you'll have to cast it to `any` to gain access to it.

## Throwing a syntax error to ease the developer experience

> **TODO** - Is this possible like it is in Babel? Or we use a [language service plugin](https://github.com/Microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin)?

## Testing

Generally with transformers the the usefulness of unit tests is quite limited.
I recommend writing integration tests to allow your tests to be super useful and resilient.
This boils down to:

- **Write integration tests** over unit tests
- Avoid snapshot tests - only do it if it makes sense - **the larger the snapshot the less useful it is**
- Try to pick apart specific behavior for every test you write - and only **assert one thing per test**

If you want you can use the [Typescript compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#a-simple-transform-function) to setup your transformer for testing,
but I'd recommend using a library instead.

### [`ts-transformer-testing-library`](https://github.com/marionebl/ts-transformer-testing-library)

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
