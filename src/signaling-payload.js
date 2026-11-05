// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

// Wire versions are independent of the game version. Never change an existing
// dictionary or binary layout: old invitations must keep decoding the same way.
class SignalingPayload {
  static maxLength = 100000;
  static alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  static dictionary = [
    '{"denantle":1,"description":{"type":"offer","sdp":"',
    '{"denantle":1,"description":{"type":"answer","sdp":"',
    "v=0\\r\\n", "s=-\\r\\n", "t=0 0\\r\\n",
    "a=group:BUNDLE 0\\r\\n", "a=extmap-allow-mixed\\r\\n",
    "a=msid-semantic: WMS\\r\\n", "a=msid-semantic:WMS *\\r\\n",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel\\r\\n",
    "c=IN IP4 0.0.0.0\\r\\n", " IN IP4 ", " IN IP6 ", "127.0.0.1",
    "o=- ", "o=mozilla...THIS_IS_SDPARTA-", "a=candidate:", ".local ",
    " 1 udp ", " 1 UDP ", " 1 TCP ", " typ host", " typ srflx", " typ relay",
    " generation 0", " network-cost ", " raddr ", " rport ", " tcptype active",
    "a=ice-ufrag:", "a=ice-pwd:", "a=ice-options:trickle\\r\\n",
    "a=fingerprint:sha-256 ", "a=setup:actpass\\r\\n", "a=setup:active\\r\\n",
    "a=setup:passive\\r\\n", "a=mid:0\\r\\n", "a=sctp-port:5000\\r\\n",
    "a=max-message-size:", "a=end-of-candidates\\r\\n", "a=sendrecv\\r\\n", "\\r\\n",
  ];

  static base64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  static unbase64(text) {
    if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length > 150000 || text.length % 4 === 1) throw new Error();
    const bytes = Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
    if (bytes.length > this.maxLength || this.base64(bytes) !== text) throw new Error();
    return bytes;
  }

  static encode(text) {
    if (typeof text !== "string" || !text || text.length > this.maxLength) throw new Error();
    const data = JSON.parse(text);
    // D2 covers the short, single mDNS host candidate offer. Exact reconstruction
    // is required; other browsers, extra candidates and future fields use D1.
    if (data.denantle === 1 && data.description?.type === "offer" && typeof data.description.sdp === "string") {
      try {
        const token = "D2:" + this.base64(this.packOffer(data.description.sdp));
        if (this.decode(token) === text) return token;
      } catch {
        // The general dictionary format preserves every original character.
      }
    }
    const bytes = [];
    const pattern = new RegExp(this.dictionary.map((part) => part.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&")).join("|"), "g");
    const literal = (part) => {
      if (!part) return;
      const raw = new TextEncoder().encode(part);
      bytes.push(0);
      this.writeNumber(bytes, raw.length);
      for (const byte of raw) bytes.push(byte);
    };
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
      literal(text.slice(offset, match.index));
      bytes.push(this.dictionary.indexOf(match[0]) + 1);
      offset = match.index + match[0].length;
    }
    literal(text.slice(offset));
    if (bytes.length > this.maxLength) throw new Error();
    return "D1:" + this.base64(bytes);
  }

  static decode(input) {
    if (typeof input !== "string" || input.length > 160000) throw new Error();
    let text = input.trim();
    if (/^https?:\/\//i.test(text)) {
      text = new URLSearchParams(new URL(text).hash.slice(1)).get("join") || "";
    }
    if (text.startsWith("{")) {
      if (text.length > this.maxLength) throw new Error();
      return text;
    }
    const reader = this.reader(this.unbase64(text.slice(3)));
    if (text.startsWith("D2:")) {
      const sdp = this.unpackOffer(reader);
      if (reader.remaining()) throw new Error();
      return JSON.stringify({ denantle: 1, description: { type: "offer", sdp } });
    }
    if (!text.startsWith("D1:")) throw new Error();
    let result = "";
    while (reader.remaining()) {
      const code = reader.take(1)[0];
      const part = code === 0
        ? new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(reader.take(Number(reader.number())))
        : this.dictionary[code - 1];
      if (part === undefined || result.length + part.length > this.maxLength) throw new Error();
      result += part;
    }
    JSON.parse(result);
    return result;
  }

  static inviteUrl(text, currentUrl) {
    const url = new URL(currentUrl);
    url.hash = "join=" + this.encode(text);
    return url.href;
  }

  static writeNumber(bytes, value, width = 0) {
    let number = BigInt(value);
    if (number < 0n || number > 0xffffffffffffffffn) throw new Error();
    if (width) {
      if (number >= 1n << BigInt(width * 8)) throw new Error();
      for (let i = 0; i < width; i++) {
        bytes.push(Number(number & 255n));
        number >>= 8n;
      }
    } else {
      while (number >= 128n) {
        bytes.push(Number(number & 127n) | 128);
        number >>= 7n;
      }
      bytes.push(Number(number));
    }
  }

  static reader(bytes) {
    let offset = 0;
    const take = (length) => {
      if (!Number.isSafeInteger(length) || length < 0 || offset + length > bytes.length) throw new Error();
      const part = bytes.subarray(offset, offset + length);
      offset += length;
      return part;
    };
    return {
      take,
      remaining: () => bytes.length - offset,
      number(width = 0) {
        let number = 0n;
        if (width) {
          const part = take(width);
          for (let i = width - 1; i >= 0; i--) number = (number << 8n) | BigInt(part[i]);
        } else {
          for (let shift = 0n; ; shift += 7n) {
            if (shift > 63n) throw new Error();
            const byte = take(1)[0];
            number |= BigInt(byte & 127) << shift;
            if (!(byte & 128)) break;
          }
          if (number > 0xffffffffffffffffn) throw new Error();
        }
        return number.toString();
      },
    };
  }

  static packOffer(sdp) {
    const lines = sdp.split("\r\n");
    const origin = lines[1]?.match(/^o=- (\d+) (\d+) IN IP4 127\.0\.0\.1$/);
    const candidate = lines[9]?.match(/^a=candidate:(\d+) (\d+) udp (\d+) ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.local (\d+) typ host generation (\d+) network-cost (\d+)$/);
    const fingerprint = lines[13]?.match(/^a=fingerprint:sha-256 ((?:[0-9A-F]{2}:){31}[0-9A-F]{2})$/);
    if (!origin || !candidate || !fingerprint) throw new Error();
    const bytes = [];
    const number = (value, width) => this.writeNumber(bytes, value, width);
    const hex = (value) => {
      for (const pair of value.match(/../g)) bytes.push(parseInt(pair, 16));
    };
    const chars = (value) => {
      if (!/^[A-Za-z0-9+/]+$/.test(value)) throw new Error();
      number(value.length);
      let bits = 0, accumulator = 0;
      for (const char of value) {
        accumulator = (accumulator << 6) | this.alphabet.indexOf(char);
        bits += 6;
        if (bits >= 8) {
          bits -= 8;
          bytes.push((accumulator >>> bits) & 255);
        }
      }
      if (bits) bytes.push((accumulator << (8 - bits)) & 255);
    };
    number(origin[1], 8);
    number(origin[2]);
    number(candidate[1], 4);
    number(candidate[2]);
    number(candidate[3], 4);
    hex(candidate[4].replace(/-/g, ""));
    number(candidate[5], 2);
    number(candidate[6]);
    number(candidate[7]);
    chars(lines[10].slice("a=ice-ufrag:".length));
    chars(lines[11].slice("a=ice-pwd:".length));
    hex(fingerprint[1].replace(/:/g, ""));
    number(lines[16].slice("a=sctp-port:".length), 2);
    number(lines[17].slice("a=max-message-size:".length));
    return Uint8Array.from(bytes);
  }

  static unpackOffer(reader) {
    const number = (width) => reader.number(width);
    const hex = (length) => Array.from(reader.take(length), (byte) => byte.toString(16).padStart(2, "0"));
    const chars = () => {
      const length = Number(number());
      const bytes = reader.take(Math.ceil(length * 6 / 8));
      let result = "", bits = 0, accumulator = 0;
      for (const byte of bytes) {
        accumulator = (accumulator << 8) | byte;
        bits += 8;
        while (bits >= 6 && result.length < length) {
          bits -= 6;
          result += this.alphabet[(accumulator >>> bits) & 63];
        }
      }
      return result;
    };
    const id = number(8), version = number();
    const foundation = number(4), component = number(), priority = number(4);
    const uuidHex = hex(16).join("");
    const uuid = [uuidHex.slice(0, 8), uuidHex.slice(8, 12), uuidHex.slice(12, 16), uuidHex.slice(16, 20), uuidHex.slice(20)].join("-");
    const port = number(2), generation = number(), cost = number();
    const ufrag = chars(), pwd = chars(), fingerprint = hex(32).join(":").toUpperCase();
    const sctp = number(2), max = number();
    return [
      "v=0", "o=- " + id + " " + version + " IN IP4 127.0.0.1", "s=-", "t=0 0",
      "a=group:BUNDLE 0", "a=extmap-allow-mixed", "a=msid-semantic: WMS",
      "m=application 9 UDP/DTLS/SCTP webrtc-datachannel", "c=IN IP4 0.0.0.0",
      "a=candidate:" + foundation + " " + component + " udp " + priority + " " + uuid + ".local " + port
        + " typ host generation " + generation + " network-cost " + cost,
      "a=ice-ufrag:" + ufrag, "a=ice-pwd:" + pwd, "a=ice-options:trickle",
      "a=fingerprint:sha-256 " + fingerprint, "a=setup:actpass", "a=mid:0",
      "a=sctp-port:" + sctp, "a=max-message-size:" + max, "",
    ].join("\r\n");
  }
}
