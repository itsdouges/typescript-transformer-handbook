#!/usr/bin/env bash

cd examples && ls -d */ | xargs -I {} bash -c "cd '{}' && ttsc"
