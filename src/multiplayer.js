// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { i18n } from "./i18n.js";
import { GUESS_PATTERN } from "./game.js";
import { createInviteUrl, decodeSignalingPayload, encodeSignalingPayload } from "./signaling-payload.js";

// Signaling is manual: each description includes all gathered ICE candidates.
// Google's STUN server discovers public addresses; game data stays peer-to-peer.
function readSignalingDescription(text, type) {
  try {
    const data = JSON.parse(decodeSignalingPayload(text));
    if (data.denantle !== 1 || data.description?.type !== type
      || typeof data.description.sdp !== "string" || !data.description.sdp.startsWith("v=0")) throw new Error();
    return { type, sdp: data.description.sdp };
  } catch {
    throw i18n.error(type === "offer"
      ? i18n.message("multiplayer.invalidInvite")
      : i18n.message("multiplayer.invalidResponse"));
  }
}

function createManualPeerConnection({ onOpen, onClose, onMessage } = {}) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  let sendQueue = Promise.resolve();
  let received = "";
  let closed = false;
  let channel = null;
  let connectionTimeout;
  let cancelGathering;

  function connected() {
    return !closed && channel?.readyState === "open";
  }

  function bindChannel(nextChannel) {
    channel = nextChannel;
    channel.bufferedAmountLowThreshold = 65536;
    channel.onopen = () => {
      clearTimeout(connectionTimeout);
      onOpen?.();
    };
    channel.onclose = () => close(i18n.message("multiplayer.peerLeft"));
    channel.onerror = () => close(i18n.message("multiplayer.connectionFailed"));
    channel.onmessage = ({ data }) => {
      try {
        if (typeof data !== "string" || data.length > 20000) throw new Error();
        const chunk = JSON.parse(data);
        if (typeof chunk.part !== "string" || typeof chunk.last !== "boolean") throw new Error();
        received += chunk.part;
        if (received.length > 4 * 1024 * 1024) throw new Error();
        if (!chunk.last) return;
        const message = JSON.parse(received);
        received = "";
        onMessage?.(message);
      } catch {
        close(i18n.message("multiplayer.invalidMessage"));
      }
    };
  }

  async function localDescription(description) {
    await peer.setLocalDescription(description);
    if (peer.iceGatheringState !== "complete") {
      await new Promise((resolve, reject) => {
        const done = (error) => {
          clearTimeout(timer);
          peer.removeEventListener("icegatheringstatechange", changed);
          cancelGathering = null;
          if (error) reject(error);
          else resolve();
        };
        const changed = () => {
          if (peer.iceGatheringState === "complete") done();
        };
        const timer = setTimeout(() => done(i18n.error("multiplayer.gatheringTimeout")), 20000);
        cancelGathering = () => done(new DOMException(i18n.t("multiplayer.closed"), "AbortError"));
        peer.addEventListener("icegatheringstatechange", changed);
        changed();
      });
    }
    if (closed) throw new DOMException(i18n.t("multiplayer.closed"), "AbortError");
    return JSON.stringify({ denantle: 1, description: peer.localDescription.toJSON() });
  }

  async function createOffer() {
    bindChannel(peer.createDataChannel("denantle"));
    return localDescription(await peer.createOffer());
  }

  async function acceptOffer(text) {
    await peer.setRemoteDescription(readSignalingDescription(text, "offer"));
    return localDescription(await peer.createAnswer());
  }

  async function acceptAnswer(text) {
    await peer.setRemoteDescription(readSignalingDescription(text, "answer"));
    connectionTimeout = setTimeout(() => {
      if (!connected()) close(i18n.message("multiplayer.noConnection"));
    }, 30000);
  }

  function send(message) {
    const task = sendQueue.then(async () => {
      if (!connected()) throw i18n.error("multiplayer.notOpen");
      const text = JSON.stringify(message);
      if (text.length > 4 * 1024 * 1024) throw i18n.error("multiplayer.tooLarge");
      // Small chunks also work with browsers that limit messages to 16 KiB.
      // Splitting the JSON string preserves Unicode even across surrogate pairs.
      for (let offset = 0; offset < text.length; offset += 2000) {
        if (!connected()) throw i18n.error("multiplayer.interrupted");
        if (channel.bufferedAmount > 131072) {
          await new Promise((resolve, reject) => {
            const finish = (error) => {
              clearTimeout(timer);
              channel.removeEventListener("bufferedamountlow", ready);
              channel.removeEventListener("close", onClosed);
              if (error) reject(error);
              else resolve();
            };
            const ready = () => finish();
            const onClosed = () => finish(i18n.error("multiplayer.interrupted"));
            const timer = setTimeout(() => finish(i18n.error("multiplayer.sendTimeout")), 15000);
            channel.addEventListener("bufferedamountlow", ready, { once: true });
            channel.addEventListener("close", onClosed, { once: true });
            if (channel.bufferedAmount <= 65536) ready();
          });
        }
        channel.send(JSON.stringify({ part: text.slice(offset, offset + 2000), last: offset + 2000 >= text.length }));
      }
    });
    sendQueue = task.catch(() => {});
    return task;
  }

  function close(message = i18n.message("multiplayer.connectionClosed")) {
    if (closed) return;
    closed = true;
    clearTimeout(connectionTimeout);
    cancelGathering?.();
    channel?.close();
    peer.close();
    received = "";
    onClose?.(message);
  }

  peer.ondatachannel = ({ channel: incomingChannel }) => {
    if (channel || incomingChannel.label !== "denantle") {
      incomingChannel.close();
      return;
    }
    bindChannel(incomingChannel);
  };
  peer.onconnectionstatechange = () => {
    const state = peer.connectionState;
    if (state === "failed" || state === "closed") close(i18n.message("multiplayer.reconnect"));
    if (state === "connected") clearTimeout(connectionTimeout);
  };
  return {
    createOffer, acceptOffer, acceptAnswer, send, close,
    get connected() { return connected(); },
    get signalingState() { return peer.signalingState; },
    set onOpen(handler) { onOpen = handler; },
    set onClose(handler) { onClose = handler; },
    set onMessage(handler) { onMessage = handler; },
  };
}

function connectionView({ role, joining: wantsToJoin, connectedCount, remotePlayerCount,
  hasPeer = false, signalingState, negotiating, hasRemote, hasLocal, peerCount, invitationsOpen }) {
  const connected = connectedCount > 0;
  const isGuest = role === "guest";
  const joining = !role && wantsToJoin;
  return {
    connected, isGuest, joining,
    role: isGuest ? "guest" : joining ? "joining" : "host",
    playerCount: isGuest ? remotePlayerCount : connectedCount + 1,
    invitationsHidden: connected && isGuest,
    invitationUsed: connected && !hasPeer,
    inviteNoteHidden: isGuest || joining,
    createHidden: isGuest || joining || hasPeer,
    createDisabled: negotiating || hasPeer,
    acceptDisabled: negotiating || !hasRemote || isGuest || (!joining && (!hasPeer || signalingState !== "have-local-offer")),
    localHidden: !hasLocal,
    remoteHidden: isGuest,
    cancelHidden: !hasPeer || isGuest,
    restartHidden: peerCount === 0 || (!connected && !isGuest),
    statusInSession: connected && (!hasPeer || isGuest || !invitationsOpen),
  };
}

function validateMultiplayerMessage(message, isGuest) {
  if (!message || typeof message !== "object") throw new Error();
  if (!isGuest) {
    if (message.type !== "guess" || typeof message.guess !== "string" || message.guess.length > 200
      || !GUESS_PATTERN.test(message.guess) || !Number.isSafeInteger(message.request) || message.request <= 0) throw new Error();
    return;
  }
  if (message.type === "players") {
    if (!Number.isSafeInteger(message.count) || message.count < 2) throw new Error();
  } else if (!["loading", "game", "state", "unavailable"].includes(message.type)) throw new Error();
}

export function createMultiplayerGame(game, { getArticle, showArticle, cancelLoading, refreshControls, resumeSolo }) {
  const elements = {
    enabled: document.getElementById("multiplayer-enabled"),
    panel: document.getElementById("multiplayer-panel"),
    connectedPanel: document.getElementById("multiplayer-connected"),
    playerCount: document.getElementById("multiplayer-player-count"),
    connectedNote: document.getElementById("multiplayer-connected-note"),
    invitations: document.getElementById("multiplayer-invitations"),
    invitationsSummary: document.getElementById("multiplayer-invitations-summary"),
    invitationTitle: document.getElementById("multiplayer-invitation-title"),
    invitationDescription: document.getElementById("multiplayer-invitation-description"),
    invitationFooter: document.getElementById("multiplayer-invitation-footer"),
    sessionStatus: document.getElementById("multiplayer-session-status"),
    sendPanel: document.getElementById("multiplayer-send-panel"),
    sendTitle: document.getElementById("multiplayer-send-title"),
    sendDescription: document.getElementById("multiplayer-send-description"),
    inviteNote: document.getElementById("multiplayer-invite-note"),
    inviteNoteTitle: document.getElementById("multiplayer-invite-note-title"),
    inviteNoteDescription: document.getElementById("multiplayer-invite-note-description"),
    remoteLabel: document.getElementById("multiplayer-remote-label"),
    remoteDescription: document.getElementById("multiplayer-remote-description"),
    joinToggle: document.getElementById("multiplayer-join-toggle"),
    cancelInvite: document.getElementById("multiplayer-cancel-invite"),
    create: document.getElementById("multiplayer-create"),
    accept: document.getElementById("multiplayer-accept"),
    acceptLabel: document.getElementById("multiplayer-accept-label"),
    copy: document.getElementById("multiplayer-copy"),
    copyLabel: document.getElementById("multiplayer-copy-label"),
    restart: document.getElementById("multiplayer-restart"),
    local: document.getElementById("multiplayer-local"),
    localPanel: document.getElementById("multiplayer-local-panel"),
    localLabel: document.getElementById("multiplayer-local-label"),
    remote: document.getElementById("multiplayer-remote"),
    remotePanel: document.getElementById("multiplayer-remote-panel"),
    payloadDebug: document.getElementById("multiplayer-debug"),
    payloadDebugPanel: document.getElementById("multiplayer-debug-panel"),
    payloadDebugLocal: document.getElementById("multiplayer-debug-local"),
    payloadDebugRemote: document.getElementById("multiplayer-debug-remote"),
    status: document.getElementById("multiplayer-status"),
    error: document.getElementById("multiplayer-error"),
  };
  // The host retains established connections while negotiating one new invite.
  let role = null;
  let joining = false;
  let peers = new Set();
  let peer = null;
  let remotePlayerCount = 2;
  let generation = 0;
  let localPayload = "";
  let remotePayload = "";
  let queue = Promise.resolve();
  let requestCounter = 0;
  let negotiating = false;
  let pendingRequest = null;
  let guessTimeout;
  let focusAfterJoin = false;

  function isGuest() { return role === "guest"; }
  function connectedPeers() { return [...peers].filter((peer) => peer.connected); }
  function connected() { return connectedPeers().length > 0; }

  function renderConnection() {
    const view = connectionView({ role, joining, connectedCount: connectedPeers().length,
      remotePlayerCount, hasPeer: Boolean(peer), signalingState: peer?.signalingState,
      negotiating, hasRemote: Boolean(elements.remote.value.trim()), hasLocal: Boolean(elements.local.value),
      peerCount: peers.size, invitationsOpen: elements.invitations.open });
    const { connected, joining: isJoining, playerCount: count } = view;
    elements.panel.classList.toggle("is-connected", connected);
    elements.panel.dataset.role = view.role;
    elements.connectedPanel.hidden = !connected;
    i18n.text(elements.playerCount, i18n.message("multiplayer.players", { count }));
    i18n.text(elements.connectedNote, isGuest()
      ? i18n.message("multiplayer.guestConnected")
      : count === 2 ? i18n.message("multiplayer.friendConnected") : i18n.message("multiplayer.friendsConnected"));
    elements.invitations.hidden = view.invitationsHidden;
    elements.invitationsSummary.hidden = !connected || isGuest();
    if (!connected) elements.invitations.open = true;
    i18n.text(elements.invitationTitle, isGuest() ? i18n.message("multiplayer.guestTitle")
      : isJoining ? i18n.message("multiplayer.joinTitle")
      : connected ? i18n.message("multiplayer.hostTitle") : i18n.message("multiplayer.title"));
    i18n.text(elements.invitationDescription, isGuest()
      ? i18n.message("multiplayer.guestDescription")
      : isJoining ? i18n.message("multiplayer.joinDescription")
      : connected ? i18n.message("multiplayer.hostDescription")
      : i18n.message("multiplayer.description"));
    elements.sendPanel.hidden = isJoining;
    i18n.text(elements.sendTitle, isGuest() ? i18n.message("multiplayer.sendResponse") : i18n.message("multiplayer.sendInvite"));
    i18n.text(elements.sendDescription, isGuest()
      ? i18n.message("multiplayer.sendResponseHelp")
      : i18n.message("multiplayer.sendInviteHelp"));
    elements.sendDescription.hidden = !isGuest();
    elements.inviteNote.hidden = view.inviteNoteHidden;
    const { invitationUsed } = view;
    i18n.text(elements.inviteNoteTitle, invitationUsed
      ? i18n.message("multiplayer.inviteUsed")
      : i18n.message("multiplayer.singleUse"));
    i18n.text(elements.inviteNoteDescription, invitationUsed
      ? i18n.message("multiplayer.inviteUsedHelp")
      : i18n.message("multiplayer.singleUseHelp"));
    elements.local.setAttribute("aria-describedby", isGuest()
      ? "multiplayer-status" : "multiplayer-invite-note multiplayer-status");
    i18n.text(elements.remoteLabel, isJoining ? i18n.message("multiplayer.pasteInvite") : i18n.message("multiplayer.pasteResponse"));
    i18n.text(elements.remoteDescription, isJoining
      ? i18n.message("multiplayer.inviteHelp")
      : i18n.message("multiplayer.responseHelp"));
    i18n.attr(elements.remote, "placeholder", isJoining ? i18n.message("multiplayer.invitePlaceholder") : i18n.message("multiplayer.responsePlaceholder"));
    elements.joinToggle.hidden = Boolean(role) || connected;
    i18n.text(elements.joinToggle, isJoining ? i18n.message("multiplayer.hostToggle") : i18n.message("multiplayer.joinToggle"));
    elements.create.hidden = view.createHidden;
    i18n.text(elements.create, connected ? i18n.message("multiplayer.createAnother") : i18n.message("multiplayer.create"));
    elements.create.disabled = view.createDisabled;
    i18n.text(elements.acceptLabel, isJoining ? i18n.message("multiplayer.acceptInvite") : i18n.message("multiplayer.acceptResponse"));
    elements.accept.disabled = view.acceptDisabled;
    elements.localPanel.hidden = view.localHidden;
    elements.remotePanel.hidden = view.remoteHidden;
    elements.cancelInvite.hidden = view.cancelHidden;
    i18n.text(elements.cancelInvite, connected ? i18n.message("multiplayer.cancelInvite") : i18n.message("multiplayer.reset"));
    elements.copy.disabled = !elements.local.value;
    elements.restart.hidden = view.restartHidden;
    i18n.text(elements.restart, connected
      ? isGuest() ? i18n.message("multiplayer.leave") : i18n.message("multiplayer.disconnect")
      : i18n.message("multiplayer.disconnectReset"));
    // Keep loading and disconnection feedback visible after signaling is hidden.
    const statusParent = view.statusInSession
      ? elements.sessionStatus : elements.invitationFooter;
    if (elements.status.parentElement !== statusParent) statusParent.prepend(elements.status);
    elements.invitationFooter.hidden = connected && !peer;
    renderPayloadDebug();
  }

  function renderPayloadDebug() {
    const visible = elements.payloadDebug.checked && !(isGuest() && connected());
    elements.payloadDebugPanel.hidden = !visible;
    const show = (element, value) => {
      i18n.text(element, "");
      if (!visible || !value) return;
      try {
        i18n.text(element, JSON.stringify(JSON.parse(decodeSignalingPayload(value)), null, 2));
      } catch {
        i18n.text(element, i18n.message("multiplayer.invalidDebug"));
      }
    };
    show(elements.payloadDebugLocal, elements.local.value);
    show(elements.payloadDebugRemote, elements.remote.value.trim() || remotePayload);
  }

  function refreshInviteLink() {
    if (role === "host" && localPayload) {
      elements.local.value = createInviteUrl(localPayload, window.location.href);
    }
  }

  function acceptInviteFromLocation() {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.hash.slice(1));
    const token = params.get("join");
    if (token === null) return false;
    elements.enabled.checked = true;
    elements.panel.hidden = false;
    if (peers.size || negotiating) {
      i18n.text(elements.error, i18n.message("multiplayer.disconnectFirst"));
      return true;
    }
    // Remove the invitation from the address bar without reloading the page.
    params.delete("join");
    url.hash = params.toString();
    window.history.replaceState(null, "", url);
    try {
      readSignalingDescription(token, "offer");
    } catch (error) {
      i18n.text(elements.error, i18n.errorMessage(error));
      return false;
    }
    elements.remote.value = token;
    void negotiate(false);
    return true;
  }

  function setNegotiating(busy) {
    negotiating = busy;
    renderConnection();
  }

  async function negotiate(create) {
    if (negotiating || (create && (peer || isGuest()))) return;
    i18n.text(elements.error, "");
    // Validate pasted data before disturbing an existing invitation or solo game.
    try {
      if (!create) {
        if (role === "host" && !peer) throw i18n.error("multiplayer.createFirst");
        readSignalingDescription(elements.remote.value.trim(), role === "host" ? "answer" : "offer");
        remotePayload = decodeSignalingPayload(elements.remote.value.trim());
      }
    } catch (error) {
      i18n.text(elements.error, i18n.errorMessage(error));
      return;
    }
    if (!role) role = create ? "host" : "guest";
    setNegotiating(true);
    let negotiatingPeer = peer;
    try {
      if (!negotiatingPeer) {
        negotiatingPeer = createManualPeerConnection();
        peer = negotiatingPeer;
        peers.add(negotiatingPeer);
        if (isGuest()) {
          cancelLoading();
          game.setBusy(true);
        }
        negotiatingPeer.onOpen = () => {
          if (!peers.has(negotiatingPeer)) return;
          const moveFocus = elements.invitations.contains(document.activeElement);
          i18n.text(elements.status, "");
          clearSignaling();
          if (!isGuest()) {
            peer = null;
            elements.invitations.open = false;
          }
          setNegotiating(false);
          if (!isGuest()) {
            sharePlayers();
            // A guess may already be awaiting model results when the peer joins.
            void queue.then(() => {
              if (peers.has(negotiatingPeer)) shareGame(negotiatingPeer);
            });
          }
          if (moveFocus) {
            if (game.active && !game.busy) game.input.focus();
            else if (!isGuest()) elements.invitationsSummary.focus();
            else focusAfterJoin = true;
          }
        };
        negotiatingPeer.onClose = (message) => {
          removePeer(negotiatingPeer, message);
        };
        negotiatingPeer.onMessage = (message) => receive(message, negotiatingPeer);
      }
      renderConnection();
      refreshControls();
      i18n.text(elements.status, i18n.message("multiplayer.gathering"));
      if (create) {
        const payload = await negotiatingPeer.createOffer();
        if (negotiatingPeer !== peer) return;
        localPayload = payload;
        refreshInviteLink();
        i18n.text(elements.localLabel, i18n.message("multiplayer.linkLabel"));
        i18n.text(elements.copyLabel, i18n.message("multiplayer.copyLink"));
        i18n.text(elements.status, i18n.message("multiplayer.waiting"));
      } else if (isGuest()) {
        const payload = await negotiatingPeer.acceptOffer(elements.remote.value.trim());
        if (negotiatingPeer !== peer) return;
        localPayload = payload;
        elements.local.value = encodeSignalingPayload(payload);
        i18n.text(elements.localLabel, i18n.message("multiplayer.responseLabel"));
        i18n.text(elements.copyLabel, i18n.message("multiplayer.copyResponse"));
        elements.remote.value = "";
        i18n.text(elements.status, i18n.message("multiplayer.responseReady"));
      } else {
        await negotiatingPeer.acceptAnswer(elements.remote.value.trim());
        if (negotiatingPeer !== peer) return;
        i18n.text(elements.status, i18n.message("multiplayer.connecting"));
      }
    } catch (error) {
      if (error.name === "AbortError" || (negotiatingPeer && !peers.has(negotiatingPeer))) return;
      const message = i18n.message("multiplayer.negotiationFailed");
      if (negotiatingPeer) removePeer(negotiatingPeer, message);
      else {
        if (!peers.size) role = null;
        i18n.text(elements.status, message);
        setNegotiating(false);
        refreshControls();
      }
      i18n.text(elements.error, i18n.errorMessage(error));
    } finally {
      if (negotiatingPeer === peer) {
        setNegotiating(false);
        renderPayloadDebug();
      }
    }
  }

  function clearSignaling() {
    elements.local.value = "";
    elements.remote.value = "";
    localPayload = "";
    remotePayload = "";
    elements.payloadDebug.checked = false;
    i18n.text(elements.localLabel, i18n.message("multiplayer.localLabel"));
    i18n.text(elements.copyLabel, i18n.message("multiplayer.copyLink"));
    renderPayloadDebug();
  }

  function removePeer(removedPeer, message) {
    if (!peers.has(removedPeer)) return;
    if (isGuest()) {
      disconnect(message);
      return;
    }
    const moveFocus = removedPeer === peer && elements.invitations.contains(document.activeElement);
    peers.delete(removedPeer);
    removedPeer.close();
    if (removedPeer === peer) {
      peer = null;
      clearSignaling();
      negotiating = false;
      i18n.text(elements.error, "");
    }
    if (!peers.size) {
      role = null;
      joining = false;
    }
    i18n.text(elements.status, connected()
      ? i18n.message("multiplayer.continues", { message })
      : message);
    renderConnection();
    if (moveFocus) elements.create.focus();
    sharePlayers();
  }

  function sharePlayers() {
    if (!isGuest()) send({ type: "players", count: connectedPeers().length + 1 });
  }

  async function copyDescription() {
    const value = elements.local.value;
    try {
      await navigator.clipboard.writeText(value);
      if (value === elements.local.value) i18n.text(elements.status, isGuest()
        ? i18n.message("multiplayer.responseCopied")
        : i18n.message("multiplayer.inviteCopied"));
    } catch {
      elements.local.focus();
      elements.local.select();
      i18n.text(elements.status, i18n.message("multiplayer.copyManually"));
    }
  }

  function send(message, target = null) {
    for (const peer of target ? [target] : connectedPeers()) {
      if (!peers.has(peer) || !peer.connected) continue;
      void peer.send(message).catch((error) => removePeer(peer, i18n.errorMessage(error)));
    }
  }

  function shareGame(target = null) {
    if (isGuest() || !connected()) return;
    const article = getArticle();
    send(article && game.active
      ? { type: "game", article, state: game.exportSharedState() }
      : { type: "loading" }, target);
  }

  function requestGuess(guess) {
    if (!connected()) {
      if (isGuest()) return false;
      return enqueueGuess(guess);
    }
    if (isGuest()) {
      pendingRequest = ++requestCounter;
      game.setBusy(true);
      send({ type: "guess", session: getArticle()?.session, guess, request: pendingRequest });
      guessTimeout = setTimeout(() => disconnect(i18n.message("multiplayer.guessTimeout")), 30000);
      return true;
    }
    return enqueueGuess(guess);
  }

  function enqueueGuess(guess, request = null, requester = null) {
    const requestedGeneration = generation;
    const session = getArticle()?.session;
    queue = queue.then(async () => {
      if (requestedGeneration !== generation || isGuest() || session !== getArticle()?.session
        || (requester && !peers.has(requester))) return;
      const accepted = await game.submitGuess(guess, {
        shared: true, focus: request === null, clearInput: request === null,
      });
      if (requestedGeneration !== generation || session !== getArticle()?.session || !game.active) return;
      const state = game.exportSharedState();
      for (const peer of connectedPeers()) {
        // Each guest starts its own request counter; acknowledge only its request.
        send({ type: "state", session, state, request: peer === requester ? request : null,
          accepted: Boolean(accepted), feedback: i18n.getMessage(game.feedback) }, peer);
      }
    }).catch(() => disconnect(i18n.message("multiplayer.guessFailed")));
    return queue;
  }

  function receive(message, peer) {
    if (!peers.has(peer)) return;
    try {
      validateMultiplayerMessage(message, isGuest());
      if (!isGuest()) {
        if (message.session === getArticle()?.session) void enqueueGuess(message.guess, message.request, peer);
        return;
      }
      if (message.type === "players") {
        remotePlayerCount = message.count;
        renderConnection();
      } else if (message.type === "loading") {
        clearTimeout(guessTimeout);
        pendingRequest = null;
        game.reset();
        i18n.text(elements.status, i18n.message("multiplayer.hostLoading"));
      } else if (message.type === "game") {
        showArticle(message.article);
        game.applySharedState(message.state);
        game.setBusy(false);
        clearTimeout(guessTimeout);
        pendingRequest = null;
        i18n.text(elements.status, "");
        if (focusAfterJoin) {
          focusAfterJoin = false;
          game.input.focus();
        }
      } else if (message.type === "state") {
        if (message.session !== getArticle()?.session) return;
        game.applySharedState(message.state);
        if (pendingRequest != null && message.request === pendingRequest) {
          clearTimeout(guessTimeout);
          pendingRequest = null;
          game.setBusy(false);
          if (message.accepted) game.input.value = "";
          i18n.text(game.feedback, i18n.isMessage(message.feedback) && message.feedback.key.startsWith("guess.")
            && Object.values(message.feedback.params).every((value) => typeof value === "string" && value.length <= 200)
            ? message.feedback : typeof message.feedback === "string" ? message.feedback.slice(0, 500) : "");
          game.input.focus();
        }
      } else if (message.type === "unavailable") {
        game.reset();
        i18n.text(elements.status, i18n.message("multiplayer.hostLoadFailed"));
      } else throw new Error();
    } catch {
      removePeer(peer, i18n.message("multiplayer.invalidGame"));
    }
  }

  function disconnect(message = i18n.message("multiplayer.ended")) {
    const wasGuest = isGuest();
    const closingPeers = [...peers];
    peers = new Set();
    peer = null;
    role = null;
    joining = false;
    generation += 1;
    for (const peer of closingPeers) peer.close();
    clearTimeout(guessTimeout);
    pendingRequest = null;
    remotePlayerCount = 2;
    focusAfterJoin = false;
    clearSignaling();
    i18n.text(elements.error, "");
    i18n.text(elements.status, message);
    setNegotiating(false);
    renderPayloadDebug();
    game.setBusy(!game.active);
    refreshControls();
    if (wasGuest) resumeSolo();
  }

  document.getElementById("game-mode").addEventListener("change", () => {
    elements.panel.hidden = !elements.enabled.checked;
    if (!elements.enabled.checked) disconnect();
    else if (!window.RTCPeerConnection) i18n.text(elements.error, i18n.message("multiplayer.unsupported"));
  });
  elements.create.addEventListener("click", () => void negotiate(true));
  elements.accept.addEventListener("click", () => void negotiate(false));
  elements.restart.addEventListener("click", () => disconnect());
  elements.cancelInvite.addEventListener("click", () => {
    if (peer && !isGuest()) removePeer(peer, i18n.message("multiplayer.cancelled"));
  });
  elements.copy.addEventListener("click", () => void copyDescription());
  elements.joinToggle.addEventListener("click", () => {
    joining = !joining;
    elements.remote.value = "";
    i18n.text(elements.error, "");
    i18n.text(elements.status, joining
      ? i18n.message("multiplayer.pasteDetails")
      : i18n.message("multiplayer.initial"));
    renderConnection();
    if (joining) elements.remote.focus();
    else elements.create.focus();
  });
  elements.payloadDebug.addEventListener("change", () => renderPayloadDebug());
  elements.remote.addEventListener("input", () => renderConnection());
  elements.invitations.addEventListener("toggle", () => renderConnection());
  window.addEventListener("hashchange", () => acceptInviteFromLocation());
  document.addEventListener("denantle:languagechange", () => renderConnection());
  game.onGuessRequest = (guess) => requestGuess(guess);
  renderConnection();
  return {
    refreshInviteLink, acceptInviteFromLocation, shareGame, send, negotiate,
    get isGuest() { return isGuest(); },
    get connected() { return connected(); },
    get enabled() { return elements.enabled; },
    get peer() { return peer; },
    get negotiating() { return negotiating; },
  };
}
