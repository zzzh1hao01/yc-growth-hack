## Parent PRD

`BRIEF.md`

## What to build

Convex action implementing multi-turn chat with the AI household persona. The contractor sends a message; the action loads the persona and conversation history, calls GPT with the full context, stores the response turn, and returns the reply.

The persona speaks in character as the homeowner — not as an AI assistant. The system prompt is derived from the persona JSON generated in Slice 8.

### System prompt construction

```
You are [cluster name] homeowner at [address]. 
Respond as this person would respond to a contractor cold-approaching about [service_type].
Your likely objections: [persona.common_objections].
Your preferred channel: [persona.preferred_contractor_channel].
Stay in character. Do not break the fourth wall.
[persona.summary]
```

### Chat turn storage

Each turn written to `chat_history` table as two rows: `{role: "user", content}` and `{role: "assistant", content}`.

## Acceptance criteria

- [ ] Convex action `sendChatMessage(session_id, parcel_id, message)` returns assistant reply
- [ ] Action loads full conversation history from `chat_history` and passes it to GPT (maintains context across turns)
- [ ] System prompt is constructed from `leads.persona` + contractor `service_profile`
- [ ] Both the user message and assistant reply are written to `chat_history` before the action returns
- [ ] Convex query `getChatHistory(session_id, parcel_id)` returns all turns in order for a given conversation
- [ ] If `leads.persona` is null, action calls `generatePersona` first (or throws a clear error for the frontend to handle)
- [ ] GPT model and token limits configurable via environment variable

## Blocked by

- Blocked by `issues/008-persona-generation-api.md`

## User stories addressed

- Persona Chat (§ Persona Generation in BRIEF.md)
- Lead Interaction — chat window
- Core Value Proposition — Household personas as qualification interface
