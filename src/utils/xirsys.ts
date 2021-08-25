import axios from "axios";

export interface ICEConfig {
  iceServers: ICEServer[];
}
interface ICEServer {
  username?: string;
  credential?: string;
  urls: string[] | string;
}

export type ErrorMessage =
  | "unauthorized"
  | "no_namespace"
  | "no_service"
  | "bandwidth_limit_exceeded";

type Status = "ok" | "error";

interface XIRSYSResponse {
  v: ICEConfig | ErrorMessage;
  s: Status;
}

const googleStun: ICEConfig = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ],
    },
  ],
};

export const fetchICEConfig = async () => {
  const response = await axios.put<XIRSYSResponse>(
    process.env.XIRSYS_URL || "",
    undefined,
    // { format: "urls" },
    {
      headers: {
        Authorization: `Basic ${Buffer.from(
          process.env.XIRSYS_SECRET || ""
        ).toString("base64")}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.data.s === "error") {
    const message = response.data.v;

    if (message === "bandwidth_limit_exceeded") {
      console.log(
        "XIRSYS bandwidth limit exceeded. Falling back to Google STUN."
      );
      return googleStun;
    }

    throw new Error(`XIRSYS: ${message}`);
  }

  return response.data.v as ICEConfig;
};
