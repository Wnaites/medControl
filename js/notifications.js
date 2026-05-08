// Notifications module for handling push notifications
import { 
  calculateEndDate, 
  getDosesForDay, 
  shouldDoseOnDay,
  createDoseTime,
  getAllScheduledDoses,
  isSameDay
} from './utils.js';

class NotificationManager {
  constructor(options = {}) {
    this.permission = 'default';
    this.storage = options.storage || (typeof storage !== 'undefined' ? storage : null);
    this.scheduledTimeouts = [];
    this.notificationClass = options.NotificationClass || (typeof Notification !== 'undefined' ? Notification : null);
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
    const endDate = calculateEndDate(medicine.startDate, medicine.durationDays);

    // Only schedule if medicine is active
    if (now > endDate) return;

    // Get all scheduled doses for this medicine
    const allDoses = getAllScheduledDoses(medicine);
    
    // Schedule each dose
    allDoses.forEach(doseTime => {
      this.createNotification(medicine, doseTime);
    });
  }

  // Schedule daily notifications (kept for backward compatibility)
  scheduleDailyNotification(medicine, startTime) {
    const duration = parseInt(medicine.durationDays);
    
    for (let i = 0; i < duration; i++) {
      const notificationTime = new Date(startTime);
      notificationTime.setDate(notificationTime.getDate() + i);
      
      if (notificationTime > new Date()) {
        this.createNotification(medicine, notificationTime);
      }
    }
  }

  // Schedule specific days notifications (kept for backward compatibility)
  scheduleSpecificDaysNotification(medicine, startTime) {
    const days = medicine.specificDays || [];
    const duration = parseInt(medicine.durationDays);
    
    for (let i = 0; i < duration; i++) {
      const currentDate = new Date(startTime);
      currentDate.setDate(currentDate.getDate() + i);
      
      const dayOfWeek = currentDate.getDay();
      if (days.includes(dayOfWeek)) {
        this.createNotification(medicine, currentDate);
      }
    }
  }

  // Schedule weekly notifications (kept for backward compatibility)
  scheduleWeeklyNotification(medicine, startTime) {
    const duration = parseInt(medicine.durationDays);
    const weeks = Math.ceil(duration / 7);
    
    for (let i = 0; i < weeks; i++) {
      const notificationTime = new Date(startTime);
      notificationTime.setDate(notificationTime.getDate() + (i * 7));
      
      if (notificationTime > new Date()) {
        this.createNotification(medicine, notificationTime);
      }
    }
  }

  // Schedule custom interval notifications (now fully implemented)
  scheduleCustomNotification(medicine, startTime) {
    const interval = parseInt(medicine.customInterval) || 8;
    const duration = parseInt(medicine.durationDays);
    const dosesPerDay = Math.floor(24 / interval);
    
    for (let day = 0; day < duration; day++) {
      const currentDate = new Date(startTime);
      currentDate.setDate(currentDate.getDate() + day);
      
      // Create multiple doses per day based on interval
      for (let dose = 0; dose < dosesPerDay; dose++) {
        const doseTime = new Date(currentDate);
        doseTime.setHours(dose * interval, 0, 0, 0);
        
        if (doseTime > new Date()) {
          this.createNotification(medicine, doseTime);
        }
      }
    }
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

    // Use setTimeout for scheduling (simplified approach)
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
    const NotificationClass = this.notificationClass || (typeof Notification !== 'undefined' ? Notification : null);
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
  // Make available globally for browser
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
