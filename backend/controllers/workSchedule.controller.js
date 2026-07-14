const db = require('../config/db');

// Clock in — creates a new work schedule record
async function clockIn(req, res) {
  try {
    const { employeeName, notes, workDate } = req.body;
    if (!employeeName) {
      return res.status(400).json({ message: 'employeeName is required' });
    }

    const result = await db.query(
      `INSERT INTO workschedules (employee_name, work_date, clock_in, clock_out, notes)
       VALUES ($1, $2, NOW(), NULL, $3)
       RETURNING id AS "Id", clock_in AS "ClockIn"`,
      [employeeName, workDate || null, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error clocking in', error: err.message });
  }
}

// Clock out — updates the record with the clock out time
async function clockOut(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE workschedules
       SET clock_out = NOW()
       WHERE id = $1
       RETURNING id AS "Id", clock_in AS "ClockIn", clock_out AS "ClockOut"`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error clocking out', error: err.message });
  }
}

// Get all work schedule records (most recent first)
async function getAllSchedules(req, res) {
  try {
    const result = await db.query(
      `SELECT id AS "Id",
              employee_name AS "EmployeeName",
              work_date AS "WorkDate",
              clock_in AS "ClockIn",
              clock_out AS "ClockOut",
              notes AS "Notes"
       FROM workschedules
       ORDER BY work_date DESC, clock_in DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching schedules', error: err.message });
  }
}

// Get a single record by id
async function getScheduleById(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT id AS "Id",
              employee_name AS "EmployeeName",
              work_date AS "WorkDate",
              clock_in AS "ClockIn",
              clock_out AS "ClockOut",
              notes AS "Notes"
       FROM workschedules
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching schedule', error: err.message });
  }
}

// Update notes on a record
async function updateSchedule(req, res) {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await db.query(
      'UPDATE workschedules SET notes = $1 WHERE id = $2',
      [notes || null, id]
    );

    res.json({ message: 'Schedule updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating schedule', error: err.message });
  }
}

// Delete a record
async function deleteSchedule(req, res) {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM workschedules WHERE id = $1', [id]);
    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting schedule', error: err.message });
  }
}

module.exports = { clockIn, clockOut, getAllSchedules, getScheduleById, updateSchedule, deleteSchedule };
