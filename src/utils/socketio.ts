import IO from "socket.io";

export const getRoomName = (socket: IO.Socket) =>
  Object.keys(socket.rooms).filter((room) => room !== socket.id)[0];

export const getUsersInSameRoom = (socket: IO.Socket) => {
  const room = getRoomName(socket);
  const users = Object.keys(socket.adapter.rooms[room].sockets).filter(
    (id) => id !== socket.id
  );
  return users;
};
