// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

// Signaling is manual: each description includes all gathered ICE candidates.
// No external ICE services are used.
class ManualPeerConnection {
  constructor({ onOpen, onClose, onMessage } = {}) {
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onMessage = onMessage;
    this.peer = new RTCPeerConnection({
      iceServers: [],
    });
    this.sendQueue = Promise.resolve();
    this.received = "";
    this.closed = false;
    this.peer.ondatachannel = ({ channel }) => {
      if (this.channel || channel.label !== "denantle") {
        channel.close();
        return;
      }
      this.bindChannel(channel);
    };
    this.peer.onconnectionstatechange = () => {
      const state = this.peer.connectionState;
      if (state === "failed" || state === "closed") this.close(i18n.message("multiplayer.reconnect"));
      if (state === "connected") clearTimeout(this.connectionTimeout);
    };
  }

  get connected() {
    return !this.closed && this.channel?.readyState === "open";
  }

  static readDescription(text, type) {
    try {
      const data = JSON.parse(SignalingPayload.decode(text));
      if (data.denantle !== 1 || data.description?.type !== type
        || typeof data.description.sdp !== "string" || !data.description.sdp.startsWith("v=0")) throw new Error();
      return { type, sdp: data.description.sdp };
    } catch {
      throw i18n.error(type === "offer"
        ? i18n.message("multiplayer.invalidInvite")
        : i18n.message("multiplayer.invalidResponse"));
    }
  }

  bindChannel(channel) {
    this.channel = channel;
    channel.bufferedAmountLowThreshold = 65536;
    channel.onopen = () => {
      clearTimeout(this.connectionTimeout);
      this.onOpen?.();
    };
    channel.onclose = () => this.close(i18n.message("multiplayer.peerLeft"));
    channel.onerror = () => this.close(i18n.message("multiplayer.connectionFailed"));
    channel.onmessage = ({ data }) => {
      try {
        if (typeof data !== "string" || data.length > 20000) throw new Error();
        const chunk = JSON.parse(data);
        if (typeof chunk.part !== "string" || typeof chunk.last !== "boolean") throw new Error();
        this.received += chunk.part;
        if (this.received.length > 4 * 1024 * 1024) throw new Error();
        if (!chunk.last) return;
        const message = JSON.parse(this.received);
        this.received = "";
        this.onMessage?.(message);
      } catch {
        this.close(i18n.message("multiplayer.invalidMessage"));
      }
    };
  }

  async localDescription(description) {
    await this.peer.setLocalDescription(description);
    if (this.peer.iceGatheringState !== "complete") {
      await new Promise((resolve, reject) => {
        const done = (error) => {
          clearTimeout(timer);
          this.peer.removeEventListener("icegatheringstatechange", changed);
          this.cancelGathering = null;
          if (error) reject(error);
          else resolve();
        };
        const changed = () => {
          if (this.peer.iceGatheringState === "complete") done();
        };
        const timer = setTimeout(() => done(i18n.error("multiplayer.gatheringTimeout")), 20000);
        this.cancelGathering = () => done(new DOMException(i18n.t("multiplayer.closed"), "AbortError"));
        this.peer.addEventListener("icegatheringstatechange", changed);
        changed();
      });
    }
    if (this.closed) throw new DOMException(i18n.t("multiplayer.closed"), "AbortError");
    return JSON.stringify({ denantle: 1, description: this.peer.localDescription.toJSON() });
  }

  async createOffer() {
    this.bindChannel(this.peer.createDataChannel("denantle"));
    return this.localDescription(await this.peer.createOffer());
  }

  async acceptOffer(text) {
    await this.peer.setRemoteDescription(ManualPeerConnection.readDescription(text, "offer"));
    return this.localDescription(await this.peer.createAnswer());
  }

  async acceptAnswer(text) {
    await this.peer.setRemoteDescription(ManualPeerConnection.readDescription(text, "answer"));
    this.connectionTimeout = setTimeout(() => {
      if (!this.connected) this.close(i18n.message("multiplayer.noConnection"));
    }, 30000);
  }

  send(message) {
    const task = this.sendQueue.then(async () => {
      if (!this.connected) throw i18n.error("multiplayer.notOpen");
      const text = JSON.stringify(message);
      if (text.length > 4 * 1024 * 1024) throw i18n.error("multiplayer.tooLarge");
      // Small chunks also work with browsers that limit messages to 16 KiB.
      // Splitting the JSON string preserves Unicode even across surrogate pairs.
      for (let offset = 0; offset < text.length; offset += 2000) {
        if (!this.connected) throw i18n.error("multiplayer.interrupted");
        if (this.channel.bufferedAmount > 131072) {
          await new Promise((resolve, reject) => {
            const finish = (error) => {
              clearTimeout(timer);
              this.channel.removeEventListener("bufferedamountlow", ready);
              this.channel.removeEventListener("close", closed);
              if (error) reject(error);
              else resolve();
            };
            const ready = () => finish();
            const closed = () => finish(i18n.error("multiplayer.interrupted"));
            const timer = setTimeout(() => finish(i18n.error("multiplayer.sendTimeout")), 15000);
            this.channel.addEventListener("bufferedamountlow", ready, { once: true });
            this.channel.addEventListener("close", closed, { once: true });
            if (this.channel.bufferedAmount <= 65536) ready();
          });
        }
        this.channel.send(JSON.stringify({ part: text.slice(offset, offset + 2000), last: offset + 2000 >= text.length }));
      }
    });
    this.sendQueue = task.catch(() => {});
    return task;
  }

  close(message = i18n.message("multiplayer.connectionClosed")) {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.connectionTimeout);
    this.cancelGathering?.();
    this.channel?.close();
    this.peer.close();
    this.received = "";
    this.onClose?.(message);
  }
}

class MultiplayerGame {
  constructor(game, { getArticle, showArticle, cancelLoading, refreshControls, resumeSolo }) {
    this.game = game;
    this.getArticle = getArticle;
    this.showArticle = showArticle;
    this.cancelLoading = cancelLoading;
    this.refreshControls = refreshControls;
    this.resumeSolo = resumeSolo;
    this.enabled = document.getElementById("multiplayer-enabled");
    this.panel = document.getElementById("multiplayer-panel");
    this.connectedPanel = document.getElementById("multiplayer-connected");
    this.playerCount = document.getElementById("multiplayer-player-count");
    this.connectedNote = document.getElementById("multiplayer-connected-note");
    this.invitations = document.getElementById("multiplayer-invitations");
    this.invitationsSummary = document.getElementById("multiplayer-invitations-summary");
    this.invitationTitle = document.getElementById("multiplayer-invitation-title");
    this.invitationDescription = document.getElementById("multiplayer-invitation-description");
    this.invitationFooter = document.getElementById("multiplayer-invitation-footer");
    this.sessionStatus = document.getElementById("multiplayer-session-status");
    this.sendPanel = document.getElementById("multiplayer-send-panel");
    this.sendTitle = document.getElementById("multiplayer-send-title");
    this.sendDescription = document.getElementById("multiplayer-send-description");
    this.inviteNote = document.getElementById("multiplayer-invite-note");
    this.inviteNoteTitle = document.getElementById("multiplayer-invite-note-title");
    this.inviteNoteDescription = document.getElementById("multiplayer-invite-note-description");
    this.remoteLabel = document.getElementById("multiplayer-remote-label");
    this.remoteDescription = document.getElementById("multiplayer-remote-description");
    this.joinToggle = document.getElementById("multiplayer-join-toggle");
    this.cancelInvite = document.getElementById("multiplayer-cancel-invite");
    this.create = document.getElementById("multiplayer-create");
    this.accept = document.getElementById("multiplayer-accept");
    this.acceptLabel = document.getElementById("multiplayer-accept-label");
    this.copy = document.getElementById("multiplayer-copy");
    this.copyLabel = document.getElementById("multiplayer-copy-label");
    this.restart = document.getElementById("multiplayer-restart");
    this.local = document.getElementById("multiplayer-local");
    this.localPanel = document.getElementById("multiplayer-local-panel");
    this.localLabel = document.getElementById("multiplayer-local-label");
    this.remote = document.getElementById("multiplayer-remote");
    this.remotePanel = document.getElementById("multiplayer-remote-panel");
    this.payloadDebug = document.getElementById("multiplayer-debug");
    this.payloadDebugPanel = document.getElementById("multiplayer-debug-panel");
    this.payloadDebugLocal = document.getElementById("multiplayer-debug-local");
    this.payloadDebugRemote = document.getElementById("multiplayer-debug-remote");
    this.status = document.getElementById("multiplayer-status");
    this.error = document.getElementById("multiplayer-error");
    this.role = null;
    this.joining = false;
    // The host keeps established connections while negotiating one new invite.
    // For a guest, peer remains the connection to the host.
    this.peers = new Set();
    this.peer = null;
    this.remotePlayerCount = 2;
    this.generation = 0;
    this.localPayload = "";
    this.remotePayload = "";
    this.queue = Promise.resolve();
    this.requestCounter = 0;
    document.getElementById("game-mode").addEventListener("change", () => {
      this.panel.hidden = !this.enabled.checked;
      if (!this.enabled.checked) this.disconnect();
      else if (!window.RTCPeerConnection) i18n.text(this.error, i18n.message("multiplayer.unsupported"));
    });
    this.create.addEventListener("click", () => void this.negotiate(true));
    this.accept.addEventListener("click", () => void this.negotiate(false));
    this.restart.addEventListener("click", () => this.disconnect());
    this.cancelInvite.addEventListener("click", () => {
      if (this.peer && !this.isGuest) this.removePeer(this.peer, i18n.message("multiplayer.cancelled"));
    });
    this.copy.addEventListener("click", () => void this.copyDescription());
    this.joinToggle.addEventListener("click", () => {
      this.joining = !this.joining;
      this.remote.value = "";
      i18n.text(this.error, "");
      i18n.text(this.status, this.joining
        ? i18n.message("multiplayer.pasteDetails")
        : i18n.message("multiplayer.initial"));
      this.renderConnection();
      if (this.joining) this.remote.focus();
      else this.create.focus();
    });
    this.payloadDebug.addEventListener("change", () => this.renderPayloadDebug());
    this.remote.addEventListener("input", () => this.renderConnection());
    this.invitations.addEventListener("toggle", () => this.renderConnection());
    window.addEventListener("hashchange", () => this.acceptInviteFromLocation());
    document.addEventListener("denantle:languagechange", () => this.renderConnection());
    this.game.onGuessRequest = (guess) => this.requestGuess(guess);
    this.renderConnection();
  }

  get isGuest() { return this.role === "guest"; }
  get connectedPeers() { return [...this.peers].filter((peer) => peer.connected); }
  get connected() { return this.connectedPeers.length > 0; }

  renderConnection() {
    const connected = this.connected;
    const joining = !this.role && this.joining;
    const count = this.isGuest ? this.remotePlayerCount : this.connectedPeers.length + 1;
    this.panel.classList.toggle("is-connected", connected);
    this.panel.dataset.role = this.isGuest ? "guest" : joining ? "joining" : "host";
    this.connectedPanel.hidden = !connected;
    i18n.text(this.playerCount, i18n.message("multiplayer.players", { count }));
    i18n.text(this.connectedNote, this.isGuest
      ? i18n.message("multiplayer.guestConnected")
      : count === 2 ? i18n.message("multiplayer.friendConnected") : i18n.message("multiplayer.friendsConnected"));
    this.invitations.hidden = connected && this.isGuest;
    this.invitationsSummary.hidden = !connected || this.isGuest;
    if (!connected) this.invitations.open = true;
    i18n.text(this.invitationTitle, this.isGuest ? i18n.message("multiplayer.guestTitle")
      : joining ? i18n.message("multiplayer.joinTitle")
      : connected ? i18n.message("multiplayer.hostTitle") : i18n.message("multiplayer.title"));
    i18n.text(this.invitationDescription, this.isGuest
      ? i18n.message("multiplayer.guestDescription")
      : joining ? i18n.message("multiplayer.joinDescription")
      : connected ? i18n.message("multiplayer.hostDescription")
      : i18n.message("multiplayer.description"));
    this.sendPanel.hidden = joining;
    i18n.text(this.sendTitle, this.isGuest ? i18n.message("multiplayer.sendResponse") : i18n.message("multiplayer.sendInvite"));
    i18n.text(this.sendDescription, this.isGuest
      ? i18n.message("multiplayer.sendResponseHelp")
      : i18n.message("multiplayer.sendInviteHelp"));
    this.sendDescription.hidden = !this.isGuest;
    this.inviteNote.hidden = this.isGuest || joining;
    const invitationUsed = connected && !this.peer;
    i18n.text(this.inviteNoteTitle, invitationUsed
      ? i18n.message("multiplayer.inviteUsed")
      : i18n.message("multiplayer.singleUse"));
    i18n.text(this.inviteNoteDescription, invitationUsed
      ? i18n.message("multiplayer.inviteUsedHelp")
      : i18n.message("multiplayer.singleUseHelp"));
    this.local.setAttribute("aria-describedby", this.isGuest
      ? "multiplayer-status" : "multiplayer-invite-note multiplayer-status");
    i18n.text(this.remoteLabel, joining ? i18n.message("multiplayer.pasteInvite") : i18n.message("multiplayer.pasteResponse"));
    i18n.text(this.remoteDescription, joining
      ? i18n.message("multiplayer.inviteHelp")
      : i18n.message("multiplayer.responseHelp"));
    i18n.attr(this.remote, "placeholder", joining ? i18n.message("multiplayer.invitePlaceholder") : i18n.message("multiplayer.responsePlaceholder"));
    this.joinToggle.hidden = Boolean(this.role) || connected;
    i18n.text(this.joinToggle, joining ? i18n.message("multiplayer.hostToggle") : i18n.message("multiplayer.joinToggle"));
    this.create.hidden = this.isGuest || joining || Boolean(this.peer);
    i18n.text(this.create, connected ? i18n.message("multiplayer.createAnother") : i18n.message("multiplayer.create"));
    this.create.disabled = this.negotiating || Boolean(this.peer);
    i18n.text(this.acceptLabel, joining ? i18n.message("multiplayer.acceptInvite") : i18n.message("multiplayer.acceptResponse"));
    this.accept.disabled = this.negotiating || !this.remote.value.trim() || this.isGuest
      || (!joining && (!this.peer || this.peer.peer.signalingState !== "have-local-offer"));
    this.localPanel.hidden = !this.local.value;
    this.remotePanel.hidden = this.isGuest;
    this.cancelInvite.hidden = !this.peer || this.isGuest;
    i18n.text(this.cancelInvite, connected ? i18n.message("multiplayer.cancelInvite") : i18n.message("multiplayer.reset"));
    this.copy.disabled = !this.local.value;
    this.restart.hidden = this.peers.size === 0 || (!connected && !this.isGuest);
    i18n.text(this.restart, connected
      ? this.isGuest ? i18n.message("multiplayer.leave") : i18n.message("multiplayer.disconnect")
      : i18n.message("multiplayer.disconnectReset"));
    // Keep loading and disconnection feedback visible after signaling is hidden.
    const statusParent = connected && (!this.peer || this.isGuest || !this.invitations.open)
      ? this.sessionStatus : this.invitationFooter;
    if (this.status.parentElement !== statusParent) statusParent.prepend(this.status);
    this.invitationFooter.hidden = connected && !this.peer;
    this.renderPayloadDebug();
  }

  renderPayloadDebug() {
    const visible = this.payloadDebug.checked && !(this.isGuest && this.connected);
    this.payloadDebugPanel.hidden = !visible;
    const show = (element, value) => {
      i18n.text(element, "");
      if (!visible || !value) return;
      try {
        i18n.text(element, JSON.stringify(JSON.parse(SignalingPayload.decode(value)), null, 2));
      } catch {
        i18n.text(element, i18n.message("multiplayer.invalidDebug"));
      }
    };
    show(this.payloadDebugLocal, this.local.value);
    show(this.payloadDebugRemote, this.remote.value.trim() || this.remotePayload);
  }

  refreshInviteLink() {
    if (this.role === "host" && this.localPayload) {
      this.local.value = SignalingPayload.inviteUrl(this.localPayload, window.location.href);
    }
  }

  acceptInviteFromLocation() {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.hash.slice(1));
    const token = params.get("join");
    if (token === null) return false;
    this.enabled.checked = true;
    this.panel.hidden = false;
    if (this.peers.size || this.negotiating) {
      i18n.text(this.error, i18n.message("multiplayer.disconnectFirst"));
      return true;
    }
    // Remove the invitation from the address bar without reloading the page.
    params.delete("join");
    url.hash = params.toString();
    window.history.replaceState(null, "", url);
    try {
      ManualPeerConnection.readDescription(token, "offer");
    } catch (error) {
      i18n.text(this.error, i18n.errorMessage(error));
      return false;
    }
    this.remote.value = token;
    void this.negotiate(false);
    return true;
  }

  setNegotiating(busy) {
    this.negotiating = busy;
    this.renderConnection();
  }

  async negotiate(create) {
    if (this.negotiating || (create && (this.peer || this.isGuest))) return;
    i18n.text(this.error, "");
    // Validate pasted data before disturbing an existing invitation or solo game.
    try {
      if (!create) {
        if (this.role === "host" && !this.peer) throw i18n.error("multiplayer.createFirst");
        ManualPeerConnection.readDescription(this.remote.value.trim(), this.role === "host" ? "answer" : "offer");
        this.remotePayload = SignalingPayload.decode(this.remote.value.trim());
      }
    } catch (error) {
      i18n.text(this.error, i18n.errorMessage(error));
      return;
    }
    if (!this.role) this.role = create ? "host" : "guest";
    this.setNegotiating(true);
    let peer = this.peer;
    try {
      if (!peer) {
        peer = new ManualPeerConnection();
        this.peer = peer;
        this.peers.add(peer);
        if (this.isGuest) {
          this.cancelLoading();
          this.game.setBusy(true);
        }
        peer.onOpen = () => {
          if (!this.peers.has(peer)) return;
          const moveFocus = this.invitations.contains(document.activeElement);
          i18n.text(this.status, "");
          this.clearSignaling();
          if (!this.isGuest) {
            this.peer = null;
            this.invitations.open = false;
          }
          this.setNegotiating(false);
          if (!this.isGuest) {
            this.sharePlayers();
            // A guess may already be awaiting model results when the peer joins.
            void this.queue.then(() => {
              if (this.peers.has(peer)) this.shareGame(peer);
            });
          }
          if (moveFocus) {
            if (this.game.active && !this.game.busy) this.game.input.focus();
            else if (!this.isGuest) this.invitationsSummary.focus();
            else this.focusAfterJoin = true;
          }
        };
        peer.onClose = (message) => {
          this.removePeer(peer, message);
        };
        peer.onMessage = (message) => this.receive(message, peer);
      }
      this.renderConnection();
      this.refreshControls();
      i18n.text(this.status, i18n.message("multiplayer.gathering"));
      if (create) {
        const payload = await peer.createOffer();
        if (peer !== this.peer) return;
        this.localPayload = payload;
        this.refreshInviteLink();
        i18n.text(this.localLabel, i18n.message("multiplayer.linkLabel"));
        i18n.text(this.copyLabel, i18n.message("multiplayer.copyLink"));
        i18n.text(this.status, i18n.message("multiplayer.waiting"));
      } else if (this.isGuest) {
        const payload = await peer.acceptOffer(this.remote.value.trim());
        if (peer !== this.peer) return;
        this.localPayload = payload;
        this.local.value = SignalingPayload.encode(payload);
        i18n.text(this.localLabel, i18n.message("multiplayer.responseLabel"));
        i18n.text(this.copyLabel, i18n.message("multiplayer.copyResponse"));
        this.remote.value = "";
        i18n.text(this.status, i18n.message("multiplayer.responseReady"));
      } else {
        await peer.acceptAnswer(this.remote.value.trim());
        if (peer !== this.peer) return;
        i18n.text(this.status, i18n.message("multiplayer.connecting"));
      }
    } catch (error) {
      if (error.name === "AbortError" || (peer && !this.peers.has(peer))) return;
      const message = i18n.message("multiplayer.negotiationFailed");
      if (peer) this.removePeer(peer, message);
      else {
        if (!this.peers.size) this.role = null;
        i18n.text(this.status, message);
        this.setNegotiating(false);
        this.refreshControls();
      }
      i18n.text(this.error, i18n.errorMessage(error));
    } finally {
      if (peer === this.peer) {
        this.setNegotiating(false);
        this.renderPayloadDebug();
      }
    }
  }

  clearSignaling() {
    this.local.value = "";
    this.remote.value = "";
    this.localPayload = "";
    this.remotePayload = "";
    this.payloadDebug.checked = false;
    i18n.text(this.localLabel, i18n.message("multiplayer.localLabel"));
    i18n.text(this.copyLabel, i18n.message("multiplayer.copyLink"));
    this.renderPayloadDebug();
  }

  removePeer(peer, message) {
    if (!this.peers.has(peer)) return;
    if (this.isGuest) {
      this.disconnect(message);
      return;
    }
    const moveFocus = peer === this.peer && this.invitations.contains(document.activeElement);
    this.peers.delete(peer);
    peer.close();
    if (peer === this.peer) {
      this.peer = null;
      this.clearSignaling();
      this.negotiating = false;
      i18n.text(this.error, "");
    }
    if (!this.peers.size) {
      this.role = null;
      this.joining = false;
    }
    i18n.text(this.status, this.connected
      ? i18n.message("multiplayer.continues", { message })
      : message);
    this.renderConnection();
    if (moveFocus) this.create.focus();
    this.sharePlayers();
  }

  sharePlayers() {
    if (!this.isGuest) this.send({ type: "players", count: this.connectedPeers.length + 1 });
  }

  async copyDescription() {
    const value = this.local.value;
    try {
      await navigator.clipboard.writeText(value);
      if (value === this.local.value) i18n.text(this.status, this.isGuest
        ? i18n.message("multiplayer.responseCopied")
        : i18n.message("multiplayer.inviteCopied"));
    } catch {
      this.local.focus();
      this.local.select();
      i18n.text(this.status, i18n.message("multiplayer.copyManually"));
    }
  }

  send(message, target = null) {
    for (const peer of target ? [target] : this.connectedPeers) {
      if (!this.peers.has(peer) || !peer.connected) continue;
      void peer.send(message).catch((error) => this.removePeer(peer, i18n.errorMessage(error)));
    }
  }

  shareGame(target = null) {
    if (this.isGuest || !this.connected) return;
    const article = this.getArticle();
    this.send(article && this.game.active
      ? { type: "game", article, state: this.game.exportSharedState() }
      : { type: "loading" }, target);
  }

  requestGuess(guess) {
    if (!this.connected) {
      if (this.isGuest) return false;
      return this.enqueueGuess(guess);
    }
    if (this.isGuest) {
      this.pendingRequest = ++this.requestCounter;
      this.game.setBusy(true);
      this.send({ type: "guess", session: this.getArticle()?.session, guess, request: this.pendingRequest });
      this.guessTimeout = setTimeout(() => this.disconnect(i18n.message("multiplayer.guessTimeout")), 30000);
      return true;
    }
    return this.enqueueGuess(guess);
  }

  enqueueGuess(guess, request = null, requester = null) {
    const generation = this.generation;
    const session = this.getArticle()?.session;
    this.queue = this.queue.then(async () => {
      if (generation !== this.generation || this.isGuest || session !== this.getArticle()?.session
        || (requester && !this.peers.has(requester))) return;
      const accepted = await this.game.submitGuess(guess, {
        shared: true, focus: request === null, clearInput: request === null,
      });
      if (generation !== this.generation || session !== this.getArticle()?.session || !this.game.active) return;
      const state = this.game.exportSharedState();
      for (const peer of this.connectedPeers) {
        // Each guest starts its own request counter; acknowledge only its request.
        this.send({ type: "state", session, state, request: peer === requester ? request : null,
          accepted: Boolean(accepted), feedback: i18n.getMessage(this.game.feedback) }, peer);
      }
    }).catch(() => this.disconnect(i18n.message("multiplayer.guessFailed")));
    return this.queue;
  }

  receive(message, peer) {
    if (!this.peers.has(peer)) return;
    try {
      if (!message || typeof message !== "object") throw new Error();
      if (!this.isGuest) {
        if (message.type !== "guess" || typeof message.guess !== "string" || message.guess.length > 200
          || !GUESS_PATTERN.test(message.guess) || !Number.isSafeInteger(message.request) || message.request <= 0) throw new Error();
        if (message.session === this.getArticle()?.session) void this.enqueueGuess(message.guess, message.request, peer);
        return;
      }
      if (message.type === "players") {
        if (!Number.isSafeInteger(message.count) || message.count < 2) throw new Error();
        this.remotePlayerCount = message.count;
        this.renderConnection();
      } else if (message.type === "loading") {
        clearTimeout(this.guessTimeout);
        this.pendingRequest = null;
        this.game.reset();
        i18n.text(this.status, i18n.message("multiplayer.hostLoading"));
      } else if (message.type === "game") {
        this.showArticle(message.article);
        this.game.applySharedState(message.state);
        this.game.setBusy(false);
        clearTimeout(this.guessTimeout);
        this.pendingRequest = null;
        i18n.text(this.status, "");
        if (this.focusAfterJoin) {
          this.focusAfterJoin = false;
          this.game.input.focus();
        }
      } else if (message.type === "state") {
        if (message.session !== this.getArticle()?.session) return;
        this.game.applySharedState(message.state);
        if (this.pendingRequest != null && message.request === this.pendingRequest) {
          clearTimeout(this.guessTimeout);
          this.pendingRequest = null;
          this.game.setBusy(false);
          if (message.accepted) this.game.input.value = "";
          i18n.text(this.game.feedback, i18n.isMessage(message.feedback) && message.feedback.key.startsWith("guess.")
            && Object.values(message.feedback.params).every((value) => typeof value === "string" && value.length <= 200)
            ? message.feedback : typeof message.feedback === "string" ? message.feedback.slice(0, 500) : "");
          this.game.input.focus();
        }
      } else if (message.type === "unavailable") {
        this.game.reset();
        i18n.text(this.status, i18n.message("multiplayer.hostLoadFailed"));
      } else throw new Error();
    } catch {
      this.removePeer(peer, i18n.message("multiplayer.invalidGame"));
    }
  }

  disconnect(message = i18n.message("multiplayer.ended")) {
    const wasGuest = this.isGuest;
    const peers = [...this.peers];
    this.peers.clear();
    this.peer = null;
    this.role = null;
    this.joining = false;
    this.generation += 1;
    for (const peer of peers) peer.close();
    clearTimeout(this.guessTimeout);
    this.pendingRequest = null;
    this.remotePlayerCount = 2;
    this.focusAfterJoin = false;
    this.clearSignaling();
    i18n.text(this.error, "");
    i18n.text(this.status, message);
    this.setNegotiating(false);
    this.renderPayloadDebug();
    this.game.setBusy(!this.game.active);
    this.refreshControls();
    if (wasGuest) this.resumeSolo();
  }
}
