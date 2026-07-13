const express = require('express');
const router = express.Router();
const {
  getAllPeople,
  addPerson,
  updatePerson,
  deletePerson
} = require('../controllers/people.controller');

router.get('/', getAllPeople);
router.post('/', addPerson);
router.put('/:id', updatePerson);
router.delete('/:id', deletePerson);

module.exports = router;

// In server.js, mount this alongside your existing routes, e.g.:
//   const peopleRoutes = require('./routes/people.routes');
//   app.use('/api/people', peopleRoutes);