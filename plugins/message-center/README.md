# Message Center

Connects IRIS to your own [Message Center](https://github.com/lsy-404/message-center)
as an MCP client, so IRIS agents can read and answer the QQ messages it relays.

## Disclosure

This plugin gives AI access to every direct message, @mention and explicit
request in your QQ immediate queue; reading is not limited by conversation
policy. In conversations you enrol in Message Center as trusted with `send_text`
allowed, AI can send text from your QQ account. Each reply an agent sends
through the `reply` tool is confirmed in IRIS. With **Direct messages** set to
`auto`, the default, IRIS answers a direct message without asking once you have
been away from QQ for 30 minutes and the message has been unanswered for 5
minutes. The agent token is a full QQ access credential.

本插件授予 AI 读取你 QQ 即时队列里所有私聊、@提及和明确请求的能力（读取不受会话策略限制）。在你于
Message Center 网页中登记为 trusted 并允许 `send_text` 的会话里，AI 能以你的 QQ 账号发送文本：agent
通过 `reply` 工具发出的每条回复都需要在 IRIS 里确认；「私聊」设为 `auto`（默认）时，你离开 QQ 满 30
分钟、且私聊 5 分钟未被回应，IRIS 会不经确认自动回复。Agent token 等同于完整的 QQ 访问凭据。

## Setup

1. Install the plugin from the IRIS market, confirm it, then enable it.
2. Set **Message Center URL** to the HTTPS address of your Message Center
   (without `/mcp`) and **Agent token** to its `AGENT_TOKEN`. The token is kept
   in the IRIS credential vault; the plugin itself never sees it.
3. To allow replies in a conversation, open it in the Message Center web app,
   mark it trusted, allow the `send_text` action and choose a reply policy other
   than `none`. A required prefix limits replies to messages that start with it.

The Message Center must offer the `owner_activity` tool with its per-conversation
`lastReplyAt`, `agentRepliesSinceOwner` and `activeLeases` fields. **Test
connection** in IRIS also lists the QQ relays and whether they are online.

## What it does

Every minute IRIS checks the queue and notifies you of new direct messages and
mentions. Clicking a notification opens IRIS with a prompt to look at them.
Messages followed by a message you sent yourself in their conversation are not
announced; IRIS claims up to five of them per minute and marks them completed so
they do not hold up newer messages in the queue. A reply sent by an agent or by
IRIS does not count, because messages may have arrived while it was written.

Agents get five tools: `pending` lists waiting messages (metadata only),
`open` claims one for five minutes and returns its content as untrusted data,
`reply` answers in that conversation, `done` releases it as `completed`,
`retry` or `dead_letter`, and `status` shows the QQ relays and your reply
settings. Claims live only in IRIS memory; agents never see a lease token.

Replies are checked in IRIS before anything is sent: the message must be open
on this device with at least 20 seconds of its claim left, and its conversation
must have a reply policy other than `none` and allow `send_text`. Long replies
are sent in parts of at most 500 characters. Each part's request id depends
only on this device, the message, the reply text and the part's position, so
sending the same text again, even after opening the message again, never
queues a part twice.

## Automatic replies

With **Direct messages** set to `auto`, IRIS answers a direct-message
conversation when all of these hold:

- Message Center has recorded a message you sent yourself, and the last one is
  at least **Away after** minutes old (30 by default). Replies sent by agents do
  not count.
- The newest message in the conversation is at least **Unanswered after**
  minutes old (5 by default), at most a day old, and nothing has been sent in
  that conversation since, neither by you nor by an agent, queued or delivered.
- No agent on any device has a message of that conversation open.
- Agents on all devices together have sent fewer than three messages to that
  conversation since you last wrote anything. Message Center counts them, so
  restarting IRIS or adding a device does not reset the count.

IRIS then claims the conversation's unanswered messages, asks one of your
models for a reply of at most 500 characters, sends it and marks the messages
completed. The model has no tools and receives the messages only as data,
together with your optional **Reply persona**. All ages are measured against
Message Center's clock, not this device's. While IRIS answers a message
automatically, agents cannot open, reply to or release it. If anything fails, the messages
go back to the queue and this device does not try them again. When several
devices run IRIS, the claim makes sure only one of them answers a message, and
the reply it sends marks the conversation answered for all of them.

Group mentions are never answered automatically. Set **Group mentions** to
`off` or `notify`, and **Show notifications** off to keep IRIS quiet.
