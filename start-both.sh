#!/bin/bash

# Start the client process in the background
(cd client && npm run start &)

# Start the server process
cd server && npm run start
