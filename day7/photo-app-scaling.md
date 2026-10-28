# SnapShare: Scaling Plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of photos from people they follow.

## 1. Assumptions

- Registered users: 10,000,000
- Active each day: 10%
- Each active user uploads 1 photo per day
- Each active user views 50 feed pages per day
- Average photo: 2 MB; each photo also gets a 50 KB thumbnail
- Traffic is spread evenly over 24 hours for the average (86,400 seconds per day)
- Peak traffic is 5x the average
- Storage uses decimal units (1 TB = 1,000,000 MB)

**Daily active users (DAU)** = 10,000,000 x 10% = **1,000,000**

## 2. Estimates

### Uploads per second

- Uploads per day = 1,000,000 users x 1 photo = 1,000,000
- Average = 1,000,000 / 86,400 = **about 12 uploads/s** (11.6)
- Peak = 11.6 x 5 = **about 58 uploads/s**

### Feed views per second

- Feed views per day = 1,000,000 users x 50 = 50,000,000
- Average = 50,000,000 / 86,400 = **about 579 views/s**
- Peak = 579 x 5 = **about 2,900 views/s** (2,894)

### Photo storage per year

- Per photo: 2 MB original + 0.05 MB thumbnail = 2.05 MB
- Per day: 1,000,000 x 2.05 MB = 2,050,000 MB = 2.05 TB
- Per year: 2.05 TB x 365 = **about 748 TB/year**
  - Originals: 730 TB
  - Thumbnails: 18.25 TB

### Extra: upload bandwidth

- Average: 11.6 x 2 MB = about 23 MB/s
- Peak: 58 x 2 MB = about 116 MB/s

## 3. Read-heavy or write-heavy?

**SnapShare is read-heavy.** There are 50 feed views for every 1 upload, a ratio of about **50:1**, and in reality it is higher because each feed page shows many photos.

What this means for the design:

- Optimise the read path first: cache hot data, serve images from a CDN, and send read queries to replicas.
- Scale reads horizontally (more app servers, more replicas, more cache) rather than scaling writes.
- The write path is small (about 58/s at peak), so one primary database can handle it for a long time.
- Slow write work (making thumbnails) can be done in the background so uploads stay fast.

## 4. Why photos must not be stored in the database

- **Size:** 748 TB per year of binary files would make the database enormous, slow to back up, slow to restore, and expensive to replicate.
- **Performance:** big blobs push useful rows out of memory, so normal queries (feeds, follows, likes) get slower.
- **Cost:** database storage is far more expensive per GB than object storage.
- **Delivery:** a database cannot serve files through a CDN; every image view would hit it.

**Where they go instead:** an **object store** (such as Amazon S3 or equivalent). It is cheap, practically unlimited, durable, and works directly with a CDN. The database stores only the **metadata** (photo id, owner id, object key/URL, thumbnail key, timestamp, caption).

## 5. Architecture diagram

```
                           +----------------+
                           |  Client (app/  |
                           |    browser)    |
                           +--+----------+--+
                              |          ^
         API requests         |          |  images (photos + thumbnails)
                              v          |
                     +----------------+  |
                     | Load Balancer  |  |
                     +-------+--------+  |
                             |           |
              +--------------+------+    |
              v              v      v    |
        +-----------+  +-----------+  ...|
        | App Server|  | App Server|     |
        +-----+-----+  +-----+-----+     |
              |              |           |
   +----------+---+----------+--+        |
   |              |             |        |
   v              v             v        |
+-------+   +-----------+   +--------+   |
| Cache |   | Database  |   | Queue  |   |
|(Redis)|   | (Primary) |   |        |   |
+-------+   +-----+-----+   +---+----+   |
                  |             |        |
          replication           v        |
                  v        +---------+   |
            +-----------+  | Thumb-  |   |
            | Read      |  | nail    |   |
            | Replica   |  | Worker  |   |
            +-----------+  +----+----+   |
                                |        |
                                v        |
                         +--------------+|
   upload (presigned) -->| Object       ||
                         | Storage (S3) ||
                         +------+-------+|
                                |        |
                                v        |
                         +--------------+|
                         |     CDN      +-+
                         +--------------+
                  (CDN pulls from object storage
                   and serves images to users)

Read path:  Client -> LB -> App -> Cache -> (miss) Read Replica;
            image URLs in the response point to the CDN.
Write path: Client -> LB -> App -> Primary DB (metadata)
            and Client -> Object Storage (file), then Queue -> Worker.
```

## 6. Components: one sentence each

- **CDN:** it caches photos and thumbnails at servers close to users, so images load fast and most image traffic never reaches our servers.
- **Load balancer:** it spreads incoming requests across many app servers so no single server is overloaded and one failing server does not take the app down.
- **App servers:** they run the application logic (auth, feed building, upload handling) and are stateless, so we can add more as traffic grows.
- **Cache:** it keeps frequently requested data (feeds, photo metadata, user profiles) in memory so repeated reads avoid slow database queries.
- **Database (primary):** it durably stores structured data such as users, follows, and photo metadata, and handles all writes.
- **Read replica:** it is a copy of the primary that serves read queries, taking load off the primary and giving a standby if it fails.
- **Object storage:** it stores the actual photo and thumbnail files cheaply, durably, and at practically unlimited scale.
- **Queue:** it holds thumbnail jobs so uploads can return immediately and spikes of uploads are smoothed out.
- **Thumbnail worker:** it takes jobs from the queue, creates the 50 KB thumbnail, and saves it to object storage, in the background and independently of the web servers.

## 7. Upload flow, step by step

1. The user picks a photo in the app and taps upload.
2. The request reaches the **load balancer**, which forwards it to an **app server**.
3. The app server authenticates the user, validates the request (file type, size limit), and creates a photo record in the **primary database** with status `processing`.
4. The app server returns a short-lived **pre-signed upload URL** for the object store.
5. The client uploads the 2 MB original **directly to object storage**, so the file never passes through our app servers.
6. The client (or an object-storage event) tells the app server the upload is complete.
7. The app server puts a **thumbnail job** (photo id + object key) on the **queue** and immediately responds "success" to the user.
8. A **thumbnail worker** picks up the job, downloads the original, makes a 50 KB thumbnail, and saves it to object storage.
9. The worker updates the photo record in the database (thumbnail key, status `ready`). If the job fails, it is retried, and after repeated failures goes to a dead-letter queue for investigation.
10. The relevant **cache** entries (for example the followers' feeds) are invalidated or updated.
11. When followers load their feed, the app returns metadata, and the images are fetched from the **CDN**, which pulls them from object storage on the first request and caches them afterwards.

## 8. Trade-offs

1. **Caching: speed vs freshness.** The cache makes feeds fast and protects the database, but cached feeds can be slightly stale (a new photo may appear a few seconds late), and invalidation logic adds complexity. We accept short staleness because feed views outnumber uploads 50:1.
2. **Read replica: scalability vs consistency.** Replication lag means a read from the replica might not yet include a just-written row (a user may not see their own new photo immediately). Mitigation: read the user's own recent data from the primary. We accept eventual consistency for other users' data.
3. **Asynchronous thumbnails: fast uploads vs a delay.** The queue keeps uploads fast and handles spikes, but the thumbnail is not available instantly, so the UI must show a placeholder or the original briefly. It also adds more moving parts (queue, workers, retries, monitoring).
4. **Thumbnails: storage cost vs speed.** Storing a 50 KB thumbnail adds about 18 TB per year, but feeds load roughly 40x less data per image than with originals, which saves far more in bandwidth and gives a faster feed.
5. **CDN: cost and cache staleness vs latency.** A CDN adds a bill and makes deleted or replaced photos linger until the cache expires or is purged, but it removes most image traffic from our system and speeds up delivery worldwide.