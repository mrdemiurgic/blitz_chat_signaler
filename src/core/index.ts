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
 * Full API documentation and examples of how a signaler should work with webRTC peers:
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling/webrtc_-_signaling_diagram.svg
 *
 * If your intended model is strictly 1 on 1, try the perfect negotiation pattern:
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
 *
 * Since Blitz Chat needs to support more than 2 peers connecting with each other
 * in a single room, it does not follow this pattern and manually handles offers/answers.
 *
 * If it follows the perfect negotiation pattern, it can skip the "ready" and "newPeer"
 * events.
 *
 */

/**
 * After a successful connection to signaler, the first event that peer emits to server is "join."
 *
 * join -> { roomName: string }
 *
 * It joins the room and checks for existing peers in the room. Emits event "welcome" back to peer:
 *
 * welcome -> { iceConfig: ICEConfig, peers: string[], yourId: string }
 *
 * ICE configuration is used to authenicate the peer with the XIRSYS STUN/TURN server.
 * It contains a temporary token that is only valid for 30 seconds. If the new
 * peer is the only peer in room, ICE configuration is not needed yet.
 *
 * https://developer.mozilla.org/en-US/docs/Glossary/STUN
 * https://developer.mozilla.org/en-US/docs/Glossary/TURN
 * https://medium.com/av-transcode/what-is-webrtc-and-how-to-setup-stun-turn-server-for-webrtc-communication-63314728b9d0
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
 * If it is empty, do nothing and wait for the "newPeer" event.
 *
 * If it is populated, create a RTCPeerConnection instance for each existing peer and
 * emit "ready" to server to notify it that the new peer is ready to start receiving
 * offers from other peers in the room.
 *
 * ready -> {}
 *
 * The server emits "newPeer" to other peers in the room, so they can create the corresponding
 * RTCPeerConnection instance and start generating RTCSessionDescription offers for this new peer.
 *
 * newPeer -> {iceConfig: ICEConfig, id: string}
 *
 */
const onReady = (socket: IO.Socket) => {
  socket.on("ready" as T.Event, async () => {
    const room = getRoomName(socket);
    const iceConfig = await fetchICEConfig();
    socket.to(room).emit("newPeer" as T.Event, { iceConfig, id: socket.id });
  });
};

/**
 * "sdp" and "iceCandidate" are used for negotiating webRTC peer connections.
 *
 * After exchanging session descriptions and ICE candidates, if a video connection is not established,
 * an invalid iceConfig configuration or a firewall are the most likely culprits. Also look into
 * "ice trickling." It is prone to race conditions, and some webRTC implementations
 * do not support trickling.
 *
 */
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
