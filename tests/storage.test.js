/**
 * Unit tests for StorageManager class
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

describe('StorageManager', () => {
  let StorageManager;
  let storageInstance;
  
  beforeEach(() => {
    // Clear the module cache and re-require to get fresh instance
    jest.resetModules();
    localStorage.clear();
    
    // Load the storage module
    const storageModule = require('../js/storage.js');
    StorageManager = storageModule.StorageManager;
    storageInstance = new StorageManager();
  });

  describe('Constructor', () => {
    test('should initialize with correct storage key', () => {
      expect(storageInstance.storageKey).toBe('medcontrole_medicines');
    });
  });

  describe('generateId', () => {
    test('should generate a unique string ID', () => {
      const id1 = storageInstance.generateId();
      const id2 = storageInstance.generateId();
      
      expect(typeof id1).toBe('string');
      expect(id1).not.toBe(id2);
    });
  });

  describe('saveMedicine', () => {
    test('should save a new medicine with generated ID and createdAt timestamp', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00'
      };

      const saved = storageInstance.saveMedicine(medicine);

      expect(saved.id).toBeDefined();
      expect(saved.createdAt).toBeDefined();
      expect(saved.name).toBe('Aspirina');
    });

    test('should update existing medicine when ID is provided', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00'
      };

      const saved = storageInstance.saveMedicine(medicine);
      saved.dosage = '1000mg';

      const updated = storageInstance.saveMedicine(saved);

      expect(updated.id).toBe(saved.id);
      expect(updated.dosage).toBe('1000mg');
      expect(updated.createdAt).toBe(saved.createdAt);
    });

    test('should store medicine in localStorage', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00'
      };

      storageInstance.saveMedicine(medicine);

      const stored = JSON.parse(localStorage.getItem('medcontrole_medicines'));
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Aspirina');
    });
  });

  describe('getMedicines', () => {
    test('should return empty array when no medicines exist', () => {
      const medicines = storageInstance.getMedicines();
      expect(medicines).toEqual([]);
    });

    test('should return all saved medicines', () => {
      const medicine1 = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00'
      };

      const medicine2 = {
        name: 'Ibuprofeno',
        dosage: '400mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 15,
        time: '12:00'
      };

      storageInstance.saveMedicine(medicine1);
      storageInstance.saveMedicine(medicine2);

      const medicines = storageInstance.getMedicines();
      expect(medicines).toHaveLength(2);
    });
  });

  describe('getMedicine', () => {
    test('should return medicine by ID', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00'
      };

      const saved = storageInstance.saveMedicine(medicine);
      const retrieved = storageInstance.getMedicine(saved.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(saved.id);
      expect(retrieved.name).toBe('Aspirina');
    });

    test('should return undefined for non-existent ID', () => {
      const retrieved = storageInstance.getMedicine('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('deleteMedicine', () => {
    test('should delete medicine by ID', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00'
      };

      const saved = storageInstance.saveMedicine(medicine);
      storageInstance.deleteMedicine(saved.id);

      const medicines = storageInstance.getMedicines();
      expect(medicines).toHaveLength(0);
    });

    test('should not affect other medicines when deleting one', () => {
      const medicine1 = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00'
      };

      const medicine2 = {
        name: 'Ibuprofeno',
        dosage: '400mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 15,
        time: '12:00'
      };

      const saved1 = storageInstance.saveMedicine(medicine1);
      const saved2 = storageInstance.saveMedicine(medicine2);

      storageInstance.deleteMedicine(saved1.id);

      const medicines = storageInstance.getMedicines();
      expect(medicines).toHaveLength(1);
      expect(medicines[0].id).toBe(saved2.id);
    });
  });

  describe('updateMedicineStatus', () => {
    test('should update medicine status and lastUpdated timestamp', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00'
      };

      const saved = storageInstance.saveMedicine(medicine);
      storageInstance.updateMedicineStatus(saved.id, 'completed');

      const updated = storageInstance.getMedicine(saved.id);
      expect(updated.status).toBe('completed');
      expect(updated.lastUpdated).toBeDefined();
    });

    test('should not throw error for non-existent medicine', () => {
      expect(() => {
        storageInstance.updateMedicineStatus('non-existent', 'completed');
      }).not.toThrow();
    });
  });

  describe('markDoseTaken', () => {
    test('should add dose to dosesTaken array', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00'
      };

      const saved = storageInstance.saveMedicine(medicine);
      const doseTime = new Date().toISOString();
      
      storageInstance.markDoseTaken(saved.id, doseTime);

      const updated = storageInstance.getMedicine(saved.id);
      expect(updated.dosesTaken).toHaveLength(1);
      expect(updated.dosesTaken[0].time).toBe(doseTime);
      expect(updated.dosesTaken[0].takenAt).toBeDefined();
    });
  });

  describe('getTodayDoses', () => {
    test('should return medicines active today', () => {
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: startDate,
        durationDays: 30,
        time: '08:00'
      };

      storageInstance.saveMedicine(medicine);

      const todayDoses = storageInstance.getTodayDoses();
      expect(todayDoses).toHaveLength(1);
    });

    test('should not return medicines that have ended', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2020-01-01',
        durationDays: 10,
        time: '08:00'
      };

      storageInstance.saveMedicine(medicine);

      const todayDoses = storageInstance.getTodayDoses();
      expect(todayDoses).toHaveLength(0);
    });
  });

  describe('getLastDoseTime', () => {
    test('should return correct dose time based on medicine time', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '14:30'
      };

      const lastDoseTime = storageInstance.getLastDoseTime(medicine);
      expect(lastDoseTime.getHours()).toBe(14);
      expect(lastDoseTime.getMinutes()).toBe(30);
    });
  });

  describe('isDoseTakenToday', () => {
    test('should return false when no doses taken', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00'
      };

      expect(storageInstance.isDoseTakenToday(medicine)).toBe(false);
    });

    test('should return true when dose was taken today', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00',
        dosesTaken: [{
          time: '08:00',
          takenAt: new Date().toISOString()
        }]
      };

      expect(storageInstance.isDoseTakenToday(medicine)).toBe(true);
    });

    test('should return false when dose was taken on a different day', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00',
        dosesTaken: [{
          time: '08:00',
          takenAt: yesterday.toISOString()
        }]
      };

      expect(storageInstance.isDoseTakenToday(medicine)).toBe(false);
    });
  });

  describe('exportData', () => {
    test('should create blob and trigger download', () => {
      const medicine = {
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        durationDays: 30,
        time: '08:00'
      };

      storageInstance.saveMedicine(medicine);
      storageInstance.exportData();

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
    });
  });

  describe('importData', () => {
    test('should import medicines from file', async () => {
      const importedMedicines = [
        {
          id: 'test-id',
          name: 'Aspirina',
          dosage: '500mg',
          frequencyType: 'daily',
          startDate: '2024-01-01',
          durationDays: 30,
          time: '08:00'
        }
      ];

      // Mock FileReader to test import functionality
      const mockReader = {
        readAsText: jest.fn(function(file) {
          setTimeout(() => {
            this.onload({ target: { result: JSON.stringify(importedMedicines) } });
          }, 0);
        })
      };
      
      const originalFileReader = global.FileReader;
      global.FileReader = jest.fn(() => mockReader);
      
      await storageInstance.importData({});
      
      global.FileReader = originalFileReader;

      const medicines = storageInstance.getMedicines();
      expect(medicines).toHaveLength(1);
      expect(medicines[0].name).toBe('Aspirina');
    });

    test('should reject on invalid JSON', async () => {
      const mockReader = {
        readAsText: jest.fn(function(file) {
          setTimeout(() => {
            this.onload({ target: { result: 'invalid json' } });
          }, 0);
        })
      };
      
      const originalFileReader = global.FileReader;
      global.FileReader = jest.fn(() => mockReader);
      
      await expect(storageInstance.importData({})).rejects.toThrow();
      
      global.FileReader = originalFileReader;
    });
  });
});
