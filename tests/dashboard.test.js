// Tests for Treatment Dashboard module

const { JSDOM } = require('jsdom');

// Setup DOM environment
let dom;
let window;
let document;

beforeEach(() => {
  dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { 
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
  });
  
  window = dom.window;
  document = window.document;
  
  // Setup globals
  global.window = window;
  global.document = document;
  global.Notification = class Notification {
    static requestPermission() {
      return Promise.resolve('granted');
    }
    constructor(title, options) {}
  };
  
  // Clear localStorage
  localStorage.clear();
});

afterEach(() => {
  dom.window.close();
});

describe('TreatmentDashboard', () => {
  let storage;
  let dashboard;
  
  beforeEach(() => {
    // Import storage first
    const { StorageManager } = require('../js/storage.js');
    storage = new StorageManager();
    
    // Make storage globally available
    global.storage = storage;
    
    // Import dashboard
    const { TreatmentDashboard } = require('../js/dashboard.js');
    dashboard = new TreatmentDashboard({ storage });
  });
  
  describe('Initialization', () => {
    test('should create dashboard instance', () => {
      expect(dashboard).toBeDefined();
      expect(dashboard.storage).toBeDefined();
    });
    
    test('should initialize with default storage if not provided', () => {
      const { TreatmentDashboard } = require('../js/dashboard.js');
      const dash = new TreatmentDashboard();
      expect(dash.storage).toBeDefined();
    });
  });
  
  describe('Treatment Timeline', () => {
    test('should render empty state when no medicines', () => {
      const container = document.createElement('div');
      container.id = 'treatment-timeline';
      document.body.appendChild(container);
      
      dashboard.renderTreatmentTimeline();
      
      expect(container.innerHTML).toContain('empty-state');
      expect(container.innerHTML).toContain('Nenhum tratamento em andamento');
    });
    
    test('should render timeline for each medicine', () => {
      // Add a test medicine
      const medicine = {
        id: 'test-123',
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '7',
        time: '08:00',
        dosesTaken: []
      };
      
      storage.saveMedicine(medicine);
      
      const container = document.createElement('div');
      container.id = 'treatment-timeline';
      document.body.appendChild(container);
      
      dashboard.renderTreatmentTimeline();
      
      expect(container.innerHTML).toContain('medicine-timeline');
      expect(container.innerHTML).toContain('Aspirina');
      expect(container.innerHTML).toContain('500mg');
    });
    
    test('should calculate progress correctly', () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 3); // Started 3 days ago
      
      const medicine = {
        id: 'test-456',
        name: 'Paracetamol',
        dosage: '750mg',
        frequencyType: 'daily',
        startDate: startDate.toISOString(),
        durationDays: '10',
        time: '09:00',
        dosesTaken: []
      };
      
      storage.saveMedicine(medicine);
      
      const timelineHTML = dashboard.createMedicineTimeline(medicine);
      
      expect(timelineHTML).toContain('progress-bar');
      expect(timelineHTML).toContain('% concluído');
    });
    
    test('should show adherence percentage', () => {
      const medicine = {
        id: 'test-789',
        name: 'Ibuprofeno',
        dosage: '600mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '5',
        time: '10:00',
        dosesTaken: [
          { takenAt: new Date().toISOString() },
          { takenAt: new Date().toISOString() }
        ]
      };
      
      storage.saveMedicine(medicine);
      
      const timelineHTML = dashboard.createMedicineTimeline(medicine);
      
      expect(timelineHTML).toContain('Adesão');
      expect(timelineHTML).toContain('doses');
    });
  });
  
  describe('Day Status Calculation', () => {
    test('should mark day as completed when all doses taken', () => {
      const medicine = {
        id: 'test-day-1',
        name: 'Test Med',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '7',
        time: '08:00',
        dosesTaken: [
          { takenAt: new Date().toISOString() }
        ]
      };
      
      const today = new Date();
      const status = dashboard.getDayStatus(medicine, today, true);
      
      expect(status).toBe('completed');
    });
    
    test('should mark day as overdue when doses missed in past', () => {
      const medicine = {
        id: 'test-day-2',
        name: 'Test Med',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
        durationDays: '7',
        time: '08:00',
        dosesTaken: []
      };
      
      const yesterday = new Date(Date.now() - 86400000);
      const status = dashboard.getDayStatus(medicine, yesterday, true);
      
      expect(status).toBe('overdue');
    });
    
    test('should mark day as pending when doses not yet due', () => {
      const medicine = {
        id: 'test-day-3',
        name: 'Test Med',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '7',
        time: '20:00',
        dosesTaken: []
      };
      
      const today = new Date();
      today.setHours(10, 0, 0, 0); // Morning, dose is at 8 PM
      
      const status = dashboard.getDayStatus(medicine, today, false);
      
      expect(status).toBe('pending');
    });
  });
  
  describe('Dose Calculations', () => {
    test('should calculate total doses for daily treatment', () => {
      const medicine = {
        id: 'test-calc-1',
        name: 'Daily Med',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '10',
        time: '08:00',
        dosesTaken: []
      };
      
      const total = dashboard.calculateTotalDoses(medicine);
      expect(total).toBe(10);
    });
    
    test('should calculate total doses for custom interval treatment', () => {
      const medicine = {
        id: 'test-calc-2',
        name: 'Custom Med',
        dosage: '100mg',
        frequencyType: 'custom',
        customInterval: '8', // Every 8 hours = 3 times per day
        startDate: new Date().toISOString(),
        durationDays: '7',
        time: '08:00',
        dosesTaken: []
      };
      
      const total = dashboard.calculateTotalDoses(medicine);
      expect(total).toBe(21); // 3 doses/day * 7 days
    });
    
    test('should calculate taken doses', () => {
      const medicine = {
        id: 'test-calc-3',
        name: 'Test Med',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '7',
        time: '08:00',
        dosesTaken: [
          { takenAt: new Date().toISOString() },
          { takenAt: new Date().toISOString() },
          { takenAt: new Date().toISOString() }
        ]
      };
      
      const taken = dashboard.calculateTakenDoses(medicine);
      expect(taken).toBe(3);
    });
    
    test('should return 0 taken doses when no doses recorded', () => {
      const medicine = {
        id: 'test-calc-4',
        name: 'Test Med',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '7',
        time: '08:00',
        dosesTaken: []
      };
      
      const taken = dashboard.calculateTakenDoses(medicine);
      expect(taken).toBe(0);
    });
  });
  
  describe('Get Doses For Day', () => {
    test('should return single dose for daily frequency', () => {
      const medicine = {
        id: 'test-doses-1',
        name: 'Daily Med',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '7',
        time: '08:00',
        dosesTaken: []
      };
      
      const targetDate = new Date();
      const doses = dashboard.getDosesForDay(medicine, targetDate);
      
      expect(doses.length).toBe(1);
      expect(doses[0].getHours()).toBe(8);
    });
    
    test('should return multiple doses for custom frequency', () => {
      const medicine = {
        id: 'test-doses-2',
        name: 'Custom Med',
        dosage: '100mg',
        frequencyType: 'custom',
        customInterval: '6', // Every 6 hours = 4 times per day
        startDate: new Date().toISOString(),
        durationDays: '7',
        time: '08:00',
        dosesTaken: []
      };
      
      const targetDate = new Date();
      const doses = dashboard.getDosesForDay(medicine, targetDate);
      
      expect(doses.length).toBe(4);
    });
    
    test('should return empty array for specific-days on wrong day', () => {
      const medicine = {
        id: 'test-doses-3',
        name: 'Specific Med',
        dosage: '100mg',
        frequencyType: 'specific-days',
        specificDays: [1, 3, 5], // Mon, Wed, Fri
        startDate: new Date().toISOString(),
        durationDays: '7',
        time: '08:00',
        dosesTaken: []
      };
      
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + (7 - targetDate.getDay()) % 7 + 2); // Next Tuesday
      
      const doses = dashboard.getDosesForDay(medicine, targetDate);
      
      expect(doses.length).toBe(0);
    });
    
    test('should return empty array for weekly on wrong day', () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Last Sunday
      
      const medicine = {
        id: 'test-doses-4',
        name: 'Weekly Med',
        dosage: '100mg',
        frequencyType: 'weekly',
        startDate: startDate.toISOString(),
        durationDays: '28',
        time: '08:00',
        dosesTaken: []
      };
      
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1); // Monday (not Sunday)
      
      const doses = dashboard.getDosesForDay(medicine, targetDate);
      
      expect(doses.length).toBe(0);
    });
  });
  
  describe('All Doses Modal', () => {
    test('should open modal and populate medicine filter', () => {
      // Add test medicines
      storage.saveMedicine({
        id: 'med-1',
        name: 'Aspirina',
        dosage: '500mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '7',
        time: '08:00',
        dosesTaken: []
      });
      
      storage.saveMedicine({
        id: 'med-2',
        name: 'Paracetamol',
        dosage: '750mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '5',
        time: '09:00',
        dosesTaken: []
      });
      
      // Create modal elements
      const modal = document.createElement('div');
      modal.id = 'all-doses-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-body">
            <select id="filter-medicine"></select>
            <div id="all-doses-list"></div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      dashboard.openAllDosesModal();
      
      const filterSelect = document.getElementById('filter-medicine');
      expect(filterSelect.options.length).toBeGreaterThan(1);
      expect(modal.style.display).toBe('block');
    });
    
    test('should render all doses list sorted by time', () => {
      const medicine = {
        id: 'test-render',
        name: 'Test Med',
        dosage: '100mg',
        frequencyType: 'custom',
        customInterval: '8',
        startDate: new Date().toISOString(),
        durationDays: '2',
        time: '08:00',
        dosesTaken: []
      };
      
      storage.saveMedicine(medicine);
      
      const container = document.createElement('div');
      container.id = 'all-doses-list';
      document.body.appendChild(container);
      
      dashboard.renderAllDoses();
      
      const doseItems = container.querySelectorAll('.dose-item');
      expect(doseItems.length).toBeGreaterThan(0);
    });
    
    test('should filter doses by medicine', () => {
      const med1 = storage.saveMedicine({
        id: 'filter-med-1',
        name: 'Med 1',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '3',
        time: '08:00',
        dosesTaken: []
      });
      
      storage.saveMedicine({
        id: 'filter-med-2',
        name: 'Med 2',
        dosage: '200mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '3',
        time: '09:00',
        dosesTaken: []
      });
      
      const container = document.createElement('div');
      container.id = 'all-doses-list';
      document.body.appendChild(container);
      
      dashboard.renderAllDoses(med1.id, '');
      
      const doseItems = container.querySelectorAll('.dose-item');
      doseItems.forEach(item => {
        expect(item.innerHTML).toContain('Med 1');
      });
    });
    
    test('should filter doses by status', () => {
      const medicine = {
        id: 'filter-status-med',
        name: 'Test Med',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date(Date.now() - 86400000 * 2).toISOString(),
        durationDays: '5',
        time: '08:00',
        dosesTaken: [
          { takenAt: new Date(Date.now() - 86400000).toISOString() }
        ]
      };
      
      storage.saveMedicine(medicine);
      
      const container = document.createElement('div');
      container.id = 'all-doses-list';
      document.body.appendChild(container);
      
      dashboard.renderAllDoses('', 'taken');
      
      const takenItems = container.querySelectorAll('.dose-item.taken');
      expect(takenItems.length).toBeGreaterThan(0);
    });
  });
  
  describe('Take Dose from Dashboard', () => {
    test('should mark dose as taken and update UI', () => {
      const appMock = {
        refreshUI: jest.fn(),
        showToast: jest.fn()
      };
      
      const notificationsMock = {
        cancelMedicineNotifications: jest.fn(),
        scheduleMedicineNotifications: jest.fn()
      };
      
      const { TreatmentDashboard } = require('../js/dashboard.js');
      const dash = new TreatmentDashboard({
        storage,
        notifications: notificationsMock,
        app: appMock
      });
      
      const medicine = storage.saveMedicine({
        id: 'take-dose-med',
        name: 'Test Med',
        dosage: '100mg',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '7',
        time: '08:00',
        dosesTaken: []
      });
      
      dash.takeDoseFromDashboard(medicine.id);
      
      const updatedMed = storage.getMedicine(medicine.id);
      expect(updatedMed.dosesTaken.length).toBeGreaterThan(0);
      expect(appMock.refreshUI).toHaveBeenCalled();
      expect(appMock.showToast).toHaveBeenCalled();
    });
  });
  
  describe('Should Dose On Day', () => {
    test('should return true for daily frequency', () => {
      const medicine = {
        id: 'should-dose-1',
        name: 'Daily Med',
        frequencyType: 'daily',
        startDate: new Date().toISOString(),
        durationDays: '7'
      };
      
      const anyDay = new Date();
      expect(dashboard.shouldDoseOnDay(medicine, anyDay)).toBe(true);
    });
    
    test('should return true for specific-days on matching day', () => {
      const medicine = {
        id: 'should-dose-2',
        name: 'Specific Med',
        frequencyType: 'specific-days',
        specificDays: [1, 3, 5],
        startDate: new Date().toISOString(),
        durationDays: '7'
      };
      
      const monday = new Date();
      monday.setDate(monday.getDate() + (1 - monday.getDay() + 7) % 7);
      
      expect(dashboard.shouldDoseOnDay(medicine, monday)).toBe(true);
    });
    
    test('should return false for specific-days on non-matching day', () => {
      const medicine = {
        id: 'should-dose-3',
        name: 'Specific Med',
        frequencyType: 'specific-days',
        specificDays: [1, 3, 5],
        startDate: new Date().toISOString(),
        durationDays: '7'
      };
      
      const tuesday = new Date();
      tuesday.setDate(tuesday.getDate() + (2 - tuesday.getDay() + 7) % 7);
      
      expect(dashboard.shouldDoseOnDay(medicine, tuesday)).toBe(false);
    });
  });
});
