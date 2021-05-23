import { ICEConfig } from "../utils/xirsys";

export type EmitEvent =
  | "welcome"
  | "newPeer"
  | "sdp"
  | "iceCandidate"
  | "byePeer"
  | "bye"
  | "blitzError";

export type OnEvent = "join" | "ready" | "sdp" | "iceCandidate" | "leave";

export interface Join {
  roomName: string;
}

export interface Welcome {
  roomName: string;
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

interface IceCandidate {
  iceCandidate: RTCIceCandidate;
}

export interface IncomingIceCandidate extends IceCandidate {
  to: string;
}

export interface OutgoingIceCandidate extends IceCandidate {
  from: string;
}

interface SDP {
  sdp: RTCSessionDescription;
}

export interface IncomingSDP extends SDP {
  to: string;
}

export interface OutgoingSDP extends SDP {
  from: string;
}

export interface BlitzError {
  message: string;
}
