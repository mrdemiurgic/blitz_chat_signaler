import { ICEConfig } from "../utils/xirsys";

export type Event =
  | "join"
  | "welcome"
  | "ready"
  | "newPeer"
  | "sdp"
  | "candidate"
  | "error";

export interface Join {
  roomName: string;
}

export interface Welcome {
  iceConfig?: ICEConfig;
  yourId: string;
  users: string[];
}

export interface NewPeer {
  iceConfig: ICEConfig;
  id: string;
}

export interface IceCandidate {
  to: string;
  from: string;
  iceCandidate: RTCIceCandidate;
}

export interface SDP {
  to: string;
  from: string;
  sdp: RTCSessionDescription;
}

export interface Error {
  message: string;
}
