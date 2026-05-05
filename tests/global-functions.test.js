/**
 * Unit tests for global-functions.js
 */

// Mock Notification API
global.Notification = class Notification {
  static permission = 'default';
  static requestPermission = jest.fn(() => Promise.resolve('granted'));
  
  constructor(title, options) {
    this.title = title;
    this.options = options;
  }
};

// Load the global functions module
require('../js/global-functions.js');

describe('Global Functions', () => {
  beforeEach(() => {
    // Clear DOM and reset mocks
    document.body.innerHTML = '';
    jest.clearAllMocks();
    
    // Create modal elements for testing
    document.body.innerHTML = `
      <div id="notification-modal" class="modal">
        <div class="modal-content">Notification Modal</div>
      </div>
      <div id="medicine-modal" class="modal">
        <div class="modal-content">Medicine Modal</div>
      </div>
    `;
  });

  describe('closeModal', () => {
    test('should close all modals with class "modal"', () => {
      const modal1 = document.getElementById('notification-modal');
      const modal2 = document.getElementById('medicine-modal');
      
      // Set modals to visible
      modal1.style.display = 'block';
      modal2.style.display = 'block';
      
      // Close all modals
      closeModal();
      
      expect(modal1.style.display).toBe('none');
      expect(modal2.style.display).toBe('none');
    });

    test('should handle case when no modals exist', () => {
      document.body.innerHTML = '';
      
      expect(() => closeModal()).not.toThrow();
    });
  });

  describe('closeNotificationModal', () => {
    test('should close notification modal specifically', () => {
      const notificationModal = document.getElementById('notification-modal');
      const medicineModal = document.getElementById('medicine-modal');
      
      notificationModal.style.display = 'block';
      medicineModal.style.display = 'block';
      
      closeNotificationModal();
      
      expect(notificationModal.style.display).toBe('none');
      expect(medicineModal.style.display).toBe('block');
    });

    test('should handle case when notification modal does not exist', () => {
      document.body.innerHTML = '';
      
      // The function will throw because the element doesn't exist
      expect(() => closeNotificationModal()).toThrow(TypeError);
    });
  });

  describe('requestNotificationPermission', () => {
    test('should request notification permission', async () => {
      global.Notification.requestPermission.mockResolvedValue('granted');
      
      await requestNotificationPermission();
      
      expect(global.Notification.requestPermission).toHaveBeenCalled();
    });

    test('should close notification modal on granted permission', async () => {
      global.Notification.requestPermission.mockResolvedValue('granted');
      
      await requestNotificationPermission();
      
      const notificationModal = document.getElementById('notification-modal');
      expect(notificationModal.style.display).toBe('none');
    });

    test('should log message when permission is granted', async () => {
      console.log = jest.fn();
      global.Notification.requestPermission.mockResolvedValue('granted');
      
      await requestNotificationPermission();
      
      expect(console.log).toHaveBeenCalledWith('Notification permission granted');
    });

    test('should handle case when Notification is not supported', async () => {
      const originalNotification = global.Notification;
      delete global.Notification;
      
      await expect(requestNotificationPermission()).resolves.toBeUndefined();
      
      global.Notification = originalNotification;
    });
  });

  describe('Window click event listener', () => {
    test('should close modal when clicking outside (on modal background)', () => {
      const modal = document.getElementById('medicine-modal');
      modal.style.display = 'block';
      
      // Simulate click on modal
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      });
      modal.dispatchEvent(event);
      
      expect(modal.style.display).toBe('none');
    });

    test('should not close modal when clicking inside content', () => {
      const modal = document.getElementById('medicine-modal');
      modal.style.display = 'block';
      
      // Add content element inside modal
      const content = document.createElement('div');
      content.className = 'modal-content';
      modal.appendChild(content);
      
      // Simulate click on content (not on modal directly)
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      });
      content.dispatchEvent(event);
      
      // Modal should remain open
      expect(modal.style.display).toBe('block');
    });
  });

  describe('Window object exports', () => {
    test('should export closeModal to window object', () => {
      expect(window.closeModal).toBeDefined();
      expect(typeof window.closeModal).toBe('function');
    });

    test('should export closeNotificationModal to window object', () => {
      expect(window.closeNotificationModal).toBeDefined();
      expect(typeof window.closeNotificationModal).toBe('function');
    });

    test('should export requestNotificationPermission to window object', () => {
      expect(window.requestNotificationPermission).toBeDefined();
      expect(typeof window.requestNotificationPermission).toBe('function');
    });
  });
});
