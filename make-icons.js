const fs = require("fs");
const zlib = require("zlib");
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  const both = Buffer.concat([typeBuf, data]);
  crc.writeUInt32BE(crc32(both));
  return Buffer.concat([len, both, crc]);
}
function png(size, rgb) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
      const edge = x < size * 0.12 || x > size * 0.88 || y < size * 0.12 || y > size * 0.88;
      const cx = x - size / 2, cy = y - size / 2;
      const r = Math.sqrt(cx * cx + cy * cy);
      if (edge) { raw[i]=15; raw[i+1]=36; raw[i+2]=48; raw[i+3]=255; }
      else if (r < size * 0.28) { raw[i]=126; raw[i+1]=200; raw[i+2]=227; raw[i+3]=255; }
      else { raw[i]=23; raw[i+1]=52; raw[i+2]=68; raw[i+3]=255; }
    }
  }
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}
fs.writeFileSync("public/icon-192.png", png(192));
fs.writeFileSync("public/icon-512.png", png(512));
console.log("icons ok");
