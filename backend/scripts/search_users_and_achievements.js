const mongoose = require('mongoose');
try {
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.warn(err);
}
const User = require('../models/User');
const Achievement = require('../models/Achievement');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
  
  const searchUsernames = ['itriserty', 'kuzya', 'mag1sterss'];
  for (const username of searchUsernames) {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (user) {
      console.log(`User found: ${user.username} (ID: ${user._id}), Name: ${user.name}, Achievements count: ${user.achievements.length}`);
    } else {
      console.log(`User not found: ${username}`);
    }
  }

  const achievements = await Achievement.find();
  console.log('Achievements in database:');
  for (const a of achievements) {
    console.log(`- Slug: ${a.slug}, Title: ${a.title}, ID: ${a._id}`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
