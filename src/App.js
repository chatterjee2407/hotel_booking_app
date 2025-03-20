import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState('');

  const login = async () => {
    const res = await axios.post('http://localhost:3000/login', { username, password });
    setToken(res.data.token);
    setMessage('Logged in successfully');
  };

  const bookRoom = async () => {
    const res = await axios.post('http://localhost:3000/book', { roomId, checkIn, checkOut }, {
      headers: { Authorization: token },
    });
    setMessage(`Booking successful! Price: $${res.data.price}`);
  };

  const fetchBookings = async () => {
    const res = await axios.get('http://localhost:3000/admin/bookings', {
      headers: { Authorization: token },
    });
    setBookings(res.data);
  };

  const deleteBooking = async (id) => {
    await axios.delete(`http://localhost:3000/admin/bookings/${id}`, {
      headers: { Authorization: token },
    });
    setMessage('Booking deleted');
    fetchBookings();
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Hotel Booking System</h1>
      
      {/* Login */}
      <div>
        <h2>Login</h2>
        <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={login}>Login</button>
      </div>

      {/* Booking */}
      {token && (
        <div>
          <h2>Book a Room</h2>
          <input placeholder="Room ID (e.g., 1)" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          <button onClick={bookRoom}>Book</button>
        </div>
      )}

      {/* Admin Panel */}
      {token && (
        <div>
          <h2>Admin Panel</h2>
          <button onClick={fetchBookings}>View Bookings</button>
          <ul>
            {bookings.map((booking) => (
              <li key={booking._id}>
                Room {booking.roomId} - ${booking.price} 
                <button onClick={() => deleteBooking(booking._id)}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p>{message}</p>
    </div>
  );
}

export default App;