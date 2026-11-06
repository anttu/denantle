// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  Article,
  MultiplayerMessage,
  ReceivedMessage,
} from './contracts.js'
import {
  type GamePeer,
  isMultiplayerNetwork,
  type MultiplayerNetwork,
} from './data-peer.js'
import { featureFlags } from './feature-flags.js'
import type { createArticleGame } from './game.js'
import {
  createManualPeerConnection,
  readSignalingDescription,
} from './manual-peer.js'
import {
  createPeerJsSession,
  randomInvitationToken,
  validPeerInvite,
} from './peerjs-session.js'
import { errorName, isRecord } from './validation.js'

type ManualPeer = ReturnType<typeof createManualPeerConnection>
interface MultiplayerHooks {
  getArticle(): Article | null
  showArticle(data: unknown): void
  cancelLoading(): void
  refreshControls(): void
  resumeSolo(): void
}
interface ConnectionViewInput {
  role: 'host' | 'guest' | null
  joining: boolean
  connectedCount: number
  remotePlayerCount: number
  hasPeer?: boolean
  signalingState?: RTCSignalingState
  negotiating: boolean
  hasRemote: boolean
  hasLocal: boolean
  peerCount: number
  invitationsOpen: boolean
}

import { elementById } from './dom.js'
import { GUESS_PATTERN } from './game.js'
import { i18n } from './i18n.js'
import {
  createInviteUrl,
  decodeSignalingPayload,
  encodeSignalingPayload,
} from './signaling-payload.js'

function connectionView({
  role,
  joining: wantsToJoin,
  connectedCount,
  remotePlayerCount,
  hasPeer = false,
  signalingState,
  negotiating,
  hasRemote,
  hasLocal,
  peerCount,
  invitationsOpen,
}: ConnectionViewInput) {
  const connected = connectedCount > 0
  const isGuest = role === 'guest'
  const joining = !role && wantsToJoin
  return {
    connected,
    isGuest,
    joining,
    role: isGuest ? 'guest' : joining ? 'joining' : 'host',
    playerCount: isGuest ? remotePlayerCount : connectedCount + 1,
    invitationsHidden: connected && isGuest,
    invitationUsed: connected && !hasPeer,
    inviteNoteHidden: isGuest || joining,
    createHidden: isGuest || joining || hasPeer,
    createDisabled: negotiating || hasPeer,
    acceptDisabled:
      negotiating ||
      !hasRemote ||
      isGuest ||
      (!joining && (!hasPeer || signalingState !== 'have-local-offer')),
    localHidden: !hasLocal,
    remoteHidden: isGuest,
    cancelHidden: !hasPeer || isGuest,
    restartHidden: peerCount === 0 || (!connected && !isGuest),
    statusInSession: connected && (!hasPeer || isGuest || !invitationsOpen),
  }
}

export function validateMultiplayerMessage(
  message: unknown,
  isGuest: boolean,
): asserts message is ReceivedMessage {
  if (!isRecord(message)) throw new Error()
  const validSession =
    message.session === undefined || typeof message.session === 'string'
  if (!isGuest) {
    if (
      message.type !== 'guess' ||
      typeof message.guess !== 'string' ||
      message.guess.length > 200 ||
      !GUESS_PATTERN.test(message.guess) ||
      typeof message.request !== 'number' ||
      !Number.isSafeInteger(message.request) ||
      message.request <= 0 ||
      !validSession
    )
      throw new Error()
    return
  }
  switch (message.type) {
    case 'players':
      if (
        typeof message.count !== 'number' ||
        !Number.isSafeInteger(message.count) ||
        message.count < 2
      )
        throw new Error()
      return
    case 'loading':
    case 'unavailable':
      return
    case 'game':
      if (!('article' in message) || !('state' in message)) throw new Error()
      return
    case 'state':
      if (
        !validSession ||
        typeof message.accepted !== 'boolean' ||
        !(
          message.request === null ||
          (typeof message.request === 'number' &&
            Number.isSafeInteger(message.request) &&
            message.request > 0)
        ) ||
        !('state' in message)
      )
        throw new Error()
      return
    default:
      throw new Error()
  }
}

export function createMultiplayerGame(
  game: ReturnType<typeof createArticleGame>,
  {
    getArticle,
    showArticle,
    cancelLoading,
    refreshControls,
    resumeSolo,
  }: MultiplayerHooks,
) {
  const elements = {
    mode: elementById('game-mode', HTMLFieldSetElement),
    help: elementById('multiplayer-help', HTMLElement),
    autoPanel: elementById('multiplayer-auto', HTMLElement),
    autoTitle: elementById('multiplayer-auto-title', HTMLElement),
    autoDescription: elementById('multiplayer-auto-description', HTMLElement),
    autoNetworkChoice: elementById('multiplayer-network-choice', HTMLElement),
    autoNetwork: elementById('multiplayer-network', HTMLSelectElement),
    autoNetworkLabel: elementById('multiplayer-auto-network', HTMLElement),
    autoNetworkHelp: elementById('multiplayer-network-help', HTMLElement),
    autoCreate: elementById('multiplayer-auto-create', HTMLButtonElement),
    autoLocalPanel: elementById('multiplayer-auto-local-panel', HTMLElement),
    autoLocal: elementById('multiplayer-auto-local', HTMLInputElement),
    autoCopy: elementById('multiplayer-auto-copy', HTMLButtonElement),
    autoStatus: elementById('multiplayer-auto-status', HTMLElement),
    manual: elementById('multiplayer-manual', HTMLDetailsElement),
    enabled: elementById('multiplayer-enabled', HTMLInputElement),
    panel: elementById('multiplayer-panel', HTMLElement),
    connectedPanel: elementById('multiplayer-connected', HTMLElement),
    playerCount: elementById('multiplayer-player-count', HTMLElement),
    connectedNote: elementById('multiplayer-connected-note', HTMLElement),
    invitations: elementById('multiplayer-invitations', HTMLDetailsElement),
    invitationsSummary: elementById(
      'multiplayer-invitations-summary',
      HTMLElement,
    ),
    invitationTitle: elementById('multiplayer-invitation-title', HTMLElement),
    invitationDescription: elementById(
      'multiplayer-invitation-description',
      HTMLElement,
    ),
    invitationFooter: elementById('multiplayer-invitation-footer', HTMLElement),
    sessionStatus: elementById('multiplayer-session-status', HTMLElement),
    sendPanel: elementById('multiplayer-send-panel', HTMLElement),
    sendTitle: elementById('multiplayer-send-title', HTMLElement),
    sendDescription: elementById('multiplayer-send-description', HTMLElement),
    inviteNote: elementById('multiplayer-invite-note', HTMLElement),
    inviteNoteTitle: elementById('multiplayer-invite-note-title', HTMLElement),
    inviteNoteDescription: elementById(
      'multiplayer-invite-note-description',
      HTMLElement,
    ),
    remoteLabel: elementById('multiplayer-remote-label', HTMLElement),
    remoteDescription: elementById(
      'multiplayer-remote-description',
      HTMLElement,
    ),
    joinToggle: elementById('multiplayer-join-toggle', HTMLButtonElement),
    cancelInvite: elementById('multiplayer-cancel-invite', HTMLButtonElement),
    create: elementById('multiplayer-create', HTMLButtonElement),
    accept: elementById('multiplayer-accept', HTMLButtonElement),
    acceptLabel: elementById('multiplayer-accept-label', HTMLElement),
    copy: elementById('multiplayer-copy', HTMLButtonElement),
    copyLabel: elementById('multiplayer-copy-label', HTMLElement),
    restart: elementById('multiplayer-restart', HTMLButtonElement),
    local: elementById('multiplayer-local', HTMLInputElement),
    localPanel: elementById('multiplayer-local-panel', HTMLElement),
    localLabel: elementById('multiplayer-local-label', HTMLElement),
    remote: elementById('multiplayer-remote', HTMLTextAreaElement),
    remotePanel: elementById('multiplayer-remote-panel', HTMLElement),
    payloadDebug: elementById('multiplayer-debug', HTMLInputElement),
    payloadDebugPanel: elementById('multiplayer-debug-panel', HTMLElement),
    payloadDebugLocal: elementById('multiplayer-debug-local', HTMLElement),
    payloadDebugRemote: elementById('multiplayer-debug-remote', HTMLElement),
    status: elementById('multiplayer-status', HTMLElement),
    error: elementById('multiplayer-error', HTMLElement),
  }
  // The host retains established connections while negotiating one new invite.
  let autoSession: ReturnType<typeof createPeerJsSession> | null = null
  let autoHostId = ''
  let autoToken = ''
  let autoConnecting = false
  let autoAvailable = true
  let automaticNetwork: MultiplayerNetwork = 'internet'
  let role: 'host' | 'guest' | null = null
  let joining = false
  let peers = new Set<GamePeer>()
  let peer: ManualPeer | null = null
  let remotePlayerCount = 2
  let generation = 0
  let localPayload = ''
  let remotePayload = ''
  let queue = Promise.resolve()
  let requestCounter = 0
  let negotiating = false
  let pendingRequest: number | null = null
  let guessTimeout: ReturnType<typeof setTimeout> | undefined
  let focusAfterJoin = false

  function isGuest() {
    return role === 'guest'
  }
  function connectedPeers() {
    return [...peers].filter((peer) => peer.connected)
  }
  function connected() {
    return connectedPeers().length > 0
  }

  function renderConnection() {
    const view = connectionView({
      role,
      joining,
      connectedCount: connectedPeers().length,
      remotePlayerCount,
      hasPeer: Boolean(peer),
      signalingState: peer?.signalingState,
      negotiating,
      hasRemote: Boolean(elements.remote.value.trim()),
      hasLocal: Boolean(elements.local.value),
      peerCount: peers.size,
      invitationsOpen: elements.invitations.open,
    })
    const { connected, joining: isJoining, playerCount: count } = view
    elements.panel.classList.toggle('is-connected', connected)
    elements.panel.dataset.role = view.role
    elements.connectedPanel.hidden = !connected
    i18n.text(
      elements.playerCount,
      i18n.message('multiplayer.players', { count }),
    )
    i18n.text(
      elements.connectedNote,
      isGuest()
        ? i18n.message('multiplayer.guestConnected')
        : count === 2
          ? i18n.message('multiplayer.friendConnected')
          : i18n.message('multiplayer.friendsConnected'),
    )
    elements.invitations.hidden = view.invitationsHidden
    elements.invitationsSummary.hidden = !connected || isGuest()
    if (!connected) elements.invitations.open = true
    i18n.text(
      elements.invitationTitle,
      isGuest()
        ? i18n.message('multiplayer.guestTitle')
        : isJoining
          ? i18n.message('multiplayer.joinTitle')
          : connected
            ? i18n.message('multiplayer.hostTitle')
            : i18n.message('multiplayer.title'),
    )
    i18n.text(
      elements.invitationDescription,
      isGuest()
        ? i18n.message('multiplayer.guestDescription')
        : isJoining
          ? i18n.message('multiplayer.joinDescription')
          : connected
            ? i18n.message('multiplayer.hostDescription')
            : i18n.message('multiplayer.description'),
    )
    elements.sendPanel.hidden = isJoining
    i18n.text(
      elements.sendTitle,
      isGuest()
        ? i18n.message('multiplayer.sendResponse')
        : i18n.message('multiplayer.sendInvite'),
    )
    i18n.text(
      elements.sendDescription,
      isGuest()
        ? i18n.message('multiplayer.sendResponseHelp')
        : i18n.message('multiplayer.sendInviteHelp'),
    )
    elements.sendDescription.hidden = !isGuest()
    elements.inviteNote.hidden = view.inviteNoteHidden
    const { invitationUsed } = view
    i18n.text(
      elements.inviteNoteTitle,
      invitationUsed
        ? i18n.message('multiplayer.inviteUsed')
        : i18n.message('multiplayer.singleUse'),
    )
    i18n.text(
      elements.inviteNoteDescription,
      invitationUsed
        ? i18n.message('multiplayer.inviteUsedHelp')
        : i18n.message('multiplayer.singleUseHelp'),
    )
    elements.local.setAttribute(
      'aria-describedby',
      isGuest()
        ? 'multiplayer-status'
        : 'multiplayer-invite-note multiplayer-status',
    )
    i18n.text(
      elements.remoteLabel,
      isJoining
        ? i18n.message('multiplayer.pasteInvite')
        : i18n.message('multiplayer.pasteResponse'),
    )
    i18n.text(
      elements.remoteDescription,
      isJoining
        ? i18n.message('multiplayer.inviteHelp')
        : i18n.message('multiplayer.responseHelp'),
    )
    i18n.attr(
      elements.remote,
      'placeholder',
      isJoining
        ? i18n.message('multiplayer.invitePlaceholder')
        : i18n.message('multiplayer.responsePlaceholder'),
    )
    elements.joinToggle.hidden = Boolean(role) || connected
    i18n.text(
      elements.joinToggle,
      isJoining
        ? i18n.message('multiplayer.hostToggle')
        : i18n.message('multiplayer.joinToggle'),
    )
    elements.create.hidden = view.createHidden
    i18n.text(
      elements.create,
      connected
        ? i18n.message('multiplayer.createAnother')
        : i18n.message('multiplayer.create'),
    )
    elements.create.disabled = view.createDisabled
    i18n.text(
      elements.acceptLabel,
      isJoining
        ? i18n.message('multiplayer.acceptInvite')
        : i18n.message('multiplayer.acceptResponse'),
    )
    elements.accept.disabled = view.acceptDisabled
    elements.localPanel.hidden = view.localHidden
    elements.remotePanel.hidden = view.remoteHidden
    elements.cancelInvite.hidden = view.cancelHidden
    i18n.text(
      elements.cancelInvite,
      connected
        ? i18n.message('multiplayer.cancelInvite')
        : i18n.message('multiplayer.reset'),
    )
    elements.copy.disabled = !elements.local.value
    elements.restart.hidden = view.restartHidden
    i18n.text(
      elements.restart,
      connected
        ? isGuest()
          ? i18n.message('multiplayer.leave')
          : i18n.message('multiplayer.disconnect')
        : i18n.message('multiplayer.disconnectReset'),
    )
    // Keep loading and disconnection feedback visible after signaling is hidden.
    const statusParent =
      !featureFlags.manualMultiplayer ||
      view.statusInSession ||
      (autoSession && !peer && !localPayload)
        ? elements.sessionStatus
        : elements.invitationFooter
    if (elements.status.parentElement !== statusParent)
      statusParent.prepend(elements.status)
    elements.invitationFooter.hidden = connected && !peer
    renderPayloadDebug()
    renderAutoConnection()
  }

  function renderAutoConnection() {
    const guest = isGuest()
    elements.autoNetworkChoice.hidden = guest
    elements.autoNetwork.value = automaticNetwork
    elements.autoNetwork.disabled = Boolean(autoSession)
    i18n.text(
      elements.autoNetworkLabel,
      i18n.message(
        automaticNetwork === 'lan'
          ? 'multiplayer.networkLan'
          : 'multiplayer.networkInternet',
      ),
    )
    i18n.text(
      elements.autoNetworkHelp,
      i18n.message(
        automaticNetwork === 'lan'
          ? 'multiplayer.networkLanHelp'
          : 'multiplayer.networkInternetHelp',
      ),
    )
    elements.autoPanel.hidden = guest && connected()
    elements.manual.hidden =
      !featureFlags.manualMultiplayer || (guest && connected())
    i18n.text(
      elements.autoTitle,
      i18n.message(guest ? 'multiplayer.autoJoining' : 'multiplayer.autoTitle'),
    )
    i18n.text(
      elements.autoDescription,
      i18n.message(
        guest
          ? 'multiplayer.autoJoinDescription'
          : 'multiplayer.autoDescription',
      ),
    )
    elements.autoCreate.hidden = guest || Boolean(autoHostId && autoAvailable)
    elements.autoCreate.disabled = autoConnecting
    i18n.text(
      elements.autoCreate,
      i18n.message(
        autoSession && !autoAvailable
          ? 'multiplayer.autoRetry'
          : 'multiplayer.autoCreate',
      ),
    )
    elements.autoLocalPanel.hidden = !autoHostId || guest
    elements.autoCopy.disabled = !elements.autoLocal.value
    i18n.text(
      elements.autoStatus,
      i18n.message(
        !autoAvailable
          ? 'multiplayer.signalingUnavailable'
          : autoConnecting
            ? 'multiplayer.autoConnecting'
            : autoHostId
              ? 'multiplayer.autoReady'
              : 'multiplayer.autoInitial',
      ),
    )
    if (autoSession) elements.restart.hidden = false
  }

  function registerPeer(newPeer: GamePeer, manual = false) {
    peers.add(newPeer)
    if (isGuest()) {
      cancelLoading()
      game.setBusy(true)
    }
    newPeer.onOpen = () => {
      if (!peers.has(newPeer)) return
      const moveFocus =
        elements.invitations.contains(document.activeElement) ||
        elements.autoPanel.contains(document.activeElement)
      i18n.text(elements.status, '')
      if (manual && newPeer === peer) {
        clearSignaling()
        if (!isGuest()) {
          peer = null
          elements.invitations.open = false
        }
        negotiating = false
      }
      autoConnecting = false
      renderConnection()
      refreshControls()
      if (!isGuest()) {
        sharePlayers()
        void queue.then(() => {
          if (peers.has(newPeer)) shareGame(newPeer)
        })
      }
      if (moveFocus) {
        if (game.active && !game.busy) game.input.focus()
        else if (!isGuest() && manual) elements.invitationsSummary.focus()
        else focusAfterJoin = true
      }
    }
    newPeer.onClose = (message) => removePeer(newPeer, message)
    newPeer.onMessage = (message) => receive(message, newPeer)
    renderConnection()
    refreshControls()
  }

  function isCurrentSession(session: ReturnType<typeof createPeerJsSession>) {
    return autoSession === session
  }

  function newAutomaticSession(hostToken?: string) {
    const session = createPeerJsSession(
      {
        hostToken,
        onConnection: (newPeer) => {
          if (!isCurrentSession(session) || role !== 'host') {
            newPeer.close()
            return
          }
          registerPeer(newPeer)
        },
        onOpen: () => {
          if (!isCurrentSession(session)) return
          autoAvailable = true
          autoConnecting = false
          i18n.text(elements.error, '')
          renderConnection()
        },
        onUnavailable: (message) => {
          if (!isCurrentSession(session)) return
          if (isGuest() && !connected()) {
            disconnect(message)
          }
          autoAvailable = false
          autoConnecting = false
          elements.manual.open = featureFlags.manualMultiplayer
          i18n.text(elements.error, message)
          renderConnection()
        },
      },
      automaticNetwork,
    )
    autoSession = session
    return session
  }

  async function startAutomaticHost() {
    if (!featureFlags.multiplayer || isGuest() || autoConnecting) return
    i18n.text(elements.status, '')
    i18n.text(elements.error, '')
    if (autoSession) {
      if (!autoSession.destroyed) {
        autoSession.reconnect()
        return
      }
      autoSession.close()
      autoSession = null
      autoHostId = ''
    }
    role = 'host'
    autoConnecting = true
    autoAvailable = true
    autoToken = randomInvitationToken()
    const session = newAutomaticSession(autoToken)
    renderConnection()
    try {
      const id = await session.ready
      if (!isCurrentSession(session)) return
      autoHostId = id
      autoConnecting = false
      refreshInviteLink()
      renderConnection()
    } catch (error) {
      if (!isCurrentSession(session)) return
      autoSession = null
      session.close()
      autoConnecting = false
      autoAvailable = false
      elements.manual.open = featureFlags.manualMultiplayer
      i18n.text(elements.error, i18n.errorMessage(error))
      renderConnection()
    }
  }

  async function joinAutomatic(
    id: string,
    token: string,
    network: MultiplayerNetwork,
  ) {
    i18n.text(elements.status, '')
    role = 'guest'
    automaticNetwork = network
    autoConnecting = true
    autoAvailable = true
    cancelLoading()
    game.setBusy(true)
    const session = newAutomaticSession()
    renderConnection()
    refreshControls()
    try {
      await session.ready
      if (!isCurrentSession(session) || role !== 'guest') return
      autoConnecting = true
      registerPeer(session.connect(id, token))
    } catch (error) {
      if (!isCurrentSession(session)) return
      const message = i18n.errorMessage(error)
      disconnect(message)
      elements.manual.open = featureFlags.manualMultiplayer
      i18n.text(elements.error, message)
    }
  }

  function renderPayloadDebug() {
    const visible = elements.payloadDebug.checked && !(isGuest() && connected())
    elements.payloadDebugPanel.hidden = !visible
    const show = (element: HTMLElement, value: string) => {
      i18n.text(element, '')
      if (!visible || !value) return
      try {
        i18n.text(
          element,
          JSON.stringify(JSON.parse(decodeSignalingPayload(value)), null, 2),
        )
      } catch {
        i18n.text(element, i18n.message('multiplayer.invalidDebug'))
      }
    }
    show(elements.payloadDebugLocal, elements.local.value)
    show(
      elements.payloadDebugRemote,
      elements.remote.value.trim() || remotePayload,
    )
  }

  function refreshInviteLink() {
    if (role === 'host' && autoHostId && autoToken) {
      const url = new URL(window.location.href)
      const params = new URLSearchParams({
        peer: autoHostId,
        token: autoToken,
      })
      if (automaticNetwork === 'lan') params.set('network', automaticNetwork)
      url.hash = params.toString()
      elements.autoLocal.value = url.href
    }
    if (role === 'host' && localPayload) {
      elements.local.value = createInviteUrl(localPayload, window.location.href)
    }
  }

  function acceptInviteFromLocation() {
    if (!featureFlags.multiplayer) return false
    const url = new URL(window.location.href)
    const params = new URLSearchParams(url.hash.slice(1))
    const hostId = params.get('peer')
    if (hostId !== null) {
      const token = params.get('token')
      const network = params.get('network') ?? 'internet'
      elements.enabled.checked = true
      elements.panel.hidden = false
      if (peers.size || negotiating || autoSession) {
        i18n.text(elements.error, i18n.message('multiplayer.disconnectFirst'))
        return true
      }
      params.delete('peer')
      params.delete('token')
      params.delete('network')
      url.hash = params.toString()
      window.history.replaceState(null, '', url)
      if (
        !validPeerInvite(hostId, token) ||
        !isMultiplayerNetwork(network) ||
        params.has('join')
      ) {
        i18n.text(elements.error, i18n.message('multiplayer.invalidInvite'))
        return false
      }
      void joinAutomatic(hostId, token!, network)
      return true
    }
    const token = params.get('join')
    if (!featureFlags.manualMultiplayer || token === null) return false
    elements.enabled.checked = true
    elements.panel.hidden = false
    if (peers.size || negotiating || autoSession) {
      i18n.text(elements.error, i18n.message('multiplayer.disconnectFirst'))
      return true
    }
    // Remove the invitation from the address bar without reloading the page.
    params.delete('join')
    url.hash = params.toString()
    window.history.replaceState(null, '', url)
    try {
      readSignalingDescription(token, 'offer')
    } catch (error) {
      i18n.text(elements.error, i18n.errorMessage(error))
      return false
    }
    elements.manual.open = true
    elements.remote.value = token
    void negotiateManual(false)
    return true
  }

  function setNegotiating(busy: boolean) {
    negotiating = busy
    renderConnection()
  }

  async function negotiateManual(create: boolean) {
    if (
      !featureFlags.multiplayer ||
      !featureFlags.manualMultiplayer ||
      negotiating ||
      (create && (peer || isGuest()))
    )
      return
    i18n.text(elements.error, '')
    // Validate pasted data before disturbing an existing invitation or solo game.
    try {
      if (!create) {
        if (role === 'host' && !peer)
          throw i18n.error('multiplayer.createFirst')
        readSignalingDescription(
          elements.remote.value.trim(),
          role === 'host' ? 'answer' : 'offer',
        )
        remotePayload = decodeSignalingPayload(elements.remote.value.trim())
      }
    } catch (error) {
      i18n.text(elements.error, i18n.errorMessage(error))
      return
    }
    if (!role) role = create ? 'host' : 'guest'
    setNegotiating(true)
    let negotiatingPeer = peer
    try {
      if (!negotiatingPeer) {
        const newPeer = createManualPeerConnection()
        negotiatingPeer = newPeer
        peer = newPeer
        registerPeer(newPeer, true)
      }
      renderConnection()
      refreshControls()
      i18n.text(elements.status, i18n.message('multiplayer.gathering'))
      if (create) {
        const payload = await negotiatingPeer.createOffer()
        if (negotiatingPeer !== peer) return
        localPayload = payload
        refreshInviteLink()
        i18n.text(elements.localLabel, i18n.message('multiplayer.linkLabel'))
        i18n.text(elements.copyLabel, i18n.message('multiplayer.copyLink'))
        i18n.text(elements.status, i18n.message('multiplayer.waiting'))
      } else if (isGuest()) {
        const payload = await negotiatingPeer.acceptOffer(
          elements.remote.value.trim(),
        )
        if (negotiatingPeer !== peer) return
        localPayload = payload
        elements.local.value = encodeSignalingPayload(payload)
        i18n.text(
          elements.localLabel,
          i18n.message('multiplayer.responseLabel'),
        )
        i18n.text(elements.copyLabel, i18n.message('multiplayer.copyResponse'))
        elements.remote.value = ''
        i18n.text(elements.status, i18n.message('multiplayer.responseReady'))
      } else {
        await negotiatingPeer.acceptAnswer(elements.remote.value.trim())
        if (negotiatingPeer !== peer) return
        i18n.text(elements.status, i18n.message('multiplayer.connecting'))
      }
    } catch (error) {
      if (
        errorName(error) === 'AbortError' ||
        (negotiatingPeer && !peers.has(negotiatingPeer))
      )
        return
      const message = i18n.message('multiplayer.negotiationFailed')
      if (negotiatingPeer) removePeer(negotiatingPeer, message)
      else {
        if (!peers.size) role = null
        i18n.text(elements.status, message)
        setNegotiating(false)
        refreshControls()
      }
      i18n.text(elements.error, i18n.errorMessage(error))
    } finally {
      if (negotiatingPeer === peer) {
        setNegotiating(false)
        renderPayloadDebug()
      }
    }
  }

  function clearSignaling() {
    elements.local.value = ''
    elements.remote.value = ''
    localPayload = ''
    remotePayload = ''
    elements.payloadDebug.checked = false
    i18n.text(elements.localLabel, i18n.message('multiplayer.localLabel'))
    i18n.text(elements.copyLabel, i18n.message('multiplayer.copyLink'))
    renderPayloadDebug()
  }

  function removePeer(removedPeer: GamePeer, message: unknown) {
    if (!peers.has(removedPeer)) return
    if (isGuest()) {
      disconnect(message)
      return
    }
    const moveFocus =
      removedPeer === peer &&
      elements.invitations.contains(document.activeElement)
    peers.delete(removedPeer)
    removedPeer.close()
    if (removedPeer === peer) {
      peer = null
      clearSignaling()
      negotiating = false
      i18n.text(elements.error, '')
    }
    if (!peers.size && !(autoSession && role === 'host')) {
      role = null
      joining = false
    }
    i18n.text(
      elements.status,
      connected()
        ? i18n.message('multiplayer.continues', { message })
        : message,
    )
    renderConnection()
    if (moveFocus) elements.create.focus()
    sharePlayers()
  }

  function sharePlayers() {
    if (!isGuest())
      send({ type: 'players', count: connectedPeers().length + 1 })
  }

  async function copyAutomaticInvite() {
    const value = elements.autoLocal.value
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      if (value === elements.autoLocal.value)
        i18n.text(elements.autoStatus, i18n.message('multiplayer.inviteCopied'))
    } catch {
      elements.autoLocal.focus()
      elements.autoLocal.select()
      i18n.text(elements.autoStatus, i18n.message('multiplayer.copyManually'))
    }
  }

  async function copyDescription() {
    const value = elements.local.value
    try {
      await navigator.clipboard.writeText(value)
      if (value === elements.local.value)
        i18n.text(
          elements.status,
          isGuest()
            ? i18n.message('multiplayer.responseCopied')
            : i18n.message('multiplayer.inviteCopied'),
        )
    } catch {
      elements.local.focus()
      elements.local.select()
      i18n.text(elements.status, i18n.message('multiplayer.copyManually'))
    }
  }

  function send(message: MultiplayerMessage, target: GamePeer | null = null) {
    for (const peer of target ? [target] : connectedPeers()) {
      if (!peers.has(peer) || !peer.connected) continue
      void peer
        .send(message)
        .catch((error) => removePeer(peer, i18n.errorMessage(error)))
    }
  }

  function shareGame(target: GamePeer | null = null) {
    if (isGuest() || !connected()) return
    const article = getArticle()
    send(
      article && game.active
        ? { type: 'game', article, state: game.exportSharedState() }
        : { type: 'loading' },
      target,
    )
  }

  function requestGuess(guess: string) {
    if (!connected()) {
      if (isGuest()) return false
      return enqueueGuess(guess)
    }
    if (isGuest()) {
      pendingRequest = ++requestCounter
      game.setBusy(true)
      send({
        type: 'guess',
        session: getArticle()?.session,
        guess,
        request: pendingRequest,
      })
      guessTimeout = setTimeout(
        () => disconnect(i18n.message('multiplayer.guessTimeout')),
        30000,
      )
      return true
    }
    return enqueueGuess(guess)
  }

  function enqueueGuess(
    guess: string,
    request: number | null = null,
    requester: GamePeer | null = null,
  ) {
    const requestedGeneration = generation
    const session = getArticle()?.session
    queue = queue
      .then(async () => {
        if (
          requestedGeneration !== generation ||
          isGuest() ||
          session !== getArticle()?.session ||
          (requester && !peers.has(requester))
        )
          return
        const accepted = await game.submitGuess(guess, {
          shared: true,
          focus: request === null,
          clearInput: request === null,
        })
        if (
          requestedGeneration !== generation ||
          session !== getArticle()?.session ||
          !game.active
        )
          return
        const state = game.exportSharedState()
        for (const peer of connectedPeers()) {
          // Each guest starts its own request counter; acknowledge only its request.
          send(
            {
              type: 'state',
              session,
              state,
              request: peer === requester ? request : null,
              accepted: Boolean(accepted),
              feedback: i18n.getMessage(game.feedback),
            },
            peer,
          )
        }
      })
      .catch(() => disconnect(i18n.message('multiplayer.guessFailed')))
    return queue
  }

  function receive(message: unknown, peer: GamePeer) {
    if (!peers.has(peer)) return
    try {
      validateMultiplayerMessage(message, isGuest())
      if (message.type === 'guess') {
        if (message.session === getArticle()?.session)
          void enqueueGuess(message.guess, message.request, peer)
        return
      }
      if (message.type === 'players') {
        remotePlayerCount = message.count
        renderConnection()
      } else if (message.type === 'loading') {
        clearTimeout(guessTimeout)
        pendingRequest = null
        game.reset()
        i18n.text(elements.status, i18n.message('multiplayer.hostLoading'))
      } else if (message.type === 'game') {
        showArticle(message.article)
        game.applySharedState(message.state)
        game.setBusy(false)
        clearTimeout(guessTimeout)
        pendingRequest = null
        i18n.text(elements.status, '')
        if (focusAfterJoin) {
          focusAfterJoin = false
          game.input.focus()
        }
      } else if (message.type === 'state') {
        if (message.session !== getArticle()?.session) return
        game.applySharedState(message.state)
        if (pendingRequest != null && message.request === pendingRequest) {
          clearTimeout(guessTimeout)
          pendingRequest = null
          game.setBusy(false)
          if (message.accepted) game.input.value = ''
          i18n.text(
            game.feedback,
            i18n.isMessage(message.feedback) &&
              message.feedback.key.startsWith('guess.') &&
              Object.values(message.feedback.params).every(
                (value) => typeof value === 'string' && value.length <= 200,
              )
              ? message.feedback
              : typeof message.feedback === 'string'
                ? message.feedback.slice(0, 500)
                : '',
          )
          game.input.focus()
        }
      } else if (message.type === 'unavailable') {
        game.reset()
        i18n.text(elements.status, i18n.message('multiplayer.hostLoadFailed'))
      } else throw new Error()
    } catch {
      removePeer(peer, i18n.message('multiplayer.invalidGame'))
    }
  }

  function disconnect(message: unknown = i18n.message('multiplayer.ended')) {
    const wasGuest = isGuest()
    const closingPeers = [...peers]
    const closingSession = autoSession
    autoSession = null
    autoHostId = ''
    autoToken = ''
    autoConnecting = false
    autoAvailable = true
    elements.autoLocal.value = ''
    peers = new Set()
    peer = null
    role = null
    joining = false
    generation += 1
    closingSession?.close()
    for (const peer of closingPeers) peer.close()
    clearTimeout(guessTimeout)
    pendingRequest = null
    remotePlayerCount = 2
    focusAfterJoin = false
    clearSignaling()
    i18n.text(elements.error, '')
    i18n.text(elements.status, message)
    setNegotiating(false)
    renderPayloadDebug()
    game.setBusy(!game.active)
    refreshControls()
    if (wasGuest) resumeSolo()
  }

  elements.mode.hidden = !featureFlags.multiplayer
  elements.mode.disabled = !featureFlags.multiplayer
  elements.help.hidden = !featureFlags.multiplayer
  if (!featureFlags.multiplayer) {
    elements.enabled.checked = false
    elementById('singleplayer-enabled', HTMLInputElement).checked = true
    elements.panel.hidden = true
  }
  elements.mode.addEventListener('change', () => {
    if (!featureFlags.multiplayer) return
    elements.panel.hidden = !elements.enabled.checked
    if (!elements.enabled.checked) disconnect()
    else if (!window.RTCPeerConnection)
      i18n.text(elements.error, i18n.message('multiplayer.unsupported'))
  })
  elements.autoCreate.addEventListener('click', () => void startAutomaticHost())
  elements.autoNetwork.addEventListener('change', () => {
    if (
      !autoSession &&
      !isGuest() &&
      isMultiplayerNetwork(elements.autoNetwork.value)
    )
      automaticNetwork = elements.autoNetwork.value
    renderConnection()
  })
  elements.autoCopy.addEventListener('click', () => void copyAutomaticInvite())
  elements.create.addEventListener('click', () => void negotiateManual(true))
  elements.accept.addEventListener('click', () => void negotiateManual(false))
  elements.restart.addEventListener('click', () => disconnect())
  elements.cancelInvite.addEventListener('click', () => {
    if (peer && !isGuest())
      removePeer(peer, i18n.message('multiplayer.cancelled'))
  })
  elements.copy.addEventListener('click', () => void copyDescription())
  elements.joinToggle.addEventListener('click', () => {
    joining = !joining
    elements.remote.value = ''
    i18n.text(elements.error, '')
    i18n.text(
      elements.status,
      joining
        ? i18n.message('multiplayer.pasteDetails')
        : i18n.message('multiplayer.initial'),
    )
    renderConnection()
    if (joining) elements.remote.focus()
    else elements.create.focus()
  })
  elements.payloadDebug.addEventListener('change', () => renderPayloadDebug())
  elements.remote.addEventListener('input', () => renderConnection())
  elements.invitations.addEventListener('toggle', () => renderConnection())
  window.addEventListener('hashchange', () => acceptInviteFromLocation())
  document.addEventListener('denantle:languagechange', () => renderConnection())
  game.onGuessRequest = (guess) => requestGuess(guess)
  renderConnection()
  return {
    refreshInviteLink,
    acceptInviteFromLocation,
    shareGame,
    send,
    get isGuest() {
      return isGuest()
    },
    get connected() {
      return connected()
    },
  }
}
