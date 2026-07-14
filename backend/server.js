const express = require('express');
const cors = require('cors');
require('dotenv').config();

const splitMoneyRoutes = require('./routes/splitMoney.routes');
const workScheduleRoutes = require('./routes/workSchedule.routes');
const peopleRoutes = require('./routes/people.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/split-money', splitMoneyRoutes);
app.use('/api/work-schedule', workScheduleRoutes);
app.use('/api/people', peopleRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
