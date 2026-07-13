const { sql, getPool } = require('../config/db');

// Clock in — creates a new work schedule record for today
async function clockIn(req, res) {
  try {
    const { employeeName, notes, workDate } = req.body;
    if (!employeeName) {
      return res.status(400).json({ message: 'employeeName is required' });
    }

    const pool = await getPool();
    const parsedDate = new Date(workDate);
    const result = await pool.request()
      .input('employeeName', sql.NVarChar, employeeName)
      .input('workDate', sql.Date, parsedDate)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        INSERT INTO WorkSchedules (EmployeeName, WorkDate, ClockIn, ClockOut, Notes)
        OUTPUT INSERTED.Id, INSERTED.ClockIn
        VALUES (@employeeName, @workDate, GETDATE(), NULL, @notes)
      `);

        res.status(201).json(result.recordset[0]);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error clocking in', error: err.message });
      }
}

// Clock out — updates the record with the clock out time
async function clockOut(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE WorkSchedules
        SET ClockOut = GETDATE()
        OUTPUT INSERTED.Id, INSERTED.ClockIn, INSERTED.ClockOut
        WHERE Id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error clocking out', error: err.message });
  }
}

// Get all work schedule records (most recent first)
async function getAllSchedules(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM WorkSchedules
      ORDER BY WorkDate DESC, ClockIn DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching schedules', error: err.message });
  }
}

// Get a single record by id
async function getScheduleById(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM WorkSchedules WHERE Id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching schedule', error: err.message });
  }
}

// Update notes / edit a record manually
async function updateSchedule(req, res) {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const pool = await getPool();

    await pool.request()
      .input('id', sql.Int, id)
      .input('notes', sql.NVarChar, notes || null)
      .query('UPDATE WorkSchedules SET Notes = @notes WHERE Id = @id');

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
    const pool = await getPool();
    await pool.request().input('id', sql.Int, id).query('DELETE FROM WorkSchedules WHERE Id = @id');
    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting schedule', error: err.message });
  }
}

module.exports = {
  clockIn,
  clockOut,
  getAllSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule
};
