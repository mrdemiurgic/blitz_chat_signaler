import { Server } from "http";
import IO from "socket.io";
import express, { Request, Response } from "express";
import { fetchICEConfig } from "./utils/xirsys";
import checkEnvs from "./utils/envs";
import { establishListeners } from "./core";

checkEnvs();

const app = express();

app.get("/", async (req: Request, res: Response) => {
  res.status(200).send("Blitz Chat Signaler Server");
});

const server = new Server(app);
const io = IO(server, { pingTimeout: 7500, pingInterval: 3000 });

io.on("connection", establishListeners);
server.listen(process.env.PORT || 3003);
