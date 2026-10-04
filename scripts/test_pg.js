import net from "net";

const host = "db.kbrwjxonrllfysjorzvz.supabase.co";
const port = 5432;

const socket = net.createConnection(port, host, () => {
  console.log("Connected to Supabase PostgreSQL port 5432!");
  socket.end();
});

socket.on("error", (err) => {
  console.log("Port 5432 error:", err.message);
});
