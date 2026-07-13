const express = require('express');
const router = express.Router();
const controller = require('../controllers/workSchedule.controller');

router.post('/clock-in', controller.clockIn);
router.put('/:id/clock-out', controller.clockOut);
router.get('/', controller.getAllSchedules);
router.get('/:id', controller.getScheduleById);
router.put('/:id', controller.updateSchedule);
router.delete('/:id', controller.deleteSchedule);

module.exports = router;
