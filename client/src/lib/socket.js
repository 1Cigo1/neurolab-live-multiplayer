import { io } from "socket.io-client";
export const socket = io.connect("https://neurolab-live-multiplayer.onrender.com");
