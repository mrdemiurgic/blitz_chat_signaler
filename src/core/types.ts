import { ICEConfig } from "../utils/xirsys";

export type Event =
  | "join"
  | "welcome"
  | "ready"
  | "newPeer"
  | "sdp"
  | "iceCandidate"
  | "leave"
  | "byePeer"
  | "bye"
  | "blitzError";

export interface Join {
  roomName: string;
}

export interface Welcome {
  roomName: string;
  yourId: string;
  peers: string[];
  iceConfig?: ICEConfig;
}

export interface NewPeer {
  iceConfig: ICEConfig;
  id: string;
}

export interface ByePeer {
  id: string;
}

export interface IncomingIceCandidate {
  to: string;
  iceCandidate: RTCIceCandidate;
}

export interface OutgoingIceCandidate {
  from: string;
  iceCandidate: RTCIceCandidate;
}

export interface IncomingSDP {
  to: string;
  sdp: RTCSessionDescription;
}

export interface OutgoingSDP {
  from: string;
  sdp: RTCSessionDescription;
}

export interface BlitzError {
  message: string;
}
