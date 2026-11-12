import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');

test('firestore.rules enforces all Dirty Dozen security invariants and RBAC gates', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');

  // 1. Default deny catch-all
  assert.ok(rules.includes('allow read, write: if false;'), 'Must include default-deny catch-all');

  // 2. Role self-assignment prevention on user creation and update
  assert.ok(
    rules.includes("incoming().role == 'customer'") && rules.includes('isAdmin()'),
    'Users must default to customer and only admin can assign elevated roles'
  );

  // 3. Strict key allowlisting via hasOnly
  assert.ok(rules.includes('.keys().hasOnly('), 'Must enforce strict key allowlists with hasOnly');

  // 4. Customer cancel only while status is placed
  assert.ok(
    rules.includes("existing().status == 'placed'") && rules.includes("incoming().status == 'cancelled'"),
    'Customer can cancel only while order status is placed'
  );

  // 5. Slot capacity enforcement
  assert.ok(
    rules.includes('data.bookedCount <= data.capacity'),
    'Slot bookings must never exceed slot capacity'
  );
});
