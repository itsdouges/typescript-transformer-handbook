# Transformer Handbook

This document covers how to write a [Typescript](https://typescriptlang.org/) [Transformer](https://basarat.gitbooks.io/typescript/content/docs/compiler/ast.html).

## Table of contents

- [Introduction](#introduction)
- [The basics](#the-basics)
  - [What are abstract syntax trees (ASTs)](#what-are-abstract-syntax-trees--asts-)
  - [Stages of Typescript](#stages-of-typescript)
    - [A Program according to Typescript](#a-program-according-to-typescript)
  - [Traversal](#traversal)
    - [visitNode()](#visitnode--)
    - [visitEachChild()](#visiteachchild--)
    - [visitor](#visitor)
    - [context](#context)
  - [Scopes](#scopes)
- [API](#api)
- [Writing your first transformer](#writing-your-first-transformer)
- [Types of transformers](#types-of-transformers)
  - [Transformer options](#transformer-options)
  - [Consuming transformers](#consuming-transformers)
- [Transformation operations](#transformation-operations)
  - [Visiting](#visiting)
    - [Checking a node is a certain type](#checking-a-node-is-a-certain-type)
    - [Check if an identifier is referenced](#check-if-an-identifier-is-referenced)
    - [Find a specific parent](#find-a-specific-parent)
    - [Stopping traversal](#stopping-traversal)
  - [Manipulation](#manipulation)
    - [Replacing a node](#replacing-a-node)
    - [Replacing a node with multiple nodes](#replacing-a-node-with-multiple-nodes)
    - [Inserting a sibling node](#inserting-a-sibling-node)
    - [Inserting into a container](#inserting-into-a-container)
    - [Removing a node](#removing-a-node)
    - [Adding new import declarations](#adding-new-import-declarations)
  - [Scope](#scope)
    - [Checking if a local variable is referenced](#checking-if-a-local-variable-is-referenced)
    - [Generating a UID](#generating-a-uid)
    - [Pushing a variable declaration to a parent scope](#pushing-a-variable-declaration-to-a-parent-scope)
    - [Rename a binding and its references](#rename-a-binding-and-its-references)
- [Building nodes](#building-nodes)
- [Unit testing](#unit-testing)

## Introduction

Typescript is a typed superset of Javascript that compiles to plain Javascript.
Typescript supports the ability for consumers to _transform_ code from one form to another,
similarly to how [Babel](https://babeljs.io/) has _plugins_.

> Reach out to me [@itsmadou](https://twitter.com/itsmadou) for updates and general discourse.

## The basics

Transformers are essentially a function that looks like this:

```js
const Transformer = code => code;
```

The main difference though is that instead of being given a `string` of the code -
you are supplied with the AST,
described below.

### What are abstract syntax trees (ASTs)

Abstract Syntax Trees,
or ASTs,
are a data structure that describes what the code that has been parsed.
When working with AST's in Typescript I'd strongly recommend using an AST explorer -
such as [ts-ast-viewer.com](https://ts-ast-viewer.com).

Using such a tool we can see that the following code:

```js
function hello() {
  console.log("world");
}
```

In its AST representation it looks like this:

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

And for a more detailed look just interrogate the [AST yourself here](https://ts-ast-viewer.com/#code/GYVwdgxgLglg9mABACwKYBt10QCgJSIDeAUImYhAgM5zqoB0WA5jgOQDucATugCat4A3MQC+QA)!
You can view how the code AST could be generated in the bottom left panel,
and the node metadata in the right panel.

When investigating the metadata you'll notice they are have similar structure:

> Some properties have been omitted for simplicity.

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

> SyntaxKind is a Typescript enum which describes the kind of node.
> For [more information have a read of Basarat's AST tip](https://basarat.gitbooks.io/typescript/content/docs/compiler/ast-tip-syntaxkind.html).

And so on.
Each of these describe a `Node`.
ASTs can be made from one to many -
and together they describe the syntax of a program that can be used for static analysis.

Every node has a `kind` property which describes what kind of node it is.
We will talk about how to narrow the node to a specific type of node later.

### Stages of Typescript

Very similar to Babel -
Typescript has three primary stages,
**parse**,
**transform**,
**emit**.

With two extra steps that are exclusive to Typescript,
**binding** and **checker** (which relate to the _semantics_/type correctness,
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

### Traversal

When wanting to transform the AST to you to traverse the tree recursively.
In more concrete terms we want to _visit each node_,
and then return either the same,
an updated,
or a completely new node.

If we take the previous code examples AST in JSON format (with some values omitted):

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

We start at the `SourceFile` and then work through each node.
You might think you could meticulously traverse it yourself like `source.statements[0].name` etc,
but you'll find it won't scale and is prone to breaking very easily -
so use it wisely.

Ideally for the 90% case you'll want to use the built in methods to traverse the AST.
Typescript gives us two primary methods for doing this:

#### visitNode()

Generally you'll only pass this the initial `SourceFile`.
We'll go into what the `visitor` function is soon.

```ts
import * as ts from "typescript";

ts.visitNode(sourceFile, visitor);
```

#### visitEachChild()

This is a special function that uses `visitNode` under the hood.
It will handle traversing down to the inner most node -
and it knows how to do it without you having the think about it.
We'll go into what the `context` object is soon.

```ts
import * as ts from "typescript";

ts.visitEachChild(node, visitor, context);
```

#### `visitor`

The `visitor` function is something you'll be using in every Transformer you write.
The simplest function we could write might look something like this:

```ts
import * as ts from "typescript";

const visitor = (node: ts.Node): ts.Node => {
  console.log(node.kind);
  return ts.visitEachChild(node, visitor, context);
};

return ts.visitNode(sourceFile, visitor);
```

> **Note** - You'll see that we're _returning_ each node.
> This is required!
> If we didn't you'd see some funky errors.

If we applied this to the code example used before we would see this logged in our console:

```sh
288 # (SyntaxKind.SourceFile)
243 # (SyntaxKind.FunctionDeclaration)
75  # (SyntaxKind.Identifier)
222 # (SyntaxKind.Block)
225 # (SyntaxKind.ExpressionStatement)
195 # (SyntaxKind.CallExpression)
193 # (SyntaxKind.PropertyAccessExpression)
75  # (SyntaxKind.Identifier)
75  # (SyntaxKind.Identifier)
10  # (SyntaxKind.StringLiteral)
1   # (SyntaxKind.EndOfFileToken)
```

It goes as deep as possible entering each node,
exiting when it bottoms out,
and then entering other child nodes that it comes to.

#### `context`

Every Transformer will end up receiving the Transformation `context`.
This context is used both for `visitEachChild`,
as well as doing some useful things like getting a hold of what the current Typescript configuration is.
We'll see our first look at a simple Typescript transformer soon.

### Scopes

## API

## Writing your first transformer

## Types of transformers

### Transformer options

### Consuming transformers

## Transformation operations

### Visiting

#### Checking a node is a certain type

#### Check if an identifier is referenced

#### Find a specific parent

#### Stopping traversal

### Manipulation

#### Replacing a node

#### Replacing a node with multiple nodes

#### Inserting a sibling node

#### Inserting into a container

#### Removing a node

#### Adding new import declarations

### Scope

#### Checking if a local variable is referenced

#### Generating a UID

#### Pushing a variable declaration to a parent scope

#### Rename a binding and its references

## Building nodes

## Unit testing
