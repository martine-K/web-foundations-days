# TicketHub: Event Ticketing System Design

TicketHub is a website that sells tickets for concerts and events. The hardest part of the design is the **big sale**, when a very popular concert goes on sale and far more people than seats arrive at once. The design follows the six-part framework: requirements, estimates, API, data model, architecture and trade-offs, with a dedicated section on how two people are prevented from buying the same seat.

---

## 1. Requirements

### Functional requirements
- Users can register, log in and log out.
- Users can browse and search events (by name, city, date).
- Users can view an event's details and its seat map with the status of each seat (available, held, sold).
- Users can **hold** one or more seats (up to 6) for a short time, 5 minutes, while they pay.
- Users can pay for held seats and receive an order confirmation and tickets (with a QR code).
- Users can view their orders and tickets.
- Users can release a hold, and holds expire automatically.
- Organisers can create events and set seat prices (out of scope for this document's detail).

### Non-functional requirements
- **Correctness (most important):** a seat is **never sold twice**, a customer is **never charged twice**, and a customer is never charged without getting the seat (or being refunded).
- **Speed:** normal pages respond in under 300 ms for 95% of requests; during a big sale, holding a seat responds in under 1 second.
- **Fairness:** during a big sale, people are served in the order they arrived (first come, first served); one person cannot grab hundreds of seats or use bots to jump the line (a limit of 6 seats per order and rate limits per user).
- **Scalability:** the system must handle a surge of more than 100 times normal traffic without crashing.
- **Availability:** 99.9% uptime overall; no single point of failure on the buying path.
- **Durability:** confirmed orders are never lost (replication and backups).
- **Security:** HTTPS everywhere; passwords hashed; card details handled only by a payment provider (the system never stores card numbers).
- **Consistency:** the seat status in the database is always exact. The seat map shown to browsers may be 1 to 2 seconds old, which is acceptable.

---

## 2. Estimates

### Assumptions
- 2,000,000 registered users
- Normal day: 50,000 visitors, each viewing 10 pages; 5,000 tickets sold
- Big sale: 200,000 people try to buy 20,000 seats in the first 10 minutes
- 86,400 seconds in a day; normal peak = 5x the average
- During the big sale each person makes about **10 requests** (load event page, view seat map several times, try to hold seats, pay)
- An order with its tickets is about 1 KB of data

### Normal day

| Metric | Calculation | Average | Peak (5x) |
|--------|-------------|---------|-----------|
| Page views per second | 50,000 x 10 = 500,000 per day / 86,400 | **about 6/s** | about 29/s |
| Tickets sold per second | 5,000 per day / 86,400 | **about 0.06/s** (1 every 17 s) | about 0.3/s |
| Storage per year | 5,000 orders/day x 365 x 1 KB | **about 2 GB** | n/a |

A normal day is tiny. One small server could handle it.

### Big sale

| Metric | Calculation | Value |
|--------|-------------|-------|
| Arrivals, 10-minute average | 200,000 people / 600 s | **about 333 people/s** |
| Requests, 10-minute average | 333 x 10 | **about 3,300 requests/s** |
| Requests in the first minute (if half arrive in the first 60 s) | 100,000 people / 60 s x 10 | **about 17,000 requests/s** |
| Seats sold per second | 20,000 / 600 s | **about 33 sales/s** |
| Competition | 200,000 people for 20,000 seats | **10 people per seat; 90% will not get one** |

### Comparison

| | Normal | Big sale | Increase |
|---|--------|----------|----------|
| Requests per second | 6 avg, 29 peak | 3,300 avg, 17,000 spike | about **575x** the normal average (about 115x the normal peak); the spike is about **2,900x** the normal average |
| Sales per second | 0.06 | 33 | about **575x** |

**Conclusion:** the big sale is not a "bit more traffic". It is hundreds to thousands of times more, it lasts only minutes, and it is **write-heavy and contended** (thousands of people fighting for the same rows). Designing for the normal day would fail. We cannot afford to run 17,000 requests per second all year, so the design has to **absorb the spike** (waiting room, caching, pre-scaling) instead of just buying more servers.

---

## 3. API

Base URL: `https://api.tickethub.example/v1`. JSON in and out. Bearer token authentication, except for browsing. Errors use standard status codes with a JSON body, for example `409 Conflict` when a seat is already taken.

| # | Method | Path | Description | Success status |
|---|--------|------|-------------|----------------|
| 1 | GET | `/events?city=&date=&q=&page=` | Browse and search events | 200 OK |
| 2 | GET | `/events/{eventId}` | View one event's details | 200 OK |
| 3 | GET | `/events/{eventId}/seats?section=` | View the seat map and each seat's status | 200 OK |
| 4 | POST | `/events/{eventId}/holds` | Hold seats for 5 minutes | 201 Created |
| 5 | DELETE | `/holds/{holdId}` | Release a hold | 204 No Content |
| 6 | POST | `/orders` | Pay for a hold (header `Idempotency-Key` required) | 201 Created |
| 7 | GET | `/orders/{orderId}` | View one order | 200 OK |
| 8 | GET | `/me/tickets` | View my tickets | 200 OK |
| 9 | POST | `/events/{eventId}/waiting-room` | Join the waiting room for a big sale | 202 Accepted |
| 10 | GET | `/waiting-room/{token}` | Check my position; returns an admission pass when it is my turn | 200 OK |

### Examples

**Hold seats:** `POST /events/77/holds`

```json
{ "seatIds": [4501, 4502] }
```

Response `201 Created`:

```json
{
  "holdId": "h_9c31",
  "eventId": 77,
  "seatIds": [4501, 4502],
  "expiresAt": "2026-11-05T18:05:00Z"
}
```

If any seat is no longer available, nothing is held (all or nothing) and the response is `409 Conflict`:

```json
{ "error": { "code": "SEAT_UNAVAILABLE", "message": "Seat 4502 was just taken. Please choose another seat.", "unavailableSeatIds": [4502] } }
```

**Pay:** `POST /orders` with header `Idempotency-Key: 3f9a...`

```json
{ "holdId": "h_9c31", "paymentMethodToken": "tok_visa_123" }
```

Response `201 Created`:

```json
{
  "orderId": 90123,
  "status": "PAID",
  "totalCents": 24000,
  "tickets": [
    { "seatId": 4501, "section": "A", "row": "3", "number": 11 },
    { "seatId": 4502, "section": "A", "row": "3", "number": 12 }
  ]
}
```

Other errors: `400` invalid input, `401` not logged in, `403` using someone else's hold or order, `404` unknown event or order, `410 Gone` the hold expired, `402 Payment Required` the payment was declined, `429` too many requests, `500` server error.

Sending the same `Idempotency-Key` twice returns the first result instead of charging again, so a double click or a network retry never creates two orders.

---

## 4. Data model

### Tables

**users**: `id` PK, `email` UNIQUE, `password_hash`, `name`, `created_at`

**events**: `id` PK, `name`, `venue`, `city`, `starts_at`, `on_sale_at`, `status` (`DRAFT`, `ON_SALE`, `SOLD_OUT`, `ENDED`)

**seats**: `id` PK, `event_id` FK to events, `section`, `row_label`, `seat_number`, `price_cents`, `status` (`AVAILABLE`, `HELD`, `SOLD`), `hold_id` FK to holds (nullable), `UNIQUE (event_id, section, row_label, seat_number)`

**holds**: `id` PK, `user_id` FK to users, `event_id` FK to events, `status` (`ACTIVE`, `CONVERTED`, `RELEASED`, `EXPIRED`), `expires_at`, `created_at`

**orders**: `id` PK, `user_id` FK to users, `hold_id` FK to holds, `total_cents`, `status` (`PAID`, `FAILED`, `REFUNDED`), `idempotency_key` UNIQUE, `payment_ref`, `created_at`

**order_items** (the tickets): `id` PK, `order_id` FK to orders, `seat_id` FK to seats, **`UNIQUE (seat_id)`**, `price_cents`, `qr_code`

### Relationships

```
users  1 ───< holds       (one user makes many holds)
users  1 ───< orders      (one user places many orders)
events 1 ───< seats       (one event has thousands of seats; each seat belongs to one event)
events 1 ───< holds
holds  1 ───< seats       (a hold covers 1 to 6 seats; a seat is in at most one hold at a time)
holds  1 ─── 1 orders     (a hold becomes at most one order)
orders 1 ───< order_items (one order has 1 to 6 tickets)
seats  1 ─── 0..1 order_items  (a seat can be sold at most once)
```

### SQL (PostgreSQL)

```sql
CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE events (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    venue      VARCHAR(200) NOT NULL,
    city       VARCHAR(100) NOT NULL,
    starts_at  TIMESTAMPTZ  NOT NULL,
    on_sale_at TIMESTAMPTZ  NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
               CHECK (status IN ('DRAFT','ON_SALE','SOLD_OUT','ENDED'))
);

CREATE TABLE holds (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id),
    event_id   BIGINT      NOT NULL REFERENCES events(id),
    status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
               CHECK (status IN ('ACTIVE','CONVERTED','RELEASED','EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE seats (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id    BIGINT      NOT NULL REFERENCES events(id),
    section     VARCHAR(20) NOT NULL,
    row_label   VARCHAR(10) NOT NULL,
    seat_number INT         NOT NULL,
    price_cents INT         NOT NULL CHECK (price_cents >= 0),
    status      VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
                CHECK (status IN ('AVAILABLE','HELD','SOLD')),
    hold_id     BIGINT      REFERENCES holds(id),
    UNIQUE (event_id, section, row_label, seat_number)
);

CREATE TABLE orders (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users(id),
    hold_id         BIGINT      NOT NULL UNIQUE REFERENCES holds(id),
    total_cents     INT         NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PAID'
                    CHECK (status IN ('PAID','FAILED','REFUNDED')),
    idempotency_key VARCHAR(64) NOT NULL UNIQUE,
    payment_ref     VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id    BIGINT NOT NULL REFERENCES orders(id),
    seat_id     BIGINT NOT NULL UNIQUE REFERENCES seats(id),  -- a seat can be sold only once
    price_cents INT    NOT NULL,
    qr_code     VARCHAR(100) NOT NULL
);

-- Fast seat map for one event and fast sweep of expired holds
CREATE INDEX idx_seats_event_status ON seats (event_id, status);
CREATE INDEX idx_holds_expiry ON holds (expires_at) WHERE status = 'ACTIVE';
```

---

## 5. How the design prevents two people buying the same seat

The goal: if two people click the same seat at the same moment, **exactly one wins**. We use four layers, and the last one is a safety net that cannot be bypassed.

### Layer 1: an atomic, conditional update (the main protection)

Holding a seat is a single SQL statement that only succeeds if the seat is still available:

```sql
BEGIN;
UPDATE seats
SET    status = 'HELD', hold_id = :holdId
WHERE  id = ANY(:seatIds)          -- the seats the user chose, locked in ascending id order
  AND  event_id = :eventId
  AND  status = 'AVAILABLE';       -- the condition that matters
-- The app checks the number of rows changed.
-- If it equals the number of seats requested: COMMIT.
-- If it is smaller: some seat was taken, so ROLLBACK and return 409 Conflict.
COMMIT;
```

When two users run this at the same time, the database takes a **row lock** on each seat. The first transaction changes the row to `HELD` and commits. The second one waits for the lock, then re-checks `status = 'AVAILABLE'`, sees `HELD`, and updates **0 rows**, so it is told "seat taken". There is no moment where both succeed, because "check" and "change" happen as one atomic step. We never do "read the seat, then update it in a separate step", which would be a race condition.

### Layer 2: transactions make multi-seat holds all-or-nothing

A hold of 2 to 6 seats runs in one transaction. If any seat fails, everything rolls back, so nobody ends up with half an order. Seats are always locked in ascending id order, so two people choosing overlapping seats cannot deadlock each other.

### Layer 3: time-limited holds

A hold lasts 5 minutes (`holds.expires_at`). A background worker runs every few seconds and releases expired holds (`seats.status` back to `AVAILABLE`, hold marked `EXPIRED`). This stops abandoned carts from blocking seats forever, and it stops a held seat from being sold to someone else while its owner is still paying.

### Layer 4: a database constraint as the last line of defence

`order_items.seat_id` is `UNIQUE`. Even if there were a bug in the application code, the database would reject a second ticket for the same seat (`unique violation`) and the whole transaction would roll back. The rule "a seat is sold once" is enforced by the database itself, not just by our code.

### Paying safely

1. `POST /orders` with an `Idempotency-Key`. The server extends the hold by 3 minutes so it cannot expire during payment.
2. The server **authorises** the payment with the payment provider (money is reserved, not yet taken).
3. In **one transaction** it verifies the hold is still `ACTIVE`, belongs to this user, and has not expired (`SELECT ... FOR UPDATE`), inserts the order and the order items (the `UNIQUE (seat_id)` constraint applies), sets the seats to `SOLD`, and marks the hold `CONVERTED`.
4. If the transaction succeeds, the server **captures** the payment. If it fails for any reason, the server **voids** the authorisation, so the customer is not charged.
5. The idempotency key (unique on `orders`) means that a retry or double click returns the same order and never charges twice.

### Why the cache cannot cause double-booking

The seat map shown to the browser may come from a cache that is 1 to 2 seconds old, so a user may click a seat that was just taken. That is only a display problem. The **hold request always goes to the primary database**, where Layer 1 decides. The cache is never used to decide who gets a seat.

---

## 6. Architecture

### Diagram

```
                         +------------------------+
                         |  Client (web, mobile)  |
                         +-----------+------------+
                                     |
                                     v
                         +------------------------+
                         |          DNS           |
                         +-----------+------------+
                                     |
                                     v
                         +------------------------+
                         |   CDN  (static files,  |
                         |  event pages, images)  |
                         +-----------+------------+
                                     | API calls
                                     v
                         +------------------------+
                         |  Waiting Room (virtual |  <-- big sale: admits people at a
                         |  queue, admission pass)|      controlled rate, in arrival order
                         +-----------+------------+
                                     | admitted users only
                                     v
                         +------------------------+
                         | Load Balancer + rate   |   (active + standby)
                         | limiting               |
                         +-----+-------------+----+
                               |             |
                +--------------+             +--------------+
                v                                           v
        +---------------+                           +---------------+
        | App Server 1  |   ...  (auto-scaled)  ... | App Server N  |
        +---+-------+---+                           +---+-------+---+
            |       |                                   |       |
   +--------+       +-------------------+---------------+       +--------+
   |                                    |                                |
   v                                    v                                v
+-----------+                  +------------------+              +--------------+
|   Cache   |    cache miss    |   Primary DB     |   enqueue    | Message Queue|
|  (Redis)  | ---------------> | (holds, orders,  | -----------> |              |
| seat map, |                  |  seat updates)   |              +------+-------+
| event info|                  +--------+---------+                     |
+-----------+                           |                               v
                                 replication                    +--------------+
                                        v                       |  Workers     |
                                +------------------+            | (expire holds|
                                |  Read Replicas   |            |  emails,     |
                                | (browse, search, |            |  tickets/QR, |
                                |  my tickets)     |            |  refunds)    |
                                +------------------+            +------+-------+
                                                                       |
         App servers --authorise/capture--> +-----------------+         v
                                            | Payment Provider|  +--------------+
                                            |   (external)    |  | Object       |
                                            +-----------------+  | Storage      |
                                                                 | (ticket PDFs)|
                                                                 +--------------+
```

### Components: one sentence each

- **Client:** the web or mobile app where users browse events, pick seats and pay.
- **DNS:** it turns `tickethub.example` into the address of the CDN and can reroute traffic if a region fails.
- **CDN:** it serves images, scripts and public event pages from servers near the user, so most of the surge for "look at the event page" never reaches our servers.
- **Waiting room (virtual queue):** during a big sale it lets people in a fair, first-come-first-served order at a rate the backend can handle, and shows everyone else their position instead of letting them crash the system.
- **Load balancer with rate limiting:** it spreads requests across app servers, removes unhealthy ones, and blocks bots and users who send too many requests.
- **App servers:** they run the business logic (holds, payments, orders), are stateless, and can be added automatically when load rises.
- **Cache (Redis):** it holds the seat map, event details, the "sold out" flag and waiting-room tokens in memory, so thousands of reads per second never touch the database.
- **Primary database (PostgreSQL):** it is the single source of truth for seats, holds and orders, and its row locks, transactions and unique constraints are what prevent double-booking.
- **Read replicas:** they serve browsing, search and "my tickets" queries, keeping read load away from the primary that handles the seat updates, and they act as standby copies if the primary fails.
- **Message queue:** it stores background jobs so that slow work does not delay the buyer, and it absorbs bursts of jobs.
- **Workers:** they process queued jobs (releasing expired holds, sending confirmation emails, generating tickets, handling refunds) independently of the web servers.
- **Payment provider (external):** it processes card payments so TicketHub never stores card numbers.
- **Object storage:** it stores generated ticket PDFs and images cheaply and durably.

### How it survives the big sale

1. **Pre-scale:** before the on-sale time, app servers, cache and read replicas are scaled up on a schedule (we know the exact time of the sale), instead of waiting for auto-scaling to react.
2. **CDN absorbs the "look" traffic:** event pages, images and scripts come from the CDN, not our servers.
3. **Waiting room flattens the spike:** instead of 17,000 requests per second hitting the app, people queue and are admitted at about 100 people per second. At about 10 requests each, that is roughly 1,000 requests per second reaching the app servers, and only a few hundred writes per second reaching the database, a load one primary handles. It also makes the sale **fair**, because the queue order is the arrival order.
4. **Cache for the seat map:** seat availability is read from Redis with a 1 to 2 second expiry, so the thousands of people watching the seat map do not hit the database.
5. **Only the writes go to the primary:** holds and payments are small, fast, row-level transactions on different seat rows, so they run in parallel. Contention only occurs when two people want the same seat, and then the loser gets a quick `409`.
6. **Sold-out short circuit:** when the last seat is sold, the event is marked `SOLD_OUT` in Redis and everyone still in the queue is told immediately, which removes the remaining load.
7. **Limits and protection:** a limit of 6 seats per hold, rate limits per user and IP, and bot checks at the waiting room protect fairness.
8. **Graceful degradation:** if load is still too high, the waiting room admits fewer people instead of letting the database fail. Slow background work (emails, PDFs) is queued and can run late without affecting purchases.
9. **No single point of failure:** the load balancer is an active and standby pair, the app servers and workers have many copies across availability zones, Redis has a replica, and the primary database has a replica that can be promoted automatically, with regular backups.

### Flow of buying a ticket during a big sale

1. The user opens the event page (served from the CDN) and clicks "Buy" at the on-sale time.
2. The user joins the **waiting room** (`POST /waiting-room`), gets a token and sees a position.
3. When their turn comes, they receive an **admission pass** and are allowed to the app servers.
4. `GET /events/77/seats` returns the seat map from the **cache**.
5. The user picks seats and `POST /events/77/holds` runs the atomic update on the **primary database**. If a seat is taken, they get `409` and pick another.
6. The user pays with `POST /orders`: authorise payment, run the transaction, capture payment (see section 5).
7. The app queues a job; a **worker** creates the tickets and sends the confirmation email.
8. The user sees their tickets in `GET /me/tickets`.

---

## 7. Trade-offs

1. **Waiting room: fairness and stability vs user wait and complexity.** The waiting room protects the system and gives everyone a fair chance, but users must wait, some will leave, and we must build and operate another component. We accept this because without it the site would crash exactly when the most customers are watching.
2. **Strong consistency in one primary database vs unlimited scalability.** Selling seats needs exact, immediate truth, so all seat writes go to a single primary database with transactions and constraints, even though one primary cannot scale writes forever. A NoSQL store with eventual consistency would scale writes more easily but risks double-selling, which is unacceptable. If we grow far beyond one primary, we can shard by `event_id`, because seats of different events never interact.
3. **Cached seat map: speed vs accuracy.** A 1 to 2 second old seat map means some users click a seat that is already gone and get a `409`. We accept this small annoyance because it prevents thousands of reads per second from hitting the database, and the database still has the final say.
4. **Hold length (5 minutes): fairness to buyers vs availability of seats.** A longer hold gives people time to pay but blocks seats from others, and a shorter hold sells seats faster but frustrates slow payers. Five minutes with a limit of 6 seats per hold balances the two, and expired seats return to the pool via the worker (with a delay of a few seconds).
5. **Pre-scaling servers: cost vs risk.** Running extra servers for the sale costs money for a short time, but it avoids the risk of auto-scaling reacting too slowly. Since sale times are known in advance, it is a cheap insurance.
6. **Authorise first, capture later: complexity vs never charging for a seat we cannot give.** Two payment steps are more complex than a single charge, but they mean a failed seat transaction never leaves a customer charged.