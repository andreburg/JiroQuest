const { Socket, Server: SocketServer } = require("socket.io");
const { generateUID, hostProtected, JWT_SECRET } = require("../lib/utils");
const { sessions, getUserSession } = require("../lib/sessions");
const jwt = require("jsonwebtoken");

/** @param {SocketServer} io @returns {(socket: Socket) => void} */
const onSocketConnection = (io) => (socket) => {
  const socketRouter = {
    // Session Actions
    endSession: hostProtected(onEndSession),
    joinSession: onJoinSession,
    leaveSession: onLeaveSession,
    disconnect: onPlayerDisconnect,

    // Host Actions
    kickPlayer: hostProtected(onKickPlayer),
    sessionStateChange: hostProtected(onSessionStateChange),
    gameStateChange: hostProtected(onGameStateChange),
  };

  for (let key in socketRouter) {
    let func = socketRouter[key];
    socket.on(key, func(io, socket));
  }
};

/** @param {SocketServer} io @param {Socket} socket @returns {(payload: Object) => void} */
const onGameStateChange = (io, socket) => (payload) => {
  console.log(payload.game);

  let username;
  jwt.verify(socket.request.cookies.token, JWT_SECRET, (error, tokenData) => {
    username = tokenData?.username;
  });

  const userSession = getUserSession(username);
  sessions.set(userSession, payload.game);
  io.in(userSession).emit("gameStateChange", { game: payload.game });
};

/** @param {SocketServer} io @param {Socket} socket @returns {(payload: Object) => void} */
const onSessionStateChange = (io, socket) => (payload) => {
  let username;
  jwt.verify(socket.request.cookies.token, JWT_SECRET, (error, tokenData) => {
    username = tokenData?.username;
  });

  const userSession = getUserSession(username);
  sessions.set(userSession, payload.session);
  io.in(userSession).emit("sessionStateChange", { session: payload.session });
};

/** @param {SocketServer} io @param {Socket} socket @returns {(payload: Object) => void} */
const onPlayerDisconnect = (io, socket) => (payload) => {
  let username;
  jwt.verify(socket.request.cookies.token, JWT_SECRET, (error, tokenData) => {
    username = tokenData?.username;
  });

  const userSession = getUserSession(username);
  const session = sessions.get(userSession);

  console.log("disconnected");
  if (session) {
    if (session?.hostUsername === username) {
      io.in(userSession).emit("disconnected", {});
      io.in(userSession).disconnectSockets();
      sessions.delete(userSession);
    } else {
      session.players = session.players.filter(
        (player) => player.username !== username
      );

      io.in(userSession).emit("sessionStateChange", { session });
    }
  }
};

/** @param {SocketServer} io @param {Socket} socket @returns {(payload: Object) => void} */
const onEndSession = (io, socket) => (payload) => {
  io.in(payload.sessionId).disconnectSockets();
  sessions.delete(payload.sessionId);
};

/** @param {SocketServer} io @param {Socket} socket @returns {(payload: Object) => void} */
const onJoinSession = (io, socket) => (payload) => {
  let username;
  jwt.verify(socket.request.cookies.token, JWT_SECRET, (error, tokenData) => {
    username = tokenData?.username;
  });

  const session = sessions.get(payload.sessionId);
  if (!session) {
    socket.emit("error", {
      message: "Session does not exist.",
    });
    return;
  }

  if (session.status !== "lobby") {
    socket.emit("error", {
      message: "Unable to join ongoing game.",
    });
    return;
  }

  if (session.players.length >= 4) {
    socket.emit("error", {
      message: "Unable to join full session.",
    });
    return;
  }

  socket.join(payload.sessionId);

  let newPlayer = { socketId: socket.id, username: username };

  session.players = [
    ...session.players.filter(
      (player) => player.username !== newPlayer.username
    ),
    newPlayer,
  ];

  io.in(payload.sessionId).emit("sessionStateChange", { session });
};

/** @param {SocketServer} io @param {Socket} socket @returns {(payload: Object) => void} */
const onLeaveSession = (io, socket) => (payload) => {
  let username;
  jwt.verify(socket.request.cookies.token, JWT_SECRET, (error, tokenData) => {
    username = tokenData?.username;
  });
  const userSession = getUserSession(username);
  const session = sessions.get(userSession);

  session.players = session.players.filter(
    (player) => player.username != username
  );

  socket.leave(userSession);

  socket.emit("sessionStateChange", { session });
  socket.disconnect();
};

/** @param {SocketServer} io @param {Socket} socket @returns {(payload: Object) => void} */
const onKickPlayer = (io, socket) => (payload) => {
  let username;
  jwt.verify(socket.request.cookies.token, JWT_SECRET, (error, tokenData) => {
    username = tokenData?.username;
  });

  const userSession = getUserSession(username);
  console.log(userSession);
  const session = sessions.get(userSession);

  const socketId = session.players.filter(
    (player) => player.username === payload.username
  )[0]?.socketId;

  if (socketId) {
    const socketToKick = io.sockets.sockets.get(socketId);
    socketToKick.emit("disconnected", {});
    socketToKick.leave(userSession);
    session.players = session.players.filter(
      (p) => p.username !== payload.username
    );
    socket.emit("sessionStateChange", { session });
  }
};

module.exports = {
  onSocketConnection,
};
