// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { isRecord } from "./validation.js";

// Wire versions are independent of the game version. Never change an existing
// dictionary or binary layout: old invitations must keep decoding the same way.
const SIGNALING_MAX_LENGTH = 100000;
const SIGNALING_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const SIGNALING_DICTIONARY = [
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

function encodeBase64Url(bytes: Uint8Array | number[]) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(text: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length > 150000 || text.length % 4 === 1) throw new Error();
  const bytes = Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
  if (bytes.length > SIGNALING_MAX_LENGTH || encodeBase64Url(bytes) !== text) throw new Error();
  return bytes;
}

export function encodeSignalingPayload(text: string) {
  if (typeof text !== "string" || !text || text.length > SIGNALING_MAX_LENGTH) throw new Error();
  const data: unknown = JSON.parse(text);
  // D2 covers single mDNS host offers; D3 adds an answer's DTLS role byte.
  // Exact reconstruction is required; other SDP layouts keep using D1.
  if (isRecord(data) && data.denantle === 1 && isRecord(data.description)
    && (data.description.type === "offer" || data.description.type === "answer")
    && typeof data.description.sdp === "string") {
    try {
      const { type, sdp } = data.description;
      let bytes, prefix;
      if (type === "offer") {
        bytes = packSignalingOffer(sdp);
        prefix = "D2:";
      } else {
        const setup = sdp.match(/\r\na=setup:(active|passive)\r\n/);
        if (!setup) throw new Error();
        const body = packSignalingOffer(sdp.replace(setup[0], "\r\na=setup:actpass\r\n"));
        bytes = new Uint8Array(body.length + 1);
        bytes[0] = setup[1] === "active" ? 0 : 1;
        bytes.set(body, 1);
        prefix = "D3:";
      }
      const token = prefix + encodeBase64Url(bytes);
      if (decodeSignalingPayload(token) === text) return token;
    } catch {
      // The general dictionary format preserves every original character.
    }
  }
  const bytes: number[] = [];
  const pattern = new RegExp(SIGNALING_DICTIONARY.map((part) => part.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&")).join("|"), "g");
  const literal = (part: string) => {
    if (!part) return;
    const raw = new TextEncoder().encode(part);
    bytes.push(0);
    bytes.push(...encodeSignalingNumber(raw.length));
    for (const byte of raw) bytes.push(byte);
  };
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    literal(text.slice(offset, match.index));
    bytes.push(SIGNALING_DICTIONARY.indexOf(match[0]) + 1);
    offset = match.index + match[0].length;
  }
  literal(text.slice(offset));
  if (bytes.length > SIGNALING_MAX_LENGTH) throw new Error();
  return "D1:" + encodeBase64Url(bytes);
}

export function decodeSignalingPayload(input: string) {
  if (typeof input !== "string" || input.length > 160000) throw new Error();
  let text = input.trim();
  if (/^https?:\/\//i.test(text)) {
    text = new URLSearchParams(new URL(text).hash.slice(1)).get("join") || "";
  }
  if (text.startsWith("{")) {
    if (text.length > SIGNALING_MAX_LENGTH) throw new Error();
    return text;
  }
  const reader = createSignalingReader(decodeBase64Url(text.slice(3)));
  const isAnswer = text.startsWith("D3:");
  if (text.startsWith("D2:") || isAnswer) {
    const setup = isAnswer ? ["active", "passive"][reader.take(1)[0]] : "actpass";
    if (setup === undefined) throw new Error();
    const sdp = unpackSignalingOffer(reader).replace("\r\na=setup:actpass\r\n", "\r\na=setup:" + setup + "\r\n");
    if (reader.remaining()) throw new Error();
    return JSON.stringify({ denantle: 1, description: { type: isAnswer ? "answer" : "offer", sdp } });
  }
  if (!text.startsWith("D1:")) throw new Error();
  let result = "";
  while (reader.remaining()) {
    const code = reader.take(1)[0];
    const part = code === 0
      ? new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(reader.take(Number(reader.number())))
      : SIGNALING_DICTIONARY[code - 1];
    if (part === undefined || result.length + part.length > SIGNALING_MAX_LENGTH) throw new Error();
    result += part;
  }
  JSON.parse(result);
  return result;
}

export function createInviteUrl(text: string, currentUrl: string) {
  const url = new URL(currentUrl);
  url.hash = "join=" + encodeSignalingPayload(text);
  return url.href;
}

function encodeSignalingNumber(value: string | number | bigint, width = 0) {
  const bytes: number[] = [];
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
  return bytes;
}

function createSignalingReader(bytes: Uint8Array) {
  let offset = 0;
  const take = (length: number) => {
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

function packSignalingOffer(sdp: string) {
  const lines = sdp.split("\r\n");
  const origin = lines[1]?.match(/^o=- (\d+) (\d+) IN IP4 127\.0\.0\.1$/);
  const candidate = lines[9]?.match(/^a=candidate:(\d+) (\d+) udp (\d+) ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.local (\d+) typ host generation (\d+) network-cost (\d+)$/);
  const fingerprint = lines[13]?.match(/^a=fingerprint:sha-256 ((?:[0-9A-F]{2}:){31}[0-9A-F]{2})$/);
  if (!origin || !candidate || !fingerprint) throw new Error();
  const bytes: number[] = [];
  const number = (value: string | number, width = 0) => bytes.push(...encodeSignalingNumber(value, width));
  const hex = (value: string) => {
    for (const pair of value.match(/../g) || []) bytes.push(parseInt(pair, 16));
  };
  const chars = (value: string) => {
    if (!/^[A-Za-z0-9+/]+$/.test(value)) throw new Error();
    number(value.length);
    let bits = 0, accumulator = 0;
    for (const char of value) {
      accumulator = (accumulator << 6) | SIGNALING_ALPHABET.indexOf(char);
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

function unpackSignalingOffer(reader: ReturnType<typeof createSignalingReader>) {
  const number = (width = 0) => reader.number(width);
  const hex = (length: number) => Array.from(reader.take(length), (byte) => byte.toString(16).padStart(2, "0"));
  const chars = () => {
    const length = Number(number());
    const bytes = reader.take(Math.ceil(length * 6 / 8));
    let result = "", bits = 0, accumulator = 0;
    for (const byte of bytes) {
      accumulator = (accumulator << 8) | byte;
      bits += 8;
      while (bits >= 6 && result.length < length) {
        bits -= 6;
        result += SIGNALING_ALPHABET[(accumulator >>> bits) & 63];
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
