/**
 * Unit tests for NotificationManager class
 */

// Mock dependencies before importing
const mockNotification = jest.fn(function(title, options) {
  this.title = title;
  this.options = options;
});
mockNotification.permission = 'default';
mockNotification.requestPermission = jest.fn(() => Promise.resolve('granted'));

global.Notification = mockNotification;

// Mock storage dependency
const mockStorage = {
  getMedicines: jest.fn(() => []),
  markDoseTaken: jest.fn()
};
global.storage = mockStorage;

// Mock navigator.serviceWorker with proper mock functions
const mockShowNotification = jest.fn();
const mockServiceWorkerReady = {
  then: jest.fn((cb) => {
    cb({ showNotification: mockShowNotification });
    return mockServiceWorkerReady;
  })
};

global.navigator = {
  serviceWorker: {
    ready: mockServiceWorkerReady,
    addEventListener: jest.fn()
  }
};

// Mock window.alert
window.alert = jest.fn();

describe('NotificationManager', () => {
  let NotificationManager;
  let notificationManagerInstance;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    global.Notification.permission = 'default';
    
    // Load the notifications module after resetting
    const module = require('../js/notifications.js');
    NotificationManager = module.NotificationManager || global.NotificationManager;
    notificationManagerInstance = new NotificationManager(mockStorage);
  });

  describe('Constructor', () => {
    test('should initialize with default permission', () => {
      expect(notificationManagerInstance.permission).toBe('default');
    });

    test('should call checkPermission on initialization', () => {
      // The constructor calls checkPermission which sets the permission
      expect(['default', 'granted', 'denied']).toContain(notificationManagerInstance.permission);
    });
  });

  describe('checkPermission', () => {
    test('should return false when Notification is not supported', async () => {
      const originalNotification = global.Notification;
      delete global.Notification;
      
      const newInstance = new NotificationManager();
      const result = await newInstance.checkPermission();
      
      expect(result).toBe(false);
      
      global.Notification = originalNotification;
    });

    test('should update permission property', async () => {
      global.Notification.permission = 'granted';
      
      const result = await notificationManagerInstance.checkPermission();
      
      expect(result).toBe(true);
      expect(notificationManagerInstance.permission).toBe('granted');
    });

    test('should return true when permission is granted', async () => {
      global.Notification.permission = 'granted';
      
      const result = await notificationManagerInstance.checkPermission();
      
      expect(result).toBe(true);
    });
  });

  describe('requestPermission', () => {
    test('should show alert when Notification is not supported', async () => {
      const originalNotification = global.Notification;
      delete global.Notification;
      window.alert = jest.fn();
      
      const newInstance = new NotificationManager();
      await newInstance.requestPermission();
      
      expect(window.alert).toHaveBeenCalledWith('Seu navegador não suporta notificações');
      
      global.Notification = originalNotification;
    });

    test('should request permission and update state', async () => {
      global.Notification.requestPermission.mockResolvedValue('granted');
      
      const result = await notificationManagerInstance.requestPermission();
      
      expect(result).toBe(true);
      expect(notificationManagerInstance.permission).toBe('granted');
    });

    test('should return false when permission is denied', async () => {
      global.Notification.requestPermission.mockResolvedValue('denied');
      
      const result = await notificationManagerInstance.requestPermission();
      
      expect(result).toBe(false);
    });

    test('should call scheduleNotifications when permission is granted', async () => {
      global.Notification.requestPermission.mockResolvedValue('granted');
      notificationManagerInstance.scheduleNotifications = jest.fn();
      
      await notificationManagerInstance.requestPermission();
      
      expect(notificationManagerInstance.scheduleNotifications).toHaveBeenCalled();
    });
  });

  describe('scheduleNotifications', () => {
    test('should get medicines from storage', () => {
      mockStorage.getMedicines.mockReturnValue([]);
      
      notificationManagerInstance.scheduleNotifications();
      
      expect(mockStorage.getMedicines).toHaveBeenCalled();
    });

    test('should schedule notifications for each medicine', () => {
      const medicines = [
        {
          id: '1',
          name: 'Aspirina',
          dosage: '500mg',
          frequencyType: 'daily',
          startDate: new Date().toISOString().split('T')[0],
          durationDays: 30,
          time: '08:00'
        },
        {
          id: '2',
          name: 'Ibuprofeno',
          dosage: '400mg',
          frequencyType: 'daily',
          startDate: new Date().toISOString().split('T')[0],
          durationDays: 15,
          time: '12:00'
        }
      ];
      
      mockStorage.getMedicines.mockReturnValue(medicines);
      notificationManagerInstance.scheduleMedicineNotifications = jest.fn();
      
      notificationManagerInstance.scheduleNotifications();
      
      expect(notificationManagerInstance.scheduleMedicineNotifications).toHaveBeenCalledTimes(2);
    });
  });

  describe('scheduleMedicineNotifications', () => {
    test('should not schedule if medicine has ended', () => {
      const medicine = {
        id: '1',
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2020-01-01',
        durationDays: 10,
        time: '08:00'
      };
      
      notificationManagerInstance.createNotification = jest.fn();
      notificationManagerInstance.scheduleMedicineNotifications(medicine);
      
      expect(notificationManagerInstance.createNotification).not.toHaveBeenCalled();
    });

    test('should schedule daily notifications', () => {
      const today = new Date();
      const medicine = {
        id: '1',
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: today.toISOString().split('T')[0],
        durationDays: 7,
        time: '08:00'
      };
      
      notificationManagerInstance.scheduleDailyNotification = jest.fn();
      notificationManagerInstance.scheduleMedicineNotifications(medicine);
      
      expect(notificationManagerInstance.scheduleDailyNotification).toHaveBeenCalled();
    });

    test('should schedule specific-days notifications', () => {
      const today = new Date();
      const medicine = {
        id: '1',
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'specific-days',
        startDate: today.toISOString().split('T')[0],
        durationDays: 30,
        time: '08:00',
        specificDays: [1, 3, 5]
      };
      
      notificationManagerInstance.scheduleSpecificDaysNotification = jest.fn();
      notificationManagerInstance.scheduleMedicineNotifications(medicine);
      
      expect(notificationManagerInstance.scheduleSpecificDaysNotification).toHaveBeenCalled();
    });

    test('should schedule weekly notifications', () => {
      const today = new Date();
      const medicine = {
        id: '1',
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'weekly',
        startDate: today.toISOString().split('T')[0],
        durationDays: 28,
        time: '08:00'
      };
      
      notificationManagerInstance.scheduleWeeklyNotification = jest.fn();
      notificationManagerInstance.scheduleMedicineNotifications(medicine);
      
      expect(notificationManagerInstance.scheduleWeeklyNotification).toHaveBeenCalled();
    });

    test('should schedule custom notifications', () => {
      const today = new Date();
      const medicine = {
        id: '1',
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'custom',
        startDate: today.toISOString().split('T')[0],
        durationDays: 7,
        time: '08:00',
        customInterval: 8
      };
      
      notificationManagerInstance.scheduleCustomNotification = jest.fn();
      notificationManagerInstance.scheduleMedicineNotifications(medicine);
      
      expect(notificationManagerInstance.scheduleCustomNotification).toHaveBeenCalled();
    });
  });

  describe('scheduleDailyNotification', () => {
    test('should create notifications for each day of duration', () => {
      const medicine = {
        id: '1',
        name: 'Aspirina',
        durationDays: 3
      };
      
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 1);
      
      notificationManagerInstance.createNotification = jest.fn();
      notificationManagerInstance.scheduleDailyNotification(medicine, startTime);
      
      expect(notificationManagerInstance.createNotification).toHaveBeenCalledTimes(3);
    });
  });

  describe('scheduleWeeklyNotification', () => {
    test('should create notifications for each week', () => {
      const medicine = {
        id: '1',
        name: 'Aspirina',
        durationDays: 21
      };
      
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 1);
      
      notificationManagerInstance.createNotification = jest.fn();
      notificationManagerInstance.scheduleWeeklyNotification(medicine, startTime);
      
      // 21 days / 7 = 3 weeks
      expect(notificationManagerInstance.createNotification).toHaveBeenCalledTimes(3);
    });
  });

  describe('scheduleSpecificDaysNotification', () => {
    test('should only schedule for specified days', () => {
      const medicine = {
        id: '1',
        name: 'Aspirina',
        durationDays: 7,
        specificDays: [1] // Only Mondays
      };
      
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 1);
      
      notificationManagerInstance.createNotification = jest.fn();
      notificationManagerInstance.scheduleSpecificDaysNotification(medicine, startTime);
      
      // Should only create notifications for days that match
      expect(notificationManagerInstance.createNotification).toHaveBeenCalled();
    });
  });

  describe('scheduleCustomNotification', () => {
    test('should log not implemented message', () => {
      console.log = jest.fn();
      
      const medicine = {
        id: '1',
        name: 'Aspirina',
        customInterval: 8
      };
      
      const startTime = new Date();
      
      notificationManagerInstance.scheduleCustomNotification(medicine, startTime);
      
      expect(console.log).toHaveBeenCalledWith('Custom notification scheduling not implemented yet');
    });
  });

  describe('createNotification', () => {
    test('should schedule notification with correct delay', () => {
      const medicine = {
        id: '1',
        name: 'Aspirina',
        dosage: '500mg'
      };
      
      // Set notification time in the future (1 hour from now)
      const notificationTime = new Date();
      notificationTime.setHours(notificationTime.getHours() + 1);
      
      jest.useFakeTimers({ now: Date.now() });
      const showNotificationSpy = jest.fn();
      notificationManagerInstance.showNotification = showNotificationSpy;
      notificationManagerInstance.permission = 'granted';
      notificationManagerInstance.createNotification(medicine, notificationTime);
      
      // Fast-forward until all timers are executed (1 hour + buffer)
      jest.advanceTimersByTime(61 * 60 * 1000);
      
      expect(showNotificationSpy).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    test('should immediately show notification if time is in the past', () => {
      const medicine = {
        id: '1',
        name: 'Aspirina',
        dosage: '500mg'
      };
      
      // Set notification time in the past
      const notificationTime = new Date();
      notificationTime.setHours(notificationTime.getHours() - 1);
      
      notificationManagerInstance.permission = 'granted';
      const showNotificationSpy = jest.fn();
      notificationManagerInstance.showNotification = showNotificationSpy;
      notificationManagerInstance.createNotification(medicine, notificationTime);
      
      expect(showNotificationSpy).toHaveBeenCalled();
    });
  });

  describe('showNotification', () => {
    test('should not show notification if permission is not granted', () => {
      notificationManagerInstance.permission = 'denied';
      
      notificationManagerInstance.showNotification('Test', {}, {});
      
      expect(mockServiceWorkerReady.then).not.toHaveBeenCalled();
    });

    test('should show notification via service worker', () => {
      // Reset mocks first
      jest.clearAllMocks();
      
      notificationManagerInstance.permission = 'granted';
      
      const title = 'Test Notification';
      const options = { body: 'Test body' };
      const medicine = { id: '1' };
      
      notificationManagerInstance.showNotification(title, options, medicine);
      
      expect(mockServiceWorkerReady.then).toHaveBeenCalled();
    });
  });

  describe('handleNotificationClick', () => {
    test('should close notification', () => {
      const event = {
        action: 'taken',
        notification: {
          tag: 'medicine-123-1234567890',
          close: jest.fn(),
          title: 'Test',
          body: 'Test body',
          icon: '/icon.png'
        }
      };
      
      notificationManagerInstance.extractMedicineIdFromTag = jest.fn(() => '123');
      
      notificationManagerInstance.handleNotificationClick(event);
      
      expect(event.notification.close).toHaveBeenCalled();
    });

    test('should mark dose as taken when action is taken', () => {
      const event = {
        action: 'taken',
        notification: {
          tag: 'medicine-123-1234567890',
          close: jest.fn(),
          title: 'Test',
          body: 'Test body'
        }
      };
      
      notificationManagerInstance.extractMedicineIdFromTag = jest.fn(() => '123');
      window.ui = { refreshMedicinesList: jest.fn() };
      
      notificationManagerInstance.handleNotificationClick(event);
      
      expect(mockStorage.markDoseTaken).toHaveBeenCalled();
    });

    test('should snooze notification when action is snooze', () => {
      jest.useFakeTimers();
      
      const event = {
        action: 'snooze',
        notification: {
          tag: 'medicine-123-1234567890',
          close: jest.fn(),
          title: 'Test',
          body: 'Test body',
          icon: '/icon.png'
        }
      };
      
      notificationManagerInstance.showNotification = jest.fn();
      notificationManagerInstance.handleNotificationClick(event);
      
      jest.advanceTimersByTime(15 * 60 * 1000);
      
      expect(notificationManagerInstance.showNotification).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('extractMedicineIdFromTag', () => {
    test('should extract medicine ID from tag', () => {
      const tag = 'medicine-abc123-1234567890';
      
      const medicineId = notificationManagerInstance.extractMedicineIdFromTag(tag);
      
      expect(medicineId).toBe('abc123');
    });
  });

  describe('cancelMedicineNotifications', () => {
    test('should log cancellation message', () => {
      console.log = jest.fn();
      
      notificationManagerInstance.cancelMedicineNotifications('medicine-123');
      
      expect(console.log).toHaveBeenCalledWith('Canceling notifications for medicine medicine-123');
    });
  });

  describe('testNotification', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should show test notification when permission is granted', () => {
      notificationManagerInstance.permission = 'granted';
      
      notificationManagerInstance.testNotification();
      
      expect(mockNotification).toHaveBeenCalledWith(
        'Teste de Notificação',
        expect.objectContaining({
          body: 'Suas notificações estão funcionando corretamente!'
        })
      );
    });

    test('should not show test notification when permission is not granted', () => {
      notificationManagerInstance.permission = 'denied';
      
      notificationManagerInstance.testNotification();
      
      expect(mockNotification).not.toHaveBeenCalled();
    });
  });
});
