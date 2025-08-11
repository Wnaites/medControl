// Storage module for managing medicine data
class StorageManager {
  constructor() {
    this.storageKey = 'medcontrole_medicines';
  }

  // Save medicine to localStorage
  saveMedicine(medicine) {
    const medicines = this.getMedicines();
    
    if (medicine.id) {
      // Update existing medicine
      const index = medicines.findIndex(m => m.id === medicine.id);
      if (index !== -1) {
        medicines[index] = medicine;
      }
    } else {
      // Add new medicine
      medicine.id = this.generateId();
      medicine.createdAt = new Date().toISOString();
      medicines.push(medicine);
    }
    
    localStorage.setItem(this.storageKey, JSON.stringify(medicines));
    return medicine;
  }

  // Get all medicines
  getMedicines() {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  // Get medicine by ID
  getMedicine(id) {
    const medicines = this.getMedicines();
    return medicines.find(m => m.id === id);
  }

  // Delete medicine
  deleteMedicine(id) {
    const medicines = this.getMedicines();
    const filtered = medicines.filter(m => m.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(filtered));
  }

  // Update medicine status
  updateMedicineStatus(id, status) {
    const medicine = this.getMedicine(id);
    if (medicine) {
      medicine.status = status;
      medicine.lastUpdated = new Date().toISOString();
      this.saveMedicine(medicine);
    }
  }

  // Mark dose as taken
  markDoseTaken(medicineId, doseTime) {
    const medicine = this.getMedicine(medicineId);
    if (medicine) {
      if (!medicine.dosesTaken) {
        medicine.dosesTaken = [];
      }
      
      medicine.dosesTaken.push({
        time: doseTime,
        takenAt: new Date().toISOString()
      });
      
      this.saveMedicine(medicine);
    }
  }

  // Get doses for today
  getTodayDoses() {
    const medicines = this.getMedicines();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return medicines.filter(medicine => {
      const startDate = new Date(medicine.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + parseInt(medicine.durationDays));
      
      return today >= startDate && today <= endDate;
    });
  }

  // Get overdue medicines
  getOverdueMedicines() {
    const medicines = this.getMedicines();
    const now = new Date();
    
    return medicines.filter(medicine => {
      const lastDose = this.getLastDoseTime(medicine);
      return lastDose && lastDose < now && !this.isDoseTakenToday(medicine);
    });
  }

  // Helper methods
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getLastDoseTime(medicine) {
    const now = new Date();
    const [hours, minutes] = medicine.time.split(':');
    
    const doseTime = new Date(now);
    doseTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    return doseTime;
  }

  isDoseTakenToday(medicine) {
    if (!medicine.dosesTaken) return false;
    
    const today = new Date().toDateString();
    return medicine.dosesTaken.some(dose => 
      new Date(dose.takenAt).toDateString() === today
    );
  }

  // Export data
  exportData() {
    const medicines = this.getMedicines();
    const dataStr = JSON.stringify(medicines, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'medcontrole_backup.json';
    link.click();
    
    URL.revokeObjectURL(url);
  }

  // Import data
  importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const medicines = JSON.parse(e.target.result);
          localStorage.setItem(this.storageKey, JSON.stringify(medicines));
          resolve(medicines);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    });
  }
}

// Create global instance
const storage = new StorageManager();
