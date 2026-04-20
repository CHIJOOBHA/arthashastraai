# Security Specification: Arthashastra Witness Isolation

## 1. Data Invariants
- **Witness Siloing:** User sectors (Conversations/Messages) must be cryptographically isolated. No user can read or write to another user's sector.
- **Agent Authority:** Intelligence, Tweets, AgentResponse, and AgentLog collections are write-protected from client-side SDKs. Only the backend agent system can modify these records.
- **Admin Supremacy:** designated admins (specified by email or role) have read access to system-wide logs for auditing purposes.
- **Terminal State Locking:** Once a `Message` is entered into the `Aitihya Chain` (Messages collection), it is immutable. No updates or deletes are permitted.
- **Subscription Integrity:** The `isSubscribed` status and `Subscription` details can only be modified by the backend payment processor.

## 2. The "Dirty Dozen" Payloads (Expected DENIED)

### P1: Role Escalation
```json
// Path: /users/victim-uid
{ "role": "admin" }
```

### P2: Sector Breach (Read)
```json
// Path: /conversations/stranger-conversation-id
// ACTION: get/list
```

### P3: Message Hijack
```json
// Path: /conversations/stranger-msg-id/messages/new-msg
{ "text": "Hacked", "userId": "attacker-uid" }
```

### P4: Intelligence Counterfeit
```json
// Path: /intelligence/fake-intel
{ "source": "attacker", "content": "Fake News", "timestamp": "2026-04-20T00:00:00Z" }
```

### P5: ID Poisoning (Resource Exhaustion)
```json
// Path: /conversations/LONG_STRING_128KB_ID
{ "title": "Attack" }
```

### P6: PII Leak (Unverified Email)
```json
// Path: /users/unverified-witness-uid
// ACTION: get (where email_verified is false)
```

### P7: Subscription Tampering
```json
// Path: /users/my-uid
{ "isSubscribed": true }
```

### P8: Chain Corruption (Update Hash)
```json
// Path: /conversations/my-convo/messages/msg-id
{ "hash": "new-fake-hash" }
```

### P9: Status Leapfrogging
```json
// Path: /responses/resp-id
{ "status": "posted" } // Bypassing agent posting logic
```

### P10: Orphaned Message Creation
```json
// Path: /conversations/NON_EXISTENT_CONVO/messages/msg-id
{ "text": "Void Message", "userId": "my-uid" }
```

### P11: Blanket Query Scraping
```json
// Collection: conversations
// ACTION: list (without where userId == auth.uid)
```

### P12: Timestamp Spoofing
```json
// Path: /conversations/my-convo/messages/msg-id
{ "createdAt": "2020-01-01T00:00:00Z" } // Ancient timestamp
```
