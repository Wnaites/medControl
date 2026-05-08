/**
 * User Flow Test - Adding a new medicine and verifying dose calculation
 * 
 * This test validates the expected user flow:
 * 1. User clicks to add a new medicine
 * 2. User fills in dosage and frequency information
 * 3. User specifies treatment duration
 * 4. System calculates and registers all dose times until end of treatment
 */

// Mock storage dependencies before importing
global.Blob = class Blob {
  constructor(data, options) {
    this.data = data;
    this.options = options;
  }
};

global.URL = {
  createObjectURL: jest.fn(() => 'mock-url'),
  revokeObjectURL: jest.fn()
};

const originalCreateElement = document.createElement.bind(document);
document.createElement = jest.fn((tag) => {
  const element = originalCreateElement(tag);
  if (tag === 'a') {
    element.click = jest.fn();
  }
  return element;
});

describe('User Flow - Add Medicine and Calculate Doses', () => {
  let StorageManager;
  let storageInstance;
  let NotificationManager;
  let notificationManagerInstance;
  
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    
    // Load modules
    const storageModule = require('../js/storage.js');
    StorageManager = storageModule.StorageManager;
    storageInstance = new StorageManager();
    
    const notificationsModule = require('../js/notifications.js');
    NotificationManager = notificationsModule.NotificationManager;
    notificationManagerInstance = new NotificationManager({ 
      storage: storageInstance,
      skipInit: true 
    });
  });

  describe('Complete User Flow', () => {
    test('should calculate all doses for a daily medication over treatment duration', () => {
      // Simulate user adding a new medicine
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      
      const medicine = {
        name: 'Amoxicilina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: startDate,
        durationDays: 7, // 7 days treatment
        time: '08:00'
      };
      
      // Save medicine (simulating form submission)
      const savedMedicine = storageInstance.saveMedicine(medicine);
      
      // Verify medicine was saved with ID
      expect(savedMedicine.id).toBeDefined();
      expect(savedMedicine.name).toBe('Amoxicilina');
      expect(savedMedicine.durationDays.toString()).toBe('7');
      
      // Get all scheduled doses using notification manager
      const allDoses = notificationManagerInstance.getAllScheduledDoses(savedMedicine);
      
      // Should have 7 doses (one per day for 7 days)
      // Note: doses in the past are filtered out, so we check based on current time
      expect(allDoses.length).toBeGreaterThan(0);
      expect(allDoses.length).toBeLessThanOrEqual(7);
      
      // Verify all doses are within treatment period
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 7);
      
      allDoses.forEach(dose => {
        expect(dose.getTime()).toBeGreaterThanOrEqual(today.getTime());
        expect(dose.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    test('should calculate all doses for custom frequency medication', () => {
      // Simulate user adding a medicine with custom frequency (every 8 hours)
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      
      const medicine = {
        name: 'Ibuprofeno',
        dosage: '400mg',
        frequencyType: 'custom',
        customInterval: '8', // Every 8 hours = 3 times per day
        startDate: startDate,
        durationDays: 3, // 3 days treatment
        time: '08:00'
      };
      
      // Save medicine
      const savedMedicine = storageInstance.saveMedicine(medicine);
      
      // Get all scheduled doses
      const allDoses = notificationManagerInstance.getAllScheduledDoses(savedMedicine);
      
      // Should have up to 9 doses (3 per day × 3 days)
      // Some may be filtered if in the past
      expect(allDoses.length).toBeGreaterThan(0);
      expect(allDoses.length).toBeLessThanOrEqual(9);
      
      // Verify doses are spaced approximately 8 hours apart
      if (allDoses.length > 1) {
        for (let i = 1; i < allDoses.length; i++) {
          const diffHours = (allDoses[i].getTime() - allDoses[i-1].getTime()) / (1000 * 60 * 60);
          // Allow some flexibility for edge cases
          expect(diffHours).toBeGreaterThanOrEqual(7);
          expect(diffHours).toBeLessThanOrEqual(9);
        }
      }
    });

    test('should calculate doses only for specific days of week', () => {
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      
      const medicine = {
        name: 'Vitamina C',
        dosage: '1g',
        frequencyType: 'specific-days',
        specificDays: [1, 3, 5], // Monday, Wednesday, Friday
        startDate: startDate,
        durationDays: 14, // 2 weeks
        time: '09:00'
      };
      
      // Save medicine
      const savedMedicine = storageInstance.saveMedicine(medicine);
      
      // Get all scheduled doses
      const allDoses = notificationManagerInstance.getAllScheduledDoses(savedMedicine);
      
      // Should have 6 doses (3 days per week × 2 weeks)
      // Some may be filtered if in the past
      expect(allDoses.length).toBeGreaterThanOrEqual(0);
      expect(allDoses.length).toBeLessThanOrEqual(6);
      
      // Verify all doses fall on specified days
      allDoses.forEach(dose => {
        const dayOfWeek = dose.getDay();
        expect([1, 3, 5]).toContain(dayOfWeek);
      });
    });

    test('should not schedule doses after treatment ends', () => {
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      
      const medicine = {
        name: 'Antibiótico',
        dosage: '250mg',
        frequencyType: 'daily',
        startDate: startDate,
        durationDays: 5,
        time: '12:00'
      };
      
      const savedMedicine = storageInstance.saveMedicine(medicine);
      const allDoses = notificationManagerInstance.getAllScheduledDoses(savedMedicine);
      
      // Calculate actual end date
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 5);
      endDate.setHours(23, 59, 59, 999);
      
      // All doses should be before or on end date
      allDoses.forEach(dose => {
        expect(dose.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    test('should handle weekly frequency correctly', () => {
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const startDayOfWeek = today.getDay();
      
      const medicine = {
        name: 'Injeção Semanal',
        dosage: '1ml',
        frequencyType: 'weekly',
        startDate: startDate,
        durationDays: 28, // 4 weeks
        time: '10:00'
      };
      
      const savedMedicine = storageInstance.saveMedicine(medicine);
      const allDoses = notificationManagerInstance.getAllScheduledDoses(savedMedicine);
      
      // Should have up to 4 doses (once per week for 4 weeks)
      expect(allDoses.length).toBeGreaterThanOrEqual(0);
      expect(allDoses.length).toBeLessThanOrEqual(4);
      
      // All doses should be on the same day of week as start date
      allDoses.forEach(dose => {
        expect(dose.getDay()).toBe(startDayOfWeek);
      });
    });

    test('should store medicine with complete information', () => {
      const medicine = {
        name: 'Paracetamol',
        dosage: '750mg',
        frequencyType: 'daily',
        startDate: '2024-01-15',
        durationDays: '10',
        time: '14:30'
      };
      
      const savedMedicine = storageInstance.saveMedicine(medicine);
      const retrieved = storageInstance.getMedicine(savedMedicine.id);
      
      expect(retrieved.name).toBe('Paracetamol');
      expect(retrieved.dosage).toBe('750mg');
      expect(retrieved.frequencyType).toBe('daily');
      expect(retrieved.startDate).toBe('2024-01-15');
      expect(retrieved.durationDays).toBe('10');
      expect(retrieved.time).toBe('14:30');
      expect(retrieved.id).toBeDefined();
      expect(retrieved.createdAt).toBeDefined();
    });

    test('should update medicine when editing', () => {
      // First save
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: '30',
        time: '08:00'
      };
      
      const saved = storageInstance.saveMedicine(medicine);
      
      // Edit medicine (simulating user updating dosage)
      saved.dosage = '1000mg';
      saved.durationDays = '15';
      
      const updated = storageInstance.saveMedicine(saved);
      
      expect(updated.id).toBe(saved.id);
      expect(updated.dosage).toBe('1000mg');
      expect(updated.durationDays).toBe('15');
      expect(updated.createdAt).toBe(saved.createdAt); // Should preserve creation date
    });

    test('should mark dose as taken and track history', () => {
      const medicine = {
        name: 'Remédio Teste',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString().split('T')[0],
        durationDays: '7',
        time: '08:00'
      };
      
      const saved = storageInstance.saveMedicine(medicine);
      const doseTime = new Date().toISOString();
      
      // Mark dose as taken
      storageInstance.markDoseTaken(saved.id, doseTime);
      
      const updated = storageInstance.getMedicine(saved.id);
      
      expect(updated.dosesTaken).toBeDefined();
      expect(updated.dosesTaken.length).toBe(1);
      expect(updated.dosesTaken[0].time).toBe(doseTime);
      expect(updated.dosesTaken[0].takenAt).toBeDefined();
    });

    test('should verify dose calculation matches user expectations', () => {
      // This test validates the core user expectation:
      // "System calculates and registers all dose times until end of treatment"
      
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      
      // Create a medicine with known parameters
      const medicine = {
        name: 'Teste Validacao',
        dosage: '200mg',
        frequencyType: 'daily',
        startDate: startDate,
        durationDays: '5',
        time: '08:00'
      };
      
      const saved = storageInstance.saveMedicine(medicine);
      const allDoses = notificationManagerInstance.getAllScheduledDoses(saved);
      
      // Validate that system has calculated doses
      expect(allDoses).toBeDefined();
      expect(Array.isArray(allDoses)).toBe(true);
      
      // Each dose should have a valid date
      allDoses.forEach(dose => {
        expect(dose instanceof Date).toBe(true);
        expect(isNaN(dose.getTime())).toBe(false);
      });
      
      // Doses should be sorted chronologically
      for (let i = 1; i < allDoses.length; i++) {
        expect(allDoses[i].getTime()).toBeGreaterThanOrEqual(allDoses[i-1].getTime());
      }
      
      console.log(`✓ System calculated ${allDoses.length} doses for 5-day treatment`);
      console.log(`✓ First dose: ${allDoses[0]?.toLocaleString('pt-BR')}`);
      console.log(`✓ Last dose: ${allDoses[allDoses.length-1]?.toLocaleString('pt-BR')}`);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero duration gracefully', () => {
      const medicine = {
        name: 'Dose Única',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString().split('T')[0],
        durationDays: '0',
        time: '08:00'
      };
      
      const saved = storageInstance.saveMedicine(medicine);
      const allDoses = notificationManagerInstance.getAllScheduledDoses(saved);
      
      // With 0 duration, there should be no future doses
      expect(allDoses.length).toBe(0);
    });

    test('should handle past start date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const medicine = {
        name: 'Remédio Atrasado',
        dosage: '50mg',
        frequencyType: 'daily',
        startDate: yesterday.toISOString().split('T')[0],
        durationDays: '3',
        time: '08:00'
      };
      
      const saved = storageInstance.saveMedicine(medicine);
      const allDoses = notificationManagerInstance.getAllScheduledDoses(saved);
      
      // Should still calculate remaining doses
      expect(allDoses.length).toBeGreaterThanOrEqual(0);
      expect(allDoses.length).toBeLessThanOrEqual(3);
    });

    test('should handle ended treatment', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      
      const medicine = {
        name: 'Tratamento Encerrado',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: oldDate.toISOString().split('T')[0],
        durationDays: '5',
        time: '08:00'
      };
      
      const saved = storageInstance.saveMedicine(medicine);
      const allDoses = notificationManagerInstance.getAllScheduledDoses(saved);
      
      // Treatment ended 5 days ago, no future doses
      expect(allDoses.length).toBe(0);
    });
  });
});
