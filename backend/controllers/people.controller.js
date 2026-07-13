const { sql, getPool } = require('../config/db');

// Reuse the same error-normalizing helper style as splitMoney.controller.js.
// If you'd rather share one copy, move this into a small utils file and
// require it from both controllers instead of duplicating it.
function describeError(err) {
  if (!err) return 'Unknown error';
  if (Array.isArray(err)) return err.map(describeError).join('; ');

  const parts = [];

  if (typeof err.message === 'string' && err.message) parts.push(err.message);
  if (err.code) parts.push(`code: ${err.code}`);
  if (err.number) parts.push(`number: ${err.number}`);
  if (err.state) parts.push(`state: ${err.state}`);

  if (err.originalError) {
    const orig = err.originalError;
    if (typeof orig.message === 'string' && orig.message) {
      parts.push(`original: ${orig.message}`);
    } else if (orig.info && typeof orig.info.message === 'string') {
      parts.push(`original: ${orig.info.message}`);
    }
  }

  if (Array.isArray(err.precedingErrors) && err.precedingErrors.length) {
    parts.push(describeError(err.precedingErrors));
  }

  if (parts.length) return parts.join(' | ');

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

// SQL Server error 2601/2627 = unique index/constraint violation
function isUniqueViolation(err) {
  return err && (err.number === 2601 || err.number === 2627);
}

// Get all people, alphabetically
async function getAllPeople(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT id, name
      FROM People
      ORDER BY Name ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching people', error: describeError(err) });
  }
}

// Add a new person
async function addPerson(req, res) {
  try {
    const name = (req.body.name || '').trim();

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .query(`
        INSERT INTO People (Name, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.Name
        VALUES (@name, GETDATE())
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ message: `'${req.body.name}' is already in your people list` });
    }
    console.error(err);
    res.status(500).json({ message: 'Error adding person', error: describeError(err) });
  }
}

// Rename an existing person
async function updatePerson(req, res) {
  try {
    const { id } = req.params;
    const name = (req.body.name || '').trim();

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .query(`
        UPDATE People SET Name = @name WHERE Id = @id;
        SELECT Id, Name FROM People WHERE Id = @id;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Person not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ message: `'${req.body.name}' is already in your people list` });
    }
    console.error(err);
    res.status(500).json({ message: 'Error updating person', error: describeError(err) });
  }
}

// Delete a person (their past SplitParticipants rows keep their Name; PersonId just goes null)
async function deletePerson(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM People WHERE Id = @id');

    res.json({ message: 'Person deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting person', error: describeError(err) });
  }
}

module.exports = {
  getAllPeople,
  addPerson,
  updatePerson,
  deletePerson
};