const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// MongoDB Atlas Connection
const mongoURI = 'mongodb+srv://somnathc276:gbBlxlRbP21DbWzB@cluster0.cnzkv.mongodb.net/hotel-booking?retryWrites=true&w=majority';
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  isAdmin: { type: Boolean, default: false },
});
const User = mongoose.model('User', UserSchema);

// Booking Schema
const BookingSchema = new mongoose.Schema({
  userId: String,
  roomId: String,
  checkIn: Date,
  checkOut: Date,
  price: Number,
});
const Booking = mongoose.model('Booking', BookingSchema);

// Room Schema
const RoomSchema = new mongoose.Schema({
  roomId: String,
  basePrice: Number,
  bookings: Number,
});
const Room = mongoose.model('Room', RoomSchema);

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, 'secret', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Segment Tree for Dynamic Pricing
class SegmentTree {
  constructor(size) {
    this.tree = new Array(4 * size).fill(0);
    this.size = size;
  }
  update(index, value, node = 0, start = 0, end = this.size - 1) {
    if (start === end) {
      this.tree[node] += value;
      return;
    }
    const mid = Math.floor((start + end) / 2);
    if (index <= mid) this.update(index, value, 2 * node + 1, start, mid);
    else this.update(index, value, 2 * node + 2, mid + 1, end);
    this.tree[node] = this.tree[2 * node + 1] + this.tree[2 * node + 2];
  }
  query(left, right, node = 0, start = 0, end = this.size - 1) {
    if (left > end || right < start) return 0;
    if (left <= start && right >= end) return this.tree[node];
    const mid = Math.floor((start + end) / 2);
    return this.query(left, right, 2 * node + 1, start, mid) + this.query(left, right, 2 * node + 2, mid + 1, end);
  }
}

const demandTree = new SegmentTree(100);

// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, 'secret', { expiresIn: '1h' });
  res.json({ token });
});

// Register Route
app.post('/register', async (req, res) => {
  const { username, password, isAdmin } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword, isAdmin });
  await user.save();
  res.status(201).json({ message: 'User registered' });
});

// Book Room Route
app.post('/book', authenticateToken, async (req, res) => {
  const { roomId, checkIn, checkOut } = req.body;
  const room = await Room.findOne({ roomId });
  if (!room) return res.status(404).json({ message: 'Room not found' });

  demandTree.update(parseInt(roomId), 1);
  const demand = demandTree.query(0, 99);
  const dynamicPrice = room.basePrice * (1 + demand * 0.1);

  const booking = new Booking({
    userId: req.user.id,
    roomId,
    checkIn,
    checkOut,
    price: dynamicPrice,
  });
  await booking.save();
  room.bookings += 1;
  await room.save();
  res.json({ message: 'Booking successful', price: dynamicPrice });
});

// Admin: Get All Bookings
app.get('/admin/bookings', authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  const bookings = await Booking.find();
  res.json(bookings);
});

// Admin: Delete Booking
app.delete('/admin/bookings/:id', authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  demandTree.update(parseInt(booking.roomId), -1);
  await Booking.deleteOne({ _id: req.params.id });
  res.json({ message: 'Booking deleted' });
});

// Initialize Rooms
app.post('/setup-rooms', async (req, res) => {
  const rooms = [{ roomId: '1', basePrice: 100, bookings: 0 }, { roomId: '2', basePrice: 120, bookings: 0 }];
  await Room.insertMany(rooms);
  res.json({ message: 'Rooms initialized' });
});

app.listen(3000, () => console.log('Server running on port 3000'));