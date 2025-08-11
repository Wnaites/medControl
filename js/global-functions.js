// Global utility functions for modal operations

// Close any modal
function closeModal() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.style.display = 'none';
  });
}

// Close notification modal
function closeNotificationModal() {
  document.getElementById('notification-modal').style.display = 'none';
}

// Request notification permission
async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted');
      closeNotificationModal();
    }
  }
}

// Close modal on outside click
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    closeModal();
  }
});

// Add to window object for global access
window.closeModal = closeModal;
window.closeNotificationModal = closeNotificationModal;
window.requestNotificationPermission = requestNotificationPermission;
