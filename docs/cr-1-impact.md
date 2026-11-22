# Change Request CR-1: Duplicate Ticket Merge Impact Assessment

**Document Identifier:** `DESKOPS-CR1-v1.0`  
**Milestone:** M1.4 (Client Change Request CR-1)  
**Deliverable Mapping:** Deliverable **D-1.7** & **AC-1.4**  
**Author:** Md. Shihab Shahriar (Developer A / Lead Architect)

---

## 1. Executive Summary & Business Context

During Milestone M1.4, Greenfield Facilities issued Change Request **CR-1** requesting the capability for property managers to merge duplicate maintenance requests:
> *"Residents frequently report the same water leak, power outage, or broken elevator multiple times. Managers need the ability to combine these duplicate reports into one primary ticket while preserving all resident comments and audit history."*

---

## 2. Technical Impact Analysis

### 2.1 Database Schema Impact
- **Impact Level:** **Zero Breaking Changes**.
- **Assessment:** The baseline schema already provisioned `TICKET_MERGED` within the `TicketEventType` enum. No table structure migrations or column drops were required.
- **Data Integrity:** Relation transfer (comments and watchers) is executed inside a strict `prisma.$transaction`.

### 2.2 API Contract & Routing
- Added endpoint: `POST /api/v1/tickets/:id/merge`
- **Role Guard:** Restricted exclusively to `ORGANISATION_ADMIN`.
- **Payload:**
  ```json
  {
    "duplicateTicketId": "uuid",
    "reason": "Duplicate resident report of hallway leak"
  }
  ```

### 2.3 State Machine & Lifecycle Behavior
- The duplicate ticket is transitioned atomically to `CLOSED` (`closedAt = now()`).
- Comments on the duplicate ticket have their foreign key `ticketId` updated to the primary ticket.
- Watchers on the duplicate ticket are merged into the primary ticket (preventing composite key duplicates).
- Immutable `TicketEvent` entries with `eventType = 'TICKET_MERGED'` are created on **both** primary and duplicate tickets, referencing the counterpart ticket numbers.

### 2.4 Test Verification
- Covered under automated Vitest suite: [`server/tests/ticketMerge.test.ts`](file:///run/media/aevum7/Lab/Dev-Stack/Logic%20Veda/deskops/server/tests/ticketMerge.test.ts).
- Fulfills Acceptance Criteria **AC-1.4**.
