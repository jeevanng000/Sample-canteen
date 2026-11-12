# Security Specification: Annapoorna Campus Canteen (`security_spec.md`)

## 1. Data Invariants

1. **Identity & Role Escalation Prevention (`/users/{userId}`)**:
   - Every newly registered user profile must have `uid == request.auth.uid` and `role == 'customer'` (unless the user is the bootstrapped admin email `jeevankingdimpu@gmail.com`).
   - Users can read only their own profile (`request.auth.uid == userId`), while admins can read/list all profiles to manage roles by email.
   - Non-admin users can NEVER modify their `role`, `uid`, or `email` fields during profile updates. Only admins can update a user's `role` to `'kitchen'` or `'admin'`.

2. **Menu & Settings Integrity (`/menu/{itemId}`, `/settings/{settingId}`)**:
   - All authenticated users can read menu items and canteen settings.
   - Only admins can create, update, or delete menu items and canteen settings.
   - Every string field enforces strict `.size()` boundaries and every numeric field (`price`, `prepTimeMinutes`, `ordersPerSlot`) enforces positive range bounds.

3. **Transactional Slot & Token Counters (`/slots/{slotId}`, `/counters/{dateStr}`)**:
   - Authenticated users can read slot capacity and update slot booking counts within `[0, capacity]` and daily token counters (`lastToken >= 100`).

4. **Order Lifecycle & Terminal State Locking (`/orders/{orderId}`)**:
   - Orders created by a customer must have `userId == request.auth.uid` and initial `status == 'placed'`.
   - Customers can only read/list their own orders (`resource.data.userId == request.auth.uid`), while kitchen staff and admins can read/list orders for fulfillment and analytics.
   - Customers can only cancel their own order while `resource.data.status == 'placed'`.
   - Terminal statuses (`collected`, `cancelled`, `rejected`, `no_show`) are locked against non-admin status mutations.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Self-Promoted Admin at Signup**:
   `POST /users/uid_student` -> `{ uid: "uid_student", email: "s@iit.ac.in", fullName: "Bob", studentStaffId: "CS01", role: "admin" }` -> **DENIED**
2. **Role Escalation via Profile Update**:
   `PATCH /users/uid_student` -> `{ role: "admin" }` by `uid_student` -> **DENIED**
3. **Cross-User PII Profile Read**:
   `GET /users/uid_other` by `uid_student` -> **DENIED**
4. **Shadow Ghost Field Injection on Profile**:
   `POST /users/uid_student` -> `{ ..., isSuperAdmin: true }` -> **DENIED** (`hasOnly` check)
5. **Unauthorized Menu Price Tampering by Customer**:
   `PATCH /menu/masala_dosa` -> `{ price: 1 }` by `uid_student` -> **DENIED**
6. **Unauthorized Canteen Open/Close Toggle by Kitchen**:
   `PATCH /settings/global` -> `{ isOpen: false }` by `uid_kitchen` -> **DENIED**
7. **Spoofed Order Creation for Another User**:
   `POST /orders/ord_1` -> `{ userId: "uid_victim", status: "placed", ... }` by `uid_attacker` -> **DENIED**
8. **Customer Cancelling Order Already in `preparing` State**:
   `PATCH /orders/ord_1` (where `existing.status == 'preparing'`) -> `{ status: "cancelled" }` by `uid_customer` -> **DENIED**
9. **Customer Modifying Order `totalAmount` During Cancellation**:
   `PATCH /orders/ord_1` -> `{ status: "cancelled", totalAmount: 0 }` by `uid_customer` -> **DENIED** (`affectedKeys().hasOnly`)
10. **Terminal State Mutation (`collected` -> `placed`) by Kitchen**:
    `PATCH /orders/ord_1` (where `existing.status == 'collected'`) -> `{ status: "placed" }` -> **DENIED**
11. **Slot Overbooking Beyond Capacity**:
    `PATCH /slots/2026-10-23_12:10` -> `{ bookedCount: 99, capacity: 4 }` -> **DENIED**
12. **Resource Exhaustion / 1MB ID Poisoning**:
    `POST /orders/<200-char-junk-id>` -> **DENIED** (`isValidId` check)
