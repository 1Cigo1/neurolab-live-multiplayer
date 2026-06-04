
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { nanoid } from "nanoid";

const app = express();
app.use(cors({ origin: "*" }));
app.get("/", (_, res) => res.json({ ok: true, app: "NeuroLab Live Server" }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 4000;
const rooms = new Map();

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function dsigmoid(y) { return y * (1 - y); }
function randWeight() { return Math.random() * 2 - 1; }
function createNetwork(hiddenCount = 4) {
  return {
    hiddenCount,
    w1: Array.from({ length: hiddenCount }, () => [randWeight(), randWeight()]),
    b1: Array.from({ length: hiddenCount }, randWeight),
    w2: Array.from({ length: hiddenCount }, randWeight),
    b2: randWeight(),
    epoch: 0,
    loss: null,
    history: []
  };
}
const DATASET = [
  { x: [0, 0], y: 0 }, { x: [0, 1], y: 1 }, { x: [1, 0], y: 1 }, { x: [1, 1], y: 0 }
];
function forward(net, input) {
  const hidden = net.w1.map((weights, i) => sigmoid(input[0] * weights[0] + input[1] * weights[1] + net.b1[i]));
  const output = sigmoid(hidden.reduce((sum, h, i) => sum + h * net.w2[i], net.b2));
  return { hidden, output };
}
function predictions(net) {
  return DATASET.map((d) => ({ ...d, pred: forward(net, d.x).output }));
}
function accuracy(net) {
  return predictions(net).filter(p => (p.pred >= 0.5 ? 1 : 0) === p.y).length / DATASET.length;
}
function trainOneEpoch(net, learningRate) {
  let totalLoss = 0;
  for (const sample of DATASET) {
    const { hidden, output } = forward(net, sample.x);
    const error = output - sample.y;
    totalLoss += error * error;
    const deltaOut = error * dsigmoid(output);
    const oldW2 = [...net.w2];
    for (let i = 0; i < net.hiddenCount; i++) net.w2[i] -= learningRate * deltaOut * hidden[i];
    net.b2 -= learningRate * deltaOut;
    for (let i = 0; i < net.hiddenCount; i++) {
      const deltaHidden = deltaOut * oldW2[i] * dsigmoid(hidden[i]);
      net.w1[i][0] -= learningRate * deltaHidden * sample.x[0];
      net.w1[i][1] -= learningRate * deltaHidden * sample.x[1];
      net.b1[i] -= learningRate * deltaHidden;
    }
  }
  return totalLoss / DATASET.length;
}
function trainNetwork(net, learningRate = 0.7, epochs = 100) {
  for (let i = 0; i < epochs; i++) {
    net.loss = trainOneEpoch(net, learningRate);
    net.epoch += 1;
    if (i % Math.max(1, Math.floor(epochs / 25)) === 0 || i === epochs - 1) {
      net.history.push({ epoch: net.epoch, loss: Number(net.loss.toFixed(6)), accuracy: Number(accuracy(net).toFixed(2)) });
    }
  }
  net.history = net.history.slice(-80);
  return net;
}
function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      roomId,
      users: [],
      net: createNetwork(4),
      params: { learningRate: 0.7, epochs: 100, hiddenCount: 4 },
      messages: [],
      trainingLog: []
    });
  }
  return rooms.get(roomId);
}
function publicState(room) {
  return {
    roomId: room.roomId,
    users: room.users,
    net: room.net,
    params: room.params,
    predictions: predictions(room.net),
    accuracy: accuracy(room.net),
    messages: room.messages.slice(-80),
    trainingLog: room.trainingLog.slice(-40)
  };
}
function broadcast(roomId) {
  const room = getRoom(roomId);
  io.to(roomId).emit("room-state", publicState(room));
}

io.on("connection", (socket) => {
  socket.on("create-room", ({ username, role }, cb) => {
    const roomId = `AI-${nanoid(4).toUpperCase()}`;
    const room = getRoom(roomId);
    socket.join(roomId);
    socket.data = { roomId, username, role: role || "student" };
    room.users.push({ id: socket.id, username, role: role || "student" });
    room.messages.push({ id: nanoid(), system: true, username: "Sistem", text: `${username} odayı oluşturdu.`, time: new Date().toLocaleTimeString("tr-TR") });
    cb?.({ ok: true, state: publicState(room) });
    broadcast(roomId);
  });

  socket.on("join-room", ({ roomId, username, role }, cb) => {
    const normalized = String(roomId || "").trim().toUpperCase();
    const room = getRoom(normalized);
    socket.join(normalized);
    socket.data = { roomId: normalized, username, role: role || "student" };
    if (!room.users.find(u => u.id === socket.id)) room.users.push({ id: socket.id, username, role: role || "student" });
    room.messages.push({ id: nanoid(), system: true, username: "Sistem", text: `${username} odaya katıldı.`, time: new Date().toLocaleTimeString("tr-TR") });
    cb?.({ ok: true, state: publicState(room) });
    broadcast(normalized);
  });

  socket.on("chat-message", ({ text }) => {
    const { roomId, username } = socket.data || {};
    if (!roomId || !text?.trim()) return;
    const room = getRoom(roomId);
    room.messages.push({ id: nanoid(), username, text: text.trim().slice(0, 300), time: new Date().toLocaleTimeString("tr-TR") });
    broadcast(roomId);
  });

  socket.on("update-params", (params) => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    const room = getRoom(roomId);
    const hiddenChanged = params.hiddenCount && params.hiddenCount !== room.params.hiddenCount;
    room.params = { ...room.params, ...params };
    if (hiddenChanged) room.net = createNetwork(params.hiddenCount);
    broadcast(roomId);
  });

  socket.on("train-model", () => {
    const { roomId, username } = socket.data || {};
    if (!roomId) return;
    const room = getRoom(roomId);
    trainNetwork(room.net, room.params.learningRate, room.params.epochs);
    room.trainingLog.push({ id: nanoid(), username, epoch: room.net.epoch, loss: room.net.loss, accuracy: accuracy(room.net), time: new Date().toLocaleTimeString("tr-TR") });
    broadcast(roomId);
  });

  socket.on("reset-model", () => {
    const { roomId, username } = socket.data || {};
    if (!roomId) return;
    const room = getRoom(roomId);
    room.net = createNetwork(room.params.hiddenCount);
    room.trainingLog.push({ id: nanoid(), username, reset: true, time: new Date().toLocaleTimeString("tr-TR") });
    broadcast(roomId);
  });

  socket.on("disconnect", () => {
    const { roomId, username } = socket.data || {};
    if (!roomId) return;
    const room = getRoom(roomId);
    room.users = room.users.filter(u => u.id !== socket.id);
    room.messages.push({ id: nanoid(), system: true, username: "Sistem", text: `${username || "Bir kullanıcı"} ayrıldı.`, time: new Date().toLocaleTimeString("tr-TR") });
    broadcast(roomId);
  });
});

httpServer.listen(PORT, () => console.log(`NeuroLab Live server: http://localhost:${PORT}`));
