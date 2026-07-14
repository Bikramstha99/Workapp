const db = require('../config/db');

// PostgreSQL unique-violation error code
function isUniqueViolation(err) {
  return err && err.code === '23505';
}

// Get all people, alphabetically. Returns { id, name } (lowercase) to match Angular model.
async function getAllPeople(req, res) {
  try {
    const result = await db.query('SELECT id, name FROM people ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching people', error: err.message });
  }
}

// Add a new person
async function addPerson(req, res) {
  try {
    const name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const result = await db.query(
      'INSERT INTO people (name) VALUES ($1) RETURNING id, name',
      [name]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ message: `'${req.body.name}' is already in your people list` });
    }
    console.error(err);
    res.status(500).json({ message: 'Error adding person', error: err.message });
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

    const result = await db.query(
      'UPDATE people SET name = $1 WHERE id = $2 RETURNING id, name',
      [name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Person not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ message: `'${req.body.name}' is already in your people list` });
    }
    console.error(err);
    res.status(500).json({ message: 'Error updating person', error: err.message });
  }
}

// Delete a person
async function deletePerson(req, res) {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM people WHERE id = $1', [id]);
    res.json({ message: 'Person deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting person', error: err.message });
  }
}

module.exports = { getAllPeople, addPerson, updatePerson, deletePerson };
