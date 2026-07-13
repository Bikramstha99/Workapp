const express = require('express');
const router = express.Router();
const controller = require('../controllers/splitMoney.controller');

router.post('/', controller.createSplit);
router.get('/', controller.getAllSplits);
router.get('/:id', controller.getSplitById);
router.put('/:id/participants/:participantId', controller.updateParticipantPaidStatus);
router.delete('/:id', controller.deleteSplit);

module.exports = router;
