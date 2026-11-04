# P2P chat

A static HTML page with JavaScript in `chat.js`, using built-in WebRTC data
channels. No application server, signaling service, dependencies, accounts,
or build step.

Keep `index.html` and `chat.js` in the same directory. Open `index.html` in a
current browser, or upload both files to any HTTPS static web host.
Each participant opens their own copy of the same page.

## Connect

1. The host clicks **Create invitation**, waits for an offer code, and sends the
   complete code to a guest using an existing communication channel.
2. The guest pastes the offer into **Code from the other person** and clicks
   **Use code**. They send their generated answer code back to the host.
3. The host pastes the answer and clicks **Use code**. When connected, both can
   send chat messages.
4. For more guests, the host creates a fresh invitation and repeats the exchange
   with each guest. Guests can chat with each other through the host browser.

Only share each invitation with one guest. **Replace invitation** invalidates
the unanswered offer without disconnecting existing guests. **Leave / start
over** disconnects this tab and clears its chat log.

## Connection details

- Connection codes include all gathered ICE candidates, so no background
  signaling endpoint is needed. Exchange complete codes while keeping both tabs open.
- The host browser forwards messages between guests and must remain open. If the
  host leaves, guests must exchange fresh codes with a host to reconnect.
- No external ICE servers or TURN relays are configured. Peers need a direct
  network route, such as the same local network. Some routers, mobile networks,
  VPNs, or firewalls prevent direct connections; try another network if setup fails.
- WebRTC encrypts each peer connection. The host sees and forwards guest messages.
- Each tab displays its last 100 messages. New guests see messages sent after they
  connect. Refreshing the page clears that tab's messages and disconnects it.
