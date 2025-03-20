const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const serverless = require('serverless-http');

const app = express();
app.use(express.json());

// MongoDB Atlas Connection
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://somnathc276:IKGtam4Jlcaw7HPA@cluster0.cnzkv.mongodb.net/Hotel-booking?retryWrites=true&w=majority';
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const UserSchema = new mongoose.Schema({ username: String, password: String, isAdmin: { type: Boolean, default: false } });
const BookingSchema = new mongoose.Schema({ userId: String, roomId: String, checkIn: Date, checkOut: Date, price: Number });
const RoomSchema = new mongoose.Schema({ roomId: String, basePrice: Number, bookings: Number });
const DemandSchema = new mongoose.Schema({ roomId: String, demand: { type: Number, default: 0 } });

const User = mongoose.model('User', UserSchema);
const Booking = mongoose.model('Booking', BookingSchema);
const Room = mongoose.model('Room', RoomSchema);
const Demand = mongoose.model('Demand', DemandSchema);

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Dynamic Pricing with MongoDB (replacing SegmentTree)
const updateDemand = async (roomId, value) => {
  await Demand.findOneAndUpdate(
    { roomId },
    { $inc: { demand: value } },
    { upsert: true }
  );
};

const getTotalDemand = async () => {
  const demands = await Demand.find();
  return demands.reduce((sum, d) => sum + d.demand, 0);
};

// Routes
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/register', async (req, res) => {
  try {
    const { username, password, isAdmin } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword, isAdmin });
    await user.save();
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/book', authenticateToken, async (req, res) => {
  try {
    const { roomId, checkIn, checkOut } = req.body;
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    await updateDemand(roomId, 1);
    const demand = await getTotalDemand();
    const dynamicPrice = room.basePrice * (1 + demand * 0.1);

    const booking = new Booking({ userId: req.user.id, roomId, checkIn, checkOut, price: dynamicPrice });
    await booking.save();
    room.bookings += 1;
    await room.save();
    res.json({ message: 'Booking successful', price: dynamicPrice });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/admin/bookings', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.delete('/admin/bookings/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    await updateDemand(booking.roomId, -1);
    await Booking.deleteOne({ _id: req.params.id });
    res.json({ message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/setup-rooms', async (req, res) => {
  try {
    const rooms = [{ roomId: '1', basePrice: 100, bookings: 0 }, { roomId: '2', basePrice: 120, bookings: 0 }];
    await Room.insertMany(rooms);
    res.json({ message: 'Rooms initialized' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// Export for Vercel, but allow local testing
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

module.exports = serverless(app);