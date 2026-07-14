const db = require('../config/db');

// Groups an array of rows by a given key into a Map<key, row[]>
function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const k = row[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}

// Create a new split from a saved People list.
// Body: { title, totalAmount, personIds: number[], payers: [{ personId, amount }] }
async function createSplit(req, res) {
  try {
    const { title, totalAmount, personIds, payers } = req.body;

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ message: 'totalAmount must be greater than zero' });
    }

    const ids = Array.isArray(personIds) ? [...new Set(personIds)] : [];
    if (ids.length === 0) {
      return res.status(400).json({ message: 'Select at least one person to split with' });
    }

    const payerList = Array.isArray(payers)
      ? payers.filter((p) => p && p.personId != null && typeof p.amount === 'number' && p.amount > 0)
      : [];

    if (payerList.length === 0) {
      return res.status(400).json({ message: 'At least one payer with an amount is required' });
    }

    const totalPaid = payerList.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalPaid - totalAmount) > 0.01) {
      return res.status(400).json({
        message: `Payer amounts (${totalPaid.toFixed(2)}) do not add up to the total (${totalAmount.toFixed(2)})`
      });
    }

    // Look up the selected people — validate they exist and snapshot their names
    const peopleResult = await db.query(
      'SELECT id, name FROM people WHERE id = ANY($1::int[])',
      [ids]
    );

    if (peopleResult.rows.length !== ids.length) {
      return res.status(400).json({ message: 'One or more selected people could not be found' });
    }

    // Validate that every payer is a known person
    const payerIds = [...new Set(payerList.map((p) => p.personId))];
    const payerPeopleResult = await db.query(
      'SELECT id FROM people WHERE id = ANY($1::int[])',
      [payerIds]
    );
    if (payerPeopleResult.rows.length !== payerIds.length) {
      return res.status(400).json({ message: 'One or more payers could not be found' });
    }

    // Split evenly, distributing any rounding remainder across the first participants
    const count = peopleResult.rows.length;
    const baseShare = Math.floor((totalAmount / count) * 100) / 100;
    let remainderCents = Math.round((totalAmount - baseShare * count) * 100);

    // Insert the split group
    const groupResult = await db.query(
      `INSERT INTO splitgroups (title, total_amount, number_of_people)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [title || 'Untitled Split', totalAmount, count]
    );
    const groupId = groupResult.rows[0].id;

    // Insert participants
    for (const person of peopleResult.rows) {
      let share = baseShare;
      if (remainderCents > 0) {
        share += 0.01;
        remainderCents -= 1;
      }
      await db.query(
        `INSERT INTO splitparticipants (split_group_id, person_id, name, amount_owed, paid)
         VALUES ($1, $2, $3, $4, false)`,
        [groupId, person.id, person.name, share]
      );
    }

    // Insert payers
    for (const payer of payerList) {
      await db.query(
        `INSERT INTO splitpayers (split_group_id, person_id, amount)
         VALUES ($1, $2, $3)`,
        [groupId, payer.personId, payer.amount]
      );
    }

    res.status(201).json({ id: groupId, amountPerPerson: baseShare });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating split', error: err.message });
  }
}

// Get all split groups with their participants and payers
async function getAllSplits(req, res) {
  try {
    const groupsResult = await db.query(
      `SELECT id AS "Id",
              title AS "Title",
              total_amount AS "TotalAmount",
              number_of_people AS "NumberOfPeople",
              created_at AS "CreatedAt"
       FROM splitgroups
       ORDER BY created_at DESC`
    );

    const groups = groupsResult.rows;
    if (groups.length === 0) return res.json([]);

    const participantsResult = await db.query(
      `SELECT id AS "Id",
              split_group_id AS "SplitGroupId",
              person_id AS "PersonId",
              name AS "Name",
              amount_owed AS "AmountOwed",
              paid AS "Paid"
       FROM splitparticipants`
    );

    const payersResult = await db.query(
      `SELECT split_group_id AS "SplitGroupId",
              person_id AS "PersonId",
              amount AS "Amount"
       FROM splitpayers`
    );

    const participantsByGroup = groupBy(participantsResult.rows, 'SplitGroupId');
    const payersByGroup = groupBy(payersResult.rows, 'SplitGroupId');

    const splits = groups.map((group) => ({
      ...group,
      participants: participantsByGroup.get(group.Id) || [],
      payers: (payersByGroup.get(group.Id) || []).map((p) => ({
        personId: p.PersonId,
        amount: p.Amount
      }))
    }));

    res.json(splits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching splits', error: err.message });
  }
}

// Get one split group with its participants and payers
async function getSplitById(req, res) {
  try {
    const { id } = req.params;

    const groupResult = await db.query(
      `SELECT id AS "Id",
              title AS "Title",
              total_amount AS "TotalAmount",
              number_of_people AS "NumberOfPeople",
              created_at AS "CreatedAt"
       FROM splitgroups WHERE id = $1`,
      [id]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ message: 'Split not found' });
    }

    const participantsResult = await db.query(
      `SELECT id AS "Id",
              split_group_id AS "SplitGroupId",
              person_id AS "PersonId",
              name AS "Name",
              amount_owed AS "AmountOwed",
              paid AS "Paid"
       FROM splitparticipants WHERE split_group_id = $1`,
      [id]
    );

    const payersResult = await db.query(
      `SELECT person_id AS "PersonId", amount AS "Amount"
       FROM splitpayers WHERE split_group_id = $1`,
      [id]
    );

    res.json({
      ...groupResult.rows[0],
      participants: participantsResult.rows,
      payers: payersResult.rows.map((p) => ({
        personId: p.PersonId,
        amount: p.Amount
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching split', error: err.message });
  }
}

// Toggle a participant's paid status
async function updateParticipantPaidStatus(req, res) {
  try {
    const { participantId } = req.params;
    const { paid } = req.body;

    await db.query(
      'UPDATE splitparticipants SET paid = $1 WHERE id = $2',
      [!!paid, participantId]
    );

    res.json({ message: 'Participant updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating participant', error: err.message });
  }
}

// Delete a split group (cascade handles participants and payers via FK)
async function deleteSplit(req, res) {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM splitgroups WHERE id = $1', [id]);
    res.json({ message: 'Split deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting split', error: err.message });
  }
}

module.exports = { createSplit, getAllSplits, getSplitById, updateParticipantPaidStatus, deleteSplit };
