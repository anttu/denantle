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
      if (state === "failed" || state === "closed") this.close("Yhteys katkesi. Luo uusi kutsu yhdistääksesi uudelleen.");
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
      throw new Error(type === "offer"
        ? "Kutsu ei kelpaa. Liitä koko Denantle-kutsu."
        : "Vastaus ei kelpaa. Liitä kutsuun saatu koko Denantle-vastaus.");
    }
  }

  bindChannel(channel) {
    this.channel = channel;
    channel.bufferedAmountLowThreshold = 65536;
    channel.onopen = () => {
      clearTimeout(this.connectionTimeout);
      this.onOpen?.();
    };
    channel.onclose = () => this.close("Toinen pelaaja katkaisi yhteyden. Voit jatkaa yksin tai luoda uuden kutsun.");
    channel.onerror = () => this.close("Yhteys epäonnistui. Kokeile uutta kutsua tai toista verkkoa.");
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
        this.close("Toisen pelaajan viesti ei kelpaa. Tarkista, että käytätte samaa peliversiota.");
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
        const timer = setTimeout(() => done(new Error("Yhteystietojen keruu kesti liian kauan. Kokeile uudelleen.")), 20000);
        this.cancelGathering = () => done(new DOMException("Yhteys suljettiin.", "AbortError"));
        this.peer.addEventListener("icegatheringstatechange", changed);
        changed();
      });
    }
    if (this.closed) throw new DOMException("Yhteys suljettiin.", "AbortError");
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
      if (!this.connected) this.close("Yhteyttä ei saatu. Kokeile samaa lähiverkkoa tai luo uusi kutsu.");
    }, 30000);
  }

  send(message) {
    const task = this.sendQueue.then(async () => {
      if (!this.connected) throw new Error("Yhteys ei ole auki.");
      const text = JSON.stringify(message);
      if (text.length > 4 * 1024 * 1024) throw new Error("Pelitiedot ovat liian suuret lähetettäviksi.");
      // Small chunks also work with browsers that limit messages to 16 KiB.
      // Splitting the JSON string preserves Unicode even across surrogate pairs.
      for (let offset = 0; offset < text.length; offset += 2000) {
        if (!this.connected) throw new Error("Yhteys katkesi.");
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
            const closed = () => finish(new Error("Yhteys katkesi."));
            const timer = setTimeout(() => finish(new Error("Tietojen lähetys aikakatkaistiin.")), 15000);
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

  close(message = "Yhteys suljettu.") {
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
    this.create = document.getElementById("multiplayer-create");
    this.accept = document.getElementById("multiplayer-accept");
    this.copy = document.getElementById("multiplayer-copy");
    this.restart = document.getElementById("multiplayer-restart");
    this.local = document.getElementById("multiplayer-local");
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
    this.localPayload = "";
    this.remotePayload = "";
    this.queue = Promise.resolve();
    this.requestCounter = 0;
    this.enabled.addEventListener("change", () => {
      this.panel.hidden = !this.enabled.checked;
      if (!this.enabled.checked) this.disconnect();
      else if (!window.RTCPeerConnection) this.error.textContent = "Selain ei tue WebRTC-yhteyksiä. Käytä ajantasaista Firefoxia.";
    });
    this.create.addEventListener("click", () => void this.negotiate(true));
    this.accept.addEventListener("click", () => void this.negotiate(false));
    this.restart.addEventListener("click", () => this.disconnect());
    this.copy.addEventListener("click", () => void this.copyDescription());
    this.payloadDebug.addEventListener("change", () => this.renderPayloadDebug());
    this.remote.addEventListener("input", () => this.renderPayloadDebug());
    window.addEventListener("hashchange", () => this.acceptInviteFromLocation());
    this.game.onGuessRequest = (guess) => this.requestGuess(guess);
    this.renderPayloadDebug();
  }

  get isGuest() { return this.role === "guest"; }

  renderPayloadDebug() {
    this.payloadDebugPanel.hidden = !this.payloadDebug.checked;
    const show = (element, value) => {
      element.textContent = "";
      if (!this.payloadDebug.checked || !value) return;
      try {
        element.textContent = JSON.stringify(JSON.parse(SignalingPayload.decode(value)), null, 2);
      } catch {
        element.textContent = "Yhteystietoa ei voi purkaa JSON-muotoon.";
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
    if (this.peer || this.negotiating) {
      this.error.textContent = "Katkaise nykyinen yhteys ennen uuden kutsun avaamista.";
      return true;
    }
    // Remove the invitation from the address bar without reloading the page.
    params.delete("join");
    url.hash = params.toString();
    window.history.replaceState(null, "", url);
    try {
      ManualPeerConnection.readDescription(token, "offer");
    } catch (error) {
      this.error.textContent = error.message;
      return false;
    }
    this.remote.value = token;
    void this.negotiate(false);
    return true;
  }

  setNegotiating(busy) {
    this.negotiating = busy;
    this.remotePanel.hidden = this.isGuest;
    this.create.disabled = busy || Boolean(this.peer);
    this.accept.disabled = busy || Boolean(this.peer
      && (this.isGuest || this.peer.peer.signalingState !== "have-local-offer"));
    this.copy.disabled = !this.local.value;
  }

  async negotiate(create) {
    if (this.negotiating) return;
    this.error.textContent = "";
    // Validate pasted data before disturbing an existing invitation or solo game.
    try {
      if (!create) {
        ManualPeerConnection.readDescription(this.remote.value.trim(), this.role === "host" ? "answer" : "offer");
        this.remotePayload = SignalingPayload.decode(this.remote.value.trim());
      }
    } catch (error) {
      this.error.textContent = error.message;
      return;
    }
    if (!this.peer) this.role = create ? "host" : "guest";
    this.setNegotiating(true);
    let peer = this.peer;
    try {
      if (!peer) {
        peer = new ManualPeerConnection();
        this.peer = peer;
        if (this.isGuest) {
          this.cancelLoading();
          this.game.setBusy(true);
        }
        peer.onOpen = () => {
          if (peer !== this.peer) return;
          this.status.textContent = this.isGuest
            ? "Yhteys auki. Pelataan yhdessä kutsujan artikkelia."
            : "Yhteys auki. Toinen pelaaja on mukana pelissäsi.";
          this.setNegotiating(false);
          if (!this.isGuest) {
            // A guess may already be awaiting model results when the peer joins.
            void this.queue.then(() => {
              if (peer === this.peer) this.shareGame();
            });
          }
        };
        peer.onClose = (message) => {
          if (peer === this.peer) this.disconnect(message);
        };
        peer.onMessage = (message) => this.receive(message);
      }
      this.refreshControls();
      this.status.textContent = "Kerätään yhteystietoja…";
      if (create) {
        const payload = await peer.createOffer();
        if (peer !== this.peer) return;
        this.localPayload = payload;
        this.refreshInviteLink();
        this.localLabel.textContent = "Kutsulinkki – kopioi ja lähetä pelikaverille";
        this.copy.textContent = "Kopioi kutsulinkki";
        this.status.textContent = "Jaa kutsulinkki toiselle pelaajalle. Liitä häneltä saamasi vastaus alle ja hyväksy se.";
      } else if (this.isGuest) {
        const payload = await peer.acceptOffer(this.remote.value.trim());
        if (peer !== this.peer) return;
        this.localPayload = payload;
        this.local.value = SignalingPayload.encode(payload);
        this.localLabel.textContent = "Vastaus – kopioi ja lähetä kutsujalle";
        this.copy.textContent = "Kopioi vastaus";
        this.remote.value = "";
        this.status.textContent = "Kopioi vastaus kutsujalle. Yhteys avautuu, kun kutsuja hyväksyy sen.";
      } else {
        await peer.acceptAnswer(this.remote.value.trim());
        if (peer !== this.peer) return;
        this.status.textContent = "Yhdistetään pelaajaan…";
      }
      this.accept.textContent = this.role === "host" ? "Hyväksy vastaus" : "Hyväksy kutsu";
    } catch (error) {
      if (peer !== this.peer || error.name === "AbortError") return;
      this.disconnect("Yhteyden muodostaminen epäonnistui. Voit kokeilla uudelleen.");
      this.error.textContent = error.message;
    } finally {
      if (peer === this.peer) {
        this.setNegotiating(false);
        this.renderPayloadDebug();
      }
    }
  }

  async copyDescription() {
    const value = this.local.value;
    try {
      await navigator.clipboard.writeText(value);
      if (value === this.local.value) this.status.textContent = this.isGuest
        ? "Vastaus kopioitu. Lähetä se kutsujalle."
        : "Kutsulinkki kopioitu. Lähetä se toiselle pelaajalle.";
    } catch {
      this.local.focus();
      this.local.select();
      this.status.textContent = "Kopioi valittu teksti näppäimistöllä tai selaimen valikosta.";
    }
  }

  send(message) {
    const peer = this.peer;
    if (!peer?.connected) return;
    void peer.send(message).catch((error) => {
      if (peer === this.peer) this.disconnect(error.message);
    });
  }

  shareGame() {
    if (this.isGuest || !this.peer?.connected) return;
    const article = this.getArticle();
    this.send(article && this.game.active
      ? { type: "game", article, state: this.game.exportSharedState() }
      : { type: "loading" });
  }

  requestGuess(guess) {
    if (!this.peer?.connected) {
      if (this.isGuest) return false;
      return this.enqueueGuess(guess);
    }
    if (this.isGuest) {
      this.pendingRequest = ++this.requestCounter;
      this.game.setBusy(true);
      this.send({ type: "guess", session: this.getArticle()?.session, guess, request: this.pendingRequest });
      this.guessTimeout = setTimeout(() => this.disconnect("Pelaajan vastausta ei saatu. Voit jatkaa yksin tai yhdistää uudelleen."), 30000);
      return true;
    }
    return this.enqueueGuess(guess);
  }

  enqueueGuess(guess, request = null) {
    const peer = this.peer;
    const session = this.getArticle()?.session;
    this.queue = this.queue.then(async () => {
      if ((peer && peer !== this.peer) || this.isGuest || session !== this.getArticle()?.session) return;
      const accepted = await this.game.submitGuess(guess, {
        shared: true, focus: request === null, clearInput: request === null,
      });
      if (peer !== this.peer || session !== this.getArticle()?.session || !this.game.active) return;
      this.send({ type: "state", session, state: this.game.exportSharedState(),
        request, accepted: Boolean(accepted), feedback: this.game.feedback.textContent });
    }).catch(() => this.disconnect("Arvauksen käsittely epäonnistui. Voit jatkaa yksin."));
    return this.queue;
  }

  receive(message) {
    try {
      if (!message || typeof message !== "object") throw new Error();
      if (!this.isGuest) {
        if (message.type !== "guess" || typeof message.guess !== "string" || message.guess.length > 200
          || !GUESS_PATTERN.test(message.guess) || !Number.isSafeInteger(message.request) || message.request <= 0) throw new Error();
        if (message.session === this.getArticle()?.session) void this.enqueueGuess(message.guess, message.request);
        return;
      }
      if (message.type === "loading") {
        clearTimeout(this.guessTimeout);
        this.pendingRequest = null;
        this.game.reset();
        this.status.textContent = "Kutsuja valitsee uutta artikkelia…";
      } else if (message.type === "game") {
        this.showArticle(message.article);
        this.game.applySharedState(message.state);
        this.game.setBusy(false);
        clearTimeout(this.guessTimeout);
        this.pendingRequest = null;
        this.status.textContent = "Yhteys auki. Pelataan yhdessä kutsujan artikkelia.";
      } else if (message.type === "state") {
        if (message.session !== this.getArticle()?.session) return;
        this.game.applySharedState(message.state);
        if (this.pendingRequest != null && message.request === this.pendingRequest) {
          clearTimeout(this.guessTimeout);
          this.pendingRequest = null;
          this.game.setBusy(false);
          if (message.accepted) this.game.input.value = "";
          this.game.feedback.textContent = typeof message.feedback === "string" ? message.feedback.slice(0, 500) : "";
          this.game.input.focus();
        }
      } else if (message.type === "unavailable") {
        this.game.reset();
        this.status.textContent = "Kutsujan artikkelin lataus epäonnistui. Odotetaan uutta peliä.";
      } else throw new Error();
    } catch {
      this.disconnect("Pelitiedot eivät kelpaa. Tarkista, että käytätte samaa peliversiota.");
    }
  }

  disconnect(message = "Moninpeli suljettu. Voit jatkaa yksin tai muodostaa uuden yhteyden.") {
    const wasGuest = this.isGuest;
    const peer = this.peer;
    this.peer = null;
    this.role = null;
    peer?.close();
    clearTimeout(this.guessTimeout);
    this.pendingRequest = null;
    this.local.value = "";
    this.localPayload = "";
    this.remotePayload = "";
    this.remote.value = "";
    this.localLabel.textContent = "Oma yhteystieto – kopioi ja lähetä pelikaverille";
    this.copy.textContent = "Kopioi yhteystieto";
    this.accept.textContent = "Hyväksy kutsu";
    this.error.textContent = "";
    this.status.textContent = message;
    this.setNegotiating(false);
    this.renderPayloadDebug();
    this.game.setBusy(!this.game.active);
    this.refreshControls();
    if (wasGuest) this.resumeSolo();
  }
}
