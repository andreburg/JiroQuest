import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

export const socket = io("http://localhost:9990");

const sessionIdMatch = window.location.pathname.match(/\/lobby\/([^/]+)/);
const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;
if (sessionId) {
  socket.emit("joinSession", {
    sessionId: sessionId,
  });
}
