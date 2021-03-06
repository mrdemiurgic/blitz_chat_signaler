import IO from "socket.io";
import { getPeersInSameRoom, getRoomName } from "../utils/socketio";
import { ICEConfig, fetchICEConfig } from "../utils/xirsys";

import * as T from "./types";

const LIMIT = process.env.USERS_PER_ROOM_LIMIT || 100;

export const establishListeners = (socket: IO.Socket) => {
  console.log(`Peer connected: ${socket.id}`);

  onJoin(socket);
  // onReady(socket);
  onSDP(socket);
  onCandidate(socket);
  onLeave(socket);
  onDisconnecting(socket);
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
 */

/**
 * After a successful connection to signaler, the first event that peer emits to server is "join."
 *
 * join -> { roomName: string }
 *
 * It joins the room and checks for existing peers in the room. Emits event "welcome" back to peer:
 *
 * welcome -> { iceConfig: ICEConfig, peers: string[], selfId: string }
 *
 * ICE configuration is used to authenicate the peer with the XIRSYS STUN/TURN server.
 * It contains a temporary token that is only valid for 30 seconds. If the new
 * peer is the only peer in room, ICE configuration is not needed yet.
 *
 * https://medium.com/av-transcode/what-is-webrtc-and-how-to-setup-stun-turn-server-for-webrtc-communication-63314728b9d0
 *
 * If the limit of peers per room is reached, the server will instead emit:
 *
 * blitzError -> { message: "the room is full" }
 *
 */
const onJoin = (socket: IO.Socket) => {
  socket.on("join" as T.OnEvent, async ({ roomName }: T.Join) => {
    const selfId = socket.id;

    const left = await leaveRoomIfJoined(socket);

    if (left) {
      socket.join(roomName, async (err: any) => {
        if (err) {
          console.error(`Cannot join room. SocketIO: ${err}. Peer: ${selfId}`);
          emitError(socket, "cannot join room");
          return;
        }
        const peers = getPeersInSameRoom(socket);
        if (peers.length < LIMIT) {
          const iceConfig =
            peers.length > 0 ? await fetchICEConfig() : undefined;
          socket.emit(
            "welcome" as T.EmitEvent,
            { roomName, iceConfig, peers } as T.Welcome
          );
          console.log(`Peer ${selfId} joined ${roomName}!`);
        } else {
          emitError(socket, "room is full");
          console.log(`Room is full. Peer ${selfId} turned away.`);
          socket.leave(roomName);
        }
      });
    }
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
// const onReady = (socket: IO.Socket) => {
//   socket.on("ready" as T.OnEvent, async () => {
//     console.log(`Peer ${socket.id} is ready!`);
//     const room = getRoomName(socket);
//     if (room !== undefined) {
//       const iceConfig = await fetchICEConfig();
//       socket
//         .to(room)
//         .emit(
//           "newPeer" as T.EmitEvent,
//           { iceConfig, id: socket.id } as T.NewPeer
//         );
//     }
//   });
// };

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
  socket.on("sdp" as T.OnEvent, async ({ sdp, to }: T.IncomingSDP) => {
    console.log(`sdp exchange - type: ${sdp.type} ${socket.id} -> ${to}`);

    const data = {
      sdp,
      from: socket.id,
      iceConfig: sdp.type === "offer" ? await fetchICEConfig() : undefined,
    };

    socket.to(to).emit("sdp" as T.EmitEvent, data as T.OutgoingSDP);
  });
};

const onCandidate = (socket: IO.Socket) => {
  socket.on(
    "iceCandidate" as T.OnEvent,
    ({ iceCandidate, to }: T.IncomingIceCandidate) => {
      console.log(`iceCandidate exchange - ${socket.id} -> ${to}`);
      socket
        .to(to)
        .emit(
          "iceCandidate" as T.EmitEvent,
          { iceCandidate, from: socket.id } as T.OutgoingIceCandidate
        );
    }
  );
};

/**
 * When a peer leaves the room, notify everyone else in the room.
 *
 * byePeer -> {id: string}
 *
 * Send "bye" back to the leaving peer as confirmation that he has successfully
 * left the room.
 *
 * bye -> {}
 *
 * peerLeaving() is also called on socket "disconnecting" event. Theoretically,
 * RTCPeerConnection's connectionState can be listened to for the same information,
 * but this is more reliable and instanteous.
 *
 */
const onLeave = (socket: IO.Socket) => {
  socket.on("leave" as T.OnEvent, () => {
    peerLeaving(socket);
  });
};

const onDisconnecting = (socket: IO.Socket) => {
  socket.on("disconnecting", function () {
    peerLeaving(socket);
    console.log(`Peer disconnecting: ${socket.id}`);
  });
};

const leaveRoomIfJoined = async (socket: IO.Socket): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const roomName = getRoomName(socket);
    if (roomName !== undefined) {
      console.log(`Peer ${socket.id} leaving ${roomName}.`);
      socket.leave(roomName, (err: any) => {
        if (err) {
          console.error(
            `Cannot leave room. SocketIO: ${err}. Peer: ${socket.id}`
          );
          emitError(socket, "cannot leave room");
          resolve(false);
          return;
        }

        socket
          .to(roomName)
          .emit("byePeer" as T.EmitEvent, { id: socket.id } as T.ByePeer);

        resolve(true);
      });
    } else {
      resolve(true);
    }
  });
};

const peerLeaving = async (socket: IO.Socket) => {
  const left = await leaveRoomIfJoined(socket);
  if (left) {
    socket.emit("bye" as T.EmitEvent);
  }
};

const emitError = (socket: IO.Socket, message: string) => {
  socket.emit("blitzError" as T.EmitEvent, { message } as T.BlitzError);
};
