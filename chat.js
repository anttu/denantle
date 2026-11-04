const form = document.querySelector('#form');
const nameInput = document.querySelector('#name');
const messageInput = document.querySelector('#message');
const messages = document.querySelector('#messages');
const status = document.querySelector('#status');
const send = document.querySelector('#send');
const error = document.querySelector('#error');
const createOffer = document.querySelector('#create-offer');
const signalForm = document.querySelector('#signal-form');
const remoteCode = document.querySelector('#remote-code');
const localCode = document.querySelector('#local-code');
const copyCode = document.querySelector('#copy-code');
const reset = document.querySelector('#reset');
const setupStatus = document.querySelector('#setup-status');
const supported = typeof RTCPeerConnection !== 'undefined';
const peers = new Map();
let role = null;
let pending = null;
let codePeerId = null;
let busy = false;

function openPeers() {
  return [...peers.values()].filter((peer) =>
    peer.channel?.readyState === 'open' && peer.pc.connectionState === 'connected');
}

function updateControls() {
  const count = openPeers().length;
  status.textContent = role === 'host' ? `Hosting · ${count} guest${count === 1 ? '' : 's'}` :
    count ? 'Connected to host' : peers.size ? 'Connecting…' : 'Not connected';
  send.disabled = count === 0;
  createOffer.disabled = !supported || busy || role === 'guest';
  createOffer.textContent = pending ? 'Replace invitation' : 'Create invitation';
  document.querySelector('#use-code').disabled = !supported || busy;
  copyCode.disabled = busy || !localCode.value;
  reset.disabled = busy || !role;
}

function removePeer(peer) {
  if (!peers.delete(peer.id)) return;
  if (pending === peer) pending = null;
  if (codePeerId === peer.id) {
    localCode.value = '';
    codePeerId = null;
  }
  peer.channel?.close();
  peer.pc.close();
  updateControls();
}

function broadcast(message, except) {
  let sent = 0;
  for (const peer of openPeers()) {
    if (peer === except) continue;
    try {
      peer.channel.send(JSON.stringify(message));
      sent++;
    } catch {
      removePeer(peer);
    }
  }
  return sent;
}

function attachChannel(peer, channel) {
  peer.channel = channel;
  channel.onopen = () => {
    setupStatus.textContent = role === 'host' ?
      'Connected. Create another invitation to add a guest.' : 'Connected. Keep the host tab open.';
    updateControls();
  };
  channel.onclose = () => {
    if (!peers.has(peer.id)) return;
    removePeer(peer);
    error.textContent = role === 'guest' ?
      'Host disconnected. Leave and exchange fresh codes to reconnect.' : 'A guest disconnected.';
  };
  channel.onerror = () => {
    error.textContent = 'A peer connection encountered an error. Exchange fresh codes if it disconnects.';
  };
  channel.onmessage = (event) => {
    if (typeof event.data !== 'string' || event.data.length > 16384) return;
    let message;
    try {
      const data = JSON.parse(event.data);
      if (!data || typeof data.name !== 'string' || data.name.length > 40 ||
          typeof data.text !== 'string' || !data.text.trim() || data.text.length > 2000 ||
          typeof data.time !== 'string' || !Number.isFinite(Date.parse(data.time))) return;
      message = { name: data.name.trim() || 'Anonymous', text: data.text.trim(), time: data.time };
    } catch { return; }
    addMessage(message);
    if (role === 'host') broadcast(message, peer);
  };
}

function makePeer(id) {
  const pc = new RTCPeerConnection({
    iceServers: [],
  });
  const peer = { id, pc, channel: null };
  peers.set(id, peer);
  pc.ondatachannel = (event) => attachChannel(peer, event.channel);
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      removePeer(peer);
      error.textContent = 'Direct connection failed. Try the same Wi-Fi or another network, then exchange fresh codes.';
    }
    updateControls();
  };
  return peer;
}

function waitForIce(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      reject(new Error('Connection code preparation timed out. Try again on the same local network.'));
    }, 20000);
    function check() {
      if (pc.iceGatheringState !== 'complete') return;
      clearTimeout(timeout);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }
    pc.addEventListener('icegatheringstatechange', check);
    check();
  });
}

async function showCode(peer) {
  await waitForIce(peer.pc);
  const { type, sdp } = peer.pc.localDescription;
  if (!sdp.includes('a=candidate:')) throw new Error('No connection addresses found. Try another browser or network.');
  localCode.value = JSON.stringify({ id: peer.id, type, sdp });
  codePeerId = peer.id;
}

async function setup(action) {
  if (busy || !supported) return;
  busy = true;
  error.textContent = '';
  updateControls();
  try {
    await action();
  } catch (failure) {
    error.textContent = failure.message || 'Could not prepare the connection. Please start over.';
    if (!peers.size) role = null;
  } finally {
    busy = false;
    updateControls();
  }
}

createOffer.addEventListener('click', () => setup(async () => {
  if (role === 'guest') throw new Error('Leave this room before creating your own.');
  if (pending) removePeer(pending);
  role = 'host';
  const peer = makePeer(crypto.randomUUID());
  pending = peer;
  localCode.value = '';
  setupStatus.textContent = 'Preparing an offer code…';
  try {
    attachChannel(peer, peer.pc.createDataChannel('chat'));
    await peer.pc.setLocalDescription(await peer.pc.createOffer());
    await showCode(peer);
    setupStatus.textContent = 'Send this offer to one guest. Paste their answer above and click Use code.';
  } catch (failure) {
    removePeer(peer);
    throw failure;
  }
}));

signalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  setup(async () => {
    let code;
    try { code = JSON.parse(remoteCode.value.trim()); }
    catch { throw new Error('Invalid code. Paste the complete offer or answer, including the braces.'); }
    if (!code || typeof code.id !== 'string' || !code.id || code.id.length > 100 ||
        !['offer', 'answer'].includes(code.type) || typeof code.sdp !== 'string' || code.sdp.length > 60000) {
      throw new Error('Invalid code. Use an offer or answer generated by this page.');
    }
    const description = { type: code.type, sdp: code.sdp };
    if (code.type === 'offer') {
      if (role) throw new Error('Leave the current room before joining a different one.');
      role = 'guest';
      const peer = makePeer(code.id);
      localCode.value = '';
      setupStatus.textContent = 'Preparing an answer code…';
      try {
        await peer.pc.setRemoteDescription(description);
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        await showCode(peer);
        remoteCode.value = '';
        setupStatus.textContent = 'Send this answer back to the host. Keep this tab open while they use it.';
      } catch (failure) {
        removePeer(peer);
        throw failure;
      }
    } else {
      if (role !== 'host' || !pending || pending.id !== code.id) {
        throw new Error('This answer does not match the pending invitation. Ask the guest for the matching answer.');
      }
      await pending.pc.setRemoteDescription(description);
      pending = null;
      remoteCode.value = '';
      setupStatus.textContent = 'Connecting to the guest… Keep both tabs open.';
    }
  });
});

copyCode.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(localCode.value);
    setupStatus.textContent = 'Code copied. Send it to the other person.';
  } catch {
    localCode.focus();
    localCode.select();
    setupStatus.textContent = 'Copy the selected code manually, then send it to the other person.';
  }
});

reset.addEventListener('click', () => {
  for (const peer of [...peers.values()]) removePeer(peer);
  role = null;
  pending = null;
  localCode.value = '';
  remoteCode.value = '';
  messages.replaceChildren();
  error.textContent = '';
  setupStatus.textContent = 'Create an invitation, or paste an offer to join.';
  updateControls();
});

function addMessage(message) {
  const item = document.createElement('li');
  const name = document.createElement('strong');
  name.textContent = message.name;
  const time = document.createElement('time');
  time.dateTime = message.time;
  time.textContent = new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const text = document.createElement('p');
  text.textContent = message.text;
  item.append(name, time, text);
  messages.append(item);
  if (messages.children.length > 100) messages.firstElementChild.remove();
  messages.scrollTop = messages.scrollHeight;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  const name = nameInput.value.trim() || 'Anonymous';
  if (!text || !openPeers().length) return;
  error.textContent = '';
  if (text.length > 2000 || name.length > 40) {
    error.textContent = 'Use up to 2000 characters for messages and 40 for names.';
    return;
  }
  const message = { name, text, time: new Date().toISOString() };
  if (!broadcast(message)) {
    error.textContent = 'Could not send. Check the connection and try again.';
    return;
  }
  addMessage(message);
  messageInput.value = '';
  messageInput.focus();
});

if (!supported) setupStatus.textContent = 'This browser does not support WebRTC data channels. Try a current browser.';
updateControls();
