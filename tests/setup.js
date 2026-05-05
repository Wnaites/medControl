// Test setup file for Jest
// Mock localStorage
const localStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock Notification API
global.Notification = class Notification {
  static permission = 'default';
  static requestPermission = jest.fn(() => Promise.resolve('granted'));
  
  constructor(title, options) {
    this.title = title;
    this.options = options;
  }
};

// Mock navigator.serviceWorker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: jest.fn(() => Promise.resolve({
      addEventListener: jest.fn()
    })),
    ready: Promise.resolve({
      showNotification: jest.fn()
    }),
    addEventListener: jest.fn()
  }
});

// Mock Blob
global.Blob = class Blob {
  constructor(data, options) {
    this.data = data;
    this.options = options;
  }
};

// Mock URL
global.URL = {
  createObjectURL: jest.fn(() => 'mock-url'),
  revokeObjectURL: jest.fn()
};

// Mock document.createElement
const originalCreateElement = document.createElement.bind(document);
document.createElement = jest.fn((tag) => {
  const element = originalCreateElement(tag);
  if (tag === 'a') {
    element.click = jest.fn();
  }
  return element;
});

// Clear mocks before each test
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});
