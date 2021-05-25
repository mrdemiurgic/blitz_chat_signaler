import axios from "axios";

export interface ICEConfig {
  iceServers: {
    username: string;
    urls: string[];
    credential: string;
  };
}

export type ErrorMessage = "unauthorized" | "no_namespace" | "no_service";

type Status = "ok" | "error";

interface XIRSYSResponse {
  v: ICEConfig | ErrorMessage;
  s: Status;
}

export const fetchICEConfig = async () => {
  const response = await axios.put<XIRSYSResponse>(
    process.env.XIRSYS_URL || "",
    // { format: "urls" },
    undefined,
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
    throw new Error(`XIRSYS: ${response.data.v}`);
  }

  return response.data.v as ICEConfig;
};
