// scripts.js
const express = require('express');
const cors = require('cors');
const app = express();

// Allow CORS from any origin
app.use(cors());

app.use(express.json());

// Your routes here
app.post('/addBooking', (req, res) => {
  const bookingData = req.body;
  // Logic to add the booking to the database
  res.json('Booking added successfully');
});

app.listen(5000, () => {
  console.log('Server running on port 5000');
});

// Handle "Done" Button Click in QR Modal
(function() {
  const doneButton = document.getElementById('doneButton');
  const qrModal = new bootstrap.Modal(document.getElementById('qrModal'), {
      keyboard: false
  });

  doneButton.addEventListener('click', function() {
      // Hide the QR Modal
      qrModal.hide();

      // Get booking data (dynamically based on selected event)
      const bookingData = {
          email: localStorage.getItem('userEmail'),  // Assuming user's email is stored in localStorage after login
          booking: {
              eventName: 'Music Concert',  // Replace with actual event name
              date: '2023-10-15',  // Replace with actual date
              location: 'City Arena',  // Replace with actual location
              tickets: 2,  // Replace with actual number of tickets
              price: 100,  // Replace with actual price
              status: 'Confirmed'
          }
      };

      // Send booking data to server
      fetch('http://localhost:3000/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData)
      })
      .then(response => response.json())
      .then(data => {
          if (data === 'Booking added successfully') {
              console.log('Booking added:', data);
              // Show success notification
              showToast('🎉 Congratulations! Your booking is confirmed. 🎉');

              // Trigger confetti
              confetti({
                  particleCount: 100,
                  spread: 70,
                  origin: { y: 0.6 }
              });

              // Refresh the booking list
              fetchBookingList();
          }
      })
      .catch(error => console.error('Error:', error));
  });
})();

// Function to fetch and display the booking list
function fetchBookingList() {
  const email = localStorage.getItem('userEmail');

  fetch(`/getBookings/${email}`)
      .then(response => response.json())
      .then(bookings => {
          const bookingListElement = document.querySelector('#booking-list tbody');
          bookingListElement.innerHTML = '';  // Clear existing bookings

          bookings.forEach(booking => {
              const row = `
                  <tr>
                      <td>${booking.eventName}</td>
                      <td>${booking.date}</td>
                      <td>${booking.location}</td>
                      <td>${booking.tickets}</td>
                      <td>$${booking.price}</td>
                      <td>${booking.status}</td>
                      <td><button class="btn btn-sm btn-danger">Cancel</button></td>
                  </tr>
              `;
              bookingListElement.insertAdjacentHTML('beforeend', row);
          });
      });
}

// Fetch the booking list on page load
document.addEventListener('DOMContentLoaded', function() {
  fetchBookingList();
});
