const { sql, getPool } = require('../config/db');

// msnodesqlv8 (Windows Auth) sometimes throws non-standard error shapes
// (arrays of errors, or objects without a .message). This normalizes them
// into a readable string so we never show "[object Object]" again.
function describeError(err) {
  if (!err) return 'Unknown error';
  if (Array.isArray(err)) return err.map(describeError).join('; ');

  const parts = [];

  if (typeof err.message === 'string' && err.message) parts.push(err.message);
  if (err.code) parts.push(`code: ${err.code}`);
  if (err.number) parts.push(`number: ${err.number}`);
  if (err.state) parts.push(`state: ${err.state}`);

  // mssql wraps driver-level errors here
  if (err.originalError) {
    const orig = err.originalError;
    if (typeof orig.message === 'string' && orig.message) {
      parts.push(`original: ${orig.message}`);
    } else if (orig.info && typeof orig.info.message === 'string') {
      parts.push(`original: ${orig.info.message}`);
    }
  }

  // msnodesqlv8 sometimes gives arrays of errors here
  if (Array.isArray(err.precedingErrors) && err.precedingErrors.length) {
    parts.push(describeError(err.precedingErrors));
  }

  if (parts.length) return parts.join(' | ');

  // Last resort: safe circular-aware stringify instead of String(err)
  try {
    const seen = new WeakSet();
    return JSON.stringify(err, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    });
  } catch {
    return 'Unknown error (unserializable)';
  }
}

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

// Create a new split from a saved People list — pass personIds, not raw names/counts.
// Also accepts `payers`: [{ personId, amount }, ...] describing who actually paid.
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

    // Sanity check: payers should add up to the total (allow a cent of rounding slack)
    const totalPaid = payerList.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalPaid - totalAmount) > 0.01) {
      return res.status(400).json({
        message: `Payer amounts (${totalPaid.toFixed(2)}) do not add up to the total (${totalAmount.toFixed(2)})`
      });
    }

    const pool = await getPool();

    // Look up the selected people so we can (a) validate they all exist and
    // (b) snapshot their current names onto the split, mssql-parameterized
    // via a table-valued-ish IN clause built from individual @id0, @id1... params.
    const lookupRequest = pool.request();
    const inClauseParams = ids.map((id, i) => {
      lookupRequest.input(`id${i}`, sql.Int, id);
      return `@id${i}`;
    });

    const peopleResult = await lookupRequest.query(`
      SELECT Id, Name FROM People WHERE Id IN (${inClauseParams.join(', ')})
    `);

    if (peopleResult.recordset.length !== ids.length) {
      return res.status(400).json({ message: 'One or more selected people could not be found' });
    }

    // Validate that every payer is also a known person
    const payerLookupRequest = pool.request();
    const payerIds = [...new Set(payerList.map((p) => p.personId))];
    const payerInClauseParams = payerIds.map((id, i) => {
      payerLookupRequest.input(`pid${i}`, sql.Int, id);
      return `@pid${i}`;
    });
    const payerPeopleResult = await payerLookupRequest.query(`
      SELECT Id FROM People WHERE Id IN (${payerInClauseParams.join(', ')})
    `);
    if (payerPeopleResult.recordset.length !== payerIds.length) {
      return res.status(400).json({ message: 'One or more payers could not be found' });
    }

    // Split evenly, distributing any rounding remainder across the first
    // few participants so amounts always add up exactly to totalAmount.
    const count = peopleResult.recordset.length;
    const baseShare = Math.floor((totalAmount / count) * 100) / 100;
    let remainderCents = Math.round((totalAmount - baseShare * count) * 100);

    const groupResult = await pool.request()
      .input('title', sql.NVarChar, title || 'Untitled Split')
      .input('totalAmount', sql.Decimal(10, 2), totalAmount)
      .input('numberOfPeople', sql.Int, count)
      .query(`
        INSERT INTO SplitGroups (Title, TotalAmount, NumberOfPeople, CreatedAt)
        OUTPUT INSERTED.Id
        VALUES (@title, @totalAmount, @numberOfPeople, GETDATE())
      `);

    const groupId = groupResult.recordset[0].Id;

    for (const person of peopleResult.recordset) {
      let share = baseShare;
      if (remainderCents > 0) {
        share += 0.01;
        remainderCents -= 1;
      }

      await pool.request()
        .input('groupId', sql.Int, groupId)
        .input('personId', sql.Int, person.Id)
        .input('name', sql.NVarChar, person.Name)
        .input('amountOwed', sql.Decimal(10, 2), share)
        .query(`
          INSERT INTO SplitParticipants (SplitGroupId, PersonId, Name, AmountOwed, Paid)
          VALUES (@groupId, @personId, @name, @amountOwed, 0)
        `);
    }

    // Persist who actually paid, and how much, so totals can be computed later.
    for (const payer of payerList) {
      await pool.request()
        .input('groupId', sql.Int, groupId)
        .input('personId', sql.Int, payer.personId)
        .input('amount', sql.Decimal(10, 2), payer.amount)
        .query(`
          INSERT INTO SplitPayers (SplitGroupId, PersonId, Amount)
          VALUES (@groupId, @personId, @amount)
        `);
    }

    res.status(201).json({ id: groupId, amountPerPerson: baseShare });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating split', error: describeError(err) });
  }
}

// Get all split groups (summary list), including their participants and payers
// so the frontend can render per-split breakdowns and compute overall totals.
async function getAllSplits(req, res) {
  try {
    const pool = await getPool();

    const groupsResult = await pool.request().query(`
      SELECT Id, Title, TotalAmount, NumberOfPeople, CreatedAt
      FROM SplitGroups
      ORDER BY CreatedAt DESC
    `);

    const groups = groupsResult.recordset;

    if (groups.length === 0) {
      return res.json([]);
    }

    const participantsResult = await pool.request().query(`
      SELECT * FROM SplitParticipants
    `);
    const payersResult = await pool.request().query(`
      SELECT * FROM SplitPayers
    `);

    const participantsByGroup = groupBy(participantsResult.recordset, 'SplitGroupId');
    const payersByGroup = groupBy(payersResult.recordset, 'SplitGroupId');

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
    res.status(500).json({ message: 'Error fetching splits', error: describeError(err) });
  }
}

// Get one split group with its participants and payers
async function getSplitById(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const group = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM SplitGroups WHERE Id = @id');

    if (group.recordset.length === 0) {
      return res.status(404).json({ message: 'Split not found' });
    }

    const participants = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM SplitParticipants WHERE SplitGroupId = @id');

    const payers = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM SplitPayers WHERE SplitGroupId = @id');

    res.json({
      ...group.recordset[0],
      participants: participants.recordset,
      payers: payers.recordset.map((p) => ({
        personId: p.PersonId,
        amount: p.Amount
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching split', error: describeError(err) });
  }
}

// Toggle a participant's paid status
async function updateParticipantPaidStatus(req, res) {
  try {
    const { participantId } = req.params;
    const { paid } = req.body;
    const pool = await getPool();

    await pool.request()
      .input('id', sql.Int, participantId)
      .input('paid', sql.Bit, paid ? 1 : 0)
      .query('UPDATE SplitParticipants SET Paid = @paid WHERE Id = @id');

    res.json({ message: 'Participant updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating participant', error: describeError(err) });
  }
}

// Delete a split group (and its participants and payers)
async function deleteSplit(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();

    await pool.request().input('id', sql.Int, id).query('DELETE FROM SplitParticipants WHERE SplitGroupId = @id');
    await pool.request().input('id', sql.Int, id).query('DELETE FROM SplitPayers WHERE SplitGroupId = @id');
    await pool.request().input('id', sql.Int, id).query('DELETE FROM SplitGroups WHERE Id = @id');

    res.json({ message: 'Split deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting split', error: describeError(err) });
  }
}

module.exports = {
  createSplit,
  getAllSplits,
  getSplitById,
  updateParticipantPaidStatus,
  deleteSplit
};