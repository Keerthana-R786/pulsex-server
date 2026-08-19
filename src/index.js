const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/v1/referrals', require('./routes/referrals'));
app.use('/api/v1/eligibility', require('./routes/eligibility'));
app.use('/api/v1/notifications', require('./routes/notifications'));
app.use('/api/v1/authorization', require('./routes/authorization'));
app.use('/api/v1/scheduling', require('./routes/scheduling'));
app.use('/api/v1/specialist', require('./routes/specialist'));
app.use('/api/v1/audit', require('./routes/audit'));
app.use('/api/v1/escalation', require('./routes/escalation'));
app.use('/api/v1/resolution', require('./routes/resolution'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`PulseX server running on port ${PORT}`));
