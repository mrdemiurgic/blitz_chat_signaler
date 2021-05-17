import IO from "socket.io";
import { getPeersInSameRoom, getRoomName } from "../utils/socketio";
import { ICEConfig, fetchICEConfig } from "../utils/xirsys";

import * as T from "./types";

const LIMIT = process.env.USERS_PER_ROOM_LIMIT || 100;

export const establishListeners = (socket: IO.Socket) => {
  console.log(`User connected: ${socket.id}`);

  onJoin(socket);
  onReady(socket);
  onCandidate(socket);
  onSDP(socket);

  socket.on("disconnecting", function () {
    console.log(`User disconnecting: ${socket.id}`);
  });

  socket.on("disconnect", function () {
    console.log(`User disconnected: ${socket.id}`);
  });
};

/**
 * After a successful connection to signaler, the first event that peer emits to server is "join."
 *
 * join -> { roomName: string }
 *
 * It joins the room and checks for existing peers in the room. Emits event "welcome" back to peer:
 *
 * welcome -> { iceConfig: ICEConfig, peers: string[], yourId: string }
 *
 * ICEConfig is used to authenicate the peer with the XIRSYS STUN/TURN server.
 * It contains a temporary token that is only valid for 30 seconds.
 *
 * If the limit of peers per room is reached, the server will instead emit:
 *
 * blitzError -> { message: "the room is full" }
 *
 */
const onJoin = (socket: IO.Socket) => {
  socket.on("join" as T.Event, ({ roomName }: T.Join) => {
    const yourId = socket.id;
    console.log(`${yourId} joining ${roomName}...`);
    socket.join(roomName, async (err) => {
      if (err) throw err;

      const peers = getPeersInSameRoom(socket);
      if (peers.length < LIMIT) {
        const iceConfig = peers.length > 0 ? await fetchICEConfig() : undefined;
        socket.emit(
          "welcome" as T.Event,
          { iceConfig, peers, yourId } as T.Welcome
        );
        console.log(`${yourId} joined ${roomName}!`);
      } else {
        socket.emit(
          "blitzError" as T.Event,
          { message: "the room is full" } as T.Error
        );
        console.log(`Room is full. ${yourId} turned away.`);
        socket.leave(roomName);
      }
    });
  });
};

/**
 * The new peer receives the "welcome" event from server and evaluates the peers array.
 *
 * If it is empty, do nothing.
 *
 * If it is populated, create RTCPeerConnection instances and emit "ready" to server to
 * notify it that the peer is ready to start receiving offers from other peers in the room.
 *
 * ready -> {}
 *
 * The server emits "newPeer" to other peers in the room, so they can create the corresponding
 * RTCPeerConnection instance and start generating RTCSessionDescription offers for this new patron.
 *
 * "newPeer" -> {iceConfig: ICEConfig, id: string}
 *
 * ICEConfig is used to authenicate the peer with the XIRSYS STUN/TURN server.
 * It contains a temporary token that is only valid for 30 seconds.
 *
 */
const onReady = (socket: IO.Socket) => {
  socket.on("ready" as T.Event, async () => {
    const room = getRoomName(socket);
    const iceConfig = await fetchICEConfig();
    socket.to(room).emit("newPeer" as T.Event, { iceConfig, id: socket.id });
  });
};

const onSDP = (socket: IO.Socket) => {
  socket.on("sdp" as T.Event, (data: T.SDP) => {
    socket.to(data.to).emit("sdp" as T.Event, data as T.SDP);
  });
};

const onCandidate = (socket: IO.Socket) => {
  socket.on("iceCandidate" as T.Event, (data: T.IceCandidate) => {
    socket.to(data.to).emit("iceCandidate" as T.Event, data as T.IceCandidate);
  });
};
