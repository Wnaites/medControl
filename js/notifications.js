// Notifications module for handling push notifications

class NotificationManager {
  constructor(options = {}) {
    this.permission = 'default';
    this.storage = options.storage || (typeof storage !== 'undefined' ? storage : null);
    this.scheduledTimeouts = [];
    this.NotificationClass = options.NotificationClass || (typeof Notification !== 'undefined' ? Notification : null);
    this.navigator = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
    
    if (!options.skipInit) {
      this.init();
    }
  }
  
  init() {
    this.checkPermission();
  }
  
  // Cleanup method for tests
  destroy() {
    this.clearAllTimeouts();
  }

  // Check notification permission
  async checkPermission() {
    if (!('Notification' in window)) {
      console.log('Este navegador não suporta notificações');
      return false;
    }

    this.permission = Notification.permission;
    return this.permission === 'granted';
  }

  // Request notification permission
  async requestPermission() {
    if (!('Notification' in window)) {
      alert('Seu navegador não suporta notificações');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        console.log('Notificações permitidas');
        this.scheduleNotifications();
        return true;
      } else {
        console.log('Notificações negadas');
        return false;
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
      return false;
    }
  }

  // Schedule notifications for medicines
  scheduleNotifications() {
    if (!this.storage) return;
    
    const medicines = this.storage.getMedicines();
    
    medicines.forEach(medicine => {
      this.scheduleMedicineNotifications(medicine);
    });
  }

  // Schedule notifications for a specific medicine
  scheduleMedicineNotifications(medicine) {
    const now = new Date();
    const startDate = new Date(medicine.startDate);
    const endDate = this.calculateEndDate(medicine.startDate, medicine.durationDays);

    // Only schedule if medicine is active
    if (now > endDate) return;

    // Get all scheduled doses for this medicine
    const allDoses = this.getAllScheduledDoses(medicine);
    
    // Schedule each dose
    allDoses.forEach(doseTime => {
      this.createNotification(medicine, doseTime);
    });
  }

  // Calculate end date helper
  calculateEndDate(startDate, durationDays) {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + parseInt(durationDays));
    return end;
  }

  // Get all scheduled doses for a medicine
  getAllScheduledDoses(medicine) {
    const doses = [];
    const start = new Date(medicine.startDate);
    const end = this.calculateEndDate(medicine.startDate, medicine.durationDays);
    const now = new Date();
    
    // Iterate through each day of treatment
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      // Skip if day doesn't match frequency
      if (!this.shouldDoseOnDay(medicine, date)) {
        continue;
      }
      
      // Get doses for this day
      const dayDoses = this.getDosesForDay(medicine, date);
      
      // Only include future doses
      dayDoses.forEach(dose => {
        if (dose > now) {
          doses.push(dose);
        }
      });
    }
    
    return doses;
  }

  // Check if should dose on a specific day
  shouldDoseOnDay(medicine, date) {
    const dayOfWeek = date.getDay();
    const start = new Date(medicine.startDate);
    const end = this.calculateEndDate(medicine.startDate, medicine.durationDays);
    
    // Check if date is within medicine period
    if (date < start || date > end) {
      return false;
    }
    
    // Check frequency-specific rules
    switch (medicine.frequencyType) {
      case 'daily':
        return true;
        
      case 'specific-days':
        const specificDays = medicine.specificDays || [];
        return specificDays.includes(dayOfWeek);
        
      case 'weekly':
        return dayOfWeek === start.getDay();
        
      case 'custom':
        return true;
        
      default:
        return false;
    }
  }

  // Get doses for a specific day
  getDosesForDay(medicine, targetDate = new Date()) {
    const doses = [];
    const start = new Date(medicine.startDate);
    const end = this.calculateEndDate(medicine.startDate, medicine.durationDays);
    
    // Check if targetDate is within medicine period
    const targetStart = new Date(targetDate);
    targetStart.setHours(0, 0, 0, 0);
    const targetEnd = new Date(targetDate);
    targetEnd.setHours(23, 59, 59, 999);
    
    if (targetStart < start || targetStart > end) {
      return doses;
    }
    
    // Check if dose should occur on this day based on frequency
    if (!this.shouldDoseOnDay(medicine, targetDate)) {
      return doses;
    }
    
    // Generate all doses for this day based on frequency type
    switch (medicine.frequencyType) {
      case 'daily':
      case 'specific-days':
      case 'weekly':
        // Single daily dose at specified time
        doses.push(this.createDoseTime(targetDate, medicine.time));
        break;
        
      case 'custom':
        // Multiple doses per day based on interval
        const interval = parseInt(medicine.customInterval) || 8;
        const dosesPerDay = Math.floor(24 / interval);
        
        for (let i = 0; i < dosesPerDay; i++) {
          const doseTime = new Date(targetStart);
          doseTime.setHours(i * interval, 0, 0, 0);
          
          // Only add if it's not in the past
          if (doseTime >= new Date()) {
            doses.push(doseTime);
          }
        }
        break;
    }
    
    return doses;
  }

  // Create dose time helper
  createDoseTime(date, time) {
    const [hours, minutes] = time.split(':');
    const doseTime = new Date(date);
    doseTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return doseTime;
  }

  // Create notification
  createNotification(medicine, notificationTime) {
    const title = `Hora de tomar ${medicine.name}`;
    const options = {
      body: `Dosagem: ${medicine.dosage}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `medicine-${medicine.id}-${notificationTime.getTime()}`,
      requireInteraction: true,
      actions: [
        {
          action: 'taken',
          title: 'Tomei'
        },
        {
          action: 'snooze',
          title: 'Lembrar mais tarde'
        }
      ]
    };

    // Use setTimeout for scheduling
    const delay = notificationTime.getTime() - Date.now();
    
    if (delay > 0) {
      const timeoutId = setTimeout(() => {
        if (this.permission === 'granted') {
          this.showNotification(title, options, medicine);
        }
      }, delay);
      this.scheduledTimeouts.push(timeoutId);
    } else {
      // If the time is in the past, schedule immediately (for testing)
      if (this.permission === 'granted') {
        this.showNotification(title, options, medicine);
      }
    }
  }

  // Show notification
  showNotification(title, options, medicine) {
    if (this.permission !== 'granted') return;

    const nav = this.navigator || (typeof navigator !== 'undefined' ? navigator : null);
    
    if (nav && nav.serviceWorker && nav.serviceWorker.ready) {
      nav.serviceWorker.ready.then(registration => {
        registration.showNotification(title, options);
      });
    }

    // Also show desktop notification
    const NotificationClass = this.NotificationClass || (typeof Notification !== 'undefined' ? Notification : null);
    if (NotificationClass) {
      new NotificationClass(title, options);
    }
  }

  // Handle notification click
  handleNotificationClick(event) {
    const action = event.action;
    const tag = event.notification.tag;
    
    event.notification.close();

    if (action === 'taken') {
      // Mark dose as taken
      const medicineId = this.extractMedicineIdFromTag(tag);
      if (this.storage) {
        this.storage.markDoseTaken(medicineId, new Date());
      }
      
      // Update UI
      if (window.ui) {
        window.ui.refreshMedicinesList();
      }
    } else if (action === 'snooze') {
      // Snooze for 15 minutes
      const timeout = setTimeout(() => {
        this.showNotification(event.notification.title, {
          body: event.notification.body,
          icon: event.notification.icon
        });
      }, 15 * 60 * 1000);
      this.scheduledTimeouts.push(timeout);
    }
  }

  // Extract medicine ID from notification tag
  extractMedicineIdFromTag(tag) {
    const parts = tag.split('-');
    return parts[1];
  }

  // Cancel all notifications for a medicine
  cancelMedicineNotifications(medicineId) {
    console.log(`Canceling notifications for medicine ${medicineId}`);
    // Clear any scheduled timeouts
    this.scheduledTimeouts.forEach(timeout => clearTimeout(timeout));
    this.scheduledTimeouts = [];
  }

  // Clear all scheduled timeouts (useful for cleanup)
  clearAllTimeouts() {
    this.scheduledTimeouts.forEach(timeout => clearTimeout(timeout));
    this.scheduledTimeouts = [];
  }

  // Test notification
  testNotification() {
    if (this.permission === 'granted') {
      new Notification('Teste de Notificação', {
        body: 'Suas notificações estão funcionando corretamente!',
        icon: '/icons/icon-192x192.png'
      });
    }
  }
}

// Export for testing and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NotificationManager };
} else {
  window.NotificationManager = NotificationManager;
}

// Create global instance with default storage
const notificationManager = new NotificationManager({
  storage: typeof storage !== 'undefined' ? storage : null
});

// Listen for notification clicks
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'notificationclick') {
      notificationManager.handleNotificationClick(event.data);
    }
  });
}
