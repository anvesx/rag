const { EventEmitter } = require("node:events");
const net = require("node:net");

class MemorySocket extends EventEmitter {
  writable = true;
  setEncoding() {}
  write() {
    return true;
  }
  end(callback) {
    this.writable = false;
    callback?.();
  }
}

class MemoryServer extends EventEmitter {
  listen(callback) {
    queueMicrotask(callback);
    return this;
  }
  address() {
    return { address: "memory", family: "memory", port: 0 };
  }
  close(callback) {
    queueMicrotask(callback);
    return this;
  }
}

net.createServer = () => new MemoryServer();
net.createConnection = (...args) => {
  const socket = new MemorySocket();
  const callback = args.findLast((value) => typeof value === "function");
  if (callback) queueMicrotask(callback);
  return socket;
};
