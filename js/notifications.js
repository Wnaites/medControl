// Notifications module for handling push notifications
class NotificationManager {
  constructor() {
    this.permission = 'default';
    this.checkPermission();
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
    const medicines = storage.getMedicines();
    
    medicines.forEach(medicine => {
      this.scheduleMedicineNotifications(medicine);
    });
  }

  // Schedule notifications for a specific medicine
  scheduleMedicineNotifications(medicine) {
    const now = new Date();
    const startDate = new Date(medicine.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + parseInt(medicine.durationDays));

    // Only schedule if medicine is active
    if (now > endDate) return;

    const [hours, minutes] = medicine.time.split(':');
    
    // Calculate next notification time
    let nextNotification = new Date();
    nextNotification.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // If time has passed today, schedule for tomorrow
    if (nextNotification < now) {
      nextNotification.setDate(nextNotification.getDate() + 1);
    }

    // Schedule based on frequency
    switch (medicine.frequencyType) {
      case 'daily':
        this.scheduleDailyNotification(medicine, nextNotification);
        break;
      case 'specific-days':
        this.scheduleSpecificDaysNotification(medicine, nextNotification);
        break;
      case 'weekly':
        this.scheduleWeeklyNotification(medicine, nextNotification);
        break;
      case 'custom':
        this.scheduleCustomNotification(medicine, nextNotification);
        break;
    }
  }

  // Schedule daily notifications
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

  // Schedule specific days notifications
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

  // Schedule weekly notifications
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

  // Schedule custom notifications
  scheduleCustomNotification(medicine, startTime) {
    console.log('Custom notification scheduling not implemented yet');
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
      setTimeout(() => {
        if (this.permission === 'granted') {
          this.showNotification(title, options, medicine);
        }
      }, delay);
    }
  }

  // Show notification
  showNotification(title, options, medicine) {
    if (this.permission !== 'granted') return;

    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, options);
    });

    // Also show desktop notification
    new Notification(title, options);
  }

  // Handle notification click
  handleNotificationClick(event) {
    const action = event.action;
    const tag = event.notification.tag;
    
    event.notification.close();

    if (action === 'taken') {
      // Mark dose as taken
      const medicineId = this.extractMedicineIdFromTag(tag);
      storage.markDoseTaken(medicineId, new Date());
      
      // Update UI
      if (window.ui) {
        window.ui.refreshMedicinesList();
      }
    } else if (action === 'snooze') {
      // Snooze for 15 minutes
      setTimeout(() => {
        this.showNotification(event.notification.title, {
          body: event.notification.body,
          icon: event.notification.icon
        });
      }, 15 * 60 * 1000);
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

// Create global instance
const notificationManager = new NotificationManager();

// Listen for notification clicks
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'notificationclick') {
      notificationManager.handleNotificationClick(event.data);
    }
  });
}
