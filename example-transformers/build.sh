#!/usr/bin/env bash

cd example-transformers && ls -d */ | xargs -I {} bash -c "cd '{}' && /c/repos/typescript-transformer-handbook/node_modules/.bin/tspc"
