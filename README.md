# StockMate Chess

StockMate Chess is a web application that allows you to play chess with a local Stockfish engine or against other online players.

It is built with React and TypeScript for the frontend and Express and Node.js for the backend, mainly because I wanted to learn how to build a web app with these technologies.

<img src="stockmate-chess.png" alt="StockMate Chess" width="400" />

## Getting Started

The application consists of two parts: a client (frontend) and a server (backend). They need to be started separately and run on different ports.

1. Start the server (runs on port 3001):
   ```
   npm start
   ```

2. In a new terminal, start the client (runs on port 3000):
   ```
   cd client
   npm start
   ```

After starting both the server and client, you can access the application by opening a web browser and navigating to `http://localhost:3000`.

### Prerequisites

Install Stockfish on your Mac:

    brew install stockfish

on Ubuntu:

    apt install stockfish

## System Overview

StockMate Chess is structured as a full-stack application with the following main components:

1. **Client**: A React-based frontend application (port 3000)
2. **Server**: A Node.js backend server using Express (port 3001)
3. **WebSocket**: Real-time communication between client and server
4. **Database**: SQLite database for storing user information and game data
5. **Stockfish Engine**: Local chess engine for AI gameplay

### Architecture Diagram

This diagram shows the high-level architecture of the StockMate Chess system, illustrating the relationships between the main components.

```mermaid
graph TD
    A[Client - React<br>Port 3000] -->|HTTP| B[Server - Node.js/Express<br>Port 3001]
    A <-->|WebSocket| B
    B -->|UCI| C[Stockfish Engine]
    B <-->|Query/Update| D[(SQLite Database)]
    B -->|HTTP| E[ChessTune API]
```

### Component Details

1. **Client** (Port 3000):
   - Built with React and TypeScript
   - Uses custom hooks for game logic, authentication, and WebSocket communication
   - Includes components for the chessboard, evaluation bar, and user authentication
   - Communicates with the server via HTTP requests and WebSocket

2. **Server** (Port 3001):
   - Built with Node.js and Express
   - Handles HTTP requests for user authentication and game management
   - Manages WebSocket connections for real-time game updates and player interactions
   - Interfaces with the Stockfish chess engine using the UCI protocol
   - Interacts with the SQLite database for user and game data persistence
   - Communicates with the ChessTune API for additional AI gameplay options

3. **WebSocket**:
   - Enables real-time, bidirectional communication between client and server
   - Used for:
     - Sending and receiving game moves
     - Updating online user list
     - Handling player challenges and responses
     - Starting games between players

4. **Database**:
   - Uses SQLite to store user information and game data
   - Manages user accounts, authentication, and ELO ratings

5. **Stockfish Engine**:
   - Local chess engine for AI gameplay
   - Communicates with the server using the Universal Chess Interface (UCI) protocol
   - Provides move suggestions and board evaluations

6. **ChessTune API**:
   - External chess AI service
   - Offers an alternative AI opponent to Stockfish

### Real-time Features

StockMate Chess implements several real-time features using WebSocket:

- Live updates of online players
- Real-time chess gameplay between online players
- Instant challenge system for initiating games
- Live game state synchronization

These features provide a dynamic and interactive user experience, allowing for seamless multiplayer gameplay and social interactions within the application.
