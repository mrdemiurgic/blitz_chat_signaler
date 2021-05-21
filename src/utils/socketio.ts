import IO from "socket.io";

export const getRoomName = (socket: IO.Socket) =>
  Object.keys(socket.rooms).filter((room) => room !== socket.id)[0] ||
  undefined;

export const getPeersInSameRoom = (socket: IO.Socket) => {
  const room = getRoomName(socket);
  if (room !== undefined) {
    const peers = Object.keys(socket.adapter.rooms[room].sockets).filter(
      (id) => id !== socket.id
    );
    return peers;
  }

  return [];
};
