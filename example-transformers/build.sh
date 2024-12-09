#!/usr/bin/env bash

cd example-transformers && ls -d */ | xargs -I {} bash -c "cd '{}' && tspc"
