# TTSM - Totally Terrible Server Manager

PLEASE NOTE - This is the SERVER part of the TTSM application. To access the source code for the web client, please
visit the [TTSM](https://github.com/totallyrin/ttsm) repository.

[//]: # (use the command `node .\server\server.js` from root directory to start the server)

# TTSM Server

The TTSM Server is the backend server component of the TTSM (Totally Terrible Server Manager), a web-based server
management tool for game servers. This repository contains the server-side code and accompanying files required to
run the TTSM.

## Features

- Provides WebSocket-based communication for real-time server management
- Handles server start, stop, and monitoring functionality
- Manages server logs and configuration files
- Communicates with the TTSM web client for real-time updates

## Installation

To install and run the TTSM Server locally, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/totallyrin/ttsm-server.git
   ```

2. Install dependencies:
   ```bash
   cd ttsm-server
   npm install
   ```

3. Configure the server settings:
   Open the `config.js` file and update the necessary server configuration options.

4. Start the server:
   ```bash
   node server/server.js
   ```
   This will start the TTSM Server and allow communication with the main site.

## Usage

The TTSM Server uses WebSocket communication to enable real-time server management. It establishes a WebSocket
connection with the TTSM web client, allowing for bidirectional communication between the client and server.

### WebSocket API

The TTSM Server provides a WebSocket API that allows the TTSM web client to send and receive messages. These messages
handle
various server management operations such as starting and stopping game servers, retrieving server logs, and performing
configuration changes.

## Contributing

Contributions to TTSM Server are welcome! If you find a bug or have a feature request, please open an issue on the
GitHub repository. If you'd like to contribute code, feel free to fork the repository and submit a pull request with
your changes.

Before submitting a pull request, please ensure that you have run the tests and that your code follows the project's
coding style guidelines.

## Acknowledgements

TTSM Server is built using [Node.js](https://nodejs.org). It utilizes
WebSockets for real-time communication. It may use additional libraries and tools, which are listed in the
project's `package.json` file.

---

If you have any questions or need further assistance, feel free to reach out.
